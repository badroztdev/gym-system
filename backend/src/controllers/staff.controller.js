// src/controllers/staff.controller.js
import bcrypt from "bcrypt";
import { query } from "../utils/db.js";
import { ok, created, noContent, notFound, badRequest, serverError } from "../utils/response.js";

// ── GET /api/staff ──────────────────────────────────────────────
// يعرض المدربين والمساعدين (وأحياناً المالك) في الصالة
export const getStaff = async (req, res) => {
  try {
    const { role, includeInactive } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["gym_id = $1", "role IN ('coach','assistant','owner')"];
    const params = [gymId];
    let p = 2;

    if (role) {
      conditions.push(`role = $${p}`);
      params.push(role); p++;
    }
    if (includeInactive !== "true") {
      conditions.push("is_active = TRUE");
    }

    const { rows } = await query(
      `SELECT id, full_name, phone, email, role, avatar_url,
              is_active, last_login_at, created_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.coach_id = users.id AND s.is_cancelled = FALSE) AS sessions_count
       FROM users
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE role WHEN 'owner' THEN 0 WHEN 'coach' THEN 1 ELSE 2 END,
         full_name`,
      params
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/staff/:id ──────────────────────────────────────────
export const getStaffMember = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, full_name, phone, email, role, avatar_url, is_active, created_at
       FROM users
       WHERE id = $1 AND gym_id = $2 AND role IN ('coach','assistant','owner')`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "العضو غير موجود");

    const sessions = await query(
      `SELECT id, title, session_date, start_time, end_time
       FROM sessions
       WHERE coach_id = $1 AND is_cancelled = FALSE AND session_date >= CURRENT_DATE
       ORDER BY session_date, start_time LIMIT 10`,
      [req.params.id]
    );

    return ok(res, { ...rows[0], upcomingSessions: sessions.rows });
  } catch (err) { serverError(res, err); }
};

// ── POST /api/staff ──────────────────────────────────────────────
export const createStaff = async (req, res) => {
  try {
    const { fullName, phone, email, role = "coach", password } = req.body;
    const gymId = req.user.gym_id;

    if (!["coach", "assistant"].includes(role))
      return badRequest(res, "الدور يجب أن يكون مدرب أو مساعد مدرب");

    const dup = await query(
      "SELECT id FROM users WHERE gym_id = $1 AND phone = $2",
      [gymId, phone]
    );
    if (dup.rows.length) return badRequest(res, "رقم الهاتف مسجل مسبقاً في هذه الصالة");

    // كلمة المرور: المُدخلة أو رقم الهاتف افتراضياً
    const hash = await bcrypt.hash(password || phone, 10);

    const { rows } = await query(
      `INSERT INTO users (gym_id, full_name, phone, email, role, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, full_name, phone, email, role, created_at`,
      [gymId, fullName, phone, email || null, role, hash]
    );
    return created(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/staff/:id ─────────────────────────────────────────
export const updateStaff = async (req, res) => {
  try {
    const { fullName, phone, email, role, isActive, password } = req.body;

    let passwordHash = null;
    if (password) passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await query(
      `UPDATE users SET
         full_name     = COALESCE($1, full_name),
         phone         = COALESCE($2, phone),
         email         = COALESCE($3, email),
         role          = COALESCE($4, role),
         is_active     = COALESCE($5, is_active),
         password_hash = COALESCE($6, password_hash),
         updated_at    = NOW()
       WHERE id = $7 AND gym_id = $8 AND role IN ('coach','assistant','owner')
       RETURNING id, full_name, phone, email, role, is_active`,
      [
        fullName || null, phone || null, email || null,
        role || null, isActive ?? null, passwordHash,
        req.params.id, req.user.gym_id,
      ]
    );
    if (!rows.length) return notFound(res, "العضو غير موجود");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/staff/:id  (soft delete) ─────────────────────────
export const deleteStaff = async (req, res) => {
  try {
    // لا يمكن حذف المالك
    const check = await query("SELECT role FROM users WHERE id = $1", [req.params.id]);
    if (check.rows[0]?.role === "owner")
      return badRequest(res, "لا يمكن إلغاء تفعيل حساب المالك");

    const { rows } = await query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND gym_id = $2 AND role IN ('coach','assistant')
       RETURNING id`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "العضو غير موجود");
    return noContent(res);
  } catch (err) { serverError(res, err); }
};