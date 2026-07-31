// src/components/subscriptions/SubscriptionForm.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button, Spinner } from "@/components/ui";
import { membersService } from "@/services/members.service";
import { plansService } from "@/services/plans.service";
import { subscriptionsService } from "@/services/subscriptions.service";
import toast from "react-hot-toast";

const today = () => new Date().toISOString().slice(0, 10);

export default function SubscriptionForm({ open, onClose, onSuccess, presetAthlete = null }) {
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

  useEffect(() => {
    if (!open) return;
    setAthleteSearch("");
    setSelectedAthlete(presetAthlete || null);
    setForm({ planId: "", startDate: today(), price: "", notes: "" });
    setErrors({});
  }, [open, presetAthlete]);

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
    if (!selectedAthlete) errs.athlete = "اختر الرياضي أولاً";
    if (!form.planId) errs.planId = "اختر الخطة";
    if (form.price === "" || Number(form.price) < 0) errs.price = "السعر مطلوب";
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
      toast.success("تم إنشاء الاشتراك بنجاح ✅");
      onSuccess?.();
      onClose();
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const planOptions = [
    { value: "", label: "-- اختر الخطة --" },
    ...plans.map(p => ({
      value: p.id,
      label: `${p.name} — ${p.price} دج / ${p.duration_days} يوم${p.sessions_limit ? ` / ${p.sessions_limit} حصة` : ""}`,
    })),
  ];

  return (
    <Modal open={open} onClose={onClose} title="اشتراك جديد" width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── اختيار الرياضي ── */}
        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
            الرياضي *
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
                <Button variant="ghost" size="sm" onClick={() => setSelectedAthlete(null)} style={{ color: "var(--danger)" }}>
                  تغيير
                </Button>
              )}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <Input
                placeholder="ابحث بالاسم أو رقم الهاتف (حرفان على الأقل)..."
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
                    <div style={{ padding: 14, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>لا توجد نتائج</div>
                  ) : (
                    athleteResults.map(a => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAthlete(a); setAthleteSearch(""); }}
                        style={{
                          width: "100%", textAlign: "right", padding: "10px 14px",
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
          label="الخطة *"
          options={planOptions}
          value={form.planId}
          onChange={set("planId")}
          error={errors.planId}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="تاريخ البداية"
            type="date"
            value={form.startDate}
            onChange={set("startDate")}
          />
          <Input
            label="السعر (دج) *"
            type="number" min="0" step="0.01"
            value={form.price}
            onChange={set("price")}
            error={errors.price}
          />
        </div>

        {selectedPlan && (
          <div style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6 }}>
            📅 تاريخ الانتهاء: <span className="mono">{addDays(form.startDate, selectedPlan.duration_days)}</span>
            {selectedPlan.sessions_limit && <> — 🎫 عدد الحصص: <span className="mono">{selectedPlan.sessions_limit}</span></>}
          </div>
        )}

        <Input
          label="ملاحظات"
          placeholder="اختياري"
          value={form.notes}
          onChange={set("notes")}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>إنشاء الاشتراك</Button>
        </div>
      </div>
    </Modal>
  );
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}