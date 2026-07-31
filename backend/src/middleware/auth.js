// src/middleware/auth.js
import jwt from "jsonwebtoken";
import { query } from "../utils/db.js";
import { unauthorized, forbidden } from "../utils/response.js";

// ── Verify JWT and attach user to req ─────────────────────────
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      return unauthorized(res, "يرجى تسجيل الدخول");

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      "SELECT id, gym_id, full_name, email, phone, role, is_active FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (!rows.length || !rows[0].is_active)
      return unauthorized(res, "الحساب غير موجود أو معطّل");

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return unauthorized(res, "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً");
    return unauthorized(res, "رمز مصادقة غير صالح");
  }
};

// ── Role-based access control ─────────────────────────────────
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return forbidden(res, "ليس لديك صلاحية للقيام بهذا الإجراء");
  next();
};

// Shorthand role guards
export const ownerOnly      = authorize("owner");
export const staffOnly      = authorize("owner", "coach", "assistant");
export const coachAndAbove  = authorize("owner", "coach");
