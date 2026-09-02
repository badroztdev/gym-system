// src/controllers/auth.controller.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../utils/db.js";
import { ok, unauthorized, serverError } from "../utils/response.js";

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

function normalizePhone(raw) {
  if (!raw) return raw;
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return String(raw)
    .trim()
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/\s+/g, "");
}

// POST /api/auth/login
// ✅ SaaS: تسجيل دخول موحَّد لكل المنصة (رابط واحد: sgms.site/login)
// نظراً لأن رقم الهاتف قد يتكرر عبر صالات مختلفة (قيد التفرد هو gym_id+phone معاً)،
// نتحقق من كلمة المرور مقابل كل الحسابات المطابقة لذلك الرقم:
//   - لا تطابق أي حساب        → خطأ عادي
//   - تطابق حساب واحد فقط     → دخول مباشر (الحالة الشائعة 99% من الوقت)
//   - تطابق أكثر من حساب      → نُرجع قائمة اختيار (نادر جداً)، والعميل يعيد الإرسال
//                                 مع selectedUserId بعد اختيار المستخدم
export const login = async (req, res) => {
  try {
    const { phone: rawPhone, password: rawPassword, selectedUserId } = req.body;
    const phone = normalizePhone(rawPhone);
    const password = rawPassword ? String(rawPassword).trim() : rawPassword;

    const { rows } = await query(
      `SELECT u.*, g.name AS gym_name, g.slug AS gym_slug
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
       WHERE u.phone = $1 AND u.is_active = TRUE`,
      [phone]
    );

    if (!rows.length)
      return unauthorized(res, "رقم الهاتف أو كلمة المرور غير صحيحة");

    // تحقق من كلمة المرور مقابل كل الحسابات المطابقة (بالتوازي لسرعة أعلى)
    const checks = await Promise.all(
      rows.map(async (u) => ({ user: u, valid: await bcrypt.compare(password, u.password_hash) }))
    );
    let matches = checks.filter(c => c.valid).map(c => c.user);

    if (!matches.length)
      return unauthorized(res, "رقم الهاتف أو كلمة المرور غير صحيحة");

    // إذا حُدِّد حساب معيّن مسبقاً (بعد شاشة الاختيار)، نضيّق النتيجة إليه
    if (selectedUserId) {
      matches = matches.filter(u => u.id === selectedUserId);
      if (!matches.length)
        return unauthorized(res, "حدث خطأ، يرجى إعادة تسجيل الدخول");
    }

    // ── حالة نادرة: نفس الرقم وكلمة المرور تطابقان أكثر من حساب ──
    if (matches.length > 1) {
      return ok(res, {
        requiresSelection: true,
        options: matches.map(u => ({
          id: u.id,
          fullName: u.full_name,
          role: u.role,
          gymName: u.gym_name,
          gymSlug: u.gym_slug,
        })),
      });
    }

    const user = matches[0];

    await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken(user.id);

    return ok(res, {
      token,
      user: {
        id:       user.id,
        gymId:    user.gym_id,
        gymName:  user.gym_name,
        gymSlug:  user.gym_slug,
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
              g.name AS gym_name, g.slug AS gym_slug, g.logo_url AS gym_logo
       FROM users u LEFT JOIN gyms g ON g.id = u.gym_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};