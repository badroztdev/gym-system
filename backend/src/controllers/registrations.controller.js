// src/controllers/registrations.controller.js
// استمارة التسجيل الذاتي للرياضيين: رابط عام لكل صالة + طلبات تنتظر مراجعة الطاقم
import { query } from "../utils/db.js";
import { getScope } from "../utils/access.js";
import { ok, created, notFound, badRequest, serverError } from "../utils/response.js";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MAX_PENDING = 300;            // سقف الطلبات المعلّقة لكل صالة (حماية من الإغراق)
const IP_LIMIT = 8;                 // طلبات لكل IP في الساعة
const IP_WINDOW = 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── تحديد معدل بسيط في الذاكرة ─────────────────────────────────
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < IP_WINDOW);
  if (arr.length >= IP_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < IP_WINDOW)) hits.delete(k);
  return false;
}
const clientIp = (req) =>
  String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "unknown";

// ── تنظيف المدخلات ─────────────────────────────────────────────
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩", FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const latinDigits = (s) =>
  String(s ?? "").replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(d));
  });
const cleanText = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanPhone = (v) => latinDigits(v).replace(/[\s\-.()]/g, "");
const PHONE_RE = /^\+?\d{8,15}$/;

function validDob(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false;
  return v >= "1920-01-01" && v <= new Date().toISOString().slice(0, 10);
}

async function gymBySlug(slug) {
  const { rows } = await query("SELECT id, name, slug, logo_url FROM gyms WHERE slug = $1", [String(slug || "").toLowerCase()]);
  return rows[0] || null;
}

// ── GET /api/public/registration/:slug  (عام) ─────────────────
export const getRegistrationInfo = async (req, res) => {
  try {
    const gym = await gymBySlug(req.params.slug);
    if (!gym) return notFound(res, "الصالة غير موجودة");
    return ok(res, { name: gym.name, slug: gym.slug, logo_url: gym.logo_url || null });
  } catch (err) { serverError(res, err); }
};

// ── POST /api/public/registration/:slug  (عام) ────────────────
export const submitRegistration = async (req, res) => {
  try {
    const b = req.body || {};
    // فخّ للروبوتات: حقل مخفي يجب أن يبقى فارغاً — نتظاهر بالنجاح دون حفظ
    if (b.website) return created(res, { received: true });

    if (rateLimited(clientIp(req)))
      return res.status(429).json({ message: "محاولات كثيرة، حاول لاحقاً" });

    const gym = await gymBySlug(req.params.slug);
    if (!gym) return notFound(res, "الصالة غير موجودة");

    const fullName = cleanText(b.fullName, 120);
    const phone = cleanPhone(b.phone);
    const dob = cleanText(b.dateOfBirth, 10);
    const gender = b.gender === "male" || b.gender === "female" ? b.gender : null;
    const address = cleanText(b.address, 200) || null;
    const bloodGroup = BLOOD_GROUPS.includes(b.bloodGroup) ? b.bloodGroup : null;
    const guardianName = cleanText(b.guardianName, 120) || null;
    const guardianPhone = cleanPhone(b.guardianPhone) || null;

    if (fullName.length < 3) return badRequest(res, "الاسم واللقب مطلوب");
    if (!PHONE_RE.test(phone)) return badRequest(res, "رقم الهاتف غير صالح");
    if (!validDob(dob)) return badRequest(res, "تاريخ الميلاد غير صالح");
    if (guardianPhone && !PHONE_RE.test(guardianPhone)) return badRequest(res, "رقم هاتف ولي الأمر غير صالح");

    const pend = await query(
      "SELECT COUNT(*)::int AS n, BOOL_OR(phone = $2) AS dup FROM registration_requests WHERE gym_id = $1 AND status = 'pending'",
      [gym.id, phone]
    );
    // نفس الرقم مرسَل مسبقاً وما زال معلّقاً: نعتبره نجاحاً دون تكرار
    if (pend.rows[0].dup) return created(res, { received: true });
    if (pend.rows[0].n >= MAX_PENDING)
      return res.status(429).json({ message: "الاستمارة مغلقة مؤقتاً، تواصل مع النادي" });

    await query(
      `INSERT INTO registration_requests
         (gym_id, full_name, phone, gender, date_of_birth, address, blood_group, guardian_name, guardian_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [gym.id, fullName, phone, gender, dob, address, bloodGroup, guardianName, guardianPhone]
    );
    return created(res, { received: true });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/registrations  (الطاقم) ──────────────────────────
// المدرب ذو النطاق المحدّد لا يرى الطلبات (لا فئة لها بعد) — قائمة فارغة بدل خطأ
export const listRegistrations = async (req, res) => {
  try {
    if (getScope(req.user)) return ok(res, [], { meta: { total: 0 } });
    const { rows } = await query(
      `SELECT r.id, r.full_name, r.phone, r.gender, r.date_of_birth, r.address, r.blood_group,
              r.guardian_name, r.guardian_phone, r.created_at,
              EXISTS (SELECT 1 FROM users u WHERE u.gym_id = r.gym_id AND u.phone = r.phone) AS phone_exists
       FROM registration_requests r
       WHERE r.gym_id = $1 AND r.status = 'pending'
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [req.user.gym_id]
    );
    return ok(res, rows, { meta: { total: rows.length } });
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/registrations/:id  { status: approved|rejected, memberId? } ─
export const updateRegistration = async (req, res) => {
  try {
    if (getScope(req.user)) return notFound(res, "الطلب غير موجود");
    const { status, memberId } = req.body || {};
    if (!["approved", "rejected"].includes(status)) return badRequest(res, "الحالة غير صالحة");
    if (memberId && !UUID_RE.test(String(memberId))) return badRequest(res, "معرّف العضو غير صالح");

    const { rows } = await query(
      `UPDATE registration_requests
          SET status = $1, member_id = $2, handled_by = $3, handled_at = NOW()
        WHERE id = $4 AND gym_id = $5 AND status = 'pending'
        RETURNING id, status`,
      [status, memberId || null, req.user.id, req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الطلب غير موجود أو تمت معالجته");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};
