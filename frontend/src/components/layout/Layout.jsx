// src/components/layout/Layout.jsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import NotificationBell from "@/components/notifications/NotificationBell";

const NAV = [
  { path: "/dashboard",     label: "لوحة التحكم",   icon: "⊞" },
  { path: "/members",       label: "الأعضاء",        icon: "👥" },
  { path: "/sessions",      label: "الحصص",          icon: "📅" },
  { path: "/subscriptions", label: "الاشتراكات",     icon: "🎫" },
  { path: "/attendance",    label: "الحضور",         icon: "✅" },
  { path: "/progress",      label: "التقدم",         icon: "📈" },
  { path: "/team",          label: "الفريق",         icon: "🧑‍🏫" },
  { path: "/notifications", label: "الإشعارات",      icon: "🔔" },
  { path: "/settings",      label: "الإعدادات",      icon: "⚙️" },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const { user, logout }              = useAuthStore();
  const location                      = useLocation();
  const navigate                      = useNavigate();
  const { gymSlug }                   = useParams();
  const isMobile                      = useIsMobile();

  // ✅ الجزء الثالث من الرابط هو اسم الصفحة الفعلي الآن (بعد /{gymSlug}/)
  // مثال: /s-elhidhab/members → activePath = "/members"
  const activePath = "/" + location.pathname.split("/")[2];

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const handleNav = (path) => {
    navigate(`/${gymSlug}${path}`);
    if (isMobile) setSidebarOpen(false);
  };

  const ROLE_LABELS = { owner: "المالك", coach: "مدرب", assistant: "مساعد" };

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{
        padding: (collapsed && !isMobile) ? "20px 0" : "18px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        justifyContent: (collapsed && !isMobile) ? "center" : "space-between",
        gap: 10, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
           <img
            src="/logo.png"
            alt="SGMS"
            style={{
              width: 56, height: 56, borderRadius: 14, margin: "0 auto 12px",
              display: "block", objectFit: "cover",
            }}
          />
          {(!collapsed || isMobile) && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>SGMS</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{user?.gymName || "الصالة"}</div>
            </div>
          )}
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{
            background: "none", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 22, padding: 4, lineHeight: 1,
          }}>✕</button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {NAV.map(item => {
          const active = activePath === item.path;
          return (
            <button key={item.path} onClick={() => handleNav(item.path)} style={{
              width: "100%",
              padding: (collapsed && !isMobile) ? "12px 0" : "12px 18px",
              display: "flex", alignItems: "center", gap: 12,
              justifyContent: (collapsed && !isMobile) ? "center" : "flex-start",
              background: active ? "var(--accent)15" : "transparent",
              border: "none",
              borderRight: active ? "3px solid var(--accent)" : "3px solid transparent",
              color: active ? "var(--accent)" : "var(--muted)",
              cursor: "pointer", fontSize: isMobile ? 15 : 13,
              fontWeight: active ? 600 : 400,
              fontFamily: "'Sora', sans-serif",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--border)30"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: isMobile ? 20 : 18, flexShrink: 0 }}>{item.icon}</span>
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse btn — desktop only */}
      {!isMobile && (
        <button onClick={() => setCollapsed(v => !v)} style={{
          margin: 10, padding: "8px",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--muted)",
          cursor: "pointer", fontSize: 13, fontFamily: "'Sora', sans-serif",
        }}>{collapsed ? "→" : "←"}</button>
      )}

      {/* User */}
      {(!collapsed || isMobile) && (
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: "var(--accent2)30",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, color: "var(--accent2)", fontWeight: 700,
            }}>{user?.fullName?.[0] || "م"}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.fullName}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {ROLE_LABELS[user?.role] || user?.role}
              </div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate("/login"); }} style={{
            width: "100%", padding: "9px",
            background: "var(--danger)10", border: "1px solid var(--danger)30",
            borderRadius: "var(--radius-sm)", color: "var(--danger)",
            cursor: "pointer", fontSize: 12,
            fontFamily: "'Sora', sans-serif", fontWeight: 500,
          }}>تسجيل الخروج</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", direction: "rtl", background: "var(--bg)" }}>

      {/* ── Desktop Sidebar ───────────────────────────────── */}
      {!isMobile && (
        <aside style={{
          width: collapsed ? 64 : 220,
          minHeight: "100vh", position: "sticky", top: 0, height: "100vh",
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          flexShrink: 0, overflow: "hidden",
          transition: "width 0.25s ease",
        }}>
          <SidebarContent />
        </aside>
      )}

      {/* ── Mobile: Overlay + Drawer ──────────────────────── */}
      {isMobile && sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.65)",
          }} />
          <aside style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "75vw", maxWidth: 280, zIndex: 50,
            background: "var(--surface)", borderLeft: "1px solid var(--border)",
            overflowY: "auto",
            animation: "slideInRight 0.22s ease",
          }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        overflow: "auto", minWidth: 0,
        paddingBottom: isMobile ? 72 : 0,
        position: "relative",
      }}>
{/* Mobile top bar */}
        {isMobile && (
          <div style={{
            padding: "11px 16px",
            background: "var(--surface)", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: "#0d0f14",
              }}>G</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>SGMS</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NotificationBell />
              <button onClick={() => setSidebarOpen(true)} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "7px 12px",
                color: "var(--text)", cursor: "pointer", fontSize: 20,
              }}>☰</button>
            </div>
          </div>
        )}

        <Outlet />

        {/* Mobile bottom nav */}
        {isMobile && (
          <nav style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
            background: "var(--surface)", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-around",
            padding: "6px 0 10px", direction: "rtl",
          }}>
            {NAV.slice(0, 5).map(item => {
              const active = activePath === item.path;
              return (
                <button key={item.path} onClick={() => handleNav(item.path)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 2, background: "none", border: "none",
                  color: active ? "var(--accent)" : "var(--muted)",
                  cursor: "pointer", fontSize: 10,
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: active ? 700 : 400,
                  padding: "4px 6px", minWidth: 50, flex: 1,
                }}>
                  <span style={{ fontSize: 21 }}>{item.icon}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", maxWidth: 56, textOverflow: "ellipsis" }}>{item.label}</span>
                </button>
              );
            })}
            <button onClick={() => setSidebarOpen(true)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 2, background: "none", border: "none",
              color: "var(--muted)", cursor: "pointer",
              fontSize: 10, fontFamily: "'Sora', sans-serif",
              padding: "4px 6px", minWidth: 50, flex: 1,
            }}>
              <span style={{ fontSize: 21 }}>☰</span>
              <span>المزيد</span>
            </button>
          </nav>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}