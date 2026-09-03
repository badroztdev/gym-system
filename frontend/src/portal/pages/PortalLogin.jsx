// src/portal/pages/PortalLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { usePortalStore } from "@/portal/store/portalStore";
import { PORTAL_DARK_THEME, PORTAL_LIGHT_THEME } from "@/portal/portalTheme";
import api from "@/services/api";
import toast from "react-hot-toast";

const ROLE_LABELS = { athlete: "رياضي", guardian: "ولي أمر" };

export default function PortalLogin() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState(null); // حالة نادرة: أكثر من حساب مطابق
  const { dark, toggleDark } = usePortalStore();
  const theme = dark ? PORTAL_DARK_THEME : PORTAL_LIGHT_THEME;

  const finishLogin = (data) => {
    if (!["athlete", "guardian"].includes(data.user.role)) {
      setError("هذا الحساب مخصص للوحة التحكم، يرجى استخدام رابط آخر");
      return;
    }
    setAuth(data.user, data.token);
    toast.success(`أهلاً ${data.user.fullName} 👋`);
    navigate(`/portal/${data.user.gymSlug}/home`);
  };

  const attemptLogin = async (selectedUserId) => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/login", { ...form, selectedUserId });
      if (data.data.requiresSelection) {
        // في البوابة نعرض فقط حسابات athlete/guardian من قائمة الاختيار
        const portalOptions = data.data.options.filter(o => ["athlete", "guardian"].includes(o.role));
        if (!portalOptions.length) {
          setError("هذا الحساب مخصص للوحة التحكم، يرجى استخدام رابط آخر");
        } else if (portalOptions.length === 1) {
          attemptLogin(portalOptions[0].id);
        } else {
          setOptions(portalOptions);
        }
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
      ...theme,
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 16,
      position: "relative", transition: "background 0.2s ease",
    }}>
      {/* زر تبديل الوضع الفاتح/الداكن */}
      <button
        onClick={toggleDark}
        aria-label="تبديل الوضع"
        style={{
          position: "absolute", top: 16, left: 16,
          width: 38, height: 38, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 16,
        }}
      >{dark ? "☀️" : "🌙"}</button>

      <div className="fade-up" style={{
        width: "100%", maxWidth: 380,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "36px 28px",
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 14px",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30,
          }}>🏋️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>بوابة الرياضي</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>تابع جدولك واشتراكك بسهولة</p>
        </div>

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
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{opt.gymName}</div>
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
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>رقم الهاتف</label>
              <input
                type="tel" placeholder="0550000000" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{
                  width: "100%", padding: "13px 16px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text)", fontSize: 15, outline: "none", textAlign: "right",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>كلمة المرور</label>
              <input
                type="password" placeholder="••••••••" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{
                  width: "100%", padding: "13px 16px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text)", fontSize: 15, outline: "none", textAlign: "right",
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger)10", padding: "10px 12px", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              padding: "14px", background: "var(--accent)", border: "none",
              borderRadius: "var(--radius-sm)", color: "#0d0f14", fontSize: 15,
              fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, fontFamily: "'Sora', sans-serif", marginTop: 4,
            }}>
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}