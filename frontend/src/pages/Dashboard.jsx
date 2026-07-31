// src/pages/Dashboard.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import PageHeader from "@/components/layout/PageHeader";
import { Spinner, Badge } from "@/components/ui";
import { dashboardService } from "@/services/dashboard.service";

const PERIODS = [
  { value: "week",  label: "أسبوعي" },
  { value: "month", label: "شهري" },
  { value: "year",  label: "سنوي" },
];

const PIE_COLORS = ["#6ee7b7","#818cf8","#fb923c","#f87171","#fbbf24","#0ea5e9","#a78bfa"];

// ══ بطاقة إحصائية ═════════════════════════════════════════════
function StatCard({ icon, label, value, sub, color, delay }) {
  return (
    <div className={`fade-up d-${delay}`} style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "18px 20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -24, left: -24, width: 80, height: 80, borderRadius: "50%", background: color + "12" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: color + "20",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>{icon}</div>
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ══ اختيار الفترة ═════════════════════════════════════════════
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

// ══ الصفحة الرئيسية ══════════════════════════════════════════
export default function DashboardPage() {
  const [revenuePeriod, setRevenuePeriod]     = useState("week");
  const [attendancePeriod, setAttendancePeriod] = useState("week");
  const [growthPeriod, setGrowthPeriod]       = useState("month");

  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ["dashboard-overview"], queryFn: dashboardService.getOverview,
  });
  const o = overviewData?.data || {};

  const { data: revenueData } = useQuery({
    queryKey: ["revenue-chart", revenuePeriod],
    queryFn: () => dashboardService.getRevenueChart(revenuePeriod),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance-chart", attendancePeriod],
    queryFn: () => dashboardService.getAttendanceChart(attendancePeriod),
  });

  const { data: growthData } = useQuery({
    queryKey: ["members-growth", growthPeriod],
    queryFn: () => dashboardService.getMembersGrowth(growthPeriod),
  });

  const { data: topCoachesData } = useQuery({ queryKey: ["top-coaches"], queryFn: dashboardService.getTopCoaches });
  const { data: ageDistData }    = useQuery({ queryKey: ["age-distribution"], queryFn: dashboardService.getAgeDistribution });
  const { data: activityData }  = useQuery({ queryKey: ["recent-activity"], queryFn: dashboardService.getRecentActivity });

  const revenue    = revenueData?.data    || [];
  const attendance = attendanceData?.data || [];
  const growth     = growthData?.data     || [];
  const topCoaches = topCoachesData?.data || [];
  const ageDist    = (ageDistData?.data   || []).map(d => ({ ...d, count: Number(d.count) }));
  const activity   = activityData?.data   || [];

  const formatLabel = (label, period) => {
    if (period === "year") return label.slice(5); // MM
    return label.slice(5); // MM-DD
  };

  const ACTIVITY_INFO = {
    member:       { icon: "👤", label: "عضو جديد",  color: "var(--accent2)" },
    payment:      { icon: "💰", label: "دفعة",       color: "var(--accent)" },
    subscription: { icon: "🎫", label: "اشتراك جديد", color: "var(--accent3)" },
  };

  if (loadingOverview) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spinner size={36} /></div>;
  }

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="نظرة شاملة على أداء الصالة" />

      <main style={{ padding: "24px 28px", flex: 1 }}>

        {/* ══ الصف 1 — الأعضاء والاشتراكات ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }} className="stats-grid">
          <StatCard icon="👥" label="إجمالي الرياضيين" value={o.members?.total_athletes || 0} sub={`+${o.members?.new_this_month || 0} هذا الشهر`} color="var(--accent2)" delay={1} />
          <StatCard icon="🎫" label="اشتراكات نشطة" value={o.subscriptions?.active_count || 0} sub={`${o.subscriptions?.expiring_count || 0} تنتهي قريباً`} color="var(--accent)" delay={2} />
          <StatCard icon="💰" label="إيرادات الشهر" value={`${Number(o.revenue?.this_month || 0).toLocaleString()} دج`} sub={`اليوم: ${Number(o.revenue?.today || 0).toLocaleString()} دج`} color="var(--accent3)" delay={3} />
          <StatCard icon="⚠️" label="مستحقات معلّقة" value={`${Number(o.revenue?.total_due || 0).toLocaleString()} دج`} sub={`${o.subscriptions?.overdue_count || 0} اشتراك متأخر`} color="var(--danger)" delay={4} />
        </div>

        {/* ══ الصف 2 — الحصص والحضور والفريق ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }} className="stats-grid">
          <StatCard icon="📅" label="حصص اليوم" value={o.sessions?.today_count || 0} sub={`${o.sessions?.week_count || 0} هذا الأسبوع`} color="var(--accent2)" delay={1} />
          <StatCard icon="✅" label="حضور (30 يوم)" value={o.attendance?.present || 0} sub={`${o.attendance?.absent || 0} غياب`} color="var(--accent)" delay={2} />
          <StatCard icon="⏰" label="تأخير (30 يوم)" value={o.attendance?.late || 0} color="var(--warning)" delay={3} />
          <StatCard icon="🧑‍🏫" label="الفريق" value={(Number(o.staff?.coaches||0) + Number(o.staff?.assistants||0))} sub={`${o.staff?.coaches || 0} مدرب، ${o.staff?.assistants || 0} مساعد`} color="var(--accent3)" delay={4} />
        </div>

        {/* ══ رسم الإيرادات ══ */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>💰 الإيرادات</div>
            <PeriodSelector value={revenuePeriod} onChange={setRevenuePeriod} />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenue.map(r => ({ ...r, label: formatLabel(r.label, revenuePeriod), value: Number(r.value) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} دج`, "الإيرادات"]} />
              <Line type="monotone" dataKey="value" stroke="#6ee7b7" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ══ رسم الحضور ══ */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>✅ الحضور والغياب</div>
            <PeriodSelector value={attendancePeriod} onChange={setAttendancePeriod} />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={attendance.map(a => ({ ...a, label: formatLabel(a.label, attendancePeriod), present: Number(a.present), absent: Number(a.absent), late: Number(a.late) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="present" name="حاضر" fill="#6ee7b7" radius={[4,4,0,0]} />
              <Bar dataKey="late"    name="متأخر" fill="#fbbf24" radius={[4,4,0,0]} />
              <Bar dataKey="absent"  name="غائب"  fill="#f87171" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ══ صف: نمو الأعضاء + توزيع الفئات ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* نمو الأعضاء */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>📈 نمو الأعضاء الجدد</div>
              <PeriodSelector value={growthPeriod} onChange={setGrowthPeriod} />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={growth.map(g => ({ ...g, label: formatLabel(g.label, growthPeriod), new_members: Number(g.new_members) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="new_members" name="أعضاء جدد" fill="#818cf8" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* توزيع الفئات العمرية */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>🏷️ توزيع الفئات العمرية</div>
            {ageDist.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 12 }}>لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={ageDist} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={75} label={({ category, count }) => `${count}`}>
                    {ageDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ══ صف: أفضل المدربين + آخر الأنشطة ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* أفضل المدربين */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>🏆 أفضل المدربين (30 يوم)</div>
            {topCoaches.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 12 }}>لا توجد بيانات كافية</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topCoaches.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      background: i === 0 ? "var(--accent3)25" : "var(--surface)",
                      color: i === 0 ? "var(--accent3)" : "var(--muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.full_name}</div>
                    </div>
                    <div style={{ textAlign: "left", flexShrink: 0 }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--accent2)" }}>{c.sessions_count} حصة</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* آخر الأنشطة */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>🕐 آخر الأنشطة</div>
            {activity.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 12 }}>لا توجد أنشطة حديثة</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto" }}>
                {activity.map((a, i) => {
                  const info = ACTIVITY_INFO[a.type] || ACTIVITY_INFO.member;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{info.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "var(--text)" }}>
                          <strong>{a.title}</strong> — {info.label}
                          {a.type === "payment" && ` (${Number(a.detail).toLocaleString()} دج)`}
                          {a.type === "subscription" && ` (${a.detail})`}
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                          {new Date(a.ts).toLocaleString("ar-DZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}