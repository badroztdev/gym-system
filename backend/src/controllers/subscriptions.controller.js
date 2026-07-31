// src/controllers/subscriptions.controller.js
import { query } from "../utils/db.js";
import {
  ok, created, notFound, badRequest, serverError, paginate,
} from "../utils/response.js";

// ── GET /api/subscriptions ─────────────────────────────────────
export const getSubscriptions = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status, paymentStatus, athleteId } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["u.gym_id = $1"];
    const params = [gymId];
    let p = 2;

    if (athleteId) {
      conditions.push(`s.athlete_id = $${p}`);
      params.push(athleteId); p++;
    }
    if (search) {
      conditions.push(`(u.full_name ILIKE $${p} OR u.phone ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (status === "active") {
      conditions.push(`s.status = 'active' AND s.end_date >= CURRENT_DATE`);
    } else if (status === "expiring") {
      conditions.push(`s.status = 'active' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`);
    } else if (status === "expired") {
      conditions.push(`(s.status = 'expired' OR (s.status = 'active' AND s.end_date < CURRENT_DATE))`);
    } else if (status === "cancelled") {
      conditions.push(`s.status = 'cancelled'`);
    } else if (status === "suspended") {
      conditions.push(`s.status = 'suspended'`);
    }

    // فلتر حالة الدفع يُطبَّق بعد حساب total_paid (LATERAL JOIN) — نستخدم HAVING-like عبر WHERE على alias في subquery خارجي
    const where = conditions.join(" AND ");

    let paymentFilter = "";
    if (paymentStatus === "paid")    paymentFilter = "WHERE x.remaining <= 0";
    if (paymentStatus === "partial") paymentFilter = "WHERE x.remaining > 0 AND x.total_paid > 0";
    if (paymentStatus === "unpaid")  paymentFilter = "WHERE x.total_paid = 0";

    const baseQuery = `
      SELECT
        s.id, s.athlete_id, u.full_name AS athlete_name, u.phone AS athlete_phone,
        s.plan_id, sp.name AS plan_name,
        s.start_date, s.end_date, s.status, s.sessions_remaining,
        sp.sessions_limit, s.price, s.notes, s.created_at,
        COALESCE(pay.total_paid, 0) AS total_paid,
        (s.price - COALESCE(pay.total_paid, 0)) AS remaining
      FROM subscriptions s
      JOIN users u ON u.id = s.athlete_id
      JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS total_paid
        FROM payments
        WHERE subscription_id = s.id AND status = 'paid'
      ) pay ON TRUE
      WHERE ${where}
    `;

    // عدد الإجمالي (مع فلتر الدفع)
    const countRes = await query(
      `SELECT COUNT(*) FROM (${baseQuery}) x ${paymentFilter}`,
      params
    );
    const total = Number(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT * FROM (${baseQuery}) x ${paymentFilter}
       ORDER BY x.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    return ok(res, rows, {
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    serverError(res, err);
  }
};

// ── GET /api/subscriptions/:id ─────────────────────────────────
export const getSubscription = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         s.*, u.full_name AS athlete_name, u.phone AS athlete_phone,
         sp.name AS plan_name, sp.sessions_limit,
         COALESCE(pay.total_paid, 0) AS total_paid,
         (s.price - COALESCE(pay.total_paid, 0)) AS remaining
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN LATERAL (
         SELECT SUM(amount) AS total_paid FROM payments
         WHERE subscription_id = s.id AND status = 'paid'
       ) pay ON TRUE
       WHERE s.id = $1 AND u.gym_id = $2`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الاشتراك غير موجود");

    const payments = await query(
      `SELECT id, amount, method, status, notes, paid_at, created_at
       FROM payments WHERE subscription_id = $1
       ORDER BY paid_at DESC NULLS LAST, created_at DESC`,
      [req.params.id]
    );

    return ok(res, { ...rows[0], payments: payments.rows });
  } catch (err) {
    serverError(res, err);
  }
};

