// src/components/team/StaffForm.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Select, Button } from "@/components/ui";
import { staffService } from "@/services/staff.service";
import toast from "react-hot-toast";

export default function StaffForm({ open, onClose, staff, onSuccess }) {
  const { t } = useTranslation();
  const ROLES = [
    { value: "coach",     label: t("staffForm.roleCoach") },
    { value: "assistant", label: t("staffForm.roleAssistant") },
  ];
  const EMPTY = { fullName: "", phone: "", email: "", role: "coach", password: "" };

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
    if (!form.fullName.trim()) e.fullName = t("staffForm.errorFullName");
    if (!form.phone.trim())    e.phone = t("staffForm.errorPhone");
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
        toast.success(t("staffForm.toastUpdated"));
      } else {
        await staffService.create(form);
        toast.success(t("staffForm.toastCreated"));
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("staffForm.editTitle", { name: staff?.full_name }) : t("staffForm.addTitle")} width={440}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label={t("staffForm.fullName")} placeholder={t("staffForm.fullNamePlaceholder")} value={form.fullName} onChange={set("fullName")} error={errors.fullName} />
        <Input label={t("staffForm.phone")} placeholder="0550000000" value={form.phone} onChange={set("phone")} error={errors.phone} type="tel" />
        <Input label={t("staffForm.email")} placeholder={t("staffForm.emailPlaceholder")} value={form.email} onChange={set("email")} type="email" />
        <Select label={t("staffForm.role")} options={ROLES} value={form.role} onChange={set("role")} />
        <Input
          label={isEdit ? t("staffForm.passwordEdit") : t("staffForm.passwordAdd")}
          placeholder={isEdit ? t("staffForm.passwordEditPlaceholder") : t("staffForm.passwordAddPlaceholder")}
          value={form.password}
          onChange={set("password")}
          type="password"
        />

        {!isEdit && (
          <p style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6 }}>
            {t("staffForm.helpPassword")}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("staffForm.cancel")}</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? t("staffForm.saveChanges") : t("staffForm.addMember")}</Button>
        </div>
      </div>
    </Modal>
  );
}
