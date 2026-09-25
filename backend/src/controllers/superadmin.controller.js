// src/controllers/superadmin.controller.js
// لوحة تحكم المطوّر — إدارة كل الصالات المسجَّلة على المنصة
import { query, transaction } from "../utils/db.js";
import { ok, noContent, notFound, badRequest, serverError, paginate } from "../utils/response.js";
import { sendMulticast } from "../services/fcm.service.js";

// ── GET /api/superadmin/gyms ──────────────────────────────────
export const getAllGyms = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status } = req.query;

    const conditions = ["1=1"];
    const params = [];
    let p = 1;

    if (search) {
      conditions.push(`(g.name ILIKE $${p} OR g.slug ILIKE $${p} OR g.owner_email ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (status) {
      conditions.push(`g.subscription_status = $${p}`);
      params.push(status); p++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM gyms g WHERE ${conditions.join(" AND ")}`, params);
    const total = Number(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT
         g.id, g.name, g.slug, g.subscription_status, g.subscription_plan,
         g.trial_ends_at, g.subscription_ends_at, g.max_athletes,
         g.owner_email, g.created_at, g.created_by_self_signup,
         (SELECT full_name FROM users WHERE gym_id = g.id AND role = 'owner' LIMIT 1) AS owner_name,
         (SELECT phone FROM users WHERE gym_id = g.id AND role = 'owner' LIMIT 1) AS owner_phone,
         (SELECT COUNT(*) FROM users WHERE gym_id = g.id AND role = 'athlete' AND is_active = TRUE) AS athletes_count,
         (SELECT COUNT(*) FROM users WHERE gym_id = g.id AND role IN ('coach','assistant') AND is_active = TRUE) AS staff_count
       FROM gyms g
       WHERE ${conditions.join(" AND ")}
       ORDER BY g.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    return ok(res, rows, { meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/superadmin/overview ──────────────────────────────
// إحصائيات عامة للمنصة بأكملها
export const getPlatformOverview = async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*) AS total_gyms,
        COUNT(*) FILTER (WHERE subscription_status = 'trial')     AS trial_gyms,
        COUNT(*) FILTER (WHERE subscription_status = 'active')    AS active_gyms,
        COUNT(*) FILTER (WHERE subscription_status = 'suspended') AS suspended_gyms,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) AS new_this_month
      FROM gyms
    `);

    const usersStats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'athlete') AS total_athletes,
        COUNT(*) FILTER (WHERE role IN ('coach','assistant')) AS total_staff,
        COUNT(*) FILTER (WHERE role = 'owner') AS total_owners
      FROM users WHERE is_active = TRUE
    `);

    return ok(res, { ...stats.rows[0], ...usersStats.rows[0] });
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/superadmin/gyms/:id/status ─────────────────────
// تفعيل / تعليق / إلغاء صالة يدوياً (بديل الفوترة الآلية مؤقتاً)
export const updateGymStatus = async (req, res) => {
  try {
    const { status, subscriptionEndsAt, notes } = req.body;
    const validStatuses = ["trial", "active", "suspended", "cancelled"];
    if (!validStatuses.includes(status))
      return badRequest(res, `الحالة يجب أن تكون: ${validStatuses.join(" | ")}`);

    const { rows } = await query(
      `UPDATE gyms SET
         subscription_status  = $1,
         subscription_ends_at = COALESCE($2, subscription_ends_at),
         notes                = COALESCE($3, notes),
         updated_at           = NOW()
       WHERE id = $4
       RETURNING id, name, subscription_status`,
      [status, subscriptionEndsAt || null, notes || null, req.params.id]
    );

    if (!rows.length) return notFound(res, "الصالة غير موجودة");

    await query(
      `INSERT INTO gym_activity_log (gym_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.params.id,
        status === "suspended" ? "suspended" : status === "active" ? "activated" : "status_changed",
        req.user.id,
        JSON.stringify({ newStatus: status, notes }),
      ]
    );

    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/superadmin/gyms/:id/plan ───────────────────────
// تغيير خطة الاشتراك وحد الرياضيين المسموح
export const updateGymPlan = async (req, res) => {
  try {
    const { plan, maxAthletes } = req.body;

    const { rows } = await query(
      `UPDATE gyms SET
         subscription_plan = COALESCE($1, subscription_plan),
         max_athletes       = COALESCE($2, max_athletes),
         updated_at         = NOW()
       WHERE id = $3
       RETURNING id, name, subscription_plan, max_athletes`,
      [plan || null, maxAthletes || null, req.params.id]
    );

    if (!rows.length) return notFound(res, "الصالة غير موجودة");

    await query(
      `INSERT INTO gym_activity_log (gym_id, action, performed_by, details)
       VALUES ($1, 'plan_changed', $2, $3)`,
      [req.params.id, req.user.id, JSON.stringify({ plan, maxAthletes })]
    );

    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/superadmin/gyms/:id ──────────────────────────────
export const getGymDetail = async (req, res) => {
  try {
    const gymRes = await query("SELECT * FROM gyms WHERE id = $1", [req.params.id]);
    if (!gymRes.rows.length) return notFound(res, "الصالة غير موجودة");

    const owner = await query(
      "SELECT id, full_name, phone, email, last_login_at FROM users WHERE gym_id = $1 AND role = 'owner' LIMIT 1",
      [req.params.id]
    );

    const activity = await query(
      `SELECT action, details, created_at FROM gym_activity_log
       WHERE gym_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );

    const counts = await query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE gym_id=$1 AND role='athlete' AND is_active=TRUE) AS athletes,
         (SELECT COUNT(*) FROM sessions WHERE gym_id=$1) AS sessions,
         (SELECT COUNT(*) FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1 AND s.status='active') AS active_subs`,
      [req.params.id]
    );

    return ok(res, {
      ...gymRes.rows[0],
      owner: owner.rows[0] || null,
      activity: activity.rows,
      counts: counts.rows[0],
    });
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/superadmin/gyms/:id ────────────────────────────
// ✅ حذف نهائي وحقيقي لحساب الصالة (subdomain) بأكمله من قاعدة البيانات.
// هذا إجراء لا رجعة فيه إطلاقاً: يحذف الصالة وكل بياناتها المرتبطة يدوياً
// (لا توجد قيود ON DELETE CASCADE في هذه القاعدة)، بالترتيب الصحيح من
// الجداول الفرعية إلى الجذر، داخل معاملة واحدة (transaction) — إما أن
// يُحذف كل شيء بنجاح، أو لا يتغيّر شيء إطلاقاً عند أي خطأ.
//
// حماية إضافية: يُشترط إرسال "confirmSlug" مطابقاً تماماً لرابط الصالة (slug)
// حتى لا يُحذف حساب صالة بالخطأ من ضغطة زر عرضية.
export const deleteGymPermanently = async (req, res) => {
  try {
    const { confirmSlug } = req.body;

    const { rows: gymRows } = await query(`SELECT id, name, slug FROM gyms WHERE id = $1`, [req.params.id]);
    if (!gymRows.length) return notFound(res, "الصالة غير موجودة");
    const gym = gymRows[0];

    if (!confirmSlug || confirmSlug !== gym.slug) {
      return badRequest(res, "رابط الصالة (slug) المُدخَل غير مطابق. يرجى كتابة الرابط بدقة لتأكيد الحذف النهائي.");
    }

    try {
      await transaction(async (client) => {
        const gymId = gym.id;

        // كل معرّفات المستخدمين التابعين لهذه الصالة (ملاك، مدربون، مساعدون، رياضيون، أولياء أمور)
        const { rows: userRows } = await client.query(`SELECT id FROM users WHERE gym_id = $1`, [gymId]);
        const userIds = userRows.map(r => r.id);

        // كل معرّفات حصص هذه الصالة
        const { rows: sessionRows } = await client.query(`SELECT id FROM sessions WHERE gym_id = $1`, [gymId]);
        const sessionIds = sessionRows.map(r => r.id);

        // كل معرّفات اشتراكات هذه الصالة (عبر athlete_id/created_by المنتميين لها)
        const subRes = userIds.length
          ? await client.query(
              `SELECT id FROM subscriptions WHERE athlete_id = ANY($1::uuid[]) OR created_by = ANY($1::uuid[])`,
              [userIds]
            )
          : { rows: [] };
        const subscriptionIds = subRes.rows.map(r => r.id);

        // 1) الحضور — يعتمد على الحصص والمستخدمين
        if (sessionIds.length || userIds.length) {
          await client.query(
            `DELETE FROM attendance
             WHERE session_id = ANY($1::uuid[]) OR athlete_id = ANY($2::uuid[]) OR recorded_by = ANY($2::uuid[])`,
            [sessionIds, userIds]
          );
        }

        // 2) تسجيلات الحصص
        if (sessionIds.length || userIds.length) {
          await client.query(
            `DELETE FROM session_enrollments
             WHERE session_id = ANY($1::uuid[]) OR athlete_id = ANY($2::uuid[])`,
            [sessionIds, userIds]
          );
        }

        // 3) سجلّ تغييرات الرتب
        if (userIds.length) {
          await client.query(
            `DELETE FROM rank_history WHERE athlete_id = ANY($1::uuid[]) OR changed_by = ANY($1::uuid[])`,
            [userIds]
          );
        }

        // 4) متابعة التقدّم الرياضي
        if (userIds.length) {
          await client.query(
            `DELETE FROM athlete_progress WHERE athlete_id = ANY($1::uuid[]) OR coach_id = ANY($1::uuid[])`,
            [userIds]
          );
        }

        // 5) روابط أولياء الأمور بالرياضيين
        if (userIds.length) {
          await client.query(
            `DELETE FROM guardian_athlete WHERE athlete_id = ANY($1::uuid[]) OR guardian_id = ANY($1::uuid[])`,
            [userIds]
          );
        }

        // 6) الإشعارات
        if (userIds.length) {
          await client.query(`DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`, [userIds]);
        }

        // 7) توكنات إشعارات الجوال (FCM)
        if (userIds.length) {
          await client.query(`DELETE FROM user_fcm_tokens WHERE user_id = ANY($1::uuid[])`, [userIds]);
        }

        // 8) المدفوعات — تعتمد على الاشتراكات والمستخدمين
        if (subscriptionIds.length || userIds.length) {
          await client.query(
            `DELETE FROM payments
             WHERE subscription_id = ANY($1::uuid[]) OR recorded_by = ANY($2::uuid[])`,
            [subscriptionIds, userIds]
          );
        }

        // 9) الاشتراكات
        if (subscriptionIds.length) {
          await client.query(`DELETE FROM subscriptions WHERE id = ANY($1::uuid[])`, [subscriptionIds]);
        }

        // 10) الحصص (بعد حذف كل ما يعتمد عليها)
        await client.query(`DELETE FROM sessions WHERE gym_id = $1`, [gymId]);

        // 11) خطط الاشتراك
        await client.query(`DELETE FROM subscription_plans WHERE gym_id = $1`, [gymId]);

        // 12) القاعات
        await client.query(`DELETE FROM rooms WHERE gym_id = $1`, [gymId]);

        // 13) الفئات الرياضية
        await client.query(`DELETE FROM sport_categories WHERE gym_id = $1`, [gymId]);

        // 14) قوالب مقاييس التقدّم
        await client.query(`DELETE FROM metric_templates WHERE gym_id = $1`, [gymId]);

        // 15) قوالب الإشعارات
        await client.query(`DELETE FROM notification_templates WHERE gym_id = $1`, [gymId]);

        // 16) سجلّ نشاط الصالة
        await client.query(`DELETE FROM gym_activity_log WHERE gym_id = $1`, [gymId]);

        // 17) المستخدمون (ملاك، مدربون، مساعدون، رياضيون، أولياء أمور)
        await client.query(`DELETE FROM users WHERE gym_id = $1`, [gymId]);

        // 18) الصالة نفسها
        await client.query(`DELETE FROM gyms WHERE id = $1`, [gymId]);
      });
    } catch (fkErr) {
      // 23503 = foreign_key_violation في PostgreSQL — يعني وجود جدول آخر
      // لم يُدرَج في ترتيب الحذف أعلاه ولا يزال يُشير لبيانات هذه الصالة.
      // بفضل الـ transaction، لم يُحذف أي شيء عند هذا الخطأ (تراجع كامل تلقائي).
      if (fkErr.code === "23503") {
        return badRequest(
          res,
          `تعذّر حذف الصالة نهائياً بسبب قيد ربط في قاعدة البيانات لم يُؤخَذ بعين الاعتبار (${fkErr.table || fkErr.detail || "جدول غير معروف"}). لم يتم حذف أي بيانات (تراجع تلقائي كامل). يرجى إبلاغ المطوّر بهذه الرسالة لإضافة الجدول الناقص لترتيب الحذف.`
        );
      }
      throw fkErr;
    }

    return noContent(res);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/superadmin/notify ────────────────────────────────
// يرسل إشعاراً من المطوّر لملّاك صالة/صالات محدَّدة (أو الجميع)
export const sendNotificationToOwners = async (req, res) => {
  try {
    const { gymIds, title, body, sendToAll } = req.body;
    if (!title?.trim() || !body?.trim())
      return badRequest(res, "العنوان والنص مطلوبان");

    // حدّد الصالات المستهدفة
    let targetGymIds = gymIds;
    if (sendToAll) {
      const all = await query("SELECT id FROM gyms");
      targetGymIds = all.rows.map(r => r.id);
    }
    if (!targetGymIds?.length)
      return badRequest(res, "يرجى تحديد صالة واحدة على الأقل");

    // جلب حسابات الملّاك لهذه الصالات
    const owners = await query(
      `SELECT id, gym_id, full_name FROM users
       WHERE gym_id = ANY($1::uuid[]) AND role = 'owner'`,
      [targetGymIds]
    );
    if (!owners.rows.length)
      return badRequest(res, "لم يُعثر على أي مالك للصالات المحددة");

    // احفظ الإشعار في قاعدة البيانات لكل مالك
    for (const owner of owners.rows) {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, metadata)
         VALUES ($1, $2, $3, 'general', $4)`,
        [owner.id, title, body, JSON.stringify({ fromSuperAdmin: true })]
      );
    }

    // أرسل Push عبر Firebase لمن لديه توكن مسجَّل
    const tokensRes = await query(
      `SELECT token FROM user_fcm_tokens
       WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE`,
      [owners.rows.map(o => o.id)]
    );
    const result = tokensRes.rows.length
      ? await sendMulticast({ tokens: tokensRes.rows.map(r => r.token), title, body })
      : { sent: 0 };

    return ok(res, {
      saved: owners.rows.length,
      pushed: result.sent || 0,
      message: `تم إرسال الإشعار لـ ${owners.rows.length} مالك صالة`,
    });
  } catch (err) { serverError(res, err); }
};