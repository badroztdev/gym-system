// src/routes/index.js
import { Router } from "express";
import multer from "multer";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import { requirePermission as perm } from "../utils/access.js";
import { authenticate, staffOnly, coachAndAbove, ownerOnly, authorize } from "../middleware/auth.js";

import { login, me } from "../controllers/auth.controller.js";
import { getMembers, getMember, createMember, updateMember, deleteMember, deleteMemberPermanently, getMembersStats, resetPassword, uploadMemberAvatar } from "../controllers/members.controller.js";
import { getCategories, createCategory, updateCategory, deleteCategory, deleteCategoryPermanently } from "../controllers/categories.controller.js";
import { getStaff, getStaffMember, createStaff, updateStaff, deleteStaff } from "../controllers/staff.controller.js";
import { getPlans, createPlan, updatePlan, deletePlan, deletePlanPermanently } from "../controllers/plans.controller.js";
import { getSubscriptions, getSubscription, createSubscription, updateSubscription, deleteSubscription, getSubscriptionStats } from "../controllers/subscriptions.controller.js";
import { getPayments, createPayment, deletePayment, getPaymentsStats } from "../controllers/payments.controller.js";
import { getRooms, createRoom, updateRoom, deleteRoom, deleteRoomPermanently, regenerateQR } from "../controllers/rooms.controller.js";
import { getSessions, getSession, createSession, updateSession, cancelSession, deleteRecurringSeries, getTodaySessions, getSessionResults, saveSessionResults } from "../controllers/sessions.controller.js";
import { scanQR, getSessionAttendance, manualAttendance, bulkAttendance, getAthleteAttendance, getAttendanceOverview, getAttendanceTrend, getAttendanceLeaderboard, getAttendanceByCategory, getRecentSessionsAttendance } from "../controllers/attendance.controller.js";
import { saveToken, getNotifications, markRead, sendManual, notifyExpiringSubscriptions } from "../controllers/notifications.controller.js";
import { getMyAthletes, getDashboard, getSchedule, getAttendanceHistory, getSubscriptionHistory, scanAttendance } from "../controllers/portal.controller.js";
import { getPortalRecipients, getPortalThreads, getPortalUnread, getPortalMessages, sendPortalMessage, getStaffThreads, getStaffUnread, getStaffMessages, sendStaffMessage } from "../controllers/chat.controller.js";
import { getAthleteProgress, createProgress, updateProgress, deleteProgress, changeRank, getMetricTemplates, createMetricTemplate, getProgressList } from "../controllers/progress.controller.js";
import { getGymSettings, updateGymSettings, updateGymPreferences, getMyProfile, updateMyProfile, changeMyPassword } from "../controllers/settings.controller.js";
import { getOverview, getRevenueChart, getAttendanceChart, getMembersGrowth, getTopCoaches, getAgeCategoryDistribution, getRecentActivity } from "../controllers/dashboard.controller.js";
import { registerGym, checkSlugAvailability, getGymBySlug } from "../controllers/onboarding.controller.js";
import { getAllGyms, getPlatformOverview, updateGymStatus, updateGymPlan, getGymDetail, deleteGymPermanently, sendNotificationToOwners } from "../controllers/superadmin.controller.js";

const router = Router();

// ✅ multer: يستقبل الملف في الذاكرة (Buffer) مباشرة، دون حفظه على القرص أبداً
// (متوافق مع طبيعة Railway اللا-دائمة)، بحد أقصى 5 ميجابايت، وصور فقط
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("يُسمح فقط بملفات الصور"));
  },
});

// حارس صلاحية خاص بالمطوّر فقط (Super Admin)
const superAdminOnly = authorize("super_admin");

// ── Health ────────────────────────────────────────────────────
router.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

// ── Auth ──────────────────────────────────────────────────────
router.post("/auth/login", [
  body("phone").notEmpty().withMessage("رقم الهاتف مطلوب"),
  body("password").notEmpty().withMessage("كلمة المرور مطلوبة"),
  validate,
], login);
router.get("/auth/me", authenticate, me);

