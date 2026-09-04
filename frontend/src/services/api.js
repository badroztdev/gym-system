// src/services/api.js
import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Request: attach JWT ───────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// يمنع تكرار التوجيه لشاشة الاشتراك عدة مرات لو فشلت عدة طلبات معاً
let redirectingToSubscriptionScreen = false;

// ── Response: handle errors globally ─────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status  = err.response?.status;
    const data    = err.response?.data;
    const message = data?.message;

    if (status === 401) {
      const user = useAuthStore.getState().user;
      useAuthStore.getState().logout();
      toast.error("انتهت الجلسة، يرجى تسجيل الدخول مجدداً");

      const isPortalUser = user && ["athlete", "guardian"].includes(user.role);
      const isPortalPath = window.location.pathname.startsWith("/portal");

      if (isPortalUser || isPortalPath) {
        window.location.href = "/portal/login";
      } else {
        window.location.href = "/login";
      }
    }
    // ✅ حالة خاصة: اشتراك الصالة معلَّق/منتهٍ — نوجّه لشاشة واحدة واضحة
    // بدل ترك كل صفحة تعرض خطأ Toast منفصل ومربك
    else if (status === 403 && data?.code === "SUBSCRIPTION_ISSUE") {
      if (!redirectingToSubscriptionScreen) {
        redirectingToSubscriptionScreen = true;
        sessionStorage.setItem("subscriptionIssueMessage", message || "");
        sessionStorage.setItem("subscriptionIssueReason", data?.reason || "");
        window.location.href = "/subscription-required";
      }
    }
    else if (status === 403) {
      toast.error(message || "ليس لديك صلاحية لهذا الإجراء");
    } else if (status >= 500) {
      toast.error("خطأ في الخادم، يرجى المحاولة لاحقاً");
    } else if (message && status !== 401) {
      toast.error(message);
    }

    return Promise.reject(err);
  }
);

export default api;
