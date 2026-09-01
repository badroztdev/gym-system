// src/routes/index.js
import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import { authenticate, staffOnly, coachAndAbove, ownerOnly, authorize } from "../middleware/auth.js";

import { login, me } from "../controllers/auth.controller.js";
import { getMembers, getMember, createMember, updateMember, deleteMember, getMembersStats, resetPassword } from "../controllers/members.controller.js";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categories.controller.js";
import { getStaff, getStaffMember, createStaff, updateStaff, deleteStaff } from "../controllers/staff.controller.js";
import { getPlans, createPlan, updatePlan, deletePlan } from "../controllers/plans.controller.js";
import { getSubscriptions, getSubscription, createSubscription, updateSubscription, getSubscriptionStats } from "../controllers/subscriptions.controller.js";
import { getPayments, createPayment, deletePayment, getPaymentsStats } from "../controllers/payments.controller.js";
import { getRooms, createRoom, updateRoom, deleteRoom, regenerateQR } from "../controllers/rooms.controller.js";
import { getSessions, getSession, createSession, updateSession, cancelSession, getTodaySessions } from "../controllers/sessions.controller.js";
import { scanQR, getSessionAttendance, manualAttendance, getAthleteAttendance } from "../controllers/attendance.controller.js";
import { saveToken, getNotifications, markRead, sendManual, notifyExpiringSubscriptions } from "../controllers/notifications.controller.js";
import { getMyAthletes, getDashboard, getSchedule, getAttendanceHistory, getSubscriptionHistory, scanAttendance } from "../controllers/portal.controller.js";
import { getAthleteProgress, createProgress, updateProgress, deleteProgress, changeRank, getMetricTemplates, createMetricTemplate, getProgressList } from "../controllers/progress.controller.js";
import { getGymSettings, updateGymSettings, updateGymPreferences, getMyProfile, updateMyProfile, changeMyPassword } from "../controllers/settings.controller.js";
import { getOverview, getRevenueChart, getAttendanceChart, getMembersGrowth, getTopCoaches, getAgeCategoryDistribution, getRecentActivity } from "../controllers/dashboard.controller.js";
import { registerGym, checkSlugAvailability } from "../controllers/onboarding.controller.js";
import { getAllGyms, getPlatformOverview, updateGymStatus, updateGymPlan, getGymDetail } from "../controllers/superadmin.controller.js";
import { checkGymStatus } from "../middleware/gymStatus.js";

const router = Router();

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
router.get   ("/members/stats",                authenticate, staffOnly,  getMembersStats);
router.post  ("/members/:id/reset-password",   authenticate, ownerOnly,  resetPassword);
router.get   ("/members",                       authenticate, staffOnly,  getMembers);
router.get   ("/members/:id",                   authenticate, staffOnly,  getMember);
router.post  ("/members",                       authenticate, staffOnly, [
  body("fullName").notEmpty().withMessage("الاسم الكامل مطلوب"),
  body("phone").custom((value, { req }) => {
    if (!req.body.guardianId && !value) throw new Error("رقم الهاتف مطلوب");
    return true;
  }),
  body("role").optional().isIn(["athlete","guardian"]).withMessage("الدور غير صحيح"),
  validate,
], createMember);
router.patch ("/members/:id",   authenticate, staffOnly, updateMember);
router.delete("/members/:id",   authenticate, ownerOnly, deleteMember);

// ── Categories ────────────────────────────────────────────────
router.get   ("/categories",     authenticate, staffOnly,    getCategories);
router.post  ("/categories",     authenticate, coachAndAbove, [
  body("name").notEmpty().withMessage("اسم الفئة مطلوب"), validate,
], createCategory);
router.patch ("/categories/:id", authenticate, coachAndAbove, updateCategory);
router.delete("/categories/:id", authenticate, ownerOnly,     deleteCategory);

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

// ── Subscriptions ─────────────────────────────────────────────
router.get   ("/subscriptions/stats", authenticate, staffOnly, getSubscriptionStats);
router.get   ("/subscriptions",       authenticate, staffOnly, getSubscriptions);
router.get   ("/subscriptions/:id",   authenticate, staffOnly, getSubscription);
router.post  ("/subscriptions",       authenticate, staffOnly, [
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  body("planId").notEmpty().withMessage("الخطة مطلوبة"),
  validate,
], createSubscription);
router.patch ("/subscriptions/:id",   authenticate, staffOnly, updateSubscription);

// ── Payments ──────────────────────────────────────────────────
router.get   ("/payments/stats", authenticate, staffOnly, getPaymentsStats);
router.get   ("/payments",       authenticate, staffOnly, getPayments);
router.post  ("/payments",       authenticate, staffOnly, [
  body("subscriptionId").notEmpty().withMessage("الاشتراك مطلوب"),
  body("amount").isFloat({ min: 0.01 }).withMessage("المبلغ يجب أن يكون أكبر من صفر"),
  validate,
], createPayment);
router.delete("/payments/:id",   authenticate, ownerOnly, deletePayment);

