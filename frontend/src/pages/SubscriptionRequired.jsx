// src/pages/SubscriptionRequired.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

const REASON_CONTENT = {
  suspended: {
    icon: "⏸️",
    title: "تم تعليق اشتراك الصالة",
    desc: "قام مدير المنصة بتعليق الوصول لهذه الصالة مؤقتاً. يرجى التواصل معنا لمعرفة السبب وإعادة التفعيل.",
  },
  cancelled: {
    icon: "🚫",
    title: "تم إلغاء اشتراك الصالة",
    desc: "لم يعد الوصول لهذه الصالة متاحاً. يرجى التواصل معنا إذا كنت تعتقد أن هذا خطأ.",
  },
  trial_expired: {
    icon: "⏳",
    title: "انتهت فترتك التجريبية المجانية",
    desc: "استمتعت بـ 14 يوماً مجاناً! اشترك الآن لمتابعة استخدام كل ميزات النظام دون انقطاع.",
  },
  subscription_expired: {
    icon: "📅",
    title: "انتهى اشتراكك",
    desc: "انتهت مدة اشتراكك في النظام. جدّد الآن لمتابعة إدارة صالتك دون انقطاع.",
  },
  default: {
    icon: "⚠️",
    title: "الوصول غير متاح حالياً",
    desc: "يرجى التواصل معنا لمعرفة تفاصيل حالة اشتراكك.",
  },
};

export default function SubscriptionRequired() {
  const navigate = useNavigate();
  const logout   = useAuthStore(s => s.logout);
  const [reason, setReason] = useState("default");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedReason  = sessionStorage.getItem("subscriptionIssueReason");
    const savedMessage = sessionStorage.getItem("subscriptionIssueMessage");
    if (savedReason && REASON_CONTENT[savedReason]) setReason(savedReason);
    if (savedMessage) setMessage(savedMessage);
  }, []);

  const content = REASON_CONTENT[reason];

  const handleLogout = () => {
    sessionStorage.removeItem("subscriptionIssueMessage");
    sessionStorage.removeItem("subscriptionIssueReason");
    logout();
    navigate("/login");
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 20,
      direction: "rtl",
    }}>
      <div style={{
        width: "100%", maxWidth: 440, textAlign: "center",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "40px 32px",
      }}>
        <div style={{ fontSize: 56, marginBottom: 18 }}>{content.icon}</div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
          {content.title}
        </h1>

        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.8, marginBottom: 24 }}>
          {message || content.desc}
        </p>

        <div style={{
          background: "var(--surface)", borderRadius: "var(--radius)",
          padding: "16px 18px", marginBottom: 24, textAlign: "right",
        }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>للتواصل والاشتراك</div>
          <a href="tel:+213000000000" style={{
            display: "block", fontSize: 14, fontWeight: 600,
            color: "var(--accent)", textDecoration: "none", marginBottom: 6,
          }}>📞 اتصل بنا</a>
          <a href="https://wa.me/213000000000" target="_blank" rel="noreferrer" style={{
            display: "block", fontSize: 14, fontWeight: 600,
            color: "var(--accent2)", textDecoration: "none",
          }}>💬 راسلنا عبر واتساب</a>
        </div>

        <button onClick={handleLogout} style={{
          width: "100%", padding: "12px",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text)",
          fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Sora', sans-serif",
        }}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}