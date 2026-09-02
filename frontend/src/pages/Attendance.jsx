// src/pages/Attendance.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import PageHeader from "@/components/layout/PageHeader";
import { Spinner } from "@/components/ui";
import { attendanceService } from "@/services/attendance.service";

const PERIODS = [
  { value: "week",  label: "أسبوعي" },
  { value: "month", label: "شهري" },
  { value: "year",  label: "سنوي" },
];

const PIE_COLORS = ["#6ee7b7","#818cf8","#fb923c","#f87171","#fbbf24","#0ea5e9","#a78bfa"];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "16px 18px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -20, left: -20, width: 70, height: 70, borderRadius: "50%", background: color + "12" }} />
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: color + "20",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, marginBottom: 8,
      }}>{icon}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function PeriodSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 3 }}>
      {PERIODS.map(p => (
        <button key={p.value} onClick={() => onChange(p.value)} style={{
          padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none",
          background: value === p.value ? "var(--accent)" : "transparent",
          color: value === p.value ? "#0d0f14" : "var(--muted)",
          cursor: "pointer", fontFamily: "'Sora', sans-serif",
        }}>{p.label}</button>
      ))}
    </div>
  );
}

const STATUS_AR = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "بعذر" };

export default function AttendancePage() {
  const isMobile = useIsMobile();
  const [trendPeriod, setTrendPeriod] = useState("month");
  const [leaderOrder, setLeaderOrder] = useState("best");

  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ["attendance-overview"],
    queryFn: () => attendanceService.getOverview(),
  });
  const o = overviewData?.data || {};

  const { data: trendData } = useQuery({
    queryKey: ["attendance-trend", trendPeriod],
    queryFn: () => attendanceService.getTrend(trendPeriod),
  });
  const trend = trendData?.data || [];

  const { data: leaderData } = useQuery({
    queryKey: ["attendance-leaderboard", leaderOrder],
    queryFn: () => attendanceService.getLeaderboard(leaderOrder),
  });
  const leaderboard = leaderData?.data || [];

  const { data: categoryData } = useQuery({
    queryKey: ["attendance-by-category"],
    queryFn: () => attendanceService.getByCategory(),
  });
  const byCategory = (categoryData?.data || []).map(d => ({ ...d, present: Number(d.present), total: Number(d.total), rate: Number(d.rate) }));

  const { data: sessionsData } = useQuery({
    queryKey: ["attendance-recent-sessions"],
    queryFn: () => attendanceService.getRecentSessions(),
  });
  const recentSessions = sessionsData?.data || [];

  const formatLabel = (label) => label.slice(5);

  if (loadingOverview) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spinner size={36} /></div>;
  }

  return (
    <>
      <PageHeader title="الحضور والغياب" subtitle="نظرة شاملة على حضور كل الحصص" />

      <main style={{ padding: isMobile ? "14px 12px" : "24px 28px", flex: 1 }}>

        {/* بطاقات إحصائية */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)",
          gap: 12, marginBottom: 20,
        }}>
          <StatCard icon="✅" label="حاضر (30 يوم)" value={o.present || 0} color="var(--accent)" />
          <StatCard icon="❌" label="غائب" value={o.absent || 0} color="var(--danger)" />
          <StatCard icon="⏰" label="متأخر" value={o.late || 0} color="var(--warning)" />
          <StatCard icon="📄" label="بعذر" value={o.excused || 0} color="var(--muted)" />
          <StatCard icon="📊" label="نسبة الحضور" value={`${o.attendanceRate || 0}%`} sub={`${o.unique_athletes || 0} رياضي`} color="var(--accent2)" />
        </div>

        {/* اتجاه الحضور */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: isMobile ? 14 : 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>📈 اتجاه الحضور</div>
            <PeriodSelector value={trendPeriod} onChange={setTrendPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
            <BarChart data={trend.map(t => ({ ...t, label: formatLabel(t.label), present: Number(t.present), absent: Number(t.absent), late: Number(t.late) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="present" name="حاضر" fill="#6ee7b7" radius={[4,4,0,0]} />
              <Bar dataKey="late"    name="متأخر" fill="#fbbf24" radius={[4,4,0,0]} />
              <Bar dataKey="absent"  name="غائب"  fill="#f87171" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* صف: الترتيب + التوزيع حسب الفئة */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* ترتيب الرياضيين */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: isMobile ? 14 : 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>🏆 ترتيب نسبة الحضور (30 يوم)</div>
              <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 3 }}>
                <button onClick={() => setLeaderOrder("best")} style={{
                  padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none",
                  background: leaderOrder === "best" ? "var(--accent)" : "transparent",
                  color: leaderOrder === "best" ? "#0d0f14" : "var(--muted)",
                  cursor: "pointer", fontFamily: "'Sora', sans-serif",
                }}>الأفضل</button>
                <button onClick={() => setLeaderOrder("worst")} style={{
                  padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none",
                  background: leaderOrder === "worst" ? "var(--danger)" : "transparent",
                  color: leaderOrder === "worst" ? "#fff" : "var(--muted)",
                  cursor: "pointer", fontFamily: "'Sora', sans-serif",
                }}>الأقل</button>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 12 }}>لا توجد بيانات كافية</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                {leaderboard.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      background: i === 0 ? "var(--accent3)25" : "var(--surface)",
                      color: i === 0 ? "var(--accent3)" : "var(--muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name}</div>
                      {a.age_category && <div style={{ fontSize: 10, color: "var(--muted)" }}>{a.age_category}</div>}
                    </div>
                    <div style={{ textAlign: "left", flexShrink: 0 }}>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 700,
                        color: a.rate >= 80 ? "var(--accent)" : a.rate >= 50 ? "var(--warning)" : "var(--danger)",
                      }}>{a.rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* توزيع حسب الفئة العمرية */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: isMobile ? 14 : 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>🏷️ نسبة الحضور حسب الفئة</div>
            {byCategory.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 12 }}>لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCategory} dataKey="rate" nameKey="category" cx="50%" cy="50%" outerRadius={75} label={({ category, rate }) => `${rate}%`}>
                    {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* آخر الحصص مع ملخص الحضور */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            🕐 آخر الحصص
          </div>
          {recentSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 12 }}>لا توجد حصص سابقة بعد</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    {["الحصة", "التاريخ", "القاعة", "حاضر", "متأخر", "غائب"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", fontSize: 11, color: "var(--muted)", textAlign: "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map(s => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{s.title}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted-lt)" }} className="mono">{s.session_date}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted-lt)" }}>{s.room_name || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{s.present}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--warning)", fontWeight: 600 }}>{s.late}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>{s.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}