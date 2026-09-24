// src/controllers/categories.controller.js
import { query } from "../utils/db.js";
import { ok, created, noContent, notFound, badRequest, serverError } from "../utils/response.js";

// ── GET /api/categories ──────────────────────────────────────────
export const getCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const conditions = ["gym_id = $1"];
    if (includeInactive !== "true") conditions.push("is_active = TRUE");

    const { rows } = await query(
      `SELECT c.id, c.name, c.color, c.icon, c.is_active,
              (SELECT COUNT(*) FROM subscription_plans sp WHERE sp.category_id = c.id) AS plans_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.category_id = c.id AND s.is_cancelled = FALSE) AS sessions_count
       FROM sport_categories c
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.is_active DESC, c.name`,
      [req.user.gym_id]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/categories ─────────────────────────────────────────
export const createCategory = async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return badRequest(res, "اسم الفئة مطلوب");

    const { rows } = await query(
      `INSERT INTO sport_categories (gym_id, name, color, icon)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.gym_id, name, color || "#6366f1", icon || null]
    );
    return created(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/categories/:id ────────────────────────────────────
export const updateCategory = async (req, res) => {
  try {
    const { name, color, icon, isActive } = req.body;
    const { rows } = await query(
      `UPDATE sport_categories SET
         name      = COALESCE($1, name),
         color     = COALESCE($2, color),
         icon      = COALESCE($3, icon),
         is_active = COALESCE($4, is_active)
       WHERE id = $5 AND gym_id = $6
       RETURNING *`,
      [name || null, color || null, icon || null, isActive ?? null, req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الفئة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/categories/:id ───────────────────────────────────
export const deleteCategory = async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE sport_categories SET is_active = FALSE WHERE id = $1 AND gym_id = $2 RETURNING id`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الفئة غير موجودة");
    return noContent(res);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/categories/:id/permanent ─────────────────────────
// ✅ حذف نهائي حقيقي من قاعدة البيانات — لا رجعة فيه.
// يُسمح به فقط إذا لم تعد الفئة مرتبطة بأي خطة اشتراك أو حصة (سابقة أو حالية)،
// لتفادي كسر سجلّات الخطط أو الحصص التي لا تزال تُشير لفئة محذوفة.
export const deleteCategoryPermanently = async (req, res) => {
  try {
    const { rows: catRows } = await query(
      `SELECT id FROM sport_categories WHERE id = $1 AND gym_id = $2`,
      [req.params.id, req.user.gym_id]
    );
    if (!catRows.length) return notFound(res, "الفئة غير موجودة");

    const { rows: planRows } = await query(
      `SELECT COUNT(*)::int AS count FROM subscription_plans WHERE category_id = $1`,
      [req.params.id]
    );
    const linkedPlans = planRows[0].count;

    const { rows: sessionRows } = await query(
      `SELECT COUNT(*)::int AS count FROM sessions WHERE category_id = $1`,
      [req.params.id]
    );
    const linkedSessions = sessionRows[0].count;

    if (linkedPlans > 0 || linkedSessions > 0) {
      const parts = [];
      if (linkedPlans > 0) parts.push(`${linkedPlans} خطة اشتراك`);
      if (linkedSessions > 0) parts.push(`${linkedSessions} حصة`);
      return badRequest(
        res,
        `لا يمكن حذف هذه الفئة نهائياً لأنها مرتبطة بـ ${parts.join(" و")}. يمكنك تعطيلها بدل حذفها، أو حذف/تعديل تلك العناصر أولاً.`
      );
    }

    await query(`DELETE FROM sport_categories WHERE id = $1 AND gym_id = $2`, [req.params.id, req.user.gym_id]);
    return noContent(res);
  } catch (err) { serverError(res, err); }
};