// ── Members ───────────────────────────────────────────────────
router.get   ("/members/stats",                authenticate, perm("members.view"),  getMembersStats);
router.post  ("/members/:id/reset-password",   authenticate, ownerOnly,  resetPassword);
router.post  ("/members/:id/avatar",          authenticate, perm("members.edit"),  avatarUpload.single("avatar"), uploadMemberAvatar);
// قائمة الأعضاء تُستخدم أيضاً لاختيار الرياضي في الاشتراكات والتقدم والحضور
const readMembers = perm("members.view", "subscriptions.view", "subscriptions.add", "payments.view", "progress.view", "attendance.view", "sessions.view");
router.get   ("/members",                       authenticate, readMembers,  getMembers);
router.get   ("/members/:id",                   authenticate, readMembers,  getMember);
router.post  ("/members",                       authenticate, perm("members.add"), [
  body("fullName").notEmpty().withMessage("الاسم الكامل مطلوب"),
  body("phone").custom((value, { req }) => {
    if (!req.body.guardianId && !value) throw new Error("رقم الهاتف مطلوب");
    return true;
  }),
  body("role").optional().isIn(["athlete","guardian"]).withMessage("الدور غير صحيح"),
  validate,
], createMember);
router.patch ("/members/:id",   authenticate, perm("members.edit"), updateMember);
router.delete("/members/:id",   authenticate, perm("members.delete"), deleteMember);
router.delete("/members/:id/permanent", authenticate, ownerOnly, deleteMemberPermanently);

// ── Categories ────────────────────────────────────────────────
router.get   ("/categories",     authenticate, staffOnly,    getCategories);
router.post  ("/categories",     authenticate, coachAndAbove, [
  body("name").notEmpty().withMessage("اسم الفئة مطلوب"), validate,
], createCategory);
router.patch ("/categories/:id", authenticate, coachAndAbove, updateCategory);
router.delete("/categories/:id", authenticate, ownerOnly,     deleteCategory);
router.delete("/categories/:id/permanent", authenticate, ownerOnly, deleteCategoryPermanently);

// ── Staff (المدربون والمساعدون) ─────────────────────────────────
router.get   ("/staff",     authenticate, staffOnly, getStaff);
router.get   ("/staff/:id", authenticate, staffOnly, getStaffMember);
router.post  ("/staff",     authenticate, ownerOnly, [
  body("fullName").notEmpty().withMessage("الاسم الكامل مطلوب"),
  body("phone").notEmpty().withMessage("رقم الهاتف مطلوب"),
  body("role").optional().isIn(["coach","assistant"]).withMessage("الدور غير صحيح"),
  validate,
], createStaff);
router.patch ("/staff/:id", authenticate, ownerOnly, updateStaff);
router.delete("/staff/:id", authenticate, ownerOnly, deleteStaff);

// ── Plans ─────────────────────────────────────────────────────
router.get   ("/plans",     authenticate, staffOnly,    getPlans);
router.post  ("/plans",     authenticate, coachAndAbove, [
  body("name").notEmpty().withMessage("اسم الخطة مطلوب"),
  body("durationDays").isInt({ min: 1 }).withMessage("المدة يجب أن تكون يوماً على الأقل"),
  body("price").isFloat({ min: 0 }).withMessage("السعر يجب أن يكون رقماً"),
  validate,
], createPlan);
router.patch ("/plans/:id", authenticate, coachAndAbove, updatePlan);
router.delete("/plans/:id", authenticate, ownerOnly,     deletePlan);
router.delete("/plans/:id/permanent", authenticate, ownerOnly, deletePlanPermanently);

// ── Subscriptions ─────────────────────────────────────────────
router.get   ("/subscriptions/stats", authenticate, perm("subscriptions.view", "payments.view"), getSubscriptionStats);
router.get   ("/subscriptions",       authenticate, perm("subscriptions.view", "payments.view"), getSubscriptions);
router.get   ("/subscriptions/:id",   authenticate, perm("subscriptions.view", "payments.view"), getSubscription);
router.post  ("/subscriptions",       authenticate, perm("subscriptions.add"), [
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  body("planId").notEmpty().withMessage("الخطة مطلوبة"),
  validate,
], createSubscription);
router.patch ("/subscriptions/:id",   authenticate, perm("subscriptions.edit"), updateSubscription);
router.delete("/subscriptions/:id",   authenticate, perm("subscriptions.delete"), deleteSubscription);

