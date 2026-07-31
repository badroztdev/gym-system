// src/components/team/StaffForm.jsx
import { useState, useEffect } from "react";
import { Modal, Input, Select, Button } from "@/components/ui";
import { staffService } from "@/services/staff.service";
import toast from "react-hot-toast";

const ROLES = [
  { value: "coach",     label: "مدرب" },
  { value: "assistant", label: "مساعد مدرب" },
];

const EMPTY = { fullName: "", phone: "", email: "", role: "coach", password: "" };

export default function StaffForm({ open, onClose, staff, onSuccess }) {
  const isEdit = !!staff;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (staff) {
      setForm({
        fullName: staff.full_name || "",
        phone:    staff.phone     || "",
        email:    staff.email     || "",
        role:     staff.role      || "coach",
        password: "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, staff]);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "الاسم الكامل مطلوب";
    if (!form.phone.trim())    e.phone = "رقم الهاتف مطلوب";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      if (isEdit) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await staffService.update(staff.id, payload);
        toast.success("تم تحديث بيانات العضو ✅");
      } else {
        await staffService.create(form);
        toast.success("تم إضافة العضو بنجاح ✅");
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `تعديل: ${staff?.full_name}` : "إضافة عضو فريق"} width={440}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="الاسم الكامل *" placeholder="مثال: كريم منصور" value={form.fullName} onChange={set("fullName")} error={errors.fullName} />
        <Input label="رقم الهاتف *" placeholder="0550000000" value={form.phone} onChange={set("phone")} error={errors.phone} type="tel" />
        <Input label="البريد الإلكتروني" placeholder="example@email.com" value={form.email} onChange={set("email")} type="email" />
        <Select label="الدور" options={ROLES} value={form.role} onChange={set("role")} />
        <Input
          label={isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور (اختياري)"}
          placeholder={isEdit ? "اتركه فارغاً لعدم التغيير" : "افتراضياً: رقم الهاتف"}
          value={form.password}
          onChange={set("password")}
          type="password"
        />

        {!isEdit && (
          <p style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6 }}>
            💡 إذا تُرك حقل كلمة المرور فارغاً، سيتم استخدام رقم الهاتف كأساس لكلمة المرور.
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? "حفظ التغييرات" : "إضافة العضو"}</Button>
        </div>
      </div>
    </Modal>
  );
}