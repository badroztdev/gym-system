// src/components/layout/PageHeader.jsx
import NotificationBell from "@/components/notifications/NotificationBell";

export default function PageHeader({ title, subtitle, actions, children }) {
  return (
    <header style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      position: "sticky", top: 0, zIndex: 10,
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{
          fontSize: "clamp(15px, 4vw, 18px)",
          fontWeight: 700, color: "var(--text)", lineHeight: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{subtitle}</p>}
      </div>
      {/* ✅ الجرس يظهر أولاً (أقصى يسار الصف) ثم أزرار الصفحة بجانبه — نفس الصف دائماً */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <NotificationBell />
        {actions}
        {children}
      </div>
    </header>
  );
}