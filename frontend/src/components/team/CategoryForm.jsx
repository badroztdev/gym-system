// src/components/team/CategoryForm.jsx
import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/components/ui";
import { categoriesService } from "@/services/categories.service";
import toast from "react-hot-toast";

const COLORS = ["#ef4444","#f97316","#fbbf24","#84cc16","#10b981","#0ea5e9","#6366f1","#8b5cf6","#ec4899"];

const EMPTY = { name: "", color: COLORS[0] };

export default function CategoryForm({ open, onClose, category, onSuccess }) {
  const isEdit = !!category;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm({
      name:  category?.name  || "",
      color: category?.color || COLORS[0],
    });
  }, [open, category]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("اسم الفئة مطلوب"); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await categoriesService.update(category.id, form);
        toast.success("تم تحديث الفئة ✅");
      } else {
        await categoriesService.create(form);
        toast.success("تم إضافة الفئة ✅");
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "تعديل الفئة" : "فئة رياضية جديدة"} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="اسم الفئة *" placeholder="مثال: كرة القدم" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />

        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 8 }}>اللون</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer",
                border: form.color === c ? "3px solid var(--text)" : "3px solid transparent",
                outline: form.color === c ? `1px solid ${c}` : "none",
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? "حفظ" : "إضافة"}</Button>
        </div>
      </div>
    </Modal>
  );
}