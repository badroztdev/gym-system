// src/components/progress/RankChangeForm.jsx
import { useState } from "react";
import { Modal, Input, Button } from "@/components/ui";
import { progressService } from "@/services/progress.service";
import toast from "react-hot-toast";

export default function RankChangeForm({ open, onClose, athlete, onSuccess }) {
  const [newRank, setNewRank] = useState("");
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newRank.trim()) { toast.error("أدخل الرتبة الجديدة"); return; }
    setLoading(true);
    try {
      await progressService.changeRank({ athleteId: athlete.id, newRank, notes: notes || null });
      toast.success("تم تحديث الرتبة ✅");
      onSuccess?.();
      onClose();
      setNewRank(""); setNotes("");
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`تغيير رتبة — ${athlete?.full_name}`} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
          الرتبة الحالية: <strong style={{ color: "var(--text)" }}>{athlete?.rank || "بدون رتبة"}</strong>
        </div>
        <Input label="الرتبة الجديدة *" placeholder="مثال: الحزام الأزرق" value={newRank} onChange={e => setNewRank(e.target.value)} />
        <Input label="ملاحظات" placeholder="اختياري" value={notes} onChange={e => setNotes(e.target.value)} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>تحديث الرتبة</Button>
        </div>
      </div>
    </Modal>
  );
}