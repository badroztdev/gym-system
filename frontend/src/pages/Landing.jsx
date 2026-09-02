// src/pages/Landing.jsx
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
    color: "var(--accent2)",
    features: ["كل الميزات بدون قيود", "حتى 100 رياضي", "بدون بطاقة بنكية", "إلغاء في أي وقت"],
    cta: "ابدأ التجربة المجانية",
    ctaLink: "/signup",
  },
  {
    name: "شهري",
    price: "2,000",
    unit: "دج / شهرياً",
    color: "var(--accent)",
    highlight: true,
    features: ["كل الميزات بدون قيود", "رياضيون غير محدودين", "إشعارات Push مجانية", "دعم فني مباشر"],
    cta: "تواصل للاشتراك",
    ctaLink: null,
  },
  {
    name: "سنوي",
    price: "20,000",
    unit: "دج / سنوياً",
    color: "var(--accent3)",
    badge: "وفّر شهرين مجاناً",
    features: ["كل مزايا الخطة الشهرية", "توفير حقيقي 4,000 دج", "أولوية في الدعم الفني", "نسخ احتياطي أسبوعي"],
    cta: "تواصل للاشتراك",
    ctaLink: null,
  },
];

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", direction: "rtl", overflowX: "hidden" }}>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--surface)cc", backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border)",
        padding: "14px 5vw",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#0d0f14",
          }}>G</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>SGMS</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/login" style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600,
            color: "var(--text)", textDecoration: "none",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          }}>تسجيل الدخول</Link>
          <Link to="/signup" style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 700,
            color: "#0d0f14", textDecoration: "none",
            background: "var(--accent)", borderRadius: "var(--radius-sm)",
          }}>ابدأ الآن</Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section style={{
        padding: "clamp(48px, 10vw, 96px) 5vw clamp(40px, 8vw, 72px)",
        textAlign: "center", maxWidth: 820, margin: "0 auto",
      }}>
        <div style={{
          display: "inline-block", fontSize: 12, fontWeight: 600,
          padding: "6px 16px", borderRadius: 20,
          background: "var(--accent)15", color: "var(--accent)",
          marginBottom: 20, border: "1px solid var(--accent)30",
        }}>🚀 منصة إدارة الصالات الرياضية الأولى في الجزائر</div>

        <h1 style={{
          fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 800,
          color: "var(--text)", lineHeight: 1.25, marginBottom: 18,
        }}>
          أدر صالتك الرياضية <span style={{ color: "var(--accent)" }}>باحترافية</span><br />
          من مكان واحد
        </h1>

        <p style={{
          fontSize: "clamp(14px, 2.2vw, 17px)", color: "var(--muted)",
          lineHeight: 1.7, marginBottom: 32, maxWidth: 560, margin: "0 auto 32px",
        }}>
          الأعضاء، الحصص، الحضور، الاشتراكات، والإشعارات — كل ما تحتاجه صالتك
          الرياضية في نظام واحد بسيط وقوي، بدون ورق وبدون تعقيد.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/signup" style={{
            padding: "14px 32px", fontSize: 15, fontWeight: 700,
            color: "#0d0f14", textDecoration: "none",
            background: "var(--accent)", borderRadius: "var(--radius-sm)",
            boxShadow: "0 8px 24px -8px var(--accent)",
          }}>ابدأ تجربتك المجانية 14 يوماً</Link>
          <a href="#pricing" style={{
            padding: "14px 32px", fontSize: 15, fontWeight: 600,
            color: "var(--text)", textDecoration: "none",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          }}>عرض الأسعار</a>
        </div>

        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 16 }}>
          بدون بطاقة بنكية · إلغاء في أي وقت
        </p>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section style={{ padding: "clamp(32px, 6vw, 64px) 5vw", background: "var(--surface)" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            كل ما تحتاجه، في مكان واحد
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>مصمَّم خصيصاً لصالات كمال الأجسام والفنون القتالية والرياضات الجماعية</p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16, maxWidth: 1100, margin: "0 auto",
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 22,
            }}>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "clamp(32px, 6vw, 64px) 5vw" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            خطط بسيطة تناسب صالتك
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>ابدأ مجاناً، وانتقل لخطة مدفوعة عندما تكون جاهزاً</p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20, maxWidth: 960, margin: "0 auto",
        }}>
          {PLANS.map((plan, i) => (
            <div key={i} style={{
              background: "var(--card)",
              border: `1px solid ${plan.highlight ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 18, padding: 28,
              position: "relative",
              transform: plan.highlight ? "scale(1.03)" : "none",
              boxShadow: plan.highlight ? "0 12px 32px -12px var(--accent)40" : "none",
            }}>
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
                  background: plan.color, color: "#0d0f14", whiteSpace: "nowrap",
                }}>{plan.badge}</div>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, color: plan.color, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 34, fontWeight: 800, color: "var(--text)" }}>{plan.price}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>{plan.unit}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-lt)" }}>
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </div>
                ))}
              </div>

              {plan.ctaLink ? (
                <Link to={plan.ctaLink} style={{
                  display: "block", textAlign: "center",
                  padding: "12px", fontSize: 14, fontWeight: 700,
                  color: "#0d0f14", textDecoration: "none",
                  background: plan.color, borderRadius: "var(--radius-sm)",
                }}>{plan.cta}</Link>
              ) : (
                <a href="tel:+213000000000" style={{
                  display: "block", textAlign: "center",
                  padding: "12px", fontSize: 14, fontWeight: 600,
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
        padding: "28px 5vw", borderTop: "1px solid var(--border)",
        textAlign: "center", color: "var(--muted)", fontSize: 12,
      }}>
        © {new Date().getFullYear()} SGMS — نظام إدارة الصالات الرياضية الذكي · صُنع في الجزائر 🇩🇿
      </footer>
    </div>
  );
}