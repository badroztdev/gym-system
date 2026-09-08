// src/pages/Subscriptions.jsx
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionsService } from "@/services/subscriptions.service";
import { plansService } from "@/services/plans.service";
import { paymentsService } from "@/services/payments.service";
import { useAuthStore } from "@/store/authStore";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Spinner, Empty, Confirm } from "@/components/ui";
import SubscriptionForm from "@/components/subscriptions/SubscriptionForm";
import PlanForm from "@/components/subscriptions/PlanForm";
import PaymentForm from "@/components/subscriptions/PaymentForm";
import SubscriptionDetail from "@/components/subscriptions/SubscriptionDetail";
import toast from "react-hot-toast";

const getTabs = (t) => [
  { id: "subscriptions", label: t("subscriptions.tabSubscriptions"), icon: "🎫" },
  { id: "plans",         label: t("subscriptions.tabPlans"),         icon: "📋" },
  { id: "payments",      label: t("subscriptions.tabPayments"),      icon: "💳" },
];

const getMethodLabels = (t) => ({
  cash: t("subscriptions.methodCash"), card: t("subscriptions.methodCard"),
  bank_transfer: t("subscriptions.methodBankTransfer"), online: t("subscriptions.methodOnline"),
});

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

// ════════════════════════════════════════════════════════════
//  Tab 1 — الاشتراكات
// ════════════════════════════════════════════════════════════

function subStatusInfo(s, t) {
  if (s.status === "cancelled") return { type: "expired", label: t("subscriptions.statusCancelled") };
  if (s.status === "suspended") return { type: "pending", label: t("subscriptions.statusSuspended") };
  const days = Math.ceil((new Date(s.end_date) - new Date()) / 86400000);
  if (days < 0) return { type: "expired", label: t("subscriptions.statusExpired") };
  if (days <= 7) return { type: "expiring", label: t("subscriptions.statusExpiresInDays", { days }) };
  return { type: "active", label: t("subscriptions.statusActive") };
}

function paymentStatusInfo(s, t) {
  const remaining = Number(s.remaining);
  const paid = Number(s.total_paid);
  if (remaining <= 0) return { type: "active", label: t("subscriptions.payPaid") };
  if (paid > 0) return { type: "expiring", label: t("subscriptions.payPartial") };
  return { type: "expired", label: t("subscriptions.payUnpaid") };
}

