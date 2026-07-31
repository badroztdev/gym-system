// src/components/progress/AthleteProgressDetail.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Modal, Button, Spinner, Empty, Confirm } from "@/components/ui";
import { progressService } from "@/services/progress.service";
import ProgressForm from "./ProgressForm";
import RankChangeForm from "./RankChangeForm";
import toast from "react-hot-toast";

export default function AthleteProgressDetail({ open, onClose, athlete }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [showRankForm, setShowRankForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["athlete-progress", athlete?.id],
    queryFn: () => progressService.getAthleteProgress(athlete.id),
    enabled: open && !!athlete?.id,
  });

  const d = data?.data;
  const records = d?.records || [];
  const rankHistory = d?.rankHistory || [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["athlete-progress", athlete?.id] });

  const deleteMutation = useMutation({
    mutationFn: progressService.remove,
    onSuccess: () => { toast.success("تم حذف السجل"); refresh(); setDeleteId(null); },
  });

  // بيانات الرسم البياني (مرتبة تصاعدياً بالتاريخ)
  const chartData = [...records].reverse().map(r => ({
    date: r.record_date?.slice(5, 10),
    الوزن: r.weight_kg ? Number(r.weight_kg) : null,
    الأداء: r.performance_score ? Number(r.performance_score) : null,
  }));

  const hasWeightData = chartData.some(d => d.الوزن != null);
  const hasPerfData   = chartData.some(d => d.الأداء != null);

  if (!athlete) return null;

  return (
    <>
      <Modal open={open} onClose={onClose} title={`تقدم — ${athlete.full_name}`} width={640}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* رأس: الرتبة الحالية + زر تغييرها */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "12px 16px",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>الرتبة الحالية</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{athlete.rank || "بدون رتبة"}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowRankForm(true)}>تغيير الرتبة</Button>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={28} /></div>
          ) : (
            <>
              {/* الرسم البياني */}
              {(hasWeightData || hasPerfData) && (
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>تطور الوزن والأداء</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      {hasWeightData && <Line type="monotone" dataKey="الوزن" stroke="#6ee7b7" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                      {hasPerfData   && <Line type="monotone" dataKey="الأداء" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* زر إضافة سجل */}
              <Button onClick={() => { setEditRecord(null); setShowForm(true); }} style={{ width: "100%", justifyContent: "center" }}>
                + إضافة سجل تقدم جديد
              </Button>

              {/* سجلات التقدم */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
                  السجلات ({records.length})
                </div>
                {records.length === 0 ? (
                  <Empty icon="📈" title="لا توجد سجلات بعد" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                    {records.map(r => (
                      <div key={r.id} style={{
                        background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{r.record_date?.slice(0,10)}</span>
                            {r.weight_kg && <span style={{ fontSize: 12, color: "var(--text)" }}>⚖️ {r.weight_kg} كغ</span>}
                            {r.body_fat_pct && <span style={{ fontSize: 12, color: "var(--text)" }}>📊 {r.body_fat_pct}% دهون</span>}
                            {r.performance_score && <span style={{ fontSize: 12, color: "var(--accent2)" }}>⭐ {r.performance_score}/100</span>}
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => { setEditRecord(r); setShowForm(true); }} style={{ background: "none", border: "none", color: "var(--accent2)", cursor: "pointer", fontSize: 12 }}>تعديل</button>
                            <button onClick={() => setDeleteId(r.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>حذف</button>
                          </div>
                        </div>
                        {r.custom_metrics && Object.keys(r.custom_metrics).length > 0 && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                            {Object.entries(r.custom_metrics).map(([k, v]) => (
                              <span key={k} style={{ fontSize: 10, background: "var(--card)", padding: "2px 8px", borderRadius: 8, color: "var(--muted-lt)" }}>
                                {k}: <strong style={{ color: "var(--text)" }}>{v}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                        {r.notes && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>📝 {r.notes}</div>}
                        {r.coach_name && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>سجّله: {r.coach_name}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* سجل تغيّر الرتب */}
              {rankHistory.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>سجل الترقيات</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {rankHistory.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                        <div style={{ fontSize: 12, color: "var(--text)" }}>
                          {r.old_rank ? `${r.old_rank} ← ` : ""}<strong style={{ color: "var(--accent)" }}>{r.new_rank}</strong>
                        </div>
                        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{r.changed_at?.slice(0,10)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <ProgressForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditRecord(null); }}
        athlete={athlete}
        record={editRecord}
        onSuccess={refresh}
      />

      <RankChangeForm
        open={showRankForm}
        onClose={() => setShowRankForm(false)}
        athlete={athlete}
        onSuccess={refresh}
      />

      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="حذف السجل"
        message="سيتم حذف هذا السجل نهائياً. لا يمكن التراجع عن هذا الإجراء."
      />
    </>
  );
}