// src/components/subscriptions/SubscriptionForm.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button, Spinner } from "@/components/ui";
import { membersService } from "@/services/members.service";
import { plansService } from "@/services/plans.service";
import { subscriptionsService } from "@/services/subscriptions.service";
import api from "@/services/api";
import toast from "react-hot-toast";

function toLocalDateString(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = () => toLocalDateString(new Date());
// يحفظ ترتيب أرقام التاريخ داخل النص العربي (RTL)
const ltr = (d) => `\u2066${d}\u2069`;

export default function SubscriptionForm({ open, onClose, onSuccess, presetAthlete = null }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ── الرياضي ──────────────────────────────────────────────────
  const [athleteSearch, setAthleteSearch] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  const { data: athletesData, isFetching: searching } = useQuery({
    queryKey: ["athletes-search", athleteSearch],
    queryFn: () => membersService.getAll({ role: "athlete", search: athleteSearch, limit: 8 }),
    enabled: open && athleteSearch.length >= 2 && !selectedAthlete,
  });
  const athleteResults = athletesData?.data || [];

  // ── الخطط ────────────────────────────────────────────────────
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: () => plansService.getAll(),
    enabled: open,
  });
  const plans = (plansData?.data || []).filter(p => p.is_active);

  const [form, setForm] = useState({ planId: "", startDate: today(), price: "", notes: "" });
  const [startTouched, setStartTouched] = useState(false);

  // ── اشتراكاته النشطة الحالية (لاقتراح بداية بعد انتهاء الحالي: تجديد مسبق بلا تداخل) ──
  const { data: currentSubs } = useQuery({
    queryKey: ["athlete-active-subs", selectedAthlete?.id],
    queryFn: () => api.get("/subscriptions", { params: { athleteId: selectedAthlete.id, status: "active", limit: 50 } }).then(r => r.data),
    enabled: open && !!selectedAthlete?.id,
  });
  const lastEnd = (currentSubs?.data || [])
    .map(s => String(s.end_date).slice(0, 10))
    .filter(d => d >= today())
    .sort()
    .pop() || null;

  useEffect(() => {
    if (!open) return;
    setAthleteSearch("");
    setSelectedAthlete(presetAthlete || null);
    setForm({ planId: "", startDate: today(), price: "", notes: "" });
    setStartTouched(false);
    setErrors({});
  }, [open, presetAthlete]);

  // لديه اشتراك لم ينتهِ → يبدأ الجديد في اليوم التالي لانتهائه (ما لم يغيّر المستخدم التاريخ بنفسه)
  useEffect(() => {
    if (!open || startTouched) return;
    setForm(f => ({ ...f, startDate: lastEnd ? addDays(lastEnd, 1) : today() }));
  }, [lastEnd, open, startTouched, selectedAthlete?.id]); // eslint-disable-line

  const selectedPlan = plans.find(p => p.id === form.planId);

  // عند اختيار خطة، نقترح سعرها كقيمة افتراضية قابلة للتعديل
  useEffect(() => {
    if (selectedPlan) {
      setForm(f => ({ ...f, price: String(selectedPlan.price) }));
    }
  }, [form.planId]); // eslint-disable-line

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!selectedAthlete) errs.athlete = t("subscriptionForm.errorAthlete");
    if (!form.planId) errs.planId = t("subscriptionForm.errorPlan");
    if (form.price === "" || Number(form.price) < 0) errs.price = t("subscriptionForm.errorPrice");
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await subscriptionsService.create({
        athleteId: selectedAthlete.id,
        planId:    form.planId,
        startDate: form.startDate,
        price:     Number(form.price),
        notes:     form.notes || null,
      });
      toast.success(t("subscriptionForm.toastCreated"));
      onSuccess?.();
      onClose();
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const planOptions = [
    { value: "", label: t("subscriptionForm.planSelect") },
    ...plans.map(p => ({
      value: p.id,
      label: t("subscriptionForm.planOptionFormat", {
        name: p.name,
        price: p.price,
        days: p.duration_days,
        sessions: p.sessions_limit ? t("subscriptionForm.planOptionSessions", { count: p.sessions_limit }) : "",
      }),
    })),
  ];

  return (
    <Modal open={open} onClose={onClose} title={t("subscriptionForm.addTitle")} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── اختيار الرياضي ── */}
        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
            {t("subscriptionForm.athleteLabel")}
          </label>

          {selectedAthlete ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "var(--surface)",
              border: "1px solid var(--accent)40", borderRadius: "var(--radius-sm)",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{selectedAthlete.full_name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{selectedAthlete.phone}</div>
              </div>
              {!presetAthlete && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedAthlete(null); setStartTouched(false); }} style={{ color: "var(--danger)" }}>
                  {t("subscriptionForm.changeAthlete")}
                </Button>
              )}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <Input
                placeholder={t("subscriptionForm.searchPlaceholder")}
                value={athleteSearch}
                onChange={e => setAthleteSearch(e.target.value)}
                error={errors.athlete}
              />
              {athleteSearch.length >= 2 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                  marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", maxHeight: 200, overflowY: "auto",
                  boxShadow: "var(--shadow)",
                }}>
                  {searching ? (
                    <div style={{ padding: 14, display: "flex", justifyContent: "center" }}><Spinner size={18} /></div>
                  ) : athleteResults.length === 0 ? (
                    <div style={{ padding: 14, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{t("subscriptionForm.noResults")}</div>
                  ) : (
                    athleteResults.map(a => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAthlete(a); setAthleteSearch(""); }}
                        style={{
                          width: "100%", textAlign: i18n.language === "ar" ? "right" : "left", padding: "10px 14px",
                          background: "transparent", border: "none", cursor: "pointer",
                          borderBottom: "1px solid var(--border)",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--card)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{a.full_name}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{a.phone}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── الخطة ── */}
        <Select
          label={t("subscriptionForm.planLabel")}
          options={planOptions}
          value={form.planId}
          onChange={set("planId")}
          error={errors.planId}
        />

        {/* تجديد مسبق: لديه اشتراك لم ينتهِ بعد */}
        {lastEnd && (
          <div style={{
            fontSize: 12, lineHeight: 1.7, padding: "10px 12px", borderRadius: "var(--radius-sm)",
            background: "var(--accent2)15", border: "1px solid var(--accent2)40", color: "var(--text)",
          }}>
            <div style={{ fontWeight: 700, color: "var(--accent2)" }}>🔁 {t("subscriptionForm.renewCurrent", { date: ltr(lastEnd) })}</div>
            {form.startDate > lastEnd ? (
              <div style={{ color: "var(--muted-lt)" }}>{t("subscriptionForm.renewStarts", { start: ltr(form.startDate) })}</div>
            ) : (
              <div style={{ color: "var(--warning)" }}>{t("subscriptionForm.renewOverlap", { date: ltr(lastEnd) })}</div>
            )}
            {form.startDate !== today() && (
              <button type="button" onClick={() => { setStartTouched(true); setForm(f => ({ ...f, startDate: today() })); }}
                style={{ marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent2)", fontSize: 12, textDecoration: "underline", fontFamily: "inherit" }}>
                {t("subscriptionForm.renewFromToday")}
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label={t("subscriptionForm.startDateLabel")}
            type="date"
            value={form.startDate}
            onChange={e => { setStartTouched(true); set("startDate")(e); }}
          />
          <Input
            label={t("subscriptionForm.priceLabel")}
            type="number" min="0" step="0.01"
            value={form.price}
            onChange={set("price")}
            error={errors.price}
          />
        </div>

        {selectedPlan && addDays(form.startDate, selectedPlan.duration_days) && (
          <div style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6 }}>
            {t("subscriptionForm.endDateInfo")}<span className="mono">{addDays(form.startDate, selectedPlan.duration_days)}</span>
            {selectedPlan.sessions_limit && <>{t("subscriptionForm.sessionsCountInfo")}<span className="mono">{selectedPlan.sessions_limit}</span></>}
          </div>
        )}

        <Input
          label={t("subscriptionForm.notesLabel")}
          placeholder={t("subscriptionForm.notesPlaceholder")}
          value={form.notes}
          onChange={set("notes")}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("subscriptionForm.cancel")}</Button>
          <Button onClick={handleSubmit} loading={loading}>{t("subscriptionForm.createSubscription")}</Button>
        </div>
      </div>
    </Modal>
  );
}

function addDays(dateStr, days) {
  if (!dateStr) return null;
  // تحليل محلي (YYYY-MM-DD) لتفادي انزياح اليوم بسبب المنطقة الزمنية
  const [y, m, dd] = String(dateStr).slice(0, 10).split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, dd || 1);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days));
  return toLocalDateString(d);
}
