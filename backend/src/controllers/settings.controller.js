// src/controllers/settings.controller.js
import bcrypt from "bcryptjs";
import { query } from "../utils/db.js";
import { ok, badRequest, notFound, serverError } from "../utils/response.js";

// ══ معلومات الصالة ═══════════════════════════════════════════

// ── GET /api/settings/gym ────────────────────────────────────
export const getGymSettings = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, address, phone, email, logo_url, settings, created_at
       FROM gyms WHERE id = $1`,
      [req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الصالة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/settings/gym ──────────────────────────────────
export const updateGymSettings = async (req, res) => {
  try {
    const { name, address, phone, email, logoUrl } = req.body;

    const { rows } = await query(
      `UPDATE gyms SET
         name       = COALESCE($1, name),
         address    = COALESCE($2, address),
         phone      = COALESCE($3, phone),
         email      = COALESCE($4, email),
         logo_url   = COALESCE($5, logo_url),
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, address, phone, email, logo_url, settings`,
      [name || null, address || null, phone || null, email || null, logoUrl || null, req.user.gym_id]
    );
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/settings/gym/preferences ──────────────────────
// تحديث الإعدادات العامة (currency, timezone, qr validity...) داخل حقل JSONB settings
export const updateGymPreferences = async (req, res) => {
  try {
    const { currency, timezone, qrValidityMinutes, weekStartsOn } = req.body;

    const current = await query("SELECT settings FROM gyms WHERE id=$1", [req.user.gym_id]);
    const existing = current.rows[0]?.settings || {};

    const updated = {
      ...existing,
      ...(currency !== undefined && { currency }),
      ...(timezone !== undefined && { timezone }),
      ...(qrValidityMinutes !== undefined && { session_qr_validity_minutes: qrValidityMinutes }),
      ...(weekStartsOn !== undefined && { week_starts_on: weekStartsOn }),
    };

    const { rows } = await query(
      `UPDATE gyms SET settings = $1, updated_at = NOW() WHERE id = $2 RETURNING settings`,
      [JSON.stringify(updated), req.user.gym_id]
    );
    return ok(res, rows[0].settings);
  } catch (err) { serverError(res, err); }
};

// ══ الملف الشخصي ═════════════════════════════════════════════

// ── GET /api/settings/profile ────────────────────────────────
export const getMyProfile = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, full_name, phone, email, avatar_url, role, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/settings/profile ──────────────────────────────
export const updateMyProfile = async (req, res) => {
  try {
    const { fullName, email, avatarUrl } = req.body;

    const { rows } = await query(
      `UPDATE users SET
         full_name  = COALESCE($1, full_name),
         email      = COALESCE($2, email),
         avatar_url = COALESCE($3, avatar_url),
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, full_name, phone, email, avatar_url, role`,
      [fullName || null, email || null, avatarUrl || null, req.user.id]
    );
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/settings/change-password ───────────────────────
export const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return badRequest(res, "كلمة المرور الحالية والجديدة مطلوبتان");
    if (newPassword.length < 6)
      return badRequest(res, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");

    const user = await query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!valid) return badRequest(res, "كلمة المرور الحالية غير صحيحة");

    const hash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [hash, req.user.id]);

    return ok(res, { changed: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) { serverError(res, err); }
};