function StatsRow() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ["subscriptions-stats"], queryFn: subscriptionsService.getStats });
  const s = data?.data || {};
  const cards = [
    { label: t("subscriptions.statActiveCount"),  value: s.active_count,   color: "var(--accent)" },
    { label: t("subscriptions.statExpiringCount"), value: s.expiring_count, color: "var(--warning)" },
    { label: t("subscriptions.statRevenueMonth"),  value: s.revenue_this_month, color: "var(--accent2)", suffix: " دج" },
    { label: t("subscriptions.statTotalDue"),      value: s.total_due,      color: "var(--danger)",  suffix: " دج" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 14 : 20 }}>
      {cards.map((c, i) => (
        <div key={i} className={`fade-up d-${i + 1}`} style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: isMobile ? "12px 14px" : "16px 20px",
        }}>
          <div className="mono" style={{ fontSize: isMobile ? 16 : 22, fontWeight: 700, color: c.color, overflowWrap: "break-word" }}>
            {s.active_count === undefined ? "—" : `${Number(c.value ?? 0).toLocaleString()}${c.suffix || ""}`}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function SubscriptionsTab() {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [paymentSub, setPaymentSub] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: subscriptionsService.remove,
    onSuccess: () => {
      toast.success(t("subscriptions.toastDeleted"));
      refresh();
      setDeleteId(null);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions", { search, status, paymentStatus, page }],
    queryFn: () => subscriptionsService.getAll({ search, status, paymentStatus, page, limit: 15 }),
    keepPreviousData: true,
  });

  const subs = data?.data || [];
  const meta = data?.meta || {};

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["subscriptions"] });
    qc.invalidateQueries({ queryKey: ["subscriptions-stats"] });
  };

  const STATUSES = [
    { value: "",         label: t("subscriptions.statusAll") },
    { value: "active",   label: t("subscriptions.statusActive") },
    { value: "expiring", label: t("subscriptions.statusExpiring") },
    { value: "expired",  label: t("subscriptions.statusExpired") },
    { value: "suspended",label: t("subscriptions.statusSuspended") },
    { value: "cancelled",label: t("subscriptions.statusCancelled") },
  ];
  const PAY_STATUSES = [
    { value: "",        label: t("subscriptions.payAll") },
    { value: "paid",    label: t("subscriptions.payPaid") },
    { value: "partial", label: t("subscriptions.payPartial") },
    { value: "unpaid",  label: t("subscriptions.payUnpaid") },
  ];

  return (
    <>
      <StatsRow />

      {/* فلاتر */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: isMobile ? "100%" : 200 }}>
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>🔍</span>
          <input
            placeholder={t("subscriptions.searchPlaceholder")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", padding: "9px 38px 9px 14px",
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              fontSize: 13, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
            }}
          />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={selectStyle(!!status)}>
          {STATUSES.map(s => <option key={s.value} value={s.value} style={optionStyle}>{s.label}</option>)}
        </select>
        <select value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPage(1); }} style={selectStyle(!!paymentStatus)}>
          {PAY_STATUSES.map(s => <option key={s.value} value={s.value} style={optionStyle}>{s.label}</option>)}
        </select>
      </div>

      {/* الجدول */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
        ) : subs.length === 0 ? (
          <Empty icon="🎫" title={t("subscriptions.noSubscriptions")} description={t("subscriptions.addFirstSubscription")} />
        ) : isMobile ? (
          /* ── عرض بطاقات للهاتف ─────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
            {subs.map(s => {
              const st = subStatusInfo(s, t);
              const pay = paymentStatusInfo(s, t);
              return (
                <div key={s.id} className="fade-in" style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: 14,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{s.athlete_name}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{s.athlete_phone}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <Badge label={st.label} type={st.type} />
                      <Badge label={pay.label} type={pay.type} />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--muted-lt)", marginBottom: 8 }}>{s.plan_name}</div>

                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                    {s.start_date?.slice(0,10)} → {s.end_date?.slice(0,10)}
                  </div>

                  <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{t("subscriptions.price")}</div>
                      <div className="mono" style={{ color: "var(--text)" }}>{Number(s.price).toFixed(0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{t("subscriptions.paid")}</div>
                      <div className="mono" style={{ color: "var(--accent)" }}>{Number(s.total_paid).toFixed(0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{t("subscriptions.remaining")}</div>
                      <div className="mono" style={{ color: Number(s.remaining) > 0 ? "var(--warning)" : "var(--muted)" }}>{Number(s.remaining).toFixed(0)}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <Button variant="secondary" size="sm" onClick={() => setDetailId(s.id)} style={{ flex: 1, justifyContent: "center", color: "var(--accent2)" }}>{t("subscriptions.actionDetails")}</Button>
                    {Number(s.remaining) > 0 && s.status === "active" && (
                      <Button variant="secondary" size="sm" onClick={() => setPaymentSub(s)} style={{ flex: 1, justifyContent: "center", color: "var(--accent)" }}>{t("subscriptions.actionPayment")}</Button>
                    )}
                    {isOwner && (
                      <Button variant="secondary" size="sm" onClick={() => setDeleteId(s.id)} style={{ color: "var(--danger)" }}>{t("subscriptions.actionDelete")}</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", direction: i18n.language === "ar" ? "rtl" : "ltr" }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  {[t("subscriptions.colAthlete"), t("subscriptions.colPlan"), t("subscriptions.colPeriod"), t("subscriptions.colPrice"), t("subscriptions.colPaid"), t("subscriptions.colRemaining"), t("subscriptions.colStatus"), t("subscriptions.colPayment"), t("subscriptions.colActions")].map(h => (
                    <th key={h} style={{ padding: "11px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const st = subStatusInfo(s, t);
                  const pay = paymentStatusInfo(s, t);
                  return (
                    <tr key={s.id} className="fade-in" style={{ borderTop: "1px solid var(--border)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.athlete_name}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{s.athlete_phone}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted-lt)" }}>{s.plan_name}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="mono" style={{ fontSize: 11, color: "var(--muted-lt)" }}>{s.start_date?.slice(0,10)}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>→ {s.end_date?.slice(0,10)}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{Number(s.price).toFixed(0)}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{Number(s.total_paid).toFixed(0)}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="mono" style={{ fontSize: 12, color: Number(s.remaining) > 0 ? "var(--warning)" : "var(--muted)" }}>
                          {Number(s.remaining).toFixed(0)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}><Badge label={st.label} type={st.type} /></td>
                      <td style={{ padding: "12px 16px" }}><Badge label={pay.label} type={pay.type} /></td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(s.id)} style={{ color: "var(--accent2)" }}>{t("subscriptions.actionDetails")}</Button>
                          {Number(s.remaining) > 0 && s.status === "active" && (
                            <Button variant="ghost" size="sm" onClick={() => setPaymentSub(s)} style={{ color: "var(--accent)" }}>{t("subscriptions.actionPayment")}</Button>
                          )}
                          {isOwner && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)} style={{ color: "var(--danger)" }}>{t("subscriptions.actionDelete")}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta.pages > 1 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>صفحة {page} من {meta.pages} — {meta.total} اشتراك</span>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>السابق</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === meta.pages}>التالي</Button>
            </div>
          </div>
        )}
      </div>

      {/* زر اشتراك جديد عائم في PageHeader عبر context — هنا نضيفه كزر إضافي */}
      <div style={{ position: "fixed", bottom: isMobile ? 90 : 150, left: isMobile ? 16 : 30, zIndex: 5 }}>
        <Button onClick={() => setShowForm(true)} style={{ boxShadow: "var(--shadow)", padding: isMobile ? "10px 16px" : "12px 22px" }} icon="+">
          {isMobile ? "" : t("subscriptions.newSubscription")}
        </Button>
      </div>

      <SubscriptionForm open={showForm} onClose={() => setShowForm(false)} onSuccess={refresh} />

      <PaymentForm
        open={!!paymentSub}
        onClose={() => setPaymentSub(null)}
        subscription={paymentSub}
        onSuccess={() => { refresh(); qc.invalidateQueries({ queryKey: ["subscription-detail"] }); }}
      />

      <SubscriptionDetail
        open={!!detailId}
        onClose={() => setDetailId(null)}
        subscriptionId={detailId}
        onAddPayment={(sub) => { setDetailId(null); setPaymentSub(sub); }}
      />

      {/* ✅ تأكيد الحذف النهائي — لتصحيح أخطاء الإدخال (مثل تاريخ خاطئ)، وليس لإنهاء اشتراك صحيح */}
      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title={t("subscriptions.deleteTitle")}
        message={t("subscriptions.deleteMessage")}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Tab 2 — الخطط
