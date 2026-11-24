// src/services/cron.service.js
// تشغيل المهام التلقائية يومياً بدون مكتبات خارجية
import { query } from "../utils/db.js";
import { sendMulticast } from "./fcm.service.js";

// ══════════════ إعدادات التنبيهات (بتوقيت الجزائر) ══════════════
const TZ = "Africa/Algiers";
// ساعات إرسال تنبيه انتهاء الاشتراك (3 مرات يومياً: صباحاً، ظهراً، مساءً)
const EXPIRY_SLOT_HOURS = [9, 14, 19];
// الاشتراك الذي يتبقى له هذا العدد من الأيام أو أقل يُنبَّه 3 مرات يومياً، وما فوقه مرة واحدة (صباحاً)
const FULL_REPEAT_WITHIN_DAYS = 2;
// تذكير المدرب قبل الحصة بـ (دقيقة) وتذكير الرياضي قبلها بـ (دقيقة)
const COACH_REMIND_MIN = 30;
const ATHLETE_REMIND_MIN = 60;
// ساعة الملخص اليومي للمالك
const OWNER_DIGEST_HOUR = 8;

// التاريخ والساعة الآن في الجزائر
function algiersNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => parts.find(p => p.type === t)?.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}

// ✅ أرسل لكل مستخدم مرة واحدة فقط لكل "key" (يمنع التكرار عند إعادة التشغيل أو التنفيذ كل ساعة/دقيقة)
// يُدرج الإشعار في السجل (الجرس) ثم يرسل Push لمن أُدرج له فعلاً فقط
async function notifyOnce({ userIds, title, body, type, key, data = {} }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const ins = await query(
    `INSERT INTO notifications (user_id, title, body, type, metadata)
     SELECT u, $2::text, $3::text, $4::text, $5::jsonb
       FROM unnest($1::uuid[]) AS u
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications n
         WHERE n.user_id = u AND n.metadata::jsonb ->> 'key' = $6::text
      )
     RETURNING user_id`,
    [ids, title, body, type, JSON.stringify({ ...data, key }), key]
  );
  const fresh = ins.rows.map(r => r.user_id);
  if (!fresh.length) return 0;
  const tokens = await query(
    `SELECT DISTINCT token FROM user_fcm_tokens WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE`,
    [fresh]
  );
  if (tokens.rows.length) {
    await sendMulticast({
      tokens: tokens.rows.map(r => r.token), title, body,
      data: { tag: key, url: "/notifications", type },
    });
  }
  return fresh.length;
}

// ── ✅ جديد: التجديد التلقائي للاشتراكات المنتهية ─────────────
// عند وصول تاريخ انتهاء أي اشتراك نشط، يُنشأ تلقائياً اشتراك تالٍ
// بنفس الخطة والسعر، يبدأ بالضبط من تاريخ انتهاء الاشتراك السابق —
// ينطبق على كل الاشتراكات دائماً، بدون أي استثناء أو خيار تفعيل/تعطيل
// ✅ يجب أن تُستدعى قبل expireSubscriptions() لأنها تحتاج رؤية
// الاشتراكات وهي لا تزال status='active' لمعرفة تفاصيلها كاملة
async function autoRenewSubscriptions() {
  try {
    console.log("🔄 [Cron] Auto-renewing expired subscriptions...");

    const expiring = await query(`
      SELECT s.id, s.athlete_id, s.plan_id, s.price, s.end_date,
             sp.duration_days, sp.sessions_limit
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE s.status = 'active' AND s.end_date < CURRENT_DATE
    `);

    let renewed = 0;
    for (const sub of expiring.rows) {
      // ✅ تحقق أمان: هل يوجد اشتراك تالٍ بالفعل يبدأ من نفس تاريخ الانتهاء؟
      // يمنع تكرار التجديد لو أُعيد تشغيل المهمة أكثر من مرة لنفس اليوم
      const already = await query(
        `SELECT id FROM subscriptions WHERE athlete_id = $1 AND start_date = $2`,
        [sub.athlete_id, sub.end_date]
      );
      if (already.rows.length) continue;

      await query(
        `INSERT INTO subscriptions
           (athlete_id, plan_id, start_date, end_date, status,
            sessions_remaining, price, notes)
         VALUES (
           $1, $2, $3::date,
           ($3::date + ($4 || ' days')::interval)::date,
           'active', $5, $6, $7
         )`,
        [
          sub.athlete_id, sub.plan_id, sub.end_date,
          sub.duration_days, sub.sessions_limit, sub.price,
          "تجديد تلقائي",
        ]
      );
      renewed++;
    }

    if (renewed > 0) {
      console.log(`✅ [Cron] Auto-renewed ${renewed} subscriptions`);
    }
  } catch (err) {
    console.error("❌ [Cron] autoRenewSubscriptions error:", err.message);
  }
}

