// src/components/subscriptions/PaymentForm.jsx
import { useState, useEffect } from "react";
import { Modal, Input, Select, Button } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import toast from "react-hot-toast";

const METHODS = [
  { value: "cash",          label: "نقدي" },
  { value: "card",          label: "بطاقة" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "online",        label: "دفع عبر الإنترنت" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentForm({ open, onClose, subscription, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ amount: "", method: "cash", notes: "", paidAt: today() });

  const remaining = subscription ? Number(subscription.remaining) : 0;

  useEffect(() => {
    if (!open || !subscription) return;
    setForm({
      amount: remaining > 0 ? String(remaining.toFixed(2)) : "",
      method: "cash",
      notes: "",
      paidAt: today(),
    });
    setErrors({});
  }, [open, subscription]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    const amt = Number(form.amount);
    if (!form.amount || amt <= 0) errs.amount = "المبلغ مطلوب ويجب أن يكون أكبر من صفر";
    if (amt > remaining + 0.01) errs.amount = `المبلغ أكبر من المتبقي (${remaining.toFixed(2)} دج)`;
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await paymentsService.create({
        subscriptionId: subscription.id,
        amount: Number(form.amount),
        method: form.method,
        notes: form.notes || null,
        paidAt: form.paidAt,
      });
      toast.success("تم تسجيل الدفعة بنجاح ✅");
      onSuccess?.();
      onClose();
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  if (!subscription) return null;

  return (
    <Modal open={open} onClose={onClose} title={`دفعة جديدة — ${subscription.athlete_name}`} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ملخص الاشتراك */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          background: "var(--surface)", borderRadius: "var(--radius-sm)",
          padding: "12px 14px", fontSize: 12,
        }}>
          <div>
            <div style={{ color: "var(--muted)" }}>السعر الإجمالي</div>
            <div className="mono" style={{ fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{Number(subscription.price).toFixed(2)} دج</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>المدفوع</div>
            <div className="mono" style={{ fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>{Number(subscription.total_paid).toFixed(2)} دج</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>المتبقي</div>
            <div className="mono" style={{ fontWeight: 700, color: remaining > 0 ? "var(--warning)" : "var(--accent)", marginTop: 2 }}>
              {remaining.toFixed(2)} دج
            </div>
          </div>
        </div>

        {remaining <= 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
            ✅ هذا الاشتراك مدفوع بالكامل
          </div>
        ) : (
          <>
            <Input
              label="المبلغ (دج) *"
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={set("amount")}
              error={errors.amount}
            />

            <Select
              label="طريقة الدفع"
              options={METHODS}
              value={form.method}
              onChange={set("method")}
            />

            <Input
              label="تاريخ الدفع"
              type="date"
              value={form.paidAt}
              onChange={set("paidAt")}
            />

            <Input
              label="ملاحظات"
              placeholder="اختياري"
              value={form.notes}
              onChange={set("notes")}
            />
          </>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إغلاق</Button>
          {remaining > 0 && (
            <Button onClick={handleSubmit} loading={loading}>تسجيل الدفعة</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}