// ════════════════════════════════════════════════════════════

function PlansTab() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const isMobile = useIsMobile();

  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ["plans-page"], queryFn: () => plansService.getAll({ includeInactive: "true" }) });
  const plans = data?.data || [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["plans"] }) || qc.invalidateQueries({ queryKey: ["plans-page"] });

  const deleteMutation = useMutation({
    mutationFn: plansService.remove,
    onSuccess: () => { toast.success(t("subscriptions.toastPlanDisabled")); refresh(); setDeleteId(null); },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => plansService.update(id, { isActive: true }),
    onSuccess: () => { toast.success(t("subscriptions.toastPlanActivated")); refresh(); },
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button icon="+" onClick={() => { setEditPlan(null); setShowForm(true); }}>{t("subscriptions.newPlan")}</Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
      ) : plans.length === 0 ? (
        <Empty icon="📋" title={t("subscriptions.noPlans")} description={t("subscriptions.addFirstPlan")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {plans.map(p => (
            <div key={p.id} className="fade-in" style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 18,
              opacity: p.is_active ? 1 : 0.5,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{p.name}</div>
                  {p.category_name && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: (p.category_color || "#6366f1") + "20", color: p.category_color || "#6366f1", marginTop: 4, display: "inline-block" }}>
                      {p.category_name}
                    </span>
                  )}
                </div>
                {!p.is_active && <Badge label={t("subscriptions.planInactive")} type="expired" />}
              </div>

              {p.description && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{p.description}</div>}

              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{t("subscriptions.price")}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{Number(p.price).toFixed(0)} دج</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{t("subscriptions.durationLabel")}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{t("subscriptions.planDuration", { days: p.duration_days })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{t("subscriptions.sessionsLabel")}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{p.sessions_limit ?? t("subscriptions.planUnlimited")}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {t("subscriptions.activeSubsCount", { count: p.active_subscriptions })}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <Button variant="secondary" size="sm" onClick={() => { setEditPlan(p); setShowForm(true); }} style={{ flex: 1, justifyContent: "center" }}>{t("subscriptions.planEdit")}</Button>
                {isOwner && (
                  p.is_active ? (
                    <Button variant="danger" size="sm" onClick={() => setDeleteId(p.id)} style={{ flex: 1, justifyContent: "center" }}>{t("subscriptions.planDisable")}</Button>
                  ) : (
                    <Button variant="secondary" size="sm" loading={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate(p.id)} style={{ flex: 1, justifyContent: "center", color: "var(--accent)" }}>{t("subscriptions.planActivate")}</Button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanForm open={showForm} onClose={() => setShowForm(false)} plan={editPlan} onSuccess={refresh} />

      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title={t("subscriptions.disablePlanTitle")}
        message={t("subscriptions.disablePlanMessage")}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Tab 3 — المدفوعات
// ════════════════════════════════════════════════════════════

function PaymentsTab() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);

  const { data: statsData } = useQuery({ queryKey: ["payments-stats"], queryFn: paymentsService.getStats });
  const stats = statsData?.data || {};

  const { data, isLoading } = useQuery({
    queryKey: ["payments", { search, method, page }],
    queryFn: () => paymentsService.getAll({ search, method, page, limit: 15 }),
    keepPreviousData: true,
  });
  const payments = data?.data || [];
  const meta = data?.meta || {};
  const METHOD_LABELS = getMethodLabels(t);

  const METHODS = [
    { value: "",              label: t("subscriptions.methodAll") },
    { value: "cash",          label: t("subscriptions.methodCash") },
    { value: "card",          label: t("subscriptions.methodCard") },
    { value: "bank_transfer", label: t("subscriptions.methodBankTransfer") },
    { value: "online",        label: t("subscriptions.methodOnline") },
  ];

  return (
    <>
      {/* إحصائيات سريعة */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: isMobile ? 14 : 20 }}>
        {[
          { label: t("subscriptions.statToday"), value: stats.today, color: "var(--accent)" },
          { label: t("subscriptions.statWeek"), value: stats.this_week, color: "var(--accent2)" },
          { label: t("subscriptions.statMonth"), value: stats.this_month, color: "var(--accent3)" },
        ].map((c, i) => (
          <div key={i} className={`fade-up d-${i + 1}`} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: isMobile ? "12px 14px" : "16px 20px" }}>
            <div className="mono" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: c.color }}>
              {stats.today === undefined ? "—" : `${Number(c.value ?? 0).toLocaleString()} دج`}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: isMobile ? "100%" : 200 }}>
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>🔍</span>
          <input
            placeholder={t("subscriptions.searchPlaceholder")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", padding: "9px 38px 9px 14px",
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              fontSize: 13, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
            }}
          />
        </div>
        <select value={method} onChange={e => { setMethod(e.target.value); setPage(1); }} style={selectStyle(!!method)}>
          {METHODS.map(m => <option key={m.value} value={m.value} style={optionStyle}>{m.label}</option>)}
        </select>
      </div>

      {/* الجدول */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={32} /></div>
        ) : payments.length === 0 ? (
          <Empty icon="💳" title={t("subscriptions.noPayments")} />
        ) : isMobile ? (
          /* ── عرض بطاقات للهاتف ─────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
            {payments.map(p => (
              <div key={p.id} className="fade-in" style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: 14,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{p.athlete_name}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{p.athlete_phone}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>+{Number(p.amount).toFixed(0)} دج</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-lt)", marginBottom: 8 }}>{p.plan_name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <Badge label={METHOD_LABELS[p.method] || p.method} type="athlete" />
                  <div style={{ textAlign: "left" }}>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted-lt)" }}>{(p.paid_at || p.created_at)?.slice(0,10)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{p.recorded_by_name || "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", direction: i18n.language === "ar" ? "rtl" : "ltr" }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  {[t("subscriptions.colDate"), t("subscriptions.colAthlete"), t("subscriptions.colPlan"), t("subscriptions.colAmount"), t("subscriptions.colMethod"), t("subscriptions.colRecordedBy")].map(h => (
                    <th key={h} style={{ padding: "11px 16px", fontSize: 11, color: "var(--muted)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="fade-in" style={{ borderTop: "1px solid var(--border)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--muted-lt)" }}>{(p.paid_at || p.created_at)?.slice(0,10)}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.athlete_name}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{p.athlete_phone}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted-lt)" }}>{p.plan_name}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>+{Number(p.amount).toFixed(0)} دج</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge label={METHOD_LABELS[p.method] || p.method} type="athlete" />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>{p.recorded_by_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.pages > 1 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("subscriptions.paginationPayments", { page, pages: meta.pages, total: meta.total })}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>{t("common.previous")}</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === meta.pages}>{t("common.next")}</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════

const selectStyle = (active) => ({
  padding: "8px 14px", fontSize: 12, borderRadius: "var(--radius-sm)",
  border: "1px solid " + (active ? "var(--accent2)" : "var(--border)"),
  background: active ? "var(--accent2)15" : "var(--card)",
  color: active ? "var(--accent2)" : "var(--muted)",
  cursor: "pointer", fontFamily: "'Sora', sans-serif", outline: "none",
});
const optionStyle = { background: "var(--card)", color: "var(--text)" };

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const TABS = getTabs(t);
  const [tab, setTab] = useState("subscriptions");
  const isMobile = useIsMobile();

  return (
    <>
      <PageHeader title={t("subscriptions.pageTitle")} subtitle={isMobile ? "" : t("subscriptions.pageSubtitle")}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 4, flexWrap: "wrap" }}>
          {TABS.map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{
              padding: isMobile ? "7px 10px" : "7px 16px", fontSize: 12, fontWeight: 600,
              borderRadius: "var(--radius-sm)", border: "none",
              background: tab === tabItem.id ? "var(--accent)" : "transparent",
              color: tab === tabItem.id ? "#0d0f14" : "var(--muted)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
            }}>
              <span>{tabItem.icon}</span>{!isMobile && tabItem.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <main style={{ padding: isMobile ? "14px 12px" : "24px 28px", flex: 1 }}>
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "plans" && <PlansTab />}
        {tab === "payments" && <PaymentsTab />}
      </main>
    </>
  );
}