// src/components/members/MemberCard.jsx — بطاقة الرياضي (اسم النادي + الصورة + الاسم + QR)
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { userCan } from "@/utils/permissions";
import { useAuthStore } from "@/store/authStore";
import { Modal, Button } from "@/components/ui";
import { qrPath, qrSvgString } from "@/utils/qr";
import toast from "react-hot-toast";

// رابط يفتح صفحة الأعضاء ويُظهر نتيجة المسح (يعمل مع أي قارئ QR أو كاميرا الهاتف)
export const cardCode = (id) => `${window.location.origin}/members?scan=${id}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default function MemberCard({ open, onClose, member, onScan }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const canEdit = userCan(user, "members.edit");
  const [uid, setUid] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: rfidData, refetch } = useQuery({
    queryKey: ["member-rfid", member?.id],
    queryFn: () => api.get(`/members/${member.id}/rfid`).then(r => r.data?.data || r.data),
    enabled: open && !!member?.id,
  });
  const savedUid = rfidData?.uid || "";
  useEffect(() => { setUid(savedUid); }, [savedUid, member?.id]);
  const saveUid = async (value) => {
    setSaving(true);
    try {
      await api.put(`/members/${member.id}/rfid`, { uid: value });
      toast.success(value ? t("card.rfidSaved") : t("card.rfidRemoved"));
      await refetch();
    } catch { /* يعرضه المعترض */ } finally { setSaving(false); }
  };
  if (!member) return null;
  const gym = user?.gymName || "SGMS";
  const code = cardCode(member.id);
  const { size, path } = qrPath(code);

  const printCard = () => {
    const photo = member.avatar_url
      ? `<img class="ph" src="${esc(member.avatar_url)}" alt="">`
      : `<div class="ph ph0">${esc((member.full_name || "?")[0])}</div>`;
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(member.full_name)}</title>
<style>
@page{size:A6;margin:6mm} *{box-sizing:border-box} html,body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;text-align:center;color:#111}
.c{border:2.5px solid #111;border-radius:6mm;padding:6mm;display:flex;flex-direction:column;align-items:center;gap:3.5mm}
.g{font-size:17pt;font-weight:800}.ph{width:26mm;height:26mm;border-radius:50%;object-fit:cover;border:1.5mm solid #111}
.ph0{display:flex;align-items:center;justify-content:center;font-size:26pt;font-weight:800;background:#eee}
.n{font-size:16pt;font-weight:700}.q{width:48mm;height:48mm;border:1mm solid #111;border-radius:2mm;padding:1.5mm}.q svg{width:100%;height:100%}
.s{font-size:8pt;color:#555}
</style></head><body><div class="c"><div class="g">${esc(gym)}</div>${photo}<div class="n">${esc(member.full_name)}</div>
<div class="q">${qrSvgString(code, 300)}</div><div class="s">SGMS</div></div></body></html>`;
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    document.body.appendChild(f);
    f.onload = () => setTimeout(() => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast.error(t("card.printError")); }
      setTimeout(() => f.parentNode && f.parentNode.removeChild(f), 1500);
    }, 400);
    f.srcdoc = html;
  };

  return (
    <Modal open={open} onClose={onClose} title={t("card.title")} width={380}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{
          width: "100%", maxWidth: 320, boxSizing: "border-box", padding: 18, borderRadius: 18, textAlign: "center",
          background: "linear-gradient(160deg, var(--surface), var(--card))", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--accent)" }}>{gym}</div>
          <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--accent)", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "var(--muted)" }}>
            {member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (member.full_name || "?")[0]}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", wordBreak: "break-word" }}>{member.full_name}</div>
          {(member.age_category || member.group_name) && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{[member.age_category, member.group_name].filter(Boolean).join(" • ")}</div>
          )}
          <div style={{ background: "#fff", padding: 10, borderRadius: 12, lineHeight: 0 }}>
            <svg width="190" height="190" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label="QR">
              <rect width={size} height={size} fill="#fff" />
              <path d={path} fill="#000" />
            </svg>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("card.hint")}</div>
        </div>
        {/* بطاقة RFID: ضع المؤشر في الحقل ثم مرّر البطاقة على القارئ (يكتب الرقم تلقائياً) */}
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>📡 {t("card.rfidTitle")}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={uid} onChange={e => setUid(e.target.value)} disabled={!canEdit} dir="ltr" placeholder={t("card.rfidPlaceholder")}
              onKeyDown={e => { if (e.key === "Enter" && canEdit && uid.trim() && uid.trim() !== savedUid) { e.preventDefault(); saveUid(uid); } }}
              style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 10px", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", outline: "none" }} />
            {canEdit && <Button size="sm" onClick={() => saveUid(uid)} loading={saving} disabled={!uid.trim() || uid.trim() === savedUid}>{t("card.rfidSave")}</Button>}
            {canEdit && savedUid && <Button size="sm" variant="secondary" onClick={() => saveUid("")} disabled={saving} style={{ color: "var(--danger)" }}>✕</Button>}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{savedUid ? t("card.rfidLinked") : t("card.rfidHint")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
          {onScan && <Button variant="secondary" onClick={onScan}>📷 {t("card.scanBtn")}</Button>}
          <Button onClick={printCard}>🖨️ {t("card.print")}</Button>
        </div>
      </div>
    </Modal>
  );
}
