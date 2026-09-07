// src/components/layout/PageHeader.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/store/themeStore";
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
  const { dark, toggleDark } = useThemeStore();
  const { i18n } = useTranslation();
  const toggleLanguage = () => i18n.changeLanguage(i18n.language === "ar" ? "fr" : "ar");

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
      {/* ✅ زر تبديل الوضع والجرس يظهران هنا فقط على الحاسوب — على الهاتف يظهران في Layout.jsx بدلاً منهما */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {!isMobile && (
          <button onClick={toggleLanguage} aria-label="تبديل اللغة" style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--card)", border: "1px solid var(--border)",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Sora', sans-serif", color: "var(--text)",
          }}>{i18n.language === "ar" ? "FR" : "AR"}</button>
        )}
        {!isMobile && (
          <button onClick={toggleDark} aria-label="تبديل الوضع" style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--card)", border: "1px solid var(--border)",
            cursor: "pointer", fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{dark ? "☀️" : "🌙"}</button>
        )}
        {!isMobile && <NotificationBell />}
        {actions}
        {children}
      </div>
    </header>
  );
}