// ── Payments ──────────────────────────────────────────────────
router.get   ("/payments/stats", authenticate, perm("payments.view", "subscriptions.view"), getPaymentsStats);
router.get   ("/payments",       authenticate, perm("payments.view", "subscriptions.view"), getPayments);
router.post  ("/payments",       authenticate, perm("payments.add"), [
  body("subscriptionId").notEmpty().withMessage("الاشتراك مطلوب"),
  body("amount").isFloat({ min: 0.01 }).withMessage("المبلغ يجب أن يكون أكبر من صفر"),
  validate,
], createPayment);
router.delete("/payments/:id",   authenticate, perm("payments.delete"), deletePayment);

// ── Rooms ─────────────────────────────────────────────────────
router.get   ("/rooms",                   authenticate, staffOnly, getRooms);
router.post  ("/rooms",                   authenticate, ownerOnly, [
  body("name").notEmpty().withMessage("اسم القاعة مطلوب"), validate,
], createRoom);
router.patch ("/rooms/:id",               authenticate, ownerOnly, updateRoom);
router.delete("/rooms/:id",               authenticate, ownerOnly, deleteRoom);
router.delete("/rooms/:id/permanent",     authenticate, ownerOnly, deleteRoomPermanently);
router.post  ("/rooms/:id/regenerate-qr", authenticate, ownerOnly, regenerateQR);

// ── Sessions ──────────────────────────────────────────────────
router.get   ("/sessions/today",  authenticate, perm("sessions.view", "attendance.view"), getTodaySessions);
router.get   ("/sessions",        authenticate, perm("sessions.view", "attendance.view"), getSessions);
router.get   ("/sessions/:id",    authenticate, perm("sessions.view", "attendance.view"), getSession);
router.post  ("/sessions",        authenticate, perm("sessions.add"), [
  body("title").notEmpty().withMessage("عنوان الحصة مطلوب"),
  body("sessionDate").notEmpty().withMessage("تاريخ الحصة مطلوب"),
  body("startTime").notEmpty().withMessage("وقت البداية مطلوب"),
  body("endTime").notEmpty().withMessage("وقت النهاية مطلوب"),
  body("coachId").notEmpty().withMessage("المدرب مطلوب"),
  body("sessionType").optional().isIn(["training","competition"]).withMessage("نوع الحصة غير صحيح"),
  validate,
], createSession);
router.patch ("/sessions/:id",    authenticate, perm("sessions.edit"), [
  body("sessionType").optional().isIn(["training","competition"]).withMessage("نوع الحصة غير صحيح"),
  validate,
], updateSession);
router.get   ("/sessions/:id/results", authenticate, perm("sessions.view", "attendance.view"), getSessionResults);
router.put   ("/sessions/:id/results", authenticate, perm("sessions.edit"), saveSessionResults);
router.delete("/sessions/:id",    authenticate, perm("sessions.delete"), cancelSession);
router.delete("/sessions/:id/series", authenticate, ownerOnly, deleteRecurringSeries);

// ── Attendance ────────────────────────────────────────────────
router.post("/attendance/scan",                   authenticate, [
  body("qrCode").notEmpty().withMessage("رمز QR مطلوب"),
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  validate,
], scanQR);
router.get ("/attendance/session/:sessionId",     authenticate, perm("attendance.view", "sessions.view"), getSessionAttendance);
router.post("/attendance/manual",                 authenticate, perm("attendance.manage"), [
  body("sessionId").notEmpty().withMessage("الحصة مطلوبة"),
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  body("status").isIn(["present","absent","late","excused"]).withMessage("الحالة غير صحيحة"),
  validate,
], manualAttendance);
router.post("/attendance/bulk",                   authenticate, perm("attendance.manage"), [
  body("sessionId").notEmpty().withMessage("الحصة مطلوبة"),
  body("records").isArray().withMessage("قائمة الحضور مطلوبة"),
  validate,
], bulkAttendance);
router.get ("/attendance/athlete/:athleteId",     authenticate, perm("attendance.view", "members.view"), getAthleteAttendance);
router.get ("/attendance/overview",               authenticate, perm("attendance.view", "stats.view"), getAttendanceOverview);
router.get ("/attendance/trend",                  authenticate, perm("attendance.view", "stats.view"), getAttendanceTrend);
router.get ("/attendance/leaderboard",             authenticate, perm("attendance.view", "stats.view"), getAttendanceLeaderboard);
router.get ("/attendance/by-category",             authenticate, perm("attendance.view", "stats.view"), getAttendanceByCategory);
router.get ("/attendance/recent-sessions",         authenticate, perm("attendance.view", "stats.view"), getRecentSessionsAttendance);

