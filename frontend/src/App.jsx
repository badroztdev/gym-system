// src/App.jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import "@/styles/globals.css";

// Firebase - تهيئة الإشعارات
import { requestNotificationPermission, onForegroundMessage } from "@/services/firebase.js";
import { notificationsService } from "@/services/notifications.service";

function playNotificationSound() {
  try {
    const audio = new Audio("/notification.wav");
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch { /* تجاهل */ }
}

// Layout (لوحة التحكم)
import Layout from "@/components/layout/Layout";

// Pages (لوحة التحكم)
import Landing       from "@/pages/Landing";
import Login         from "@/pages/Login";
import SignUp        from "@/pages/SignUp";
import SuperAdmin    from "@/pages/SuperAdmin";
import Members       from "@/pages/Members";
import Subscriptions from "@/pages/Subscriptions";
import Sessions      from "@/pages/Sessions";
import Team          from "@/pages/Team";
import Notifications from "@/pages/Notifications";
import Progress      from "@/pages/Progress";
import Settings      from "@/pages/Settings";
import Dashboard     from "@/pages/Dashboard";
import Attendance    from "@/pages/Attendance";

// Portal (الرياضي / ولي الأمر)
import PortalLayout   from "@/portal/components/PortalLayout";
import PortalLogin    from "@/portal/pages/PortalLogin";
import PortalHome     from "@/portal/pages/PortalHome";
import PortalSchedule from "@/portal/pages/PortalSchedule";
import PortalScan     from "@/portal/pages/PortalScan";
import PortalProfile  from "@/portal/pages/PortalProfile";
import PortalProgress from "@/portal/pages/PortalProgress";

const Placeholder = ({ title }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, minHeight: 400, color: "var(--muted)" }}>
    <div style={{ fontSize: 40 }}>🚧</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--muted-lt)" }}>{title}</div>
    <div style={{ fontSize: 13 }}>هذه الصفحة قيد التطوير</div>
  </div>
);

// ── تهيئة إشعارات Firebase (مشتركة بين لوحة التحكم والبوابة) ──
function useFcmSetup(token, user) {
  useEffect(() => {
    if (!token || !user) return;
    const timer = setTimeout(async () => {
      try {
        if (!("Notification" in window)) return;
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await notificationsService.saveToken(fcmToken);
          console.log("✅ FCM token saved");
        }
      } catch (e) { console.warn("FCM init failed:", e.message); }
    }, 2000);

    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title) {
        playNotificationSound();
        toast(`🔔 ${title}: ${body || ""}`, { duration: 6000 });
      }
    });

    return () => {
      clearTimeout(timer);
      if (typeof unsub === "function") unsub();
    };
  }, [token, user?.id]);
}

// ✅ حارس أمان الصالة: يتحقق أن :gymSlug في الرابط يطابق فعلاً صالة المستخدم
// المسجَّل دخوله. يمنع محاولة مستخدم صالة A من كتابة رابط صالة B يدوياً
function GymGuard({ children }) {
  const { gymSlug } = useParams();
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  useFcmSetup(token, user);

  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === "super_admin") return <Navigate to="/superadmin" replace />;
  if (!user?.gymSlug) return <Navigate to="/login" replace />;
  if (user.gymSlug !== gymSlug) return <Navigate to={`/${user.gymSlug}/dashboard`} replace />;

  return children;
}

// حارس لوحة إدارة المنصة (super_admin فقط)
function SuperAdminGuard({ children }) {
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  useFcmSetup(token, user);

  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== "super_admin") {
    return <Navigate to={user?.gymSlug ? `/${user.gymSlug}/dashboard` : "/login"} replace />;
  }
  return children;
}

// حارس مخصص لمسارات الـ Portal — يقبل فقط athlete/guardian
// ✅ نفس نمط GymGuard: يتحقق أن :gymSlug في الرابط يطابق صالة المستخدم فعلاً
function ProtectedPortalRoute({ children }) {
  const { gymSlug } = useParams();
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  useFcmSetup(token, user);

  if (!token) return <Navigate to="/portal/login" replace />;
  if (!["athlete", "guardian"].includes(user?.role)) return <Navigate to="/portal/login" replace />;
  if (!user?.gymSlug) return <Navigate to="/portal/login" replace />;
  if (user.gymSlug !== gymSlug) return <Navigate to={`/portal/${user.gymSlug}/home`} replace />;
  return children;
}

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// يوجّه من "/" حسب حالة تسجيل الدخول
// ✅ الجذر "/": غير المسجَّلين يرون الصفحة الرئيسية التسويقية،
// المسجَّلون يُوجَّهون تلقائياً للوحتهم الصحيحة حسب دورهم
function RootRedirect() {
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  if (!token) return <Landing />;
  if (user?.role === "super_admin") return <Navigate to="/superadmin" replace />;
  if (user?.gymSlug) return <Navigate to={`/${user.gymSlug}/dashboard`} replace />;
  return <Landing />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          {/* الجذر — يوجّه تلقائياً حسب حالة تسجيل الدخول */}
          <Route path="/" element={<RootRedirect />} />

          {/* لوحة إدارة المنصة (super_admin فقط) */}
          <Route path="/superadmin" element={
            <SuperAdminGuard>
              <SuperAdmin />
            </SuperAdminGuard>
          } />

          {/* ✅ لوحة تحكم كل صالة تحت رابطها الخاص: /{gymSlug}/... */}
          <Route path="/:gymSlug" element={
            <GymGuard>
              <Layout />
            </GymGuard>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="members"       element={<Members />} />
            <Route path="sessions"      element={<Sessions />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="attendance"    element={<Attendance />} />
            <Route path="progress"      element={<Progress />} />
            <Route path="team"          element={<Team />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings"      element={<Settings />} />
          </Route>

          {/* ══ Portal — الرياضي / ولي الأمر ══════════════════════ */}
          {/* تسجيل الدخول موحَّد لكل الصالات، وبعده يُوجَّه لرابط الصالة الخاص */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal/:gymSlug" element={
            <ProtectedPortalRoute>
              <PortalLayout />
            </ProtectedPortalRoute>
          }>
            <Route index             element={<Navigate to="home" replace />} />
            <Route path="home"       element={<PortalHome />} />
            <Route path="schedule"   element={<PortalSchedule />} />
            <Route path="scan"       element={<PortalScan />} />
            <Route path="profile"    element={<PortalProfile />} />
            <Route path="progress"   element={<PortalProgress />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            background: "var(--card)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            direction: "rtl",
          },
        }}
      />
    </QueryClientProvider>
  );
}