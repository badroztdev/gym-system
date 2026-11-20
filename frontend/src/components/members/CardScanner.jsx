// src/components/members/CardScanner.jsx — مسح بطاقة الرياضي: أخضر = مدفوع كاملاً، أحمر = غير ذلك
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { Modal } from "@/components/ui";

// يستخرج معرّف الرياضي من رابط البطاقة أو الصيغة القديمة
export const extractCode = (v) => {
  const m = String(v || "").match(/(?:[?&]scan=|SGMS-A:)\s*([0-9a-fA-F-]{8,40})/);
  return m ? `SGMS-A:${m[1]}` : null;
};

export default function CardScanner({ open, onClose, autoCode }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [result, setResult] = useState(null);   // {color, ...} | {error}
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const [camErr, setCamErr] = useState("");
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const timerRef = useRef(null);

  const clear = useCallback(() => { busyRef.current = false; setResult(null); setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const submit = useCallback(async (code) => {
    if (busyRef.current || !code) return;
    busyRef.current = true; setBusy(true);
    try {
      const r = await api.post("/attendance/card-scan", { code });
      setResult(r.data?.data || r.data);
      qc.invalidateQueries({ queryKey: ["attendance"] });
    } catch (e) {
      setResult({ color: "red", error: e?.response?.data?.message || t("card.invalid") });
    } finally {
      setBusy(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(clear, 4500);   // القفل يبقى حتى تختفي الشاشة (يمنع التكرار)
    }
  }, [qc, t]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null; setCam(false);
  }, []);

  // كاميرا: BarcodeDetector إن وُجد، وإلا jsQR (يُحمَّل عند الحاجة)
  const startCam = async () => {
    setCamErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream; setCam(true);
      const v = videoRef.current; v.srcObject = stream; await v.play();
      let detect;
      if ("BarcodeDetector" in window) {
        const bd = new window.BarcodeDetector({ formats: ["qr_code"] });
        detect = async () => (await bd.detect(v))[0]?.rawValue;
      } else {
        const mod = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm");
        const jsQR = mod.default || mod;
        const cv = document.createElement("canvas"); const cx = cv.getContext("2d", { willReadFrequently: true });
        detect = async () => {
          if (!v.videoWidth) return null;
          cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0);
          return jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)?.data;
        };
      }
      const loop = async () => {
        if (!streamRef.current) return;
        if (!busyRef.current) {
          try { const val = await detect(); const c = extractCode(val); if (c) await submit(c); } catch {}
        }
        setTimeout(loop, 350);
      };
      loop();
    } catch {
      setCamErr(t("card.camError")); stopCam();
    }
  };

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 100); if (autoCode) { const c = extractCode(autoCode); if (c) submit(c); } }
    else { stopCam(); busyRef.current = false; setResult(null); }
    return () => { stopCam(); clearTimeout(timerRef.current); };
  }, [open, stopCam, autoCode]);

  // الماسح الخارجي (لوحة مفاتيح وهمية) يكتب الرمز ثم Enter
  const onKey = (e) => {
    if (e.key === "Enter") { const v = e.currentTarget.value.trim(); e.currentTarget.value = ""; const c = extractCode(v); if (c) submit(c); else if (v) setResult({ color: "red", error: t("card.invalid") }); }
  };

  const green = result?.color === "green";
  const msg = !result ? "" :
    result.error ? result.error :
    result.state === "paid" ? t("card.paid") :
    result.state === "unpaid" ? t("card.unpaid") :
    result.state === "inactive" ? t("card.inactive") : t("card.noSub");
  const att = result?.attendance;
  const attMsg = !att ? "" : att.done ? t("card.attDone", { title: att.session?.title || "" })
    : att.reason === "no_session" ? t("card.attNoSession") : "";

  return (
    <>
      <Modal open={open} onClose={onClose} title={t("card.scanTitle")} width={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--muted-lt)", margin: 0, lineHeight: 1.6 }}>{t("card.scanDesc")}</p>
          <input ref={inputRef} onKeyDown={onKey} onBlur={() => open && !cam && setTimeout(() => inputRef.current?.focus(), 200)}
            placeholder={t("card.scanPlaceholder")} autoComplete="off" inputMode="none"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14, outline: "none", direction: "ltr" }} />
          {!cam
            ? <button type="button" onClick={startCam} style={{ padding: "12px", fontSize: 14, fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>📷 {t("card.camStart")}</button>
            : <button type="button" onClick={stopCam} style={{ padding: "10px", fontSize: 13, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--danger)", cursor: "pointer" }}>{t("card.camStop")}</button>}
          {camErr && <div style={{ color: "var(--danger)", fontSize: 12 }}>{camErr}</div>}
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000", display: cam ? "block" : "none" }} />
          {busy && <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)" }}>…</div>}
        </div>
      </Modal>

      {result && (
        <div onClick={() => { clearTimeout(timerRef.current); clear(); }} style={{
          position: "fixed", inset: 0, zIndex: 100000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 14, padding: 24, textAlign: "center", color: "#fff", cursor: "pointer",
          background: green ? "#16a34a" : "#dc2626",
        }}>
          <div style={{ fontSize: 84, lineHeight: 1 }}>{green ? "✓" : "✕"}</div>
          {result.athlete && (
            <div style={{ width: 110, height: 110, borderRadius: "50%", overflow: "hidden", border: "4px solid #fff", background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800 }}>
              {result.athlete.avatar ? <img src={result.athlete.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (result.athlete.name || "?")[0]}
            </div>
          )}
          {result.athlete && <div style={{ fontSize: 28, fontWeight: 800 }}>{result.athlete.name}</div>}
          <div style={{ fontSize: 24, fontWeight: 700 }}>{msg}</div>
          {result.remaining > 0 && <div style={{ fontSize: 20, fontWeight: 700 }}>{t("card.remaining")}: {Number(result.remaining).toLocaleString()} {t("common.currency", { defaultValue: "DA" })}</div>}
          {result.plan && <div style={{ fontSize: 14, opacity: .9 }}>{result.plan}{result.endDate ? ` — ${String(result.endDate).slice(0, 10)}` : ""}</div>}
          {attMsg && <div style={{ fontSize: 15, background: "rgba(0,0,0,.25)", padding: "8px 16px", borderRadius: 999 }}>{attMsg}</div>}
        </div>
      )}
    </>
  );
}
