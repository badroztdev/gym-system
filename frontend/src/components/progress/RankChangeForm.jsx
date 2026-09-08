// src/components/progress/RankChangeForm.jsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Button } from "@/components/ui";
import { progressService } from "@/services/progress.service";
import toast from "react-hot-toast";

export default function RankChangeForm({ open, onClose, athlete, onSuccess }) {
  const { t } = useTranslation();
  const [newRank, setNewRank] = useState("");
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newRank.trim()) { toast.error(t("rankChangeForm.errorNewRank")); return; }
    setLoading(true);
    try {
      await progressService.changeRank({ athleteId: athlete.id, newRank, notes: notes || null });
      toast.success(t("rankChangeForm.toastUpdated"));
      onSuccess?.();
      onClose();
      setNewRank(""); setNotes("");
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("rankChangeForm.title", { name: athlete?.full_name })} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
          {t("rankChangeForm.currentRank")} <strong style={{ color: "var(--text)" }}>{athlete?.rank || t("rankChangeForm.noRank")}</strong>
        </div>
        <Input label={t("rankChangeForm.newRankLabel")} placeholder={t("rankChangeForm.newRankPlaceholder")} value={newRank} onChange={e => setNewRank(e.target.value)} />
        <Input label={t("rankChangeForm.notesLabel")} placeholder={t("rankChangeForm.notesPlaceholder")} value={notes} onChange={e => setNotes(e.target.value)} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("rankChangeForm.cancel")}</Button>
          <Button onClick={handleSubmit} loading={loading}>{t("rankChangeForm.submit")}</Button>
        </div>
      </div>
    </Modal>
  );
}