// ── POST /api/subscriptions ────────────────────────────────────
export const createSubscription = async (req, res) => {
  try {
    const { athleteId, planId, startDate, price, notes } = req.body;
    const gymId = req.user.gym_id;

    // تحقق أن الرياضي موجود في نفس الصالة
    const athlete = await query(
      "SELECT id FROM users WHERE id = $1 AND gym_id = $2",
      [athleteId, gymId]
    );
    if (!athlete.rows.length) return badRequest(res, "الرياضي غير موجود");

    // تحقق من الخطة
    const plan = await query(
      "SELECT * FROM subscription_plans WHERE id = $1 AND gym_id = $2 AND is_active = TRUE",
      [planId, gymId]
    );
    if (!plan.rows.length) return badRequest(res, "الخطة غير موجودة أو معطّلة");

    const p = plan.rows[0];
    const finalPrice = price !== undefined && price !== null && price !== "" ? price : p.price;
    const start = startDate || new Date().toISOString().slice(0, 10);

    const { rows } = await query(
      `INSERT INTO subscriptions
         (athlete_id, plan_id, start_date, end_date, status,
          sessions_remaining, price, notes, created_by)
       VALUES (
         $1, $2, $3::date,
         ($3::date + ($4 || ' days')::interval)::date,
         'active', $5, $6, $7, $8
       )
       RETURNING *`,
      [athleteId, planId, start, p.duration_days, p.sessions_limit, finalPrice, notes || null, req.user.id]
    );

    return created(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── PATCH /api/subscriptions/:id ───────────────────────────────
export const updateSubscription = async (req, res) => {
  try {
    const { status, endDate, price, notes, sessionsRemaining } = req.body;

    const { rows } = await query(
      `UPDATE subscriptions s SET
         status             = COALESCE($1, s.status),
         end_date           = COALESCE($2, s.end_date),
         price              = COALESCE($3, s.price),
         notes              = COALESCE($4, s.notes),
         sessions_remaining = COALESCE($5, s.sessions_remaining),
         updated_at         = NOW()
       WHERE s.id = $6
         AND s.athlete_id IN (SELECT id FROM users WHERE gym_id = $7)
       RETURNING s.*`,
      [
        status || null, endDate || null, price ?? null,
        notes || null, sessionsRemaining ?? null,
        req.params.id, req.user.gym_id,
      ]
    );

    if (!rows.length) return notFound(res, "الاشتراك غير موجود");
    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── GET /api/subscriptions/stats ───────────────────────────────
export const getSubscriptionStats = async (req, res) => {
  try {
    const gymId = req.user.gym_id;

    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE s.status = 'active' AND s.end_date >= CURRENT_DATE) AS active_count,
         COUNT(*) FILTER (WHERE s.status = 'active' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS expiring_count,
         COUNT(*) FILTER (WHERE s.status = 'active' AND s.end_date < CURRENT_DATE) AS expired_count,
         COALESCE(SUM(s.price) FILTER (WHERE s.status = 'active'), 0) AS active_revenue_expected,
         COALESCE(SUM(s.price - COALESCE(pay.total_paid,0)) FILTER (WHERE s.status = 'active'), 0) AS total_due
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       LEFT JOIN LATERAL (
         SELECT SUM(amount) AS total_paid FROM payments
         WHERE subscription_id = s.id AND status = 'paid'
       ) pay ON TRUE
       WHERE u.gym_id = $1`,
      [gymId]
    );

    // إيرادات هذا الشهر (من المدفوعات الفعلية)
    const revenue = await query(
      `SELECT COALESCE(SUM(p.amount), 0) AS revenue_this_month
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       JOIN users u ON u.id = s.athlete_id
       WHERE u.gym_id = $1 AND p.status = 'paid'
         AND p.paid_at >= DATE_TRUNC('month', NOW())`,
      [gymId]
    );

    return ok(res, { ...rows[0], ...revenue.rows[0] });
  } catch (err) {
    serverError(res, err);
  }
};