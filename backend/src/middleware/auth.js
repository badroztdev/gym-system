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

    // ✅ SaaS: نجلب أيضاً حالة اشتراك الصالة في نفس الاستعلام (JOIN واحد فقط،
    // بدون أي تكلفة أداء إضافية) لتفادي إضافة أي middleware جديد لكل مسار
    const { rows } = await query(
      `SELECT u.id, u.gym_id, u.full_name, u.email, u.phone, u.role, u.is_active,
              g.subscription_status, g.trial_ends_at, g.subscription_ends_at
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (!rows.length || !rows[0].is_active)
      return unauthorized(res, "الحساب غير موجود أو معطّل");

    const user = rows[0];

    // ✅ SaaS: تحقق من حالة اشتراك الصالة (يُتجاوز تلقائياً لحساب super_admin
    // لأنه لا ينتمي لصالة عادية، وgym_id سيكون NULL له فلن يدخل هذا الشرط)
    if (user.role !== "super_admin" && user.gym_id) {
      if (user.subscription_status === "suspended") {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_ISSUE",
          reason: "suspended",
          message: "تم تعليق اشتراك الصالة. يرجى التواصل مع الدعم لتفعيله مجدداً",
        });
      }
      if (user.subscription_status === "cancelled") {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_ISSUE",
          reason: "cancelled",
          message: "تم إلغاء اشتراك الصالة",
        });
      }
      if (user.subscription_status === "trial" && user.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_ISSUE",
          reason: "trial_expired",
          message: "انتهت الفترة التجريبية المجانية. يرجى الاشتراك لمتابعة الاستخدام",
        });
      }
      if (user.subscription_status === "active" && user.subscription_ends_at && new Date(user.subscription_ends_at) < new Date()) {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_ISSUE",
          reason: "subscription_expired",
          message: "انتهى اشتراك الصالة. يرجى التجديد لمتابعة الاستخدام",
        });
      }
    }

    req.user = user;
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
