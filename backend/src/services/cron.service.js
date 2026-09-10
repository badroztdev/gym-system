// src/services/cron.service.js
// تشغيل المهام التلقائية يومياً بدون مكتبات خارجية
import { query } from "../utils/db.js";
import { sendMulticast, NotificationTemplates } from "./fcm.service.js";

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

// ── دالة إشعار انتهاء الاشتراكات ─────────────────────────────
async function notifyExpiringSubscriptions() {
  try {
    console.log("🔔 [Cron] Checking expiring subscriptions...");

    const subs = await query(
      `SELECT s.id, s.athlete_id, u.full_name AS athlete_name,
              u.gym_id, (s.end_date - CURRENT_DATE) AS days_left
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       WHERE s.status = 'active'
         AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'`
    );

    for (const sub of subs.rows) {
      const tpl = NotificationTemplates.subscriptionExpiring(sub.athlete_name, sub.days_left);

      const ids = await query(
        `SELECT guardian_id AS id FROM guardian_athlete WHERE athlete_id = $1
         UNION SELECT $1::uuid`,
        [sub.athlete_id]
      );

      for (const { id } of ids.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type, metadata)
           VALUES ($1,$2,$3,'subscription_expiry',$4)
           ON CONFLICT DO NOTHING`,
          [id, tpl.title, tpl.body, JSON.stringify({ subscriptionId: sub.id, daysLeft: sub.days_left })]
        );
      }

      const tokens = await query(
        `SELECT token FROM user_fcm_tokens WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE`,
        [ids.rows.map(r => r.id)]
      );
      if (tokens.rows.length) {
        await sendMulticast({ tokens: tokens.rows.map(r => r.token), ...tpl });
      }
    }

    console.log(`✅ [Cron] Notified ${subs.rows.length} expiring subscriptions`);
  } catch (err) {
    console.error("❌ [Cron] notifyExpiring error:", err.message);
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
      const ownerId = owner.rows[0].id;

      await query(
        `INSERT INTO notifications (user_id, title, body, type, metadata)
         VALUES ($1, $2, $3, 'subscription_expiry', $4)`,
        [ownerId, title, body, JSON.stringify({ gymId: gym.id, kind: gym.kind, daysLeft: gym.days_left })]
      );

      const tokens = await query(
        "SELECT token FROM user_fcm_tokens WHERE user_id = $1 AND is_active = TRUE",
        [ownerId]
      );
      if (tokens.rows.length) {
        await sendMulticast({ tokens: tokens.rows.map(r => r.token), title, body });
      }
      notified++;
    }

    console.log(`✅ [Cron] Notified ${notified} gym owners about expiring platform subscriptions`);
  } catch (err) {
    console.error("❌ [Cron] notifyExpiringGymSubscriptions error:", err.message);
  }
}

// ── تشغيل المهام كل 24 ساعة ───────────────────────────────────
export function startCronJobs() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 ساعة

  // تشغيل فوري عند بدء الخادم
  // ✅ التجديد التلقائي يجب أن يعمل أولاً، قبل expireSubscriptions
  autoRenewSubscriptions();
  expireSubscriptions();
  notifyExpiringSubscriptions();
  notifyExpiringGymSubscriptions();

  // جدولة يومية
  setInterval(async () => {
    await autoRenewSubscriptions();
    await expireSubscriptions();
    await notifyExpiringSubscriptions();
    await notifyExpiringGymSubscriptions();
  }, INTERVAL_MS);

  console.log("✅ [Cron] Daily jobs scheduled (every 24h)");
}
