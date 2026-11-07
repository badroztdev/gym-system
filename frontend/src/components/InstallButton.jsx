// src/components/InstallButton.jsx
// زر "تثبيت التطبيق" ظاهر دائماً في صفحات الدخول.
// آيفون: يفتح دليلاً مصوَّراً (لا يوجد API للتثبيت في iOS) · أندرويد/Chrome: يفتح نافذة التثبيت مباشرة.
import { useEffect, useState } from "react";

export default function InstallButton({ style }) {
  const [st, setSt] = useState(() => (typeof window !== "undefined" && window.sgmsInstallState ? window.sgmsInstallState() : { show: false }));
  useEffect(() => {
    const upd = () => window.sgmsInstallState && setSt(window.sgmsInstallState());
    upd();
    window.addEventListener("sgms-install-state", upd);
    const id = setInterval(upd, 2000); // احتياط: السكربت قد يُحمَّل بعد المكوّن
    return () => { window.removeEventListener("sgms-install-state", upd); clearInterval(id); };
  }, []);
  if (!st.show) return null;
  return (
    <button
      type="button"
      onClick={() => window.sgmsInstall && window.sgmsInstall()}
      style={{
        width: "100%", padding: "12px", marginTop: 14, cursor: "pointer",
        background: "transparent", color: "var(--text)", fontSize: 14, fontWeight: 700,
        border: "1.5px solid var(--accent)", borderRadius: "var(--radius-sm)",
        fontFamily: "'Sora', sans-serif", ...style,
      }}
    >{st.label}</button>
  );
}