// ── إشعار انتهاء الاشتراكات للرياضي وأولياء أمره (3 مرات يومياً عند اقتراب الانتهاء) ──
async function notifyExpiringSubscriptions() {
  try {
    console.log("🔔 [Cron] Checking expiring subscriptions...");
    const now = algiersNow();
    // الخانة الحالية: آخر ساعة إرسال مرّت اليوم (قبل أول خانة لا إرسال)
    let slot = -1;
    EXPIRY_SLOT_HOURS.forEach((h, i) => { if (now.hour >= h) slot = i; });
    if (slot < 0) return;

    const subs = await query(
      `SELECT s.id, s.athlete_id, u.full_name AS athlete_name,
              (s.end_date - $1::date) AS days_left
         FROM subscriptions s
         JOIN users u ON u.id = s.athlete_id
        WHERE s.status = 'active' AND s.visitor_name IS NULL
          AND u.is_active = TRUE
          AND s.end_date BETWEEN $1::date AND $1::date + 3
          AND NOT EXISTS (   -- لا تنبيه إن وُجد اشتراك لاحق (مجدَّد مسبقاً)
            SELECT 1 FROM subscriptions s2
             WHERE s2.athlete_id = s.athlete_id AND s2.id <> s.id
               AND s2.status = 'active' AND s2.end_date > s.end_date)`,
      [now.date]
    );

    let sent = 0;
    for (const sub of subs.rows) {
      const days = Number(sub.days_left);
      // بعيد الانتهاء: مرة واحدة صباحاً فقط. قريب الانتهاء: في الخانات الثلاث
      if (days > FULL_REPEAT_WITHIN_DAYS && slot > 0) continue;

      const when = days <= 0 ? "ينتهي اليوم" : days === 1 ? "ينتهي غداً" : `ينتهي خلال ${days} أيام`;
      const title = days <= 1 ? "⚠️ اشتراك على وشك الانتهاء" : "اشتراك ينتهي قريباً ⚠️";
      const body = `اشتراك ${sub.athlete_name} ${when}. يرجى التجديد لتفادي توقف التدريب`;

      const ids = await query(
        `SELECT guardian_id AS id FROM guardian_athlete WHERE athlete_id = $1
         UNION SELECT $1::uuid`,
        [sub.athlete_id]
      );
      sent += await notifyOnce({
        userIds: ids.rows.map(r => r.id), title, body, type: "subscription_expiry",
        key: `exp:${sub.id}:${now.date}:${slot}`,
        data: { subscriptionId: sub.id, daysLeft: days },
      });
    }
    console.log(`✅ [Cron] Expiry notices sent: ${sent}`);
  } catch (err) {
    console.error("❌ [Cron] notifyExpiring error:", err.message);
  }
}

// ── ملخص يومي للمالك: الاشتراكات المنتهية اليوم وخلال 3 أيام ──
async function notifyOwnerDigest() {
  try {
    const now = algiersNow();
    if (now.hour < OWNER_DIGEST_HOUR) return;

    const owners = await query(`SELECT id, gym_id FROM users WHERE role = 'owner' AND is_active = TRUE`);
    for (const o of owners.rows) {
      const r = await query(
        `SELECT (s.end_date - $2::date) AS d, u.full_name
           FROM subscriptions s JOIN users u ON u.id = s.athlete_id
          WHERE u.gym_id = $1 AND s.status = 'active' AND s.visitor_name IS NULL
            AND s.end_date BETWEEN $2::date AND $2::date + 3
            AND NOT EXISTS (
              SELECT 1 FROM subscriptions s2
               WHERE s2.athlete_id = s.athlete_id AND s2.id <> s.id
                 AND s2.status = 'active' AND s2.end_date > s.end_date)
          ORDER BY s.end_date, u.full_name`,
        [o.gym_id, now.date]
      );
      if (!r.rows.length) continue;
      const today = r.rows.filter(x => Number(x.d) <= 0).length;
      const names = r.rows.slice(0, 3).map(x => x.full_name).join("، ");
      const more = r.rows.length > 3 ? ` و${r.rows.length - 3} آخرين` : "";
      await notifyOnce({
        userIds: [o.id],
        title: "📋 ملخص الاشتراكات المنتهية",
        body: `ينتهي اليوم: ${today} — خلال 3 أيام: ${r.rows.length}. ${names}${more}`,
        type: "subscription_expiry",
        key: `digest:${o.gym_id}:${now.date}`,
        data: { total: r.rows.length, today },
      });
    }
  } catch (err) {
    console.error("❌ [Cron] ownerDigest error:", err.message);
  }
}

