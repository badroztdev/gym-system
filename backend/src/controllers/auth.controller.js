// src/controllers/auth.controller.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../utils/db.js";
import { ok, unauthorized, serverError } from "../utils/response.js";
import { effectivePermissions, getScope } from "../utils/access.js";

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatinDigits = (v) => String(v).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
                                       .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

// يوحّد الرقم: أرقام عربية/فارسية ← لاتينية، وإزالة المسافات والرموز غير المرئية (آيفون يضيفها)
function normalizePhone(raw) {
  if (!raw) return raw;
  return toLatinDigits(raw)
    .replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0]+/g, "")
    .replace(/[-().]/g, "");
}

// كل الصيغ الممكنة لنفس الرقم الجزائري: 0778555951 | 778555951 | 213778555951 | +213778555951
function phoneCandidates(raw) {
  const p = normalizePhone(raw);
  if (!p) return [];
  const set = new Set([p]);
  const d = p.replace(/^\+/, "").replace(/^00/, "");
  let local = null;
  if (/^213\d{9}$/.test(d)) local = "0" + d.slice(3);
  else if (/^0\d{9}$/.test(d)) local = d;
  else if (/^\d{9}$/.test(d)) local = "0" + d;
  if (local) {
    set.add(local); set.add(local.slice(1));
    set.add("213" + local.slice(1)); set.add("+213" + local.slice(1));
  }
  return [...set];
}

// كلمات مرور مرشَّحة: كما أُرسلت، بعد حذف المسافات الطرفية، وبعد تحويل الأرقام العربية
function passwordCandidates(raw) {
  if (raw === undefined || raw === null) return [];
  const base = String(raw);
  const strip = base.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0]/g, "");
  return [...new Set([base, base.trim(), strip.trim(), toLatinDigits(strip.trim())])].filter(Boolean);
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
    const candidates = phoneCandidates(rawPhone);
    const passwords  = passwordCandidates(rawPassword);
    if (!candidates.length || !passwords.length)
      return unauthorized(res, "رقم الهاتف أو كلمة المرور غير صحيحة");

    const SELECT = `SELECT u.*, g.name AS gym_name, g.slug AS gym_slug
                    FROM users u LEFT JOIN gyms g ON g.id = u.gym_id`;
    let { rows } = await query(
      `${SELECT} WHERE u.phone = ANY($1::text[]) AND u.is_active = TRUE`, [candidates]
    );
    // احتياط: أرقام مخزَّنة قديماً بأرقام عربية أو بمسافات
    if (!rows.length) {
      ({ rows } = await query(
        `${SELECT}
         WHERE u.is_active = TRUE
           AND translate(regexp_replace(u.phone, '[\\s\\-()]', '', 'g'), '٠١٢٣٤٥٦٧٨٩', '0123456789') = ANY($1::text[])`,
        [candidates]
      ));
    }

    if (!rows.length)
      return unauthorized(res, "رقم الهاتف أو كلمة المرور غير صحيحة");

    // تحقق من كلمة المرور مقابل كل الحسابات المطابقة (بالتوازي) مع تجربة الصيغ المرشَّحة
    const checks = await Promise.all(
      rows.map(async (u) => {
        for (const pw of passwords) {
          if (await bcrypt.compare(pw, u.password_hash)) return { user: u, valid: true };
        }
        return { user: u, valid: false };
      })
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
        // ✅ الصلاحيات الفعلية (المالك: ["*"]) ونطاق البيانات — تُستخدم لإخفاء القوائم في الواجهة
        permissions: effectivePermissions(user),
        scope:       getScope(user),
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
              u.permissions, u.access_scope,
              g.name AS gym_name, g.slug AS gym_slug, g.logo_url AS gym_logo
       FROM users u LEFT JOIN gyms g ON g.id = u.gym_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const row = rows[0];
    // نُبقي الحقول القديمة كما هي ونضيف الصلاحيات والنطاق (دون كشف الأعمدة الخام)
    const { permissions, access_scope, ...rest } = row;
    return ok(res, {
      ...rest,
      permissions: effectivePermissions({ role: row.role, permissions }),
      scope: getScope({ role: row.role, access_scope }),
    });
  } catch (err) {
    serverError(res, err);
  }
};