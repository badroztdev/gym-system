// src/portal/components/PortalLayout.jsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { usePortalStore } from "@/portal/store/portalStore";
import { portalService } from "@/portal/services/portal.service";
import NotificationBell from "@/components/notifications/NotificationBell";

const NAV = [
  { path: "home",       label: "الرئيسية", icon: "🏠" },
  { path: "schedule",   label: "الجدول",   icon: "📅" },
  { path: "scan",       label: "الحضور",   icon: "🔲" },
  { path: "progress",   label: "تقدّمي",   icon: "📈" },
  { path: "profile",    label: "ملفي",     icon: "👤" },
];

export default function PortalLayout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { gymSlug } = useParams();
  const { user, logout } = useAuthStore();
  const { selectedAthleteId, setSelectedAthlete } = usePortalStore();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-athletes"],
    queryFn: portalService.getMyAthletes,
  });
  const athletes = data?.data || [];
  const isGuardian = user?.role === "guardian";

  // اختر أول رياضي تلقائياً إذا لم يوجد اختيار
  useEffect(() => {
    if (athletes.length && !selectedAthleteId) {
      setSelectedAthlete(athletes[0].id);
    }
  }, [athletes, selectedAthleteId]);

  const currentAthlete = athletes.find(a => a.id === selectedAthleteId) || athletes[0];
  // البنية الآن: /portal/{gymSlug}/{page} → الصفحة هي الجزء الرابع
  const activePage = location.pathname.split("/")[3] || "home";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", direction: "rtl", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header style={{
        padding: "12px 16px", background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        {/* اختيار الرياضي (لولي الأمر فقط) */}
        {isGuardian && athletes.length > 0 ? (
          <button onClick={() => setShowSwitcher(true)} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "7px 12px",
            cursor: "pointer", maxWidth: 200,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: "var(--accent)20", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
            }}>{currentAthlete?.full_name?.[0]}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentAthlete?.full_name}
            </span>
            {athletes.length > 1 && <span style={{ fontSize: 10, color: "var(--muted)" }}>▼</span>}
          </button>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>🏋️ GymPro</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NotificationBell />
          <button onClick={() => { logout(); navigate("/portal/login"); }} style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--danger)10", border: "1px solid var(--danger)30",
            color: "var(--danger)", cursor: "pointer", fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>⏻</button>
        </div>
      </header>

      {/* ── محتوى الصفحة ─────────────────────────────────────── */}
      <main style={{ flex: 1, paddingBottom: 78, overflow: "auto" }}>
        <Outlet context={{ athlete: currentAthlete, athletes, isGuardian }} />
      </main>

      {/* ── Bottom navigation ───────────────────────────────── */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-around",
        padding: "8px 0 12px",
      }}>
        {NAV.map(item => {
          const active = activePage === item.path;
          return (
            <button key={item.path} onClick={() => navigate(`/portal/${gymSlug}/${item.path}`)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, background: "none", border: "none",
              color: active ? "var(--accent)" : "var(--muted)",
              cursor: "pointer", fontSize: 10, fontFamily: "'Sora', sans-serif",
              fontWeight: active ? 700 : 400, flex: 1,
            }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Athlete switcher modal (ولي الأمر) ───────────────── */}
      {showSwitcher && (
        <div onClick={() => setShowSwitcher(false)} style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "flex-end", justifyContent: "center",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 480,
            background: "var(--card)", borderRadius: "20px 20px 0 0",
            padding: "20px 16px 28px", animation: "fadeUp 0.25s ease",
          }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>اختر الرياضي</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {athletes.map(a => (
                <button key={a.id} onClick={() => { setSelectedAthlete(a.id); setShowSwitcher(false); }} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: "var(--radius-sm)",
                  background: a.id === selectedAthleteId ? "var(--accent)15" : "var(--surface)",
                  border: `1px solid ${a.id === selectedAthleteId ? "var(--accent)" : "var(--border)"}`,
                  cursor: "pointer", textAlign: "right",
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "var(--accent)20", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700,
                  }}>{a.full_name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{a.full_name}</div>
                    {a.age_category && <div style={{ fontSize: 11, color: "var(--muted)" }}>{a.age_category}</div>}
                  </div>
                  {a.id === selectedAthleteId && <span style={{ color: "var(--accent)" }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}