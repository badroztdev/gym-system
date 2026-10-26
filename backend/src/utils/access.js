// src/utils/access.js
// ✅ صلاحيات المدرب/المساعد + نطاق البيانات (فئات رياضية / فئات عمرية / أفواج)
// - المالك: كل شيء دائماً.
// - المدرب/المساعد: users.permissions (مصفوفة) — إن كانت NULL تُستخدم الافتراضات القديمة حسب الدور
//   فلا ينكسر أي حساب موجود.
// - users.access_scope (JSONB) — NULL أو فارغ = بلا قيود (يرى كل الصالة).
import { query } from "./db.js";
import { forbidden } from "./response.js";

export const PERMISSION_KEYS = [
  "members.view", "members.add", "members.edit", "members.delete",
  "sessions.view", "sessions.add", "sessions.edit", "sessions.delete",
  "attendance.view", "attendance.manage",
  "subscriptions.view", "subscriptions.add", "subscriptions.edit", "subscriptions.delete",
  "payments.view", "payments.add", "payments.delete",
  "stats.view",
  "progress.view", "progress.manage",
  "messages.view",
];

// نفس ما كان مسموحاً قبل هذه الميزة (حتى لا يتغيّر شيء لمن لم يُخصَّص له شيء)
export const DEFAULT_PERMISSIONS = {
  coach: [
    "members.view", "members.add", "members.edit",
    "sessions.view", "sessions.add", "sessions.edit", "sessions.delete",
    "attendance.view", "attendance.manage",
    "subscriptions.view", "subscriptions.add", "subscriptions.edit",
    "payments.view", "payments.add",
    "stats.view", "progress.view", "progress.manage", "messages.view",
  ],
  assistant: [
    "members.view", "members.add", "members.edit",
    "sessions.view",
    "attendance.view", "attendance.manage",
    "subscriptions.view", "subscriptions.add", "subscriptions.edit",
    "payments.view", "payments.add",
    "stats.view", "progress.view", "messages.view",
  ],
};

