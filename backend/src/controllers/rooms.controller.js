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