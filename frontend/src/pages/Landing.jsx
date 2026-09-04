// src/pages/Landing.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  { icon: "👥", title: "إدارة الأعضاء", desc: "سجّل الرياضيين وأولياء أمورهم، مع بحث وفلترة سريعة حسب الفئة والحالة" },
  { icon: "📅", title: "الحصص والجداول", desc: "جدول أسبوعي تفاعلي، قاعات بأكواد QR ثابتة، وتكرار تلقائي للحصص" },
  { icon: "✅", title: "حضور فوري عبر QR", desc: "الرياضي يمسح رمز القاعة فيُسجَّل حضوره تلقائياً، أو يسجّله المدرب يدوياً" },
  { icon: "🎫", title: "الاشتراكات والمدفوعات", desc: "خطط اشتراك مرنة، دفعات جزئية، وتنبيه تلقائي قبل انتهاء أي اشتراك" },
  { icon: "🔔", title: "إشعارات ذكية", desc: "تنبيهات فورية للغياب والتأخر وانتهاء الاشتراكات عبر إشعارات الهاتف" },
  { icon: "📱", title: "بوابة الرياضي وولي الأمر", desc: "تطبيق مستقل يتابع فيه كل رياضي جدوله، اشتراكه، وتقدّمه الرياضي" },
  { icon: "📊", title: "لوحة تحكم شاملة", desc: "إحصائيات فورية عن الإيرادات، الحضور، ونمو الأعضاء بمخططات واضحة" },
  { icon: "🧑‍🏫", title: "إدارة الفريق", desc: "مدربون ومساعدون بصلاحيات مخصَّصة لكل دور داخل الصالة" },
];

const PLANS = [
  {
    name: "تجريبي مجاني",
    price: "0",
    unit: "لمدة 14 يوماً",
    colorVar: "--accent2",
    features: ["كل الميزات بدون قيود", "حتى 100 رياضي", "بدون بطاقة بنكية", "إلغاء في أي وقت"],
    cta: "ابدأ التجربة المجانية",
    ctaLink: "/signup",
  },
  {
    name: "شهري",
    price: "1,000",
    unit: "دج / شهرياً",
    colorVar: "--accent",
    highlight: true,
    features: ["كل الميزات بدون قيود", "رياضيون غير محدودين", "إشعارات Push مجانية", "دعم فني مباشر"],
    cta: "تواصل للاشتراك",
    ctaLink: null,
  },
  {
    name: "سنوي",
    price: "10,000",
    unit: "دج / سنوياً",
    colorVar: "--accent3",
    badge: "وفّر شهرين مجاناً",
    features: ["كل مزايا الخطة الشهرية", "توفير حقيقي 2,000 دج", "أولوية في الدعم الفني", "نسخ احتياطي أسبوعي"],
    cta: "تواصل للاشتراك",
    ctaLink: null,
  },
];