// ── تذكير الحصص: المدرب قبل 30 دقيقة، والرياضي (وولي أمره) قبل ساعة ──
let reminding = false;
async function sendSessionReminders() {
  if (reminding) return;
  reminding = true;
  try {
    const NOW_TS = `(NOW() AT TIME ZONE '${TZ}')`;
    const sessions = await query(
      `SELECT s.id, s.gym_id, s.title, s.coach_id, s.age_category, s.age_groups,
              TO_CHAR(s.start_time, 'HH24:MI') AS hhmm,
              ROUND(EXTRACT(EPOCH FROM ((s.session_date + s.start_time) - ${NOW_TS})) / 60)::int AS mins
         FROM sessions s
        WHERE s.is_cancelled = FALSE
          AND (s.session_date + s.start_time) > ${NOW_TS}
          AND (s.session_date + s.start_time) <= ${NOW_TS} + INTERVAL '${ATHLETE_REMIND_MIN} minutes'`
    );

    for (const s of sessions.rows) {
      // المدرب
      if (s.coach_id && s.mins <= COACH_REMIND_MIN) {
        await notifyOnce({
          userIds: [s.coach_id],
          title: "⏰ تذكير بالحصة",
          body: `حصة "${s.title}" تبدأ الساعة ${s.hhmm} (بعد ${s.mins} دقيقة)`,
          type: "attendance", key: `sess-coach:${s.id}`, data: { sessionId: s.id },
        });
      }
      // الرياضيون المعنيّون بالحصة (فئة/مجموعة مطابقة أو مسجَّلون) باشتراك ساري، مع أولياء أمورهم
      const ath = await query(
        `SELECT u.id FROM users u
          WHERE u.gym_id = $1 AND u.role = 'athlete' AND u.is_active = TRUE
            AND (u.phone IS NULL OR u.phone <> '__visitor__')
            AND EXISTS (SELECT 1 FROM subscriptions sb
                         WHERE sb.athlete_id = u.id AND sb.status = 'active' AND sb.visitor_name IS NULL
                           AND sb.start_date <= (${NOW_TS})::date AND sb.end_date >= (${NOW_TS})::date)
            AND (
              EXISTS (SELECT 1 FROM session_enrollments se
                       WHERE se.session_id = $2 AND se.athlete_id = u.id AND se.status = 'enrolled')
              OR (
                ($3::text[] IS NULL OR cardinality($3::text[]) = 0 OR COALESCE(u.age_category::text,'') = ANY($3::text[]))
                AND ($4::jsonb IS NULL
                     OR NOT ($4::jsonb ? COALESCE(u.age_category::text,''))
                     OR jsonb_array_length($4::jsonb -> COALESCE(u.age_category::text,'')) = 0
                     OR ($4::jsonb -> COALESCE(u.age_category::text,'')) ? COALESCE(u.group_name::text,''))
              )
            )`,
        [s.gym_id, s.id, s.age_category, s.age_groups ? JSON.stringify(s.age_groups) : null]
      );
      if (!ath.rows.length) continue;
      const aIds = ath.rows.map(r => r.id);
      const g = await query(
        `SELECT DISTINCT guardian_id AS id FROM guardian_athlete WHERE athlete_id = ANY($1::uuid[])`, [aIds]
      );
      await notifyOnce({
        userIds: [...aIds, ...g.rows.map(r => r.id)],
        title: "⏰ تذكير بحصة اليوم",
        body: `لديك حصة "${s.title}" الساعة ${s.hhmm}`,
        type: "attendance", key: `sess-ath:${s.id}`, data: { sessionId: s.id },
      });
    }
  } catch (err) {
    console.error("❌ [Cron] sessionReminders error:", err.message);
  } finally {
    reminding = false;
  }
}

