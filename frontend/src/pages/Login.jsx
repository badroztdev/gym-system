// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import toast from "react-hot-toast";

export default function Login() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phone || !form.password) { setError("يرجى تعبئة جميع الحقول"); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.data.user, data.data.token);
      toast.success(`أهلاً ${data.data.user.fullName} 👋`);
      // ✅ توجيه حسب الدور: super_admin → لوحة إدارة المنصة، غيره → لوحة التحكم العادية
      navigate(data.data.user.role === "super_admin" ? "/superadmin" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)",
      padding: 16,
    }}>
      <div className="fade-up" style={{
        width: "100%", maxWidth: 400,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 18, padding: "36px 32px",
        boxShadow: "var(--shadow)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 12px",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 700, color: "#0d0f14",
          }}>G</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Arena GYM</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>لوحة تحكم الصالة الرياضية</p>
        </div>

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
        </form>
      </div>
    </div>
  );
}