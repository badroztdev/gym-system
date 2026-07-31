// src/controllers/payments.controller.js
import { query } from "../utils/db.js";
import {
  ok, created, noContent, notFound, badRequest, serverError, paginate,
} from "../utils/response.js";

// ── GET /api/payments ───────────────────────────────────────────
export const getPayments = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, method, subscriptionId, dateFrom, dateTo } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["u.gym_id = $1"];
    const params = [gymId];
    let p = 2;

    if (subscriptionId) {
      conditions.push(`pay.subscription_id = $${p}`);
      params.push(subscriptionId); p++;
    }
    if (search) {
      conditions.push(`(u.full_name ILIKE $${p} OR u.phone ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (method) {
      conditions.push(`pay.method = $${p}`);
      params.push(method); p++;
    }
    if (dateFrom) {
      conditions.push(`pay.paid_at >= $${p}`);
      params.push(dateFrom); p++;
    }
    if (dateTo) {
      conditions.push(`pay.paid_at <= $${p}`);
      params.push(dateTo); p++;
    }

    const where = conditions.join(" AND ");

    const countRes = await query(
      `SELECT COUNT(*)
       FROM payments pay
       JOIN subscriptions s ON s.id = pay.subscription_id
       JOIN users u ON u.id = s.athlete_id
       WHERE ${where}`,
      params
    );
    const total = Number(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT
         pay.id, pay.amount, pay.method, pay.status, pay.notes,
         pay.paid_at, pay.created_at,
         s.id AS subscription_id, sp.name AS plan_name,
         u.id AS athlete_id, u.full_name AS athlete_name, u.phone AS athlete_phone,
         rec.full_name AS recorded_by_name
       FROM payments pay
       JOIN subscriptions s ON s.id = pay.subscription_id
       JOIN subscription_plans sp ON sp.id = s.plan_id
       JOIN users u ON u.id = s.athlete_id
       LEFT JOIN users rec ON rec.id = pay.recorded_by
       WHERE ${where}
       ORDER BY pay.paid_at DESC NULLS LAST, pay.created_at DESC
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

// ── POST /api/payments ──────────────────────────────────────────
export const createPayment = async (req, res) => {
  try {
    const { subscriptionId, amount, method = "cash", notes, paidAt } = req.body;
    const gymId = req.user.gym_id;

    // تحقق أن الاشتراك ينتمي لهذه الصالة، واجلب السعر والمدفوع حالياً
    const sub = await query(
      `SELECT s.id, s.price,
              COALESCE((SELECT SUM(amount) FROM payments WHERE subscription_id = s.id AND status='paid'), 0) AS total_paid
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       WHERE s.id = $1 AND u.gym_id = $2`,
      [subscriptionId, gymId]
    );
    if (!sub.rows.length) return notFound(res, "الاشتراك غير موجود");

    const { price, total_paid } = sub.rows[0];
    const remaining = Number(price) - Number(total_paid);

    if (Number(amount) <= 0)
      return badRequest(res, "يجب أن يكون المبلغ أكبر من صفر");

    if (Number(amount) > remaining + 0.01)
      return badRequest(res, `المبلغ المدخل أكبر من المتبقي (${remaining.toFixed(2)})`);

    const { rows } = await query(
      `INSERT INTO payments
         (subscription_id, amount, method, status, notes, recorded_by, paid_at)
       VALUES ($1, $2, $3, 'paid', $4, $5, COALESCE($6, NOW()))
       RETURNING *`,
      [subscriptionId, amount, method, notes || null, req.user.id, paidAt || null]
    );

    return created(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── DELETE /api/payments/:id ────────────────────────────────────
export const deletePayment = async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM payments pay
       USING subscriptions s, users u
       WHERE pay.id = $1
         AND pay.subscription_id = s.id
         AND s.athlete_id = u.id
         AND u.gym_id = $2
       RETURNING pay.id`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الدفعة غير موجودة");
    return noContent(res);
  } catch (err) {
    serverError(res, err);
  }
};

// ── GET /api/payments/stats ─────────────────────────────────────
export const getPaymentsStats = async (req, res) => {
  try {
    const gymId = req.user.gym_id;

    const { rows } = await query(
      `SELECT
         COALESCE(SUM(pay.amount) FILTER (
           WHERE pay.paid_at >= CURRENT_DATE), 0) AS today,
         COALESCE(SUM(pay.amount) FILTER (
           WHERE pay.paid_at >= DATE_TRUNC('week', NOW())), 0) AS this_week,
         COALESCE(SUM(pay.amount) FILTER (
           WHERE pay.paid_at >= DATE_TRUNC('month', NOW())), 0) AS this_month,
         COUNT(*) FILTER (
           WHERE pay.paid_at >= CURRENT_DATE) AS today_count
       FROM payments pay
       JOIN subscriptions s ON s.id = pay.subscription_id
       JOIN users u ON u.id = s.athlete_id
       WHERE u.gym_id = $1 AND pay.status = 'paid'`,
      [gymId]
    );

    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};