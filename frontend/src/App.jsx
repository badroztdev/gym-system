// src/App.jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import "@/styles/globals.css";

// Firebase - تهيئة الإشعارات
import { requestNotificationPermission, onForegroundMessage } from "@/services/firebase.js";
import { notificationsService } from "@/services/notifications.service";

// ── تشغيل صوت التنبيه عند استقبال إشعار ─────────────────────
function playNotificationSound() {
  try {
    const audio = new Audio("/notification.wav");
    audio.volume = 0.6;
    audio.play().catch(() => {
      // بعض المتصفحات تمنع التشغيل التلقائي قبل أي تفاعل من المستخدم — نتجاهل الخطأ بصمت
    });
  } catch { /* تجاهل */ }
}

// Layout (لوحة التحكم)
import Layout from "@/components/layout/Layout";

// Pages (لوحة التحكم)
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

// Portal (الرياضي / ولي الأمر)
import PortalLayout   from "@/portal/components/PortalLayout";
import PortalLogin    from "@/portal/pages/PortalLogin";
import PortalHome     from "@/portal/pages/PortalHome";
import PortalSchedule from "@/portal/pages/PortalSchedule";
import PortalScan     from "@/portal/pages/PortalScan";
import PortalProfile  from "@/portal/pages/PortalProfile";
import PortalProgress from "@/portal/pages/PortalProgress";

// Lazy placeholders for future pages
const Placeholder = ({ title }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, minHeight: 400, color: "var(--muted)" }}>
    <div style={{ fontSize: 40 }}>🚧</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--muted-lt)" }}>{title}</div>
    <div style={{ fontSize: 13 }}>هذه الصفحة قيد التطوير</div>
  </div>
);

// Protected route wrapper
function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  useEffect(() => {
    if (!token || !user) return;

    // طلب إذن الإشعارات وحفظ الـ token — مع تأخير بسيط
    const timer = setTimeout(async () => {
      try {
        if (!("Notification" in window)) return;
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await notificationsService.saveToken(fcmToken);
          console.log("✅ FCM token saved");
        }
      } catch (e) {
        console.warn("FCM init failed:", e.message);
      }
    }, 2000); // انتظر ثانيتين بعد تسجيل الدخول

    // الاستماع للإشعارات عندما التطبيق مفتوح
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

  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// حارس مخصص لمسارات الـ Portal — يقبل فقط athlete/guardian
function ProtectedPortalRoute({ children }) {
  const token = useAuthStore(s => s.token);
  const user  = useAuthStore(s => s.user);

  useEffect(() => {
    if (!token || !user) return;
    (async () => {
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) await notificationsService.saveToken(fcmToken);
      } catch (e) { console.warn("FCM init failed:", e.message); }
    })();
    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title) {
        playNotificationSound();
        toast(`🔔 ${title}: ${body || ""}`, { duration: 6000 });
      }
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [token, user?.id]);

  if (!token) return <Navigate to="/portal/login" replace />;
  if (!["athlete", "guardian"].includes(user?.role)) return <Navigate to="/portal/login" replace />;
  return children;
}

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,     // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// يوجّه المستخدم تلقائياً حسب دوره بعد تسجيل الدخول
// super_admin → لوحة إدارة المنصة، أي دور آخر → لوحة التحكم العادية
function HomeRedirect() {
  const user = useAuthStore(s => s.user);
  if (user?.role === "super_admin") return <Navigate to="/superadmin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/superadmin" element={
            <ProtectedRoute>
              <SuperAdmin />
            </ProtectedRoute>
          } />

          {/* Protected dashboard */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="members"       element={<Members />} />
            <Route path="sessions"      element={<Sessions />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="payments"      element={<Navigate to="/subscriptions" replace />} />
            <Route path="attendance"    element={<Placeholder title="الحضور والغياب" />} />
            <Route path="progress"      element={<Progress />} />
            <Route path="team"          element={<Team />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings"      element={<Settings />} />
          </Route>

          {/* ══ Portal — الرياضي / ولي الأمر ══════════════════ */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal" element={
            <ProtectedPortalRoute>
              <PortalLayout />
            </ProtectedPortalRoute>
          }>
            <Route index             element={<Navigate to="/portal/home" replace />} />
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