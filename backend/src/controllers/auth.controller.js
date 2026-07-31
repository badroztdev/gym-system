// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../utils/db.js";
import { ok, unauthorized, serverError } from "../utils/response.js";

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // ✅ الإصلاح: نقبل جميع الأدوار (owner, coach, assistant, athlete, guardian)
    const { rows } = await query(
      `SELECT u.*, g.name AS gym_name
       FROM users u
       JOIN gyms g ON g.id = u.gym_id
       WHERE u.phone = $1`,
      [phone]
    );

    if (!rows.length)
      return unauthorized(res, "رقم الهاتف أو كلمة المرور غير صحيحة");

    const user = rows[0];

    if (!user.is_active)
      return unauthorized(res, "الحساب معطّل، يرجى التواصل مع المدير");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return unauthorized(res, "رقم الهاتف أو كلمة المرور غير صحيحة");

    // تحديث آخر تسجيل دخول
    await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken(user.id);

    return ok(res, {
      token,
      user: {
        id:       user.id,
        gymId:    user.gym_id,
        gymName:  user.gym_name,
        fullName: user.full_name,
        phone:    user.phone,
        email:    user.email,
        role:     user.role,
        avatar:   user.avatar_url,
      },
    });
  } catch (err) {
    serverError(res, err);
  }
};

// GET /api/auth/me
export const me = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.gym_id, u.full_name, u.email, u.phone,
              u.role, u.avatar_url, u.last_login_at,
              g.name AS gym_name, g.logo_url AS gym_logo
       FROM users u JOIN gyms g ON g.id = u.gym_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};