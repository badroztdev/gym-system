// src/controllers/onboarding.controller.js
// تسجيل صالة رياضية جديدة ذاتياً — بداية رحلة SaaS
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { transaction, query } from "../utils/db.js";
import { ok, created, badRequest, serverError } from "../utils/response.js";

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// تحويل اسم الصالة لـ slug صالح للرابط (أحرف لاتينية/أرقام فقط)
function slugify(name) {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")   // احذف الرموز الخاصة
    .replace(/[\s_-]+/g, "-")   // المسافات → شرطة
    .replace(/^-+|-+$/g, "");   // احذف الشرطات الطرفية
}

// ── POST /api/onboarding/register ───────────────────────────────
// يسجّل صالة رياضية جديدة + حساب المالك في خطوة واحدة
export const registerGym = async (req, res) => {
  try {
    const {
      gymName,      // اسم الصالة
      ownerName,    // اسم المالك الكامل
      ownerPhone,   // هاتف المالك (سيُستخدم لتسجيل الدخول)
      ownerEmail,   // بريد المالك (اختياري لكن مفيد للفوترة لاحقاً)
      password,     // كلمة مرور المالك
    } = req.body;

    if (!gymName?.trim())    return badRequest(res, "اسم الصالة مطلوب");
    if (!ownerName?.trim())  return badRequest(res, "اسم المالك مطلوب");
    if (!ownerPhone?.trim()) return badRequest(res, "رقم هاتف المالك مطلوب");
    if (!password || password.length < 6)
      return badRequest(res, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");

    // ── توليد slug فريد ──────────────────────────────────────
    let baseSlug = slugify(gymName) || "gym";
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const exists = await query("SELECT id FROM gyms WHERE slug = $1", [slug]);
      if (!exists.rows.length) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // ── تحقق أن رقم الهاتف غير مستخدم في أي صالة أخرى كمالك جديد ──
    // (ملاحظة: النظام يسمح بتكرار الهاتف عبر صالات مختلفة، لكن هنا
    //  نمنع فقط ازدواجية غير مقصودة لنفس الشخص يسجّل صالتين بنفس الرقم بالخطأ)
    const dupCheck = await query(
      `SELECT g.name FROM users u JOIN gyms g ON g.id = u.gym_id
       WHERE u.phone = $1 AND u.role = 'owner'`,
      [ownerPhone]
    );
    if (dupCheck.rows.length) {
      return badRequest(res, `رقم الهاتف مستخدم بالفعل كمالك لصالة "${dupCheck.rows[0].name}"`);
    }

    const result = await transaction(async (client) => {
      // 1. أنشئ الصالة
      const gymRes = await client.query(
        `INSERT INTO gyms
           (name, slug, owner_email, subscription_status, subscription_plan,
            trial_ends_at, created_by_self_signup, settings)
         VALUES ($1, $2, $3, 'trial', 'trial', NOW() + INTERVAL '14 days', TRUE, $4)
         RETURNING id, name, slug, trial_ends_at`,
        [
          gymName.trim(), slug, ownerEmail || null,
          JSON.stringify({ currency: "DZD", timezone: "Africa/Algiers", session_qr_validity_minutes: 10 }),
        ]
      );
      const gym = gymRes.rows[0];

      // 2. أنشئ حساب المالك
      const hash = await bcrypt.hash(password, 10);
      const userRes = await client.query(
        `INSERT INTO users (gym_id, full_name, phone, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'owner')
         RETURNING id, full_name, phone, email, role`,
        [gym.id, ownerName.trim(), ownerPhone.trim(), ownerEmail || null, hash]
      );
      const owner = userRes.rows[0];

      // 3. سجّل الحدث في سجل النشاط
      await client.query(
        `INSERT INTO gym_activity_log (gym_id, action, details)
         VALUES ($1, 'created', $2)`,
        [gym.id, JSON.stringify({ selfSignup: true, ownerName: owner.full_name })]
      );

      return { gym, owner };
    });

    const token = signToken(result.owner.id);

    return created(res, {
      token,
      user: {
        id: result.owner.id,
        gymId: result.gym.id,
        gymName: result.gym.name,
        gymSlug: result.gym.slug,
        fullName: result.owner.full_name,
        phone: result.owner.phone,
        email: result.owner.email,
        role: result.owner.role,
      },
      trial: {
        endsAt: result.gym.trial_ends_at,
        daysLeft: 14,
      },
      message: `تم إنشاء صالة "${result.gym.name}" بنجاح! لديك 14 يوماً تجريبياً مجانياً`,
    });
  } catch (err) {
    if (err.code === "23505") { // unique violation
      return badRequest(res, "رقم الهاتف أو اسم الصالة مستخدم بالفعل");
    }
    serverError(res, err);
  }
};

// ── GET /api/onboarding/check-slug?name=... ──────────────────────
// يتحقق مسبقاً (أثناء الكتابة) هل اسم الصالة متاح كرابط فريد
export const checkSlugAvailability = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return badRequest(res, "الاسم مطلوب");

    const slug = slugify(name) || "gym";
    const exists = await query("SELECT id FROM gyms WHERE slug = $1", [slug]);

    return ok(res, {
      slug,
      available: !exists.rows.length,
    });
  } catch (err) { serverError(res, err); }
};