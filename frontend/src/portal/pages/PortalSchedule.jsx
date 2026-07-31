// src/portal/pages/PortalSchedule.jsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalService } from "@/portal/services/portal.service";

const DAY_NAMES = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

function getWeekDates(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function PortalSchedule() {
  const { athlete } = useOutletContext();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-schedule", athlete?.id, weekOffset],
    queryFn: () => portalService.getSchedule(athlete.id, { dateFrom: weekDates[0], dateTo: weekDates[6] }),
    enabled: !!athlete?.id,
  });

  const sessions = data?.data || [];

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>الجدول الأسبوعي</h1>

      {/* تنقل الأسابيع */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={navBtnStyle}>← السابق</button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {weekOffset === 0 ? "هذا الأسبوع" : `${weekDates[0].slice(5)} — ${weekDates[6].slice(5)}`}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={navBtnStyle}>التالي →</button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>جاري التحميل...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 16 }}>
          {weekDates.map((date, i) => {
            const daySessions = sessions.filter(s => s.session_date === date);
            const isToday = date === today;
            return (
              <div key={date} style={{
                background: "var(--card)",
                border: `1px solid ${isToday ? "var(--accent)60" : "var(--border)"}`,
                borderRadius: "var(--radius)", overflow: "hidden",
              }}>
                <div style={{
                  padding: "9px 14px",
                  background: isToday ? "var(--accent)12" : "var(--surface)",
                  display: "flex", alignItems: "center", gap: 8,
                  borderBottom: daySessions.length ? "1px solid var(--border)" : "none",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text)" }}>{DAY_NAMES[i]}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{date.slice(5)}</span>
                  {isToday && <span style={{ fontSize: 9, background: "var(--accent)20", color: "var(--accent)", padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>اليوم</span>}
                </div>

                {daySessions.length > 0 && (
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {daySessions.map(s => (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "var(--surface)", borderRadius: 8, padding: "10px 12px",
                      }}>
                        <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: s.category_color || "var(--accent2)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s.title}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                            <span className="mono" style={{ fontSize: 11, color: "var(--muted-lt)" }}>🕐 {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>🧑‍🏫 {s.coach_name?.split(" ")[0]}</span>
                            {s.room_name && <span style={{ fontSize: 11, color: "var(--muted)" }}>🏛️ {s.room_name}</span>}
                          </div>
                        </div>
                        {s.attended && <span style={{ fontSize: 16 }}>✅</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtnStyle = {
  padding: "7px 14px", fontSize: 12, fontWeight: 600,
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", color: "var(--text)",
  cursor: "pointer", fontFamily: "'Sora', sans-serif",
};