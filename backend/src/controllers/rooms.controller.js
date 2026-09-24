// src/controllers/rooms.controller.js
import { query } from "../utils/db.js";
import { ok, created, noContent, notFound, badRequest, serverError } from "../utils/response.js";
import { randomBytes } from "crypto";

const generateQR = () => `GYM_ROOM_${randomBytes(8).toString("hex").toUpperCase()}`;

// ── GET /api/rooms ─────────────────────────────────────────────
export const getRooms = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.name, r.capacity, r.qr_code, r.is_active, r.created_at,
              (SELECT COUNT(*) FROM sessions s
               WHERE s.room_id = r.id
                 AND s.session_date = CURRENT_DATE) AS sessions_today
       FROM rooms r
       WHERE r.gym_id = $1
       ORDER BY r.is_active DESC, r.name`,
      [req.user.gym_id]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/rooms ────────────────────────────────────────────
export const createRoom = async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name) return badRequest(res, "اسم القاعة مطلوب");
    const { rows } = await query(
      `INSERT INTO rooms (gym_id, name, capacity, qr_code)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.gym_id, name, capacity || 20, generateQR()]
    );
    return created(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/rooms/:id ───────────────────────────────────────
export const updateRoom = async (req, res) => {
  try {
    const { name, capacity, isActive } = req.body;
    const { rows } = await query(
      `UPDATE rooms SET
         name      = COALESCE($1, name),
         capacity  = COALESCE($2, capacity),
         is_active = COALESCE($3, is_active)
       WHERE id = $4 AND gym_id = $5 RETURNING *`,
      [name || null, capacity || null, isActive ?? null, req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "القاعة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/rooms/:id ──────────────────────────────────────
// تعطيل فقط (soft delete) — القاعة تبقى في قاعدة البيانات وتُخفى من الاستخدام النشط
export const deleteRoom = async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE rooms SET is_active = FALSE WHERE id = $1 AND gym_id = $2 RETURNING id`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "القاعة غير موجودة");
    return noContent(res);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/rooms/:id/permanent ────────────────────────────
// ✅ حذف نهائي حقيقي من قاعدة البيانات — لا رجعة فيه.
// يُسمح به فقط إذا لم تعد القاعة مرتبطة بأي حصة (سابقة أو حالية)، لتفادي
// كسر سجلّات الحضور التاريخية أو حصص لا تزال تُشير لقاعة محذوفة.
export const deleteRoomPermanently = async (req, res) => {
  try {
    const { rows: roomRows } = await query(
      `SELECT id FROM rooms WHERE id = $1 AND gym_id = $2`,
      [req.params.id, req.user.gym_id]
    );
    if (!roomRows.length) return notFound(res, "القاعة غير موجودة");

    const { rows: sessionRows } = await query(
      `SELECT COUNT(*)::int AS count FROM sessions WHERE room_id = $1`,
      [req.params.id]
    );
    const linkedSessions = sessionRows[0].count;
    if (linkedSessions > 0) {
      return badRequest(
        res,
        `لا يمكن حذف هذه القاعة نهائياً لأنها مرتبطة بـ ${linkedSessions} حصة (سابقة أو حالية). يمكنك تعطيلها بدل حذفها، أو حذف/تعديل تلك الحصص أولاً.`
      );
    }

    await query(`DELETE FROM rooms WHERE id = $1 AND gym_id = $2`, [req.params.id, req.user.gym_id]);
    return noContent(res);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/rooms/:id/regenerate-qr ─────────────────────────
export const regenerateQR = async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE rooms SET qr_code = $1 WHERE id = $2 AND gym_id = $3 RETURNING *`,
      [generateQR(), req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "القاعة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};