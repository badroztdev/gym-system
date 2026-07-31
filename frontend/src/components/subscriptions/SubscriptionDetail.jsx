// src/components/subscriptions/SubscriptionDetail.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Badge, Spinner } from "@/components/ui";
import { subscriptionsService } from "@/services/subscriptions.service";
import toast from "react-hot-toast";

const METHOD_LABELS = {
  cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي", online: "عبر الإنترنت",
};

export default function SubscriptionDetail({ open, onClose, subscriptionId, onAddPayment }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-detail", subscriptionId],
    queryFn: () => subscriptionsService.getOne(subscriptionId),
    enabled: open && !!subscriptionId,
  });

  const sub = data?.data;

  const statusMutation = useMutation({
    mutationFn: (status) => subscriptionsService.update(subscriptionId, { status }),
    onSuccess: (_, status) => {
      const labels = { cancelled: "إلغاء", suspended: "تعليق", active: "إعادة تفعيل" };
      toast.success(`تم ${labels[status] || "تحديث"} الاشتراك ✅`);
      qc.invalidateQueries({ queryKey: ["subscription-detail", subscriptionId] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["subscriptions-stats"] });
    },
  });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="تفاصيل الاشتراك" width={560}>
      {isLoading || !sub ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner size={28} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* رأس البطاقة */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{sub.athlete_name}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub.athlete_phone}</div>
            </div>
            <StatusBadge sub={sub} />
          </div>

          {/* معلومات الخطة */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
            background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 14,
          }}>
            <Info label="الخطة" value={sub.plan_name} />
            <Info label="السعر" value={`${Number(sub.price).toFixed(2)} دج`} mono />
            <Info label="تاريخ البداية" value={sub.start_date?.slice(0, 10)} mono />
            <Info label="تاريخ الانتهاء" value={sub.end_date?.slice(0, 10)} mono />
            {sub.sessions_limit && (
              <Info label="الحصص المتبقية" value={`${sub.sessions_remaining ?? "—"} / ${sub.sessions_limit}`} mono />
            )}
            {sub.notes && <Info label="ملاحظات" value={sub.notes} full />}
          </div>

          {/* ملخص الدفع */}
          <div style={{ display: "flex", gap: 10 }}>
            <SummaryCard label="الإجمالي" value={sub.price} color="var(--text)" />
            <SummaryCard label="المدفوع" value={sub.total_paid} color="var(--accent)" />
            <SummaryCard label="المتبقي" value={sub.remaining} color={Number(sub.remaining) > 0 ? "var(--warning)" : "var(--accent)"} />
          </div>

          {Number(sub.remaining) > 0 && (
            <Button onClick={() => onAddPayment(sub)} style={{ width: "100%", justifyContent: "center" }}>
              + تسجيل دفعة جديدة
            </Button>
          )}

          {/* سجل المدفوعات */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 8, letterSpacing: "0.05em" }}>
              سجل المدفوعات ({sub.payments?.length || 0})
            </div>
            {sub.payments?.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 12, background: "var(--surface)", borderRadius: "var(--radius-sm)" }}>
                لا توجد مدفوعات مسجّلة
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sub.payments.map(p => (
                  <div key={p.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "10px 14px",
                  }}>
                    <div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                        +{Number(p.amount).toFixed(2)} دج
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {METHOD_LABELS[p.method] || p.method}
                        {p.notes && ` — ${p.notes}`}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                      {(p.paid_at || p.created_at)?.slice(0, 10)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* إجراءات الحالة */}
          <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {sub.status === "active" && (
              <>
                <Button variant="secondary" size="sm" loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("suspended")}>
                  تعليق الاشتراك
                </Button>
                <Button variant="danger" size="sm" loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("cancelled")}>
                  إلغاء الاشتراك
                </Button>
              </>
            )}
            {sub.status === "suspended" && (
              <Button variant="secondary" size="sm" loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate("active")}>
                إعادة تفعيل
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value, mono, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 13, color: "var(--text)", marginTop: 2, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color, marginTop: 4 }}>{Number(value).toFixed(2)}</div>
    </div>
  );
}

function StatusBadge({ sub }) {
  if (sub.status === "cancelled") return <Badge label="ملغى" type="expired" />;
  if (sub.status === "suspended") return <Badge label="معلّق" type="pending" />;
  if (sub.status === "active") {
    const days = Math.ceil((new Date(sub.end_date) - new Date()) / 86400000);
    if (days < 0) return <Badge label="منتهي" type="expired" />;
    if (days <= 7) return <Badge label={`ينتهي بعد ${days}ي`} type="expiring" />;
    return <Badge label="نشط" type="active" />;
  }
  return <Badge label="منتهي" type="expired" />;
}