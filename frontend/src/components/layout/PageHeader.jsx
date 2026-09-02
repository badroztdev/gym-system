// src/components/layout/PageHeader.jsx
import { useState, useEffect } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function PageHeader({ title, subtitle, actions, children }) {
  const isMobile = useIsMobile();

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
      {/* ✅ الجرس يظهر هنا فقط على الحاسوب — على الهاتف يظهر بجانب زر ☰ في Layout.jsx بدلاً منه */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {!isMobile && <NotificationBell />}
        {actions}
        {children}
      </div>
    </header>
  );
}