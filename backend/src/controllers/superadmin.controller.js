// src/controllers/superadmin.controller.js
// لوحة تحكم المطوّر — إدارة كل الصالات المسجَّلة على المنصة
import { query } from "../utils/db.js";
import { ok, notFound, badRequest, serverError, paginate } from "../utils/response.js";

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