// src/components/progress/CompetitionResultsList.jsx
// سجل نتائج المنافسات لرياضي (تاريخ + ميداليات) — يُستخدم في لوحة التقدم وبوابة الرياضي
import { useTranslation } from "react-i18next";

const MEDAL = {
  gold:   { icon: "🥇", key: "medalGold",   color: "#f5c542" },
  silver: { icon: "🥈", key: "medalSilver", color: "#c0c7d1" },
  bronze: { icon: "🥉", key: "medalBronze", color: "#d08a4e" },
};

export default function CompetitionResultsList({ results = [], maxHeight }) {
  const { t } = useTranslation();
  if (!results.length) return null;

  const count = (m) => results.filter(r => r.medal === m).length;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
        🏆 {t("competitionResults.title", { count: results.length })}
      </div>

      {/* ملخّص الميداليات */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {["gold", "silver", "bronze"].map(m => (
          <span key={m} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700,
            background: `color-mix(in srgb, ${MEDAL[m].color} 16%, transparent)`,
            border: `1px solid color-mix(in srgb, ${MEDAL[m].color} 45%, transparent)`,
            color: "var(--text)",
          }}>
            {MEDAL[m].icon} <span className="mono">{count(m)}</span>
          </span>
        ))}
      </div>

      {/* السجل */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight, overflowY: maxHeight ? "auto" : "visible" }}>
        {results.map(r => {
          const medal = r.medal ? MEDAL[r.medal] : null;
          return (
            <div key={r.id} style={{
              background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "12px 14px",
              borderInlineStart: `4px solid ${medal ? medal.color : "var(--border)"}`,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{medal ? medal.icon : "🏆"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflowWrap: "anywhere" }}>
                  {r.session_title}
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.session_date}</div>
                {r.specialty && (
                  <div style={{ fontSize: 12, color: "var(--muted-lt)", marginTop: 6, overflowWrap: "anywhere" }}>
                    {r.specialty}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {r.result && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999, background: "var(--accent)20", color: "var(--accent)" }}>
                      {r.result}
                    </span>
                  )}
                  {r.rank_position != null && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999, background: "var(--accent2)20", color: "var(--accent2)" }}>
                      {t("competitionResults.place", { rank: r.rank_position })}
                    </span>
                  )}
                  {medal && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999, background: `color-mix(in srgb, ${medal.color} 20%, transparent)`, color: "var(--text)" }}>
                      {t(`sessionModal.${medal.key}`)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}