// ── Notifications ─────────────────────────────────────────────
router.post ("/notifications/token",            authenticate, saveToken);
router.get  ("/notifications",                   authenticate, getNotifications);
router.patch("/notifications/:id/read",          authenticate, markRead);
router.post ("/notifications/send",              authenticate, staffOnly, [
  body("userIds").isArray({ min: 1 }).withMessage("يجب تحديد مستخدم واحد على الأقل"),
  body("title").notEmpty().withMessage("العنوان مطلوب"),
  body("body").notEmpty().withMessage("نص الإشعار مطلوب"),
  validate,
], sendManual);
router.get  ("/notifications/notify-expiring",   authenticate, staffOnly, notifyExpiringSubscriptions);

// ── Portal (الرياضي / ولي الأمر) ────────────────────────────────
const portalOnly = authorize("athlete", "guardian");

router.get("/portal/my-athletes",              authenticate, portalOnly, getMyAthletes);
router.get("/portal/dashboard/:athleteId",     authenticate, portalOnly, getDashboard);
router.get("/portal/schedule/:athleteId",      authenticate, portalOnly, getSchedule);
router.get("/portal/attendance/:athleteId",    authenticate, portalOnly, getAttendanceHistory);
router.get("/portal/subscription/:athleteId",  authenticate, portalOnly, getSubscriptionHistory);
// ── Chat (رسائل الرياضي/ولي الأمر ↔ المدرب) ───────────────────
router.get ("/portal/chat/unread",                      authenticate, portalOnly, getPortalUnread);
router.get ("/portal/chat/threads/:threadId/messages",  authenticate, portalOnly, getPortalMessages);
router.get ("/portal/chat/:athleteId/recipients",       authenticate, portalOnly, getPortalRecipients);
router.get ("/portal/chat/:athleteId/threads",          authenticate, portalOnly, getPortalThreads);
router.post("/portal/chat/:athleteId/messages",         authenticate, portalOnly, [
  body("staffId").notEmpty().withMessage("المستلم مطلوب"),
  body("body").trim().notEmpty().withMessage("نص الرسالة مطلوب").isLength({ max: 2000 }).withMessage("الرسالة طويلة جداً"),
  validate,
], sendPortalMessage);
router.get ("/chat/unread",                             authenticate, perm("messages.view"), getStaffUnread);
router.get ("/chat/threads",                            authenticate, perm("messages.view"), getStaffThreads);
router.get ("/chat/threads/:threadId/messages",         authenticate, perm("messages.view"), getStaffMessages);
router.post("/chat/threads/:threadId/messages",         authenticate, perm("messages.view"), [
  body("body").trim().notEmpty().withMessage("نص الرسالة مطلوب").isLength({ max: 2000 }).withMessage("الرسالة طويلة جداً"),
  validate,
], sendStaffMessage);

router.post("/portal/scan",                    authenticate, portalOnly, [
  body("qrCode").notEmpty().withMessage("رمز QR مطلوب"),
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  validate,
], scanAttendance);