// ── Rooms ─────────────────────────────────────────────────────
router.get   ("/rooms",                   authenticate, staffOnly, getRooms);
router.post  ("/rooms",                   authenticate, ownerOnly, [
  body("name").notEmpty().withMessage("اسم القاعة مطلوب"), validate,
], createRoom);
router.patch ("/rooms/:id",               authenticate, ownerOnly, updateRoom);
router.delete("/rooms/:id",               authenticate, ownerOnly, deleteRoom);
router.post  ("/rooms/:id/regenerate-qr", authenticate, ownerOnly, regenerateQR);

// ── Sessions ──────────────────────────────────────────────────
router.get   ("/sessions/today",  authenticate, staffOnly,    getTodaySessions);
router.get   ("/sessions",        authenticate, staffOnly,    getSessions);
router.get   ("/sessions/:id",    authenticate, staffOnly,    getSession);
router.post  ("/sessions",        authenticate, coachAndAbove, [
  body("title").notEmpty().withMessage("عنوان الحصة مطلوب"),
  body("sessionDate").notEmpty().withMessage("تاريخ الحصة مطلوب"),
  body("startTime").notEmpty().withMessage("وقت البداية مطلوب"),
  body("endTime").notEmpty().withMessage("وقت النهاية مطلوب"),
  body("coachId").notEmpty().withMessage("المدرب مطلوب"),
  validate,
], createSession);
router.patch ("/sessions/:id",    authenticate, coachAndAbove, updateSession);
router.delete("/sessions/:id",    authenticate, coachAndAbove, cancelSession);

// ── Attendance ────────────────────────────────────────────────
router.post("/attendance/scan",                   authenticate, [
  body("qrCode").notEmpty().withMessage("رمز QR مطلوب"),
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  validate,
], scanQR);
router.get ("/attendance/session/:sessionId",     authenticate, staffOnly,   getSessionAttendance);
router.post("/attendance/manual",                 authenticate, staffOnly,   [
  body("sessionId").notEmpty().withMessage("الحصة مطلوبة"),
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  body("status").isIn(["present","absent","late","excused"]).withMessage("الحالة غير صحيحة"),
  validate,
], manualAttendance);
router.get ("/attendance/athlete/:athleteId",     authenticate, staffOnly,   getAthleteAttendance);

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
router.post("/portal/scan",                    authenticate, portalOnly, [
  body("qrCode").notEmpty().withMessage("رمز QR مطلوب"),
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  validate,
], scanAttendance);

// ── Progress (متابعة التقدم) ────────────────────────────────────
router.get   ("/progress/list",              authenticate, staffOnly, getProgressList);
router.get   ("/progress/metrics-templates", authenticate, staffOnly, getMetricTemplates);
router.post  ("/progress/metrics-templates", authenticate, coachAndAbove, createMetricTemplate);
router.get   ("/progress/athlete/:athleteId",authenticate, getAthleteProgress); // staff أو portal (تحقق داخلي)
router.post  ("/progress",                    authenticate, coachAndAbove, [
  body("athleteId").notEmpty().withMessage("الرياضي مطلوب"),
  validate,
], createProgress);
router.patch ("/progress/:id",                authenticate, coachAndAbove, updateProgress);
router.delete("/progress/:id",                authenticate, coachAndAbove, deleteProgress);
router.post  ("/progress/rank-change",        authenticate, coachAndAbove, [
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
router.get("/dashboard/overview",                  authenticate, staffOnly, getOverview);
router.get("/dashboard/revenue-chart",              authenticate, staffOnly, getRevenueChart);
router.get("/dashboard/attendance-chart",           authenticate, staffOnly, getAttendanceChart);
router.get("/dashboard/members-growth",             authenticate, staffOnly, getMembersGrowth);
router.get("/dashboard/top-coaches",                authenticate, staffOnly, getTopCoaches);
router.get("/dashboard/age-category-distribution",  authenticate, staffOnly, getAgeCategoryDistribution);
router.get("/dashboard/recent-activity",            authenticate, staffOnly, getRecentActivity);

// ── Onboarding (تسجيل صالة جديدة ذاتياً) ────────────────────────
router.post("/onboarding/register", [
  body("gymName").notEmpty().withMessage("اسم الصالة مطلوب"),
  body("ownerName").notEmpty().withMessage("اسم المالك مطلوب"),
  body("ownerPhone").notEmpty().withMessage("رقم الهاتف مطلوب"),
  body("password").isLength({ min: 6 }).withMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  validate,
], registerGym);
router.get("/onboarding/check-slug", checkSlugAvailability);

// ── Super Admin (لوحة إدارة المنصة — للمطوّر فقط) ────────────────
router.get  ("/superadmin/overview",           authenticate, superAdminOnly, getPlatformOverview);
router.get  ("/superadmin/gyms",               authenticate, superAdminOnly, getAllGyms);
router.get  ("/superadmin/gyms/:id",           authenticate, superAdminOnly, getGymDetail);
router.patch("/superadmin/gyms/:id/status",    authenticate, superAdminOnly, [
  body("status").isIn(["trial","active","suspended","cancelled"]).withMessage("حالة غير صحيحة"),
  validate,
], updateGymStatus);
router.patch("/superadmin/gyms/:id/plan",      authenticate, superAdminOnly, updateGymPlan);

export default router;