// src/pages/Progress.jsx
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Spinner, Empty } from "@/components/ui";
import AthleteProgressDetail from "@/components/progress/AthleteProgressDetail";
import { progressService } from "@/services/progress.service";

const AGE_CATEGORIES = ["", "مدارس", "براعم", "أصاغر", "أشبال", "أواسط", "أمال", "أكابر"];

function StatsRow({ data }) {
  const total = data?.meta?.total || 0;
  const withRecords = data?.data?.filter(a => a.records_count > 0).length || 0;
  const cards = [
    { label: "إجمالي الرياضيين", value: total, color: "var(--accent2)" },
    { label: "لديهم سجلات تقدم", value: withRecords, color: "var(--accent)" },
    { label: "بدون سجلات", value: total - withRecords, color: "var(--warning)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
      {cards.map((c, i) => (
        <div key={i} className={`fade-up d-${i+1}`} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProgressPage() {
  const [search, setSearch] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [page, setPage] = useState(1);
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["progress-list", { search, ageCategory, page }],
    queryFn: () => progressService.getList({ search, ageCategory, page, limit: 15 }),
    keepPreviousData: true,
  });

  const athletes = data?.data || [];
  const meta = data?.meta || {};

  const handleSearch = useCallback((v) => { setSearch(v); setPage(1); }, []);
  const handleAgeCategory = useCallback((v) => { setAgeCategory(v); setPage(1); }, []);

  return (
    <>
      <PageHeader title="متابعة التقدم" subtitle={meta.total ? `${meta.total} رياضي` : ""} />

      <main style={{ padding: "24px 28px", flex: 1 }}>
        <StatsRow data={data} />

        {/* فلاتر */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>🔍</span>
            <input
              placeholder="بحث بالاسم..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 38px 9px 14px",
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)",
                fontSize: 13, outline: "none", direction: "rtl",
              }}
            />
          </div>
          <select value={ageCategory} onChange={e => handleAgeCategory(e.target.value)} style={{
            padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid " + (ageCategory ? "var(--accent2)" : "var(--border)"),
            background: ageCategory ? "var(--accent2)15" : "var(--card)",
            color: ageCategory ? "var(--accent2)" : "var(--muted)",
            cursor: "pointer", fontFamily: "'Sora', sans-serif", outline: "none",
          }}>
            {AGE_CATEGORIES.map(c => (
              <option key={c} value={c} style={{ background: "var(--card)", color: "var(--text)" }}>{c || "كل الفئات"}</option>
            ))}
          </select>
        </div>

        {/* بطاقات الرياضيين */}
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
        ) : athletes.length === 0 ? (
          <Empty icon="📈" title="لا يوجد رياضيون" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {athletes.map(a => (
              <div key={a.id} onClick={() => setSelectedAthlete(a)} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: 16, cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)40"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                    background: "var(--accent)20", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700,
                  }}>{a.full_name[0]}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name}</div>
                    {a.age_category && <Badge label={a.age_category} type="athlete" />}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  {a.weight_kg && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>آخر وزن</div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{a.weight_kg} كغ</div>
                    </div>
                  )}
                  {a.performance_score && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>آخر أداء</div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent2)" }}>{a.performance_score}/100</div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {a.rank ? `🏅 ${a.rank}` : "بدون رتبة"}
                  </span>
                  <span style={{ fontSize: 11, color: a.records_count > 0 ? "var(--accent)" : "var(--muted)" }}>
                    {a.records_count} سجل
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* pagination */}
        {meta.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p-1)} disabled={page===1}>السابق</Button>
            <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>صفحة {page} من {meta.pages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p+1)} disabled={page===meta.pages}>التالي</Button>
          </div>
        )}
      </main>

      <AthleteProgressDetail
        open={!!selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
        athlete={selectedAthlete}
      />
    </>
  );
}