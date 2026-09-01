// src/pages/SignUp.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import toast from "react-hot-toast";

export default function SignUp() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore(s => s.setAuth);

  const [form, setForm] = useState({
    gymName: "", ownerName: "", ownerPhone: "", ownerEmail: "",
    password: "", confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slugInfo, setSlugInfo] = useState(null); // { slug, available }
  const slugTimer = useRef(null);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // ── تحقق مباشر من توفر اسم الصالة (رابط فريد) أثناء الكتابة ──
  useEffect(() => {
    if (!form.gymName.trim()) { setSlugInfo(null); return; }
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/onboarding/check-slug", { params: { name: form.gymName } });
        setSlugInfo(data.data);
      } catch { /* تجاهل */ }
    }, 500);
    return () => clearTimeout(slugTimer.current);
  }, [form.gymName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.gymName.trim())   { setError("اسم الصالة مطلوب"); return; }
    if (!form.ownerName.trim()) { setError("اسمك الكامل مطلوب"); return; }
    if (!form.ownerPhone.trim()){ setError("رقم الهاتف مطلوب"); return; }
    if (form.password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (form.password !== form.confirmPassword) { setError("كلمتا المرور غير متطابقتين"); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/onboarding/register", {
        gymName:    form.gymName.trim(),
        ownerName:  form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim(),
        ownerEmail: form.ownerEmail.trim() || undefined,
        password:   form.password,
      });

      setAuth(data.data.user, data.data.token);
      toast.success(data.data.message || "تم إنشاء صالتك بنجاح! 🎉");
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "فشل إنشاء الحساب، يرجى المحاولة مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 16,
    }}>
      <div className="fade-up" style={{
        width: "100%", maxWidth: 440,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "32px 28px",
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 12px",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26,
          }}>🏋️</div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "var(--text)" }}>أنشئ صالتك الرياضية</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            14 يوماً تجريبياً مجاناً — بدون بطاقة بنكية
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div>
            <label style={labelStyle}>اسم الصالة الرياضية *</label>
            <input
              placeholder="مثال: نادي الأبطال"
              value={form.gymName}
              onChange={set("gymName")}
              style={inputStyle}
            />
            {slugInfo && (
              <div style={{ fontSize: 10, marginTop: 4, color: slugInfo.available ? "var(--accent)" : "var(--danger)" }}>
                {slugInfo.available
                  ? `✓ الرابط متاح: sgms.site/${slugInfo.slug}`
                  : `✕ الاسم مستخدم بالفعل، سيُضاف رقم تلقائياً`}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>اسمك الكامل (المالك) *</label>
            <input
              placeholder="مثال: أحمد بن علي"
              value={form.ownerName}
              onChange={set("ownerName")}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>رقم الهاتف *</label>
              <input
                type="tel" placeholder="0550000000"
                value={form.ownerPhone}
                onChange={set("ownerPhone")}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>البريد الإلكتروني</label>
              <input
                type="email" placeholder="اختياري"
                value={form.ownerEmail}
                onChange={set("ownerEmail")}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>كلمة المرور *</label>
              <input
                type="password" placeholder="6 أحرف على الأقل"
                value={form.password}
                onChange={set("password")}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>تأكيد كلمة المرور *</label>
              <input
                type="password" placeholder="أعد كتابتها"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger)10", padding: "10px 12px", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: "13px", background: "var(--accent)", border: "none",
            borderRadius: "var(--radius-sm)", color: "#0d0f14", fontSize: 14,
            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, fontFamily: "'Sora', sans-serif", marginTop: 4,
          }}>
            {loading ? "جاري الإنشاء..." : "إنشاء الصالة والبدء الآن"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            لديك صالة مسجَّلة بالفعل؟{" "}
            <Link to="/login" style={{ color: "var(--accent2)", textDecoration: "none" }}>سجّل دخولك</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 12, color: "var(--muted-lt)", fontWeight: 500,
  display: "block", marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "11px 14px", background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
  color: "var(--text)", fontSize: 14, outline: "none", textAlign: "right",
  fontFamily: "'Sora', sans-serif",
};