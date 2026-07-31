// src/portal/pages/PortalProgress.jsx
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { portalService } from "@/portal/services/portal.service";

export default function PortalProgress() {
  const { athlete } = useOutletContext();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-progress", athlete?.id],
    queryFn: () => portalService.getProgress(athlete.id),
    enabled: !!athlete?.id,
  });

  const d = data?.data;
  const records = d?.records || [];

  const chartData = [...records].reverse().map(r => ({
    date: r.record_date?.slice(5, 10),
    الوزن: r.weight_kg ? Number(r.weight_kg) : null,
    الأداء: r.performance_score ? Number(r.performance_score) : null,
  }));
  const hasWeight = chartData.some(x => x.الوزن != null);
  const hasPerf   = chartData.some(x => x.الأداء != null);

  if (isLoading || !athlete) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>جاري التحميل...</div>;
  }

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>تقدّمي</h1>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        الرتبة الحالية: <strong style={{ color: "var(--accent)" }}>{d?.athlete?.rank || "بدون رتبة"}</strong>
      </div>

      {(hasWeight || hasPerf) && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>تطور الوزن والأداء</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              {hasWeight && <Line type="monotone" dataKey="الوزن" stroke="#6ee7b7" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {hasPerf   && <Line type="monotone" dataKey="الأداء" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>السجلات ({records.length})</div>

      {records.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", background: "var(--card)", borderRadius: "var(--radius)" }}>
          لا توجد سجلات تقدم بعد
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 20 }}>
          {records.map(r => (
            <div key={r.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{r.record_date?.slice(0,10)}</span>
                {r.weight_kg && <span style={{ fontSize: 12 }}>⚖️ {r.weight_kg} كغ</span>}
                {r.performance_score && <span style={{ fontSize: 12, color: "var(--accent2)" }}>⭐ {r.performance_score}/100</span>}
              </div>
              {r.custom_metrics && Object.keys(r.custom_metrics).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {Object.entries(r.custom_metrics).map(([k,v]) => (
                    <span key={k} style={{ fontSize: 10, background: "var(--surface)", padding: "2px 8px", borderRadius: 8, color: "var(--muted-lt)" }}>{k}: {v}</span>
                  ))}
                </div>
              )}
              {r.notes && <div style={{ fontSize: 11, color: "var(--muted)" }}>📝 {r.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}