// ── لوحتا الألوان — محصورتان بالكامل داخل هذه الصفحة فقط ──────
// (لا تؤثران إطلاقاً على ألوان لوحة التحكم أو البوابة بعد تسجيل الدخول)
const DARK_THEME = {
  "--bg": "#0d0f14", "--surface": "#12151c", "--card": "#161a23",
  "--border": "#232734", "--text": "#f4f5f7", "--muted": "#7b8494", "--muted-lt": "#a2aab8",
  "--accent": "#6ee7b7", "--accent2": "#818cf8", "--accent3": "#fb923c",
  "--danger": "#f87171", "--warning": "#fbbf24",
  "--radius": "14px", "--radius-sm": "10px",
};
const LIGHT_THEME = {
  "--bg": "#f7f7fa", "--surface": "#ffffff", "--card": "#ffffff",
  "--border": "#e3e4e9", "--text": "#14161c", "--muted": "#6b7280", "--muted-lt": "#4b5563",
  "--accent": "#10b981", "--accent2": "#6366f1", "--accent3": "#f97316",
  "--danger": "#ef4444", "--warning": "#f59e0b",
  "--radius": "14px", "--radius-sm": "10px",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

export default function Landing() {
  const isMobile = useIsMobile();
  const [dark, setDark] = useState(true);
  const theme = dark ? DARK_THEME : LIGHT_THEME;

  return (
    <div style={{ ...theme, minHeight: "100vh", background: "var(--bg)", direction: "rtl", overflowX: "hidden", transition: "background 0.2s ease" }}>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--surface)", opacity: 0.98,
        borderBottom: "1px solid var(--border)",
        padding: isMobile ? "10px 4vw" : "14px 5vw",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <img
            src="/logo.png" alt="SGMS"
            style={{
              width: isMobile ? 28 : 34, height: isMobile ? 28 : 34,
              borderRadius: 9, objectFit: "cover", flexShrink: 0, display: "block",
            }}
          />
          {!isMobile && <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>SGMS</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
          {/* زر تبديل الوضع الفاتح/الداكن */}
          <button
            onClick={() => setDark(v => !v)}
            aria-label="تبديل الوضع"
            style={{
              width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", cursor: "pointer",
              fontSize: isMobile ? 14 : 16,
            }}
          >{dark ? "☀️" : "🌙"}</button>

          <Link to="/login" style={{
            padding: isMobile ? "7px 10px" : "8px 18px",
            fontSize: isMobile ? 11.5 : 13, fontWeight: 600,
            color: "var(--text)", textDecoration: "none", whiteSpace: "nowrap",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          }}>{isMobile ? "دخول" : "تسجيل الدخول"}</Link>

          <Link to="/signup" style={{
            padding: isMobile ? "7px 10px" : "8px 18px",
            fontSize: isMobile ? 11.5 : 13, fontWeight: 700,
            color: "#0d0f14", textDecoration: "none", whiteSpace: "nowrap",
            background: "var(--accent)", borderRadius: "var(--radius-sm)",
          }}>{isMobile ? "ابدأ" : "ابدأ الآن"}</Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section style={{
        padding: "clamp(40px, 10vw, 96px) 5vw clamp(36px, 8vw, 72px)",
        textAlign: "center", maxWidth: 820, margin: "0 auto",
      }}>
        <div style={{
          display: "inline-block", fontSize: 12, fontWeight: 600,
          padding: "6px 16px", borderRadius: 20,
          background: "var(--accent)20",
          color: "var(--accent)",
          marginBottom: 20, border: "1px solid var(--accent)40",
        }}>🚀 منصة إدارة الصالات الرياضية الأولى في الجزائر</div>

        <h1 style={{
          fontSize: "clamp(26px, 6vw, 48px)", fontWeight: 800,
          color: "var(--text)", lineHeight: 1.3, marginBottom: 18,
        }}>
          أدر صالتك الرياضية <span style={{ color: "var(--accent)" }}>باحترافية</span><br />
          من مكان واحد
        </h1>

        <p style={{
          fontSize: "clamp(13.5px, 2.2vw, 17px)", color: "var(--muted)",
          lineHeight: 1.7, marginBottom: 32, maxWidth: 560, margin: "0 auto 32px",
        }}>
          الأعضاء، الحصص، الحضور، الاشتراكات، والإشعارات — كل ما تحتاجه صالتك
          الرياضية في نظام واحد بسيط وقوي، بدون ورق وبدون تعقيد.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/signup" style={{
            padding: "14px 28px", fontSize: 14.5, fontWeight: 700,
            color: "#0d0f14", textDecoration: "none",
            background: "var(--accent)", borderRadius: "var(--radius-sm)",
          }}>ابدأ تجربتك المجانية 14 يوماً</Link>
          <a href="#pricing" style={{
            padding: "14px 28px", fontSize: 14.5, fontWeight: 600,
            color: "var(--text)", textDecoration: "none",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          }}>عرض الأسعار</a>
        </div>

        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 16 }}>
          بدون بطاقة بنكية · إلغاء في أي وقت
        </p>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section style={{ padding: "clamp(28px, 6vw, 64px) 5vw", background: "var(--surface)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            كل ما تحتاجه، في مكان واحد
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)" }}>مصمَّم خصيصاً لصالات كمال الأجسام والفنون القتالية والرياضات الجماعية</p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14, maxWidth: 1100, margin: "0 auto",
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 20,
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "clamp(28px, 6vw, 64px) 5vw" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            خطط بسيطة تناسب صالتك
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)" }}>ابدأ مجاناً، وانتقل لخطة مدفوعة عندما تكون جاهزاً</p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18, maxWidth: 960, margin: "0 auto",
        }}>
          {PLANS.map((plan, i) => (
            <div key={i} style={{
              background: "var(--card)",
              border: `1px solid ${plan.highlight ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 18, padding: 26,
              position: "relative",
              transform: plan.highlight && !isMobile ? "scale(1.03)" : "none",
            }}>
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
                  background: `var(${plan.colorVar})`, color: "#0d0f14", whiteSpace: "nowrap",
                }}>{plan.badge}</div>
              )}

              <div style={{ fontSize: 14.5, fontWeight: 700, color: `var(${plan.colorVar})`, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>{plan.price}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>{plan.unit}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted-lt)" }}>
                    <span style={{ color: `var(${plan.colorVar})` }}>✓</span> {f}
                  </div>
                ))}
              </div>

              {plan.ctaLink ? (
                <Link to={plan.ctaLink} style={{
                  display: "block", textAlign: "center",
                  padding: "12px", fontSize: 13.5, fontWeight: 700,
                  color: "#0d0f14", textDecoration: "none",
                  background: `var(${plan.colorVar})`, borderRadius: "var(--radius-sm)",
                }}>{plan.cta}</Link>
              ) : (
                <a href="tel:+213000000000" style={{
                  display: "block", textAlign: "center",
                  padding: "12px", fontSize: 13.5, fontWeight: 600,
                  color: "var(--text)", textDecoration: "none",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                }}>{plan.cta}</a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        padding: "24px 5vw", borderTop: "1px solid var(--border)",
        textAlign: "center", color: "var(--muted)", fontSize: 11.5,
      }}>
        © {new Date().getFullYear()} SGMS — نظام إدارة الصالات الرياضية الذكي · صُنع في الجزائر 🇩🇿
      </footer>
    </div>
  );
}