// ── Progress (متابعة التقدم) ────────────────────────────────────
router.get   ("/progress/list",              authenticate, perm("progress.view"), getProgressList);
router.get   ("/progress/metrics-templates", authenticate, perm("progress.view", "progress.manage"), getMetricTemplates);
router.post  ("/progress/metrics-templates", authenticate, perm("progress.manage"), createMetricTemplate);
router.get   ("/progress/athlete/:athleteId",authenticate, getAthleteProgress); // staff أو portal (تحقق داخلي)
router.post  ("/progress",                    authenticate, perm("progress.manage"), [
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  validate,
], createProgress);
router.patch ("/progress/:id",                authenticate, perm("progress.manage"), updateProgress);
router.delete("/progress/:id",                authenticate, perm("progress.manage"), deleteProgress);
router.post  ("/progress/rank-change",        authenticate, perm("progress.manage"), [
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  body("newRank").notEmpty().withMessage("الرتبة الجديدة مطلوبة"),
  validate,
], changeRank);

// ── Settings ──────────────────────────────────────────────────
router.get   ("/settings/gym",              authenticate, staffOnly, getGymSettings);
router.patch ("/settings/gym",              authenticate, ownerOnly, updateGymSettings);
router.patch ("/settings/gym/preferences",  authenticate, ownerOnly, updateGymPreferences);
router.get   ("/settings/profile",          authenticate, getMyProfile);
router.patch ("/settings/profile",          authenticate, updateMyProfile);
router.post  ("/settings/change-password",  authenticate, [
  body("currentPassword").notEmpty().withMessage("كلمة المرور الحالية مطلوبة"),
  body("newPassword").isLength({ min: 6 }).withMessage("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"),
  validate,
], changeMyPassword);

// ── Dashboard ─────────────────────────────────────────────────
router.get("/dashboard/overview",                  authenticate, perm("stats.view"), getOverview);
router.get("/dashboard/revenue-chart",              authenticate, perm("stats.view"), getRevenueChart);
router.get("/dashboard/attendance-chart",           authenticate, perm("stats.view"), getAttendanceChart);
router.get("/dashboard/members-growth",             authenticate, perm("stats.view"), getMembersGrowth);
router.get("/dashboard/top-coaches",                authenticate, perm("stats.view"), getTopCoaches);
router.get("/dashboard/age-category-distribution",  authenticate, perm("stats.view"), getAgeCategoryDistribution);
router.get("/dashboard/recent-activity",            authenticate, perm("stats.view"), getRecentActivity);

// ── Onboarding (تسجيل صالة جديدة ذاتياً) ────────────────────────
router.post("/onboarding/register", [
  body("gymName").notEmpty().withMessage("اسم الصالة مطلوب"),
  body("ownerName").notEmpty().withMessage("اسم المالك مطلوب"),
  body("ownerPhone").notEmpty().withMessage("رقم الهاتف مطلوب"),
  body("password").isLength({ min: 6 }).withMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  validate,
], registerGym);
router.get("/onboarding/check-slug", checkSlugAvailability);
router.get("/onboarding/gym/:slug", getGymBySlug);

// ── Super Admin (لوحة إدارة المنصة — للمطوّر فقط) ────────────────
router.get  ("/superadmin/overview",           authenticate, superAdminOnly, getPlatformOverview);
router.get  ("/superadmin/gyms",               authenticate, superAdminOnly, getAllGyms);
router.get  ("/superadmin/gyms/:id",           authenticate, superAdminOnly, getGymDetail);
router.patch("/superadmin/gyms/:id/status",    authenticate, superAdminOnly, [
  body("status").isIn(["trial","active","suspended","cancelled"]).withMessage("حالة غير صحيحة"),
  validate,
], updateGymStatus);
router.patch("/superadmin/gyms/:id/plan",      authenticate, superAdminOnly, updateGymPlan);
router.delete("/superadmin/gyms/:id",          authenticate, superAdminOnly, [
  body("confirmSlug").notEmpty().withMessage("يجب كتابة رابط الصالة (slug) لتأكيد الحذف"),
  validate,
], deleteGymPermanently);
router.post ("/superadmin/notify",             authenticate, superAdminOnly, [
  body("title").notEmpty().withMessage("العنوان مطلوب"),
  body("body").notEmpty().withMessage("نص الإشعار مطلوب"),
  validate,
], sendNotificationToOwners);

export default router;