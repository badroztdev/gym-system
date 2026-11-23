// src/components/notifications/NotificationBell.jsx
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications.service";
import toast from "react-hot-toast";
import { requestNotificationPermission, getLastFcmError } from "@/services/firebase";

const TYPE_COLORS = {
  attendance:           { bg: "var(--danger)20",  color: "var(--danger)",  icon: "✅" },
  subscription_expiry:  { bg: "var(--warning)20", color: "var(--warning)", icon: "⚠️" },
  payment:              { bg: "var(--accent)20",   color: "var(--accent)",  icon: "💰" },
  general:              { bg: "var(--border)",     color: "var(--muted)",   icon: "🔔" },
};

// كشف حجم الشاشة (يُحدَّث تلقائياً عند تدوير الهاتف أو تغيير الحجم)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── تفعيل إشعارات الهاتف (تظهر في شريط الحالة كفيسبوك/واتساب) ──
const PUSH_TXT = {
  ar: {
    title: "إشعارات الهاتف", on: "مفعّلة على هذا الجهاز ✓", enable: "تفعيل إشعارات الهاتف", test: "إرسال إشعار تجريبي (بعد 10 ثوانٍ)",
    off: "فعّلها لتصلك التنبيهات في شريط الهاتف حتى والموقع مغلق.",
    denied: "الإشعارات محظورة. اضغط 🔒 بجانب عنوان الموقع ← «الإذن/Permissions» ← «الإشعارات» ← سماح، ثم أعد تحميل الصفحة.",
    unsupported: "هذا المتصفح لا يدعم إشعارات الهاتف. على iPhone: ثبّت الموقع على الشاشة الرئيسية أولاً (مشاركة ← إضافة إلى الشاشة الرئيسية).",
    done: "تم تفعيل الإشعارات", fail: "تعذّر تفعيل الإشعارات",
    local: "اختبار العرض على هذا الهاتف (بدون خادم)", localDone: "طُلب عرض الإشعار الآن — انظر الشريط العلوي. إن لم يظهر فالهاتف يمنع إشعارات Chrome.",
    sent: "أُرسل إشعار تجريبي — انظر شريط هاتفك", later: "سيصل الإشعار بعد 10 ثوانٍ. اخرج الآن من الصفحة (زر الرئيسية) أو اقفل الشاشة وانتظر.", noDevice: "هذا الجهاز غير مسجَّل بعد. اضغط «تفعيل» أولاً.", sendFail: "فشل الإرسال",
  },
  fr: {
    title: "Notifications du téléphone", on: "Activées sur cet appareil ✓", enable: "Activer les notifications", test: "Envoyer une notification test (dans 10 s)",
    off: "Activez-les pour recevoir les alertes dans la barre du téléphone, même site fermé.",
    denied: "Notifications bloquées. Appuyez sur 🔒 près de l'adresse → « Autorisations » → « Notifications » → Autoriser, puis rechargez la page.",
    unsupported: "Ce navigateur ne prend pas en charge les notifications. Sur iPhone : installez d'abord le site sur l'écran d'accueil.",
    done: "Notifications activées", fail: "Activation impossible",
    local: "Test d'affichage sur ce téléphone (sans serveur)", localDone: "Notification demandée — regardez la barre du haut. Si rien n'apparaît, le téléphone bloque les notifications de Chrome.",
    sent: "Notification test envoyée — regardez la barre de votre téléphone", later: "La notification arrive dans 10 s. Quittez la page maintenant (bouton Accueil) ou verrouillez l'écran.", noDevice: "Appareil non enregistré. Appuyez d'abord sur « Activer ».", sendFail: "Échec de l'envoi",
  },
};

