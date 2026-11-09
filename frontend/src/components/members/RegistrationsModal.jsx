// src/components/members/RegistrationsModal.jsx
// رابط استمارة التسجيل (نسخ/واتساب) + طلبات الرياضيين بانتظار المراجعة
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { Modal, Button, Spinner } from "@/components/ui";
import { qrPath, qrSvgString } from "@/utils/qr";

// قائمة الطلبات المعلّقة — تُستعمل أيضاً لشارة العدد على زر الصفحة
export function useRegistrations() {
  return useQuery({
    queryKey: ["registrations"],
    queryFn: () => api.get("/registrations").then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 15000,
  });
}

const fmtDate = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const ageOf = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const now = new Date();
  let a = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) a--;
  return a >= 0 ? a : null;
};

export default function RegistrationsModal({ open, onClose, onAccept }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useRegistrations();
  const list = data?.data || [];
  const [rejectId, setRejectId] = useState(null);
  const [busy, setBusy] = useState(false);

  const link = `${window.location.origin}/register/${user?.gymSlug || ""}`;

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
      else throw new Error("no clipboard");
    } catch {
      try {
        const i = document.createElement("input"); i.value = link; i.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(i); i.select(); i.setSelectionRange(0, 999); document.execCommand("copy"); document.body.removeChild(i);
      } catch { window.prompt(link, link); return; }
    }
    toast.success(t("members.regCopied"));
  };

  const whatsapp = () => {
    const text = `${t("members.regShareText", { gym: user?.gymName || "" })}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  // ── طباعة QR: صفحة A4 جاهزة (اسم النادي + الرمز + الرابط) تُطبع من إطار مخفي ──
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const printQr = () => {
    const gym = esc(user?.gymName || "SGMS");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>QR — ${gym}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #111; text-align: center; }
  .page { min-height: 270mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7mm; border: 3px solid #111; border-radius: 8mm; padding: 14mm 10mm; }
  .logo { width: 28mm; height: 28mm; border-radius: 6mm; object-fit: cover; }
  .gym { font-size: 34pt; font-weight: 800; line-height: 1.2; }
  .cta-ar { font-size: 26pt; font-weight: 700; }
  .cta-fr { font-size: 20pt; font-weight: 600; color: #333; }
  .qr { width: 120mm; height: 120mm; border: 2mm solid #111; border-radius: 4mm; padding: 3mm; background: #fff; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .link { direction: ltr; font-family: Consolas, "Courier New", monospace; font-size: 13pt; word-break: break-all; color: #333; }
  .sub { font-size: 12pt; color: #555; }
</style></head><body><div class="page">
  <img class="logo" src="${window.location.origin}/logo.png" alt="" onerror="this.style.display='none'">
  <div class="gym">${gym}</div>
  <div class="cta-ar">امسح الرمز للتسجيل في النادي</div>
  <div class="cta-fr">Scannez le code pour vous inscrire</div>
  <div class="qr">${qrSvgString(link, 400)}</div>
  <div class="link">${esc(link)}</div>
  <div class="sub">SGMS</div>
</div></body></html>`;
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    document.body.appendChild(f);
    const cleanup = () => setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 1500);
    f.onload = () => {
      // ننتظر تحميل الشعار قليلاً ثم نطبع
      setTimeout(() => {
        try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast.error(t("members.regPrintError")); }
        cleanup();
      }, 350);
    };
    f.srcdoc = html;
  };

  const reject = async (id) => {
    setBusy(true);
    try {
      await api.patch(`/registrations/${id}`, { status: "rejected" });
      toast.success(t("members.regRejected"));
      setRejectId(null);
      qc.invalidateQueries({ queryKey: ["registrations"] });
    } catch { /* المعترض يعرض الخطأ */ } finally { setBusy(false); }
  };

  const small = { fontSize: 11, color: "var(--muted-lt)" };
  const pill = (c) => ({ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: `var(${c})20`, color: `var(${c})` });

  return (
    <Modal open={open} onClose={onClose} title={t("members.regTitle")} width={680}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* الرابط */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{t("members.regLinkLabel")}</div>
          <div dir="ltr" style={{
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--text)", background: "var(--card)",
            border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", wordBreak: "break-all", userSelect: "all",
          }}>{link}</div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>{t("members.regLinkHint")}</p>
          {/* معاينة رمز QR (للمسح المباشر من شاشة الهاتف أو للطباعة) */}
          <div style={{ alignSelf: "center", background: "#fff", padding: 6, borderRadius: 10, border: "1px solid var(--border)", lineHeight: 0 }}>
            {(() => {
              const { size, path } = qrPath(link);
              return (
                <svg width="168" height="168" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label="QR">
                  <rect width={size} height={size} fill="#fff" />
                  <path d={path} fill="#000" />
                </svg>
              );
            })()}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={printQr}>🖨️ {t("members.regPrintQr")}</Button>
            <Button variant="secondary" onClick={copy}>📋 {t("members.regCopy")}</Button>
            <Button variant="secondary" onClick={whatsapp}>💬 {t("members.regWhatsapp")}</Button>
            <Button variant="secondary" onClick={() => window.open(link, "_blank", "noopener")}>↗ {t("members.regOpen")}</Button>
          </div>
        </div>

        {/* الطلبات */}
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("members.regPending", { count: list.length })}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "min(48vh, 440px)", overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 28 }}><Spinner size={26} /></div>
          ) : isError ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--danger)" }}>{t("members.insuranceLoadError")}</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted)", background: "var(--surface)", borderRadius: "var(--radius-sm)" }}>
              📭 {t("members.regNone")}
            </div>
          ) : list.map((r) => {
            const age = ageOf(r.date_of_birth);
            return (
              <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{r.full_name}</span>
                  {age !== null && <span style={pill("--accent2")}>{t("members.regAge", { age })}</span>}
                  {r.gender && <span style={pill("--accent3")}>{t(r.gender === "male" ? "memberForm.male" : "memberForm.female")}</span>}
                  {r.blood_group && <span style={pill("--danger")}>{r.blood_group}</span>}
                  {r.phone_exists && <span style={pill("--warning")}>⚠ {t("members.regPhoneExists")}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "4px 14px", ...small }}>
                  <span dir="ltr" className="mono" style={{ textAlign: "start" }}>📞 {r.phone}</span>
                  <span>🎂 {fmtDate(r.date_of_birth)}</span>
                  {r.address && <span style={{ gridColumn: "1 / -1" }}>📍 {r.address}</span>}
                  {(r.guardian_name || r.guardian_phone) && (
                    <span style={{ gridColumn: "1 / -1" }}>
                      👤 {t("members.regGuardian")}: {r.guardian_name} <span dir="ltr" className="mono">{r.guardian_phone}</span>
                    </span>
                  )}
                  <span style={{ gridColumn: "1 / -1", color: "var(--muted)" }}>{fmtDate(r.created_at)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Button onClick={() => onAccept(r)} style={{ flex: "1 1 140px", justifyContent: "center" }}>✓ {t("members.regAccept")}</Button>
                  {rejectId === r.id ? (
                    <>
                      <Button variant="danger" loading={busy} onClick={() => reject(r.id)} style={{ flex: "1 1 120px", justifyContent: "center", background: "var(--danger)", color: "#fff" }}>{t("members.regRejectConfirm")}</Button>
                      <Button variant="secondary" onClick={() => setRejectId(null)}>{t("common.cancel")}</Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setRejectId(r.id)} style={{ color: "var(--danger)" }}>{t("members.regReject")}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