// ── دالة تحديث حالة الاشتراكات المنتهية ──────────────────────
async function expireSubscriptions() {
  try {
    const { rowCount } = await query(
      `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND end_date < CURRENT_DATE`
    );
    if (rowCount > 0) {
      console.log(`✅ [Cron] Expired ${rowCount} subscriptions`);
    }
  } catch (err) {
    console.error("❌ [Cron] expireSubscriptions error:", err.message);
  }
}

// ── دالة إشعار انتهاء اشتراك الصالة نفسها (SaaS) ──────────────
async function notifyExpiringGymSubscriptions() {
  try {
    console.log("🔔 [Cron] Checking expiring gym (SaaS) subscriptions...");

    const trialGyms = await query(`
      SELECT id, name, trial_ends_at,
             (trial_ends_at::date - CURRENT_DATE) AS days_left
      FROM gyms
      WHERE subscription_status = 'trial'
        AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
    `);

    const activeGyms = await query(`
      SELECT id, name, subscription_ends_at,
             (subscription_ends_at::date - CURRENT_DATE) AS days_left
      FROM gyms
      WHERE subscription_status = 'active'
        AND subscription_ends_at IS NOT NULL
        AND subscription_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
    `);

    const allExpiring = [
      ...trialGyms.rows.map(g => ({ ...g, kind: "trial" })),
      ...activeGyms.rows.map(g => ({ ...g, kind: "active" })),
    ];

    let notified = 0;
    for (const gym of allExpiring) {
      const title = gym.kind === "trial"
        ? "ينتهي اشتراكك التجريبي قريباً ⚠️"
        : "ينتهي اشتراكك قريباً ⚠️";
      const body = gym.kind === "trial"
        ? `فترتك التجريبية في "${gym.name}" تنتهي خلال ${gym.days_left} أيام. اشترك الآن لمتابعة الاستخدام`
        : `اشتراك صالة "${gym.name}" ينتهي خلال ${gym.days_left} أيام. يرجى التجديد لتجنب انقطاع الخدمة`;

      const owner = await query(
        "SELECT id FROM users WHERE gym_id = $1 AND role = 'owner' LIMIT 1",
        [gym.id]
      );
      if (!owner.rows.length) continue;
      const nowA = algiersNow();
      let slot = -1;
      EXPIRY_SLOT_HOURS.forEach((h, i) => { if (nowA.hour >= h) slot = i; });
      if (slot < 0) continue;
      if (Number(gym.days_left) > FULL_REPEAT_WITHIN_DAYS && slot > 0) continue;
      await notifyOnce({
        userIds: [owner.rows[0].id], title, body, type: "subscription_expiry",
        key: `gymexp:${gym.id}:${gym.kind}:${nowA.date}:${slot}`,
        data: { gymId: gym.id, kind: gym.kind, daysLeft: gym.days_left },
      });
      notified++;
    }

    console.log(`✅ [Cron] Notified ${notified} gym owners about expiring platform subscriptions`);
  } catch (err) {
    console.error("❌ [Cron] notifyExpiringGymSubscriptions error:", err.message);
  }
}

// ── الجدولة ───────────────────────────────────────────────────
export function startCronJobs() {
  // مهام ثقيلة كل ساعة (مع منع التكرار عبر notifyOnce فلا تتكرر الإشعارات)
  const HOUR_MS = 60 * 60 * 1000;
  const hourly = async () => {
    await autoRenewSubscriptions();
    await expireSubscriptions();
    await notifyExpiringSubscriptions();
    await notifyOwnerDigest();
    await notifyExpiringGymSubscriptions();
  };
  hourly();
  setInterval(hourly, HOUR_MS);

  // تذكير الحصص يُفحص كل دقيقة (خفيف، ومحمي من التكرار)
  setTimeout(sendSessionReminders, 15 * 1000);
  setInterval(sendSessionReminders, 60 * 1000);

  console.log("✅ [Cron] Jobs scheduled (hourly + session reminders every minute)");
}
