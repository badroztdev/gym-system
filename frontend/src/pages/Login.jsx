// src/pages/Login.jsx
// تسجيل دخول موحَّد لكل المنصة — sgms.site/login
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import toast from "react-hot-toast";

const ROLE_LABELS = { owner: "المالك", coach: "مدرب", assistant: "مساعد", super_admin: "مدير المنصة" };

export default function Login() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── الحالة النادرة: نفس الرقم/كلمة المرور تطابقان أكثر من حساب ──
  const [options, setOptions] = useState(null); // null = لا يوجد اختيار مطلوب

  const finishLogin = (data) => {
    setAuth(data.user, data.token);
    toast.success(`أهلاً ${data.user.fullName} 👋`);
    if (data.user.role === "super_admin") {
      navigate("/superadmin");
    } else {
      navigate(`/${data.user.gymSlug}/dashboard`);
    }
  };

  const attemptLogin = async (selectedUserId) => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/login", { ...form, selectedUserId });
      if (data.data.requiresSelection) {
        setOptions(data.data.options);
      } else {
        finishLogin(data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.phone || !form.password) { setError("يرجى تعبئة جميع الحقول"); return; }
    attemptLogin(undefined);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 16,
    }}>
      <div className="fade-up" style={{
        width: "100%", maxWidth: 400,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 18, padding: "36px 32px",
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src="/logo.png"
            alt="SGMS"
            style={{
              width: 56, height: 56, borderRadius: 14, margin: "0 auto 12px",
              display: "block", objectFit: "cover",
            }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>SGMS</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>تسجيل الدخول إلى صالتك الرياضية</p>
        </div>

        {/* ── شاشة اختيار الحساب (حالة نادرة) ────────────────── */}
        {options ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginBottom: 4 }}>
              وُجد أكثر من حساب بنفس البيانات، اختر الحساب المطلوب:
            </p>
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => attemptLogin(opt.id)}
                disabled={loading}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  cursor: "pointer", textAlign: "right",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{opt.gymName || "لوحة إدارة المنصة"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{ROLE_LABELS[opt.role] || opt.role}</div>
                </div>
                <span style={{ color: "var(--accent2)" }}>←</span>
              </button>
            ))}
            <button
              onClick={() => { setOptions(null); setError(""); }}
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", marginTop: 4 }}
            >
              رجوع
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
                رقم الهاتف
              </label>
              <input
                type="tel" placeholder="0550000000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{
                  width: "100%", padding: "11px 14px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", color: "var(--text)",
                  fontSize: 14, outline: "none", textAlign: "right",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
                كلمة المرور
              </label>
              <input
                type="password" placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{
                  width: "100%", padding: "11px 14px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", color: "var(--text)",
                  fontSize: 14, outline: "none", textAlign: "right",
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger)10", padding: "10px 12px", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px", background: "var(--accent)",
                border: "none", borderRadius: "var(--radius-sm)",
                color: "#0d0f14", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                fontFamily: "'Sora', sans-serif",
                marginTop: 4,
              }}
            >
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>

            <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              ليس لديك صالة مسجَّلة؟{" "}
              <a href="/signup" style={{ color: "var(--accent2)", textDecoration: "none" }}>أنشئ صالتك الآن</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}