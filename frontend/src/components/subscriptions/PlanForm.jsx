// src/components/subscriptions/PlanForm.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button } from "@/components/ui";
import { plansService } from "@/services/plans.service";
import { categoriesService } from "@/services/categories.service";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  name: "", description: "", durationDays: "30",
  price: "", sessionsLimit: "", categoryId: "",
};

export default function PlanForm({ open, onClose, plan, onSuccess }) {
  const isEdit = !!plan;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [unlimited, setUnlimited] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesService.getAll,
    enabled: open,
  });
  const categories = categoriesData?.data || [];
  const categoryOptions = [
    { value: "", label: "-- بدون فئة --" },
    ...categories.map(c => ({ value: c.id, label: c.name })),
  ];

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setForm({
        name:          plan.name          || "",
        description:   plan.description   || "",
        durationDays:  String(plan.duration_days || 30),
        price:         String(plan.price ?? ""),
        sessionsLimit: plan.sessions_limit != null ? String(plan.sessions_limit) : "",
        categoryId:    plan.category_id    || "",
      });
      setUnlimited(plan.sessions_limit == null);
    } else {
      setForm(EMPTY_FORM);
      setUnlimited(false);
    }
    setErrors({});
  }, [open, plan]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "اسم الخطة مطلوب";
    if (!form.durationDays || Number(form.durationDays) < 1) errs.durationDays = "المدة يجب أن تكون يوماً واحداً على الأقل";
    if (form.price === "" || Number(form.price) < 0) errs.price = "السعر مطلوب";
    if (!unlimited && (!form.sessionsLimit || Number(form.sessionsLimit) < 1))
      errs.sessionsLimit = "عدد الحصص مطلوب أو فعّل 'غير محدود'";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        sessionsLimit: unlimited ? null : Number(form.sessionsLimit),
        categoryId: form.categoryId || null,
      };
      if (isEdit) {
        await plansService.update(plan.id, payload);
        toast.success("تم تحديث الخطة ✅");
      } else {
        await plansService.create(payload);
        toast.success("تم إنشاء الخطة بنجاح ✅");
      }
      onSuccess?.();
      onClose();
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "تعديل الخطة" : "خطة جديدة"} width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input
          label="اسم الخطة *"
          placeholder="مثال: اشتراك شهري - كمال أجسام"
          value={form.name}
          onChange={set("name")}
          error={errors.name}
        />

        <Input
          label="الوصف"
          placeholder="وصف مختصر اختياري"
          value={form.description}
          onChange={set("description")}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="المدة (أيام) *"
            type="number" min="1"
            value={form.durationDays}
            onChange={set("durationDays")}
            error={errors.durationDays}
          />
          <Input
            label="السعر (دج) *"
            type="number" min="0" step="0.01"
            value={form.price}
            onChange={set("price")}
            error={errors.price}
          />
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500 }}>عدد الحصص المسموح</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={unlimited}
                onChange={e => setUnlimited(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              غير محدود
            </label>
          </div>
          {!unlimited && (
            <Input
              type="number" min="1"
              placeholder="مثال: 12"
              value={form.sessionsLimit}
              onChange={set("sessionsLimit")}
              error={errors.sessionsLimit}
            />
          )}
        </div>

        <Select
          label="الفئة الرياضية"
          options={categoryOptions}
          value={form.categoryId}
          onChange={set("categoryId")}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>
            {isEdit ? "حفظ التغييرات" : "إنشاء الخطة"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}