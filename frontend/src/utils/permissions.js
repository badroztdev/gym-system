// src/utils/permissions.js
// صلاحيات المدرب/المساعد — تُطابق backend/src/utils/access.js
// ملاحظة: الإخفاء في الواجهة للراحة فقط؛ الخادم هو من يفرض الصلاحيات فعلياً.

export const PERMISSION_GROUPS = [
  { id: "members",       icon: "👥", actions: ["view", "add", "edit", "delete"] },
  { id: "sessions",      icon: "📅", actions: ["view", "add", "edit", "delete"] },
  { id: "attendance",    icon: "✅", actions: ["view", "manage"] },
  { id: "subscriptions", icon: "🎫", actions: ["view", "add", "edit", "delete"] },
  { id: "payments",      icon: "💳", actions: ["view", "add", "delete"] },
  { id: "stats",         icon: "📊", actions: ["view"] },
  { id: "progress",      icon: "📈", actions: ["view", "manage"] },
  { id: "messages",      icon: "💬", actions: ["view"] },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.actions.map(a => `${g.id}.${a}`));
export const VIEW_ONLY_PERMISSIONS = PERMISSION_GROUPS.map(g => `${g.id}.view`);

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
export const GROUP_VALUES = ["الفوج 1", "الفوج 2", "الفوج 3", "الفوج 4"];

export function userPermissions(user) {
  if (!user) return [];
  if (user.role === "owner") return ["*"];
  if (Array.isArray(user.permissions)) return user.permissions;
  return DEFAULT_PERMISSIONS[user.role] || []; // جلسة قديمة قبل إضافة الميزة
}

export function userCan(user, perm) {
  const p = userPermissions(user);
  return p.includes("*") || p.includes(perm);
}
export const userCanAny = (user, perms) => perms.some(p => userCan(user, p));

// الصلاحيات المطلوبة (أيٌّ منها) لكل صفحة في القائمة؛ بدون مفتاح = متاحة للجميع
export const PAGE_PERMISSIONS = {
  dashboard:     ["stats.view"],
  members:       ["members.view"],
  sessions:      ["sessions.view"],
  subscriptions: ["subscriptions.view", "payments.view"],
  attendance:    ["attendance.view"],
  messages:      ["messages.view"],
  progress:      ["progress.view"],
};
const PAGE_ORDER = ["dashboard", "members", "sessions", "attendance", "subscriptions", "progress", "messages"];

export const canOpenPage = (user, page) =>
  !PAGE_PERMISSIONS[page] || userCanAny(user, PAGE_PERMISSIONS[page]);

export function firstAllowedPage(user) {
  return PAGE_ORDER.find(p => canOpenPage(user, p)) || "settings";
}
