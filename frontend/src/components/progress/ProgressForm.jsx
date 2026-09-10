// src/components/progress/ProgressForm.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Button } from "@/components/ui";
import { progressService } from "@/services/progress.service";
import toast from "react-hot-toast";

// ✅ إصلاح: .toISOString() يحوّل للتوقيت العالمي (UTC) لا المحلي
// في الجزائر (UTC+1)، هذا يُسبب ظهور تاريخ الأمس خلال الساعة 00:00-01:00
function toLocalDateString(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = () => toLocalDateString(new Date());

export default function ProgressForm({ open, onClose, athlete, record, onSuccess }) {
  const { t, i18n } = useTranslation();
  const isEdit = !!record;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    recordDate: today(), weightKg: "", bodyFatPct: "",
    performanceScore: "", notes: "",
  });
  // قياسات مخصصة كقائمة {key, label, value}
  const [customMetrics, setCustomMetrics] = useState([{ label: "", value: "" }]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        recordDate:       record.record_date?.slice(0,10) || today(),
        weightKg:         record.weight_kg != null ? String(record.weight_kg) : "",
        bodyFatPct:       record.body_fat_pct != null ? String(record.body_fat_pct) : "",
        performanceScore: record.performance_score != null ? String(record.performance_score) : "",
        notes:            record.notes || "",
      });
      const metrics = record.custom_metrics || {};
      const list = Object.entries(metrics).map(([label, value]) => ({ label, value: String(value) }));
      setCustomMetrics(list.length ? list : [{ label: "", value: "" }]);
    } else {
      setForm({ recordDate: today(), weightKg: "", bodyFatPct: "", performanceScore: "", notes: "" });
      setCustomMetrics([{ label: "", value: "" }]);
    }
  }, [open, record]);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const updateMetric = (i, field, value) => {
    setCustomMetrics(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };
  const addMetric    = () => setCustomMetrics(prev => [...prev, { label: "", value: "" }]);
  const removeMetric = (i) => setCustomMetrics(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.weightKg && !form.performanceScore && customMetrics.every(m => !m.label)) {
      toast.error(t("progressForm.errorNoValue"));
      return;
    }
    setLoading(true);
    try {
      const metricsObj = {};
      customMetrics.forEach(m => { if (m.label.trim()) metricsObj[m.label.trim()] = m.value; });

      const payload = {
        athleteId: athlete.id,
        recordDate: form.recordDate,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : null,
        performanceScore: form.performanceScore ? Number(form.performanceScore) : null,
        notes: form.notes || null,
        customMetrics: metricsObj,
      };

      if (isEdit) {
        await progressService.update(record.id, payload);
        toast.success(t("progressForm.toastUpdated"));
      } else {
        await progressService.create(payload);
        toast.success(t("progressForm.toastCreated"));
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("progressForm.editTitle", { name: athlete?.full_name }) : t("progressForm.addTitle", { name: athlete?.full_name })} width={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <Input label={t("progressForm.dateLabel")} type="date" value={form.recordDate} onChange={set("recordDate")} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label={t("progressForm.weightLabel")} type="number" step="0.1" min="0" value={form.weightKg} onChange={set("weightKg")} />
          <Input label={t("progressForm.bodyFatLabel")} type="number" step="0.1" min="0" max="100" value={form.bodyFatPct} onChange={set("bodyFatPct")} />
        </div>

        <Input
          label={t("progressForm.performanceLabel")}
          type="number" min="1" max="100"
          value={form.performanceScore}
          onChange={set("performanceScore")}
        />

        {/* قياسات مخصصة */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500 }}>{t("progressForm.customMetricsLabel")}</label>
            <button onClick={addMetric} type="button" style={{
              fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer",
            }}>{t("progressForm.addMetric")}</button>
          </div>
          {customMetrics.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                placeholder={t("progressForm.metricNamePlaceholder")}
                value={m.label}
                onChange={e => updateMetric(i, "label", e.target.value)}
                style={{ flex: 1.5, padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 12, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr" }}
              />
              <input
                placeholder={t("progressForm.metricValuePlaceholder")}
                value={m.value}
                onChange={e => updateMetric(i, "value", e.target.value)}
                style={{ flex: 1, padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 12, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr" }}
              />
              {customMetrics.length > 1 && (
                <button onClick={() => removeMetric(i)} type="button" style={{
                  background: "var(--danger)15", border: "1px solid var(--danger)30",
                  borderRadius: "var(--radius-sm)", color: "var(--danger)", cursor: "pointer",
                  width: 32, flexShrink: 0,
                }}>✕</button>
              )}
            </div>
          ))}
          <p style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>
            {t("progressForm.metricsHint")}
          </p>
        </div>

        <Input label={t("progressForm.notesLabel")} placeholder={t("progressForm.notesPlaceholder")} value={form.notes} onChange={set("notes")} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("progressForm.cancel")}</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? t("progressForm.saveChanges") : t("progressForm.addRecord")}</Button>
        </div>
      </div>
    </Modal>
  );
}
