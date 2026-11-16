// src/components/subscriptions/SubscriptionDetail.jsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Badge, Spinner } from "@/components/ui";
import { subscriptionsService } from "@/services/subscriptions.service";
import toast from "react-hot-toast";


export default function SubscriptionDetail({ open, onClose, subscriptionId, onAddPayment }) {
  const qc = useQueryClient();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-detail", subscriptionId],
    queryFn: () => subscriptionsService.getOne(subscriptionId),
    enabled: open && !!subscriptionId,
  });

  const sub = data?.data;

  const statusMutation = useMutation({
    mutationFn: (status) => subscriptionsService.update(subscriptionId, { status }),
    onSuccess: (_, status) => {
      toast.success(t({ cancelled: "subscriptionDetail.toastCancelled", suspended: "subscriptionDetail.toastSuspended", active: "subscriptionDetail.toastActive" }[status] || "subscriptionDetail.toastUpdated"));
      qc.invalidateQueries({ queryKey: ["subscription-detail", subscriptionId] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["subscriptions-stats"] });
    },
  });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("subscriptionDetail.title")} width={560}>
      {isLoading || !sub ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner size={28} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* رأس البطاقة */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{sub.athlete_name}{sub.is_drop_in && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent2)", border: "1px solid var(--accent2)", borderRadius: 6, padding: "1px 6px", marginInlineStart: 8 }}>{t("subscriptions.visitorBadge")}</span>}</div>
              {sub.athlete_phone && <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub.athlete_phone}</div>}
            </div>
            <StatusBadge sub={sub} />
          </div>

          {/* معلومات الخطة */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10,
            background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 14,
          }}>
            <Info label={sub.is_drop_in ? t("subscriptions.sessionLabelShort") : t("subscriptionDetail.planLbl")} value={sub.plan_name} />
            <Info label={t("subscriptionDetail.price")} value={`${Number(sub.price).toFixed(2)} ${t("subscriptionDetail.da")}`} mono />
            <Info label={t("subscriptionDetail.start")} value={sub.start_date?.slice(0, 10)} mono />
            <Info label={t("subscriptionDetail.end")} value={sub.end_date?.slice(0, 10)} mono />
            {!sub.is_drop_in && sub.sessions_limit && (
              <Info label={t("subscriptionDetail.sessionsLeft")} value={`${sub.sessions_remaining ?? "—"} / ${sub.sessions_limit}`} mono />
            )}
            {sub.notes && <Info label={t("subscriptionDetail.notes")} value={sub.notes} full />}
          </div>

          {/* ملخص الدفع */}
          {!sub.payments_hidden && <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SummaryCard label={t("subscriptionDetail.total")} value={sub.price} color="var(--text)" />
            <SummaryCard label={t("subscriptionDetail.paid")} value={sub.total_paid} color="var(--accent)" />
            <SummaryCard label={t("subscriptionDetail.remaining")} value={sub.remaining} color={Number(sub.remaining) > 0 ? "var(--warning)" : "var(--accent)"} />
          </div>

          {Number(sub.remaining) > 0 && onAddPayment && (
            <Button onClick={() => onAddPayment(sub)} style={{ width: "100%", justifyContent: "center" }}>
              {t("subscriptionDetail.addPayment")}
            </Button>
          )}

          {/* سجل المدفوعات */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 8, letterSpacing: "0.05em" }}>
              {t("subscriptionDetail.history")} ({sub.payments?.length || 0})
            </div>
            {sub.payments?.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 12, background: "var(--surface)", borderRadius: "var(--radius-sm)" }}>
                {t("subscriptionDetail.noPayments")}
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
                        +{Number(p.amount).toFixed(2)} {t("subscriptionDetail.da")}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {t(`subscriptionDetail.${p.method}`, { defaultValue: p.method })}
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

          </>}

          {/* بلا صلاحية عرض المدفوعات: زر تسجيل دفعة فقط (دون عرض الإجماليات أو السجل) */}
          {sub.payments_hidden && Number(sub.remaining) > 0 && onAddPayment && (
            <Button onClick={() => onAddPayment(sub)} style={{ width: "100%", justifyContent: "center" }}>
              {t("subscriptionDetail.addPayment")}
            </Button>
          )}

          {/* إجراءات الحالة */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {sub.status === "active" && (
              <>
                <Button variant="secondary" size="sm" loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("suspended")}>
                  {t("subscriptionDetail.suspend")}
                </Button>
                <Button variant="danger" size="sm" loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("cancelled")}>
                  {t("subscriptionDetail.cancel")}
                </Button>
              </>
            )}
            {sub.status === "suspended" && (
              <Button variant="secondary" size="sm" loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate("active")}>
                {t("subscriptionDetail.reactivate")}
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
    <div style={{ flex: "1 1 90px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color, marginTop: 4 }}>{Number(value).toFixed(2)}</div>
    </div>
  );
}

function StatusBadge({ sub }) {
  const { t } = useTranslation();
  if (sub.status === "cancelled") return <Badge label={t("subscriptionDetail.cancelled")} type="expired" />;
  if (sub.status === "suspended") return <Badge label={t("subscriptionDetail.suspended")} type="pending" />;
  if (sub.status === "active") {
    const days = Math.ceil((new Date(sub.end_date) - new Date()) / 86400000);
    if (days < 0) return <Badge label={t("subscriptionDetail.expired")} type="expired" />;
    if (days <= 7) return <Badge label={t("subscriptionDetail.endsIn", { days })} type="expiring" />;
    return <Badge label={t("subscriptionDetail.active")} type="active" />;
  }
  return <Badge label={t("subscriptionDetail.expired")} type="expired" />;
}