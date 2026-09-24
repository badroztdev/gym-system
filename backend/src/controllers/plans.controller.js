// src/controllers/plans.controller.js
import { query } from "../utils/db.js";
import { ok, created, noContent, notFound, badRequest, serverError } from "../utils/response.js";

// ── GET /api/plans ─────────────────────────────────────────────
export const getPlans = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const conditions = ["p.gym_id = $1"];
    if (includeInactive !== "true") conditions.push("p.is_active = TRUE");

    const { rows } = await query(
      `SELECT
         p.id, p.name, p.description, p.duration_days, p.price,
         p.sessions_limit, p.is_active, p.created_at,
         p.category_id, c.name AS category_name, c.color AS category_color,
         (SELECT COUNT(*) FROM subscriptions s
            WHERE s.plan_id = p.id AND s.status = 'active') AS active_subscriptions
       FROM subscription_plans p
       LEFT JOIN sport_categories c ON c.id = p.category_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.is_active DESC, p.price ASC`,
      [req.user.gym_id]
    );
    return ok(res, rows);
  } catch (err) {
    serverError(res, err);
  }
};

// ── POST /api/plans ────────────────────────────────────────────
export const createPlan = async (req, res) => {
  try {
    const { name, description, durationDays, price, sessionsLimit, categoryId } = req.body;

    const { rows } = await query(
      `INSERT INTO subscription_plans
         (gym_id, name, description, duration_days, price, sessions_limit, category_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        req.user.gym_id, name, description || null,
        durationDays, price,
        sessionsLimit === "" || sessionsLimit === undefined ? null : sessionsLimit,
        categoryId || null,
      ]
    );
    return created(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── PATCH /api/plans/:id ───────────────────────────────────────
export const updatePlan = async (req, res) => {
  try {
    const { name, description, durationDays, price, sessionsLimit, categoryId, isActive } = req.body;

    const { rows } = await query(
      `UPDATE subscription_plans SET
         name           = COALESCE($1, name),
         description    = $2,
         duration_days  = COALESCE($3, duration_days),
         price          = COALESCE($4, price),
         sessions_limit = $5,
         category_id    = $6,
         is_active      = COALESCE($7, is_active),
         updated_at     = NOW()
       WHERE id = $8 AND gym_id = $9
       RETURNING *`,
      [
        name || null,
        description || null,
        durationDays || null,
        price ?? null,
        sessionsLimit === "" || sessionsLimit === undefined ? null : sessionsLimit,
        categoryId || null,
        isActive ?? null,
        req.params.id, req.user.gym_id,
      ]
    );

    if (!rows.length) return notFound(res, "الخطة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── DELETE /api/plans/:id  (soft delete) ───────────────────────
export const deletePlan = async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE subscription_plans
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND gym_id = $2
       RETURNING id`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الخطة غير موجودة");
    return noContent(res);
  } catch (err) {
    serverError(res, err);
  }
};

// ── DELETE /api/plans/:id/permanent ────────────────────────────
// ✅ حذف نهائي حقيقي من قاعدة البيانات — لا رجعة فيه.
// يُسمح به فقط إذا لم تعد الخطة مرتبطة بأي اشتراك (سابق أو حالي)، لتفادي
// كسر سجلّات الاشتراكات والمدفوعات التاريخية.
export const deletePlanPermanently = async (req, res) => {
  try {
    const { rows: planRows } = await query(
      `SELECT id FROM subscription_plans WHERE id = $1 AND gym_id = $2`,
      [req.params.id, req.user.gym_id]
    );
    if (!planRows.length) return notFound(res, "الخطة غير موجودة");

    const { rows: subRows } = await query(
      `SELECT COUNT(*)::int AS count FROM subscriptions WHERE plan_id = $1`,
      [req.params.id]
    );
    const linkedSubs = subRows[0].count;
    if (linkedSubs > 0) {
      return badRequest(
        res,
        `لا يمكن حذف هذه الخطة نهائياً لأنها مرتبطة بـ ${linkedSubs} اشتراك (سابق أو حالي). يمكنك تعطيلها بدل حذفها، أو حذف تلك الاشتراكات أولاً.`
      );
    }

    await query(`DELETE FROM subscription_plans WHERE id = $1 AND gym_id = $2`, [req.params.id, req.user.gym_id]);
    return noContent(res);
  } catch (err) {
    serverError(res, err);
  }
};