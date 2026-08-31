// src/components/notifications/NotificationBell.jsx
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications.service";
import toast from "react-hot-toast";

const TYPE_COLORS = {
  attendance:           { bg: "var(--danger)20",  color: "var(--danger)",  icon: "✅" },
  subscription_expiry:  { bg: "var(--warning)20", color: "var(--warning)", icon: "⚠️" },
  payment:              { bg: "var(--accent)20",   color: "var(--accent)",  icon: "💰" },
  general:              { bg: "var(--border)",     color: "var(--muted)",   icon: "🔔" },
};

export default function NotificationBell() {
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const qc                = useQueryClient();
  const prevUnreadRef      = useRef(null); // لمعرفة إذا زاد عدد الإشعارات غير المقروءة

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn:  notificationsService.getAll,
    refetchInterval: 30000, // كل 30 ثانية
  });

  const notifications = data?.data || [];
  const unread        = data?.meta?.unread || 0;

  // ── تشغيل صوت عند وصول إشعار جديد (اكتُشف عبر الـ polling) ──
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

  // إغلاق عند الضغط خارج الـ dropdown
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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* زر الجرس */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: open ? "var(--accent)15" : "var(--card)",
          border: `1px solid ${open ? "var(--accent)40" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 17, position: "relative",
          transition: "all 0.15s",
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

      {/* خلفية شفافة (تُغلق القائمة عند اللمس خارجها — مهم على الهاتف) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(0,0,0,0.35)" }}
        />
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "fixed",
          top: 62,
          left: 12,
          right: 12,
          margin: "0 auto",
          maxWidth: 360,
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
          zIndex: 100, animation: "fadeUp 0.2s ease",
          direction: "rtl",
        }}>
          {/* رأس */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              الإشعارات {unread > 0 && <span style={{ color: "var(--danger)", fontSize: 11 }}>({unread} جديد)</span>}
            </span>
            {unread > 0 && (
              <button onClick={handleMarkAll} style={{
                background: "none", border: "none", color: "var(--accent)",
                cursor: "pointer", fontSize: 11, fontFamily: "'Sora', sans-serif",
              }}>قراءة الكل</button>
            )}
          </div>

          {/* القائمة */}
          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              لا توجد إشعارات
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
    </div>
  );
}