export const AGE_CATEGORY_VALUES = ["مدارس", "كتاكيت", "براعم", "أصاغر", "أشبال", "أواسط", "أمال", "أكابر"];
const GROUP_RE = /^الفوج \d{1,2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const arr = (v) => (Array.isArray(v) ? v.filter(x => typeof x === "string" && x) : []);

// ── الصلاحيات ───────────────────────────────────────────────────
export function effectivePermissions(user) {
  if (!user) return [];
  if (user.role === "owner") return ["*"];
  if (Array.isArray(user.permissions)) return user.permissions.filter(p => PERMISSION_KEYS.includes(p));
  return DEFAULT_PERMISSIONS[user.role] || [];
}

export const hasPermission = (user, perm) => {
  const eff = effectivePermissions(user);
  return eff.includes("*") || eff.includes(perm);
};

// يسمح إن امتلك المستخدم أيّاً من الصلاحيات المذكورة
export const requirePermission = (...perms) => (req, res, next) => {
  if (req.user && ["owner", "coach", "assistant"].includes(req.user.role)
      && perms.some(p => hasPermission(req.user, p))) return next();
  return forbidden(res, "ليس لديك صلاحية للقيام بهذا الإجراء");
};

// ── النطاق ──────────────────────────────────────────────────────
// null = بلا قيود
export function getScope(user) {
  if (!user || user.role === "owner" || user.role === "super_admin") return null;
  const s = user.access_scope;
  if (!s || typeof s !== "object") return null;
  const scope = {
    categories: arr(s.categories),
    ageCategories: arr(s.ageCategories),
    groups: arr(s.groups),
  };
  if (!scope.categories.length && !scope.ageCategories.length && !scope.groups.length) return null;
  return scope;
}

// شرط SQL للرياضيين (alias = جدول users). يدفع المعاملات داخل params مباشرة.
export function athleteScopeSql(user, alias, params) {
  const sc = getScope(user);
  if (!sc) return null;
  const parts = [];
  if (sc.ageCategories.length) {
    params.push(sc.ageCategories);
    parts.push(`${alias}.age_category::text = ANY($${params.length}::text[])`);
  }
  if (sc.groups.length) {
    params.push(sc.groups);
    parts.push(`${alias}.group_name = ANY($${params.length}::text[])`);
  }
  if (sc.categories.length) {
    params.push(sc.categories);
    // الفئة الرياضية للرياضي = فئة خطة اشتراكه. من لا اشتراك له بعد يظهر (ليتمكن المدرب من اشتراكه)
    parts.push(`(EXISTS (SELECT 1 FROM subscriptions ss_sc JOIN subscription_plans sp_sc ON sp_sc.id = ss_sc.plan_id
                         WHERE ss_sc.athlete_id = ${alias}.id AND sp_sc.category_id = ANY($${params.length}::uuid[]))
               OR NOT EXISTS (SELECT 1 FROM subscriptions s0_sc WHERE s0_sc.athlete_id = ${alias}.id))`);
  }
  return `(${parts.join(" AND ")})`;
}

// شرط SQL للأعضاء: رياضي ضمن النطاق، أو ولي أمر مرتبط برياضي ضمن النطاق
export function memberScopeSql(user, alias, params) {
  if (!getScope(user)) return null;
  const a = athleteScopeSql(user, alias, params);
  const b = athleteScopeSql(user, "ax_sc", params);
  return `((${alias}.role = 'athlete' AND ${a})
           OR (${alias}.role = 'guardian' AND EXISTS (
                 SELECT 1 FROM guardian_athlete gx_sc JOIN users ax_sc ON ax_sc.id = gx_sc.athlete_id
                 WHERE gx_sc.guardian_id = ${alias}.id AND ${b})))`;
}

// شرط SQL للحصص: حصصه هو، أو حصص تطابق فئاته الرياضية/العمرية
export function sessionScopeSql(user, alias, params) {
  const sc = getScope(user);
  if (!sc || (!sc.categories.length && !sc.ageCategories.length)) return null;
  params.push(user.id);
  const me = `$${params.length}`;
  const parts = [];
  if (sc.categories.length) {
    params.push(sc.categories);
    parts.push(`${alias}.category_id = ANY($${params.length}::uuid[])`);
  }
  if (sc.ageCategories.length) {
    params.push(sc.ageCategories);
    parts.push(`${alias}.age_category && $${params.length}::text[]`);
  }
  return `(${alias}.coach_id = ${me} OR (${parts.join(" AND ")}))`;
}

// ── فحوص مفردة (تُرجع true إن كان مسموحاً) ──────────────────────
export async function athleteInScope(user, athleteId) {
  const params = [athleteId, user.gym_id];
  const c = athleteScopeSql(user, "u", params);
  const { rows } = await query(
    `SELECT 1 FROM users u WHERE u.id = $1 AND u.gym_id = $2 ${c ? "AND " + c : ""}`, params);
  return rows.length > 0;
}

export async function athletesInScope(user, ids) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return true;
  const params = [uniq, user.gym_id];
  const c = athleteScopeSql(user, "u", params);
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM users u WHERE u.id = ANY($1::uuid[]) AND u.gym_id = $2 ${c ? "AND " + c : ""}`, params);
  return rows[0].n === uniq.length;
}

export async function memberInScope(user, id) {
  const params = [id, user.gym_id];
  const c = memberScopeSql(user, "u", params);
  const { rows } = await query(
    `SELECT 1 FROM users u WHERE u.id = $1 AND u.gym_id = $2 ${c ? "AND " + c : ""}`, params);
  return rows.length > 0;
}

export async function sessionInScope(user, sessionId) {
  const params = [sessionId, user.gym_id];
  const c = sessionScopeSql(user, "s", params);
  const { rows } = await query(
    `SELECT 1 FROM sessions s WHERE s.id = $1 AND s.gym_id = $2 ${c ? "AND " + c : ""}`, params);
  return rows.length > 0;
}

export async function subscriptionInScope(user, subscriptionId) {
  const params = [subscriptionId, user.gym_id];
  const c = athleteScopeSql(user, "u", params);
  const { rows } = await query(
    `SELECT 1 FROM subscriptions s JOIN users u ON u.id = s.athlete_id
     WHERE s.id = $1 AND u.gym_id = $2 ${c ? "AND " + c : ""}`, params);
  return rows.length > 0;
}

// عضو جديد/معدَّل: هل فئته العمرية وفوجه ضمن نطاق المدرب؟ (يُرجع رسالة خطأ أو null)
export function checkNewAthleteValues(user, { ageCategory, groupName } = {}) {
  const sc = getScope(user);
  if (!sc) return null;
  if (ageCategory && sc.ageCategories.length && !sc.ageCategories.includes(ageCategory))
    return "هذه الفئة العمرية خارج نطاق صلاحياتك";
  if (groupName && sc.groups.length && !sc.groups.includes(groupName))
    return "هذا الفوج خارج نطاق صلاحياتك";
  return null;
}

// حصة جديدة/معدَّلة ضمن النطاق؟
export function checkSessionValues(user, { categoryId, ageCategories } = {}) {
  const sc = getScope(user);
  if (!sc) return null;
  if (sc.categories.length && categoryId && !sc.categories.includes(categoryId))
    return "هذه الفئة الرياضية خارج نطاق صلاحياتك";
  if (sc.ageCategories.length && Array.isArray(ageCategories)
      && ageCategories.some(c => !sc.ageCategories.includes(c)))
    return "إحدى الفئات العمرية خارج نطاق صلاحياتك";
  return null;
}

// ── تنظيف مُدخلات المالك عند حفظ صلاحيات/نطاق مدرب ───────────────
export function cleanPermissions(raw) {
  if (raw === null) return null; // = الافتراضي حسب الدور
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.filter(p => PERMISSION_KEYS.includes(p)))];
}

export async function cleanScope(raw, gymId) {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const ageCategories = arr(raw.ageCategories).filter(c => AGE_CATEGORY_VALUES.includes(c));
  const groups = arr(raw.groups).filter(g => GROUP_RE.test(g)).slice(0, 20);
  let categories = arr(raw.categories).filter(c => UUID_RE.test(c));
  if (categories.length) {
    const { rows } = await query(
      "SELECT id FROM sport_categories WHERE gym_id = $1 AND id = ANY($2::uuid[])", [gymId, categories]);
    categories = rows.map(r => r.id);
  }
  if (!ageCategories.length && !groups.length && !categories.length) return null;
  return { categories, ageCategories: [...new Set(ageCategories)], groups: [...new Set(groups)] };
}