function PushSetup({ lang }) {
  const T = PUSH_TXT[lang === "fr" ? "fr" : "ar"];
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const [perm, setPerm] = useState(supported ? Notification.permission : "unsupported");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // إذا كان الإذن ممنوحاً مسبقاً: جدّد تسجيل الجهاز بصمت (يصلح التوكن المنتهي)
  useEffect(() => {
    if (perm !== "granted") return;
    requestNotificationPermission().then(tk => { if (tk) return notificationsService.saveToken(tk); setErr(getLastFcmError()); }).catch(() => {});
  }, [perm]);

  const enable = async () => {            // يجب أن يكون داخل نقرة المستخدم ليظهر طلب الإذن في أندرويد
    setBusy(true);
    try {
      const tk = await requestNotificationPermission();
      setPerm(Notification.permission);
      if (tk) { await notificationsService.saveToken(tk); setErr(""); toast.success(T.done); }
      else { setErr(getLastFcmError()); if (Notification.permission !== "denied") toast.error(T.fail); }
    } catch { toast.error(T.fail); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try {
      const r = (await notificationsService.testPush(10))?.data;
      if (!r?.devices) { toast.error(T.noDevice); await enable(); }
      else if (r.scheduled) toast.success(T.later, { duration: 8000 });
      else if (r.sent) toast.success(T.sent);
      else toast.error(`${T.sendFail}: ${(r.errors || []).join(" | ").slice(0, 120)}`);
    } catch { /* يعرضه المعترض */ } finally { setBusy(false); }
  };

  // عرض إشعار محلي مباشرة من الصفحة (بلا Firebase ولا خادم): يفصل مشكلة الهاتف عن مشكلة الإرسال
  const local = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("SGMS 🔔", {
        body: "اختبار محلي — إذا رأيت هذا في الشريط فعرض الإشعارات يعمل على هاتفك",
        icon: "/icon-192.png", badge: "/badge-72.png", tag: "sgms-local-" + Date.now(), dir: "auto", vibrate: [120, 60, 120],
      });
      toast.success(T.localDone, { duration: 9000 });
    } catch (e) { toast.error(String(e.message || e).slice(0, 120)); }
  };

  const btn = { padding: "8px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer", fontFamily: "'Sora', sans-serif", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>📲 {T.title}{perm === "granted" && <span style={{ color: "var(--accent)", fontWeight: 600 }}> — {T.on}</span>}</div>
      {perm === "unsupported" && <div style={{ fontSize: 11, color: "var(--muted-lt)", lineHeight: 1.6 }}>{T.unsupported}</div>}
      {perm === "denied" && <div style={{ fontSize: 11, color: "var(--warning)", lineHeight: 1.6 }}>{T.denied}</div>}
      {perm === "default" && (<>
        <div style={{ fontSize: 11, color: "var(--muted-lt)", lineHeight: 1.6 }}>{T.off}</div>
        <button type="button" onClick={enable} disabled={busy} style={{ ...btn, background: "var(--accent)", color: "#0d0f14", border: "none" }}>{T.enable}</button>
      </>)}
      {perm === "granted" && <button type="button" onClick={local} style={btn}>{T.local}</button>}
      {perm === "granted" && <button type="button" onClick={test} disabled={busy} style={btn}>{T.test}</button>}
      {err && <div dir="ltr" style={{ fontSize: 10.5, color: "var(--danger)", wordBreak: "break-word", lineHeight: 1.5, textAlign: "left" }}>⚠ {err}</div>}
    </div>
  );
}

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const [open, setOpen]   = useState(false);
  const ref                = useRef(null);
  const btnRef              = useRef(null);
  const qc                 = useQueryClient();
  const prevUnreadRef       = useRef(null);
  const isMobile            = useIsMobile();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn:  notificationsService.getAll,
    refetchInterval: 30000,
  });

  const notifications = data?.data || [];
  const unread        = data?.meta?.unread || 0;

  useEffect(() => {
    if (prevUnreadRef.current !== null && unread > prevUnreadRef.current) {
      try {
        const audio = new Audio("/notification.wav");
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch { /* تجاهل */ }
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAll = async () => {
    await notificationsService.markAllRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleMarkOne = async (id) => {
    await notificationsService.markRead(id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  // ── على الهاتف: نافذة سفلية (Bottom Sheet) تملأ عرض الشاشة بالكامل ──
  // ── على الحاسوب: قائمة منسدلة (Dropdown) بجانب زر الجرس مباشرة ──
  const panelStyle = isMobile
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        bottom: "auto",
        maxHeight: "75vh",
        width: "88vw",
        maxWidth: 400,
        borderRadius: "var(--radius)",
        margin: 0,
      }
    : {
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        width: 340,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: 420,
        borderRadius: "var(--radius)",
      };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* زر الجرس */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: open ? "var(--accent)15" : "var(--card)",
          border: `1px solid ${open ? "var(--accent)40" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 17, position: "relative",
          transition: "all 0.15s", flexShrink: 0,
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 5, right: 5,
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--danger)", border: "2px solid var(--surface)",
            animation: "pulse-dot 2s infinite",
          }} />
        )}
      </button>

      {/* خلفية شفافة تُغلق القائمة عند اللمس خارجها */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(0,0,0,0.4)" }}
        />
      )}

      {/* القائمة — تتكيف تلقائياً بين Bottom Sheet (هاتف) و Dropdown (حاسوب) */}
      {open && (
        <div style={{
          ...panelStyle,
          overflowY: "auto",
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          zIndex: 100,
          animation: isMobile ? "popCenter 0.2s ease" : "fadeUp 0.2s ease",
          direction: i18n.language === "ar" ? "rtl" : "ltr",
        }}>
          {/* رأس */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, background: "var(--card)", zIndex: 1,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              {t("notificationBell.title")} {unread > 0 && <span style={{ color: "var(--danger)", fontSize: 11 }}>{t("notificationBell.unreadCount", { count: unread })}</span>}
            </span>
            {unread > 0 && (
              <button onClick={handleMarkAll} style={{
                background: "none", border: "none", color: "var(--accent)",
                cursor: "pointer", fontSize: 11, fontFamily: "'Sora', sans-serif",
              }}>{t("notificationBell.markAllRead")}</button>
            )}
          </div>

          <PushSetup lang={i18n.language} />

          {/* القائمة */}
          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              {t("notificationBell.noNotifications")}
            </div>
          ) : (
            notifications.map(n => {
              const style = TYPE_COLORS[n.type] || TYPE_COLORS.general;
              return (
                <div
                  key={n.id}
                  onClick={() => handleMarkOne(n.id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: n.is_read ? "transparent" : style.bg,
                    cursor: "pointer", transition: "background 0.15s",
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                  onMouseLeave={e => e.currentTarget.style.background = n.is_read ? "transparent" : style.bg}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{style.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: n.is_read ? 400 : 700,
                      color: "var(--text)", marginBottom: 2,
                    }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-lt)", lineHeight: 1.5 }}>{n.body}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                      {new Date(n.sent_at).toLocaleString("ar-DZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: style.color, flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <style>{`
        @keyframes popCenter {
          from { transform: translate(-50%, -50%) scale(0.94); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
