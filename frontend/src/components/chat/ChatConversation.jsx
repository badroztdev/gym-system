// src/components/chat/ChatConversation.jsx
// واجهة محادثة مشتركة (لوحة التحكم + بوابة الرياضي): فقاعات + حقل إرسال، متجاوبة مع الهاتف
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";

const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function PlaneIcon({ flip }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: flip ? "scaleX(-1)" : "none" }}>
      <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

export default function ChatConversation({
  messages = [], meId, onSend, sending = false, loading = false,
  emptyText, theirLabel,        // theirLabel(msg) → نص صغير فوق رسالة الطرف الآخر
}) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "ar";
  const locale = rtl ? "ar-DZ" : "fr-FR";
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const taRef = useRef(null);
  const stickRef = useRef(true);        // هل المستخدم قرب أسفل القائمة؟
  const lastCount = useRef(0);

  const dayLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    if (dayKey(iso) === dayKey(today)) return t("chat.today");
    if (dayKey(iso) === dayKey(yest))  return t("chat.yesterday");
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  };
  const timeLabel = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  // التمرير للأسفل عند وصول رسائل جديدة (إلا إذا كان المستخدم يقرأ رسائل قديمة)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const firstLoad = lastCount.current === 0 && messages.length > 0;
    if (firstLoad || stickRef.current || last?.sender_id === meId) el.scrollTop = el.scrollHeight;
    lastCount.current = messages.length;
  }, [messages, meId]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // حقل الإدخال ينمو تلقائياً حتى حدّ أقصى
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [text]);

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    stickRef.current = true;
    try { await onSend(body); setText(""); } catch { /* الواجهة الأم تعرض الخطأ */ }
  };

  const onKeyDown = (e) => {
    const desktop = window.matchMedia?.("(pointer: fine)").matches;
    if (e.key === "Enter" && !e.shiftKey && desktop) { e.preventDefault(); submit(); }
  };

  const mineSide  = rtl ? "flex-start" : "flex-end";   // الرسائل المرسلة على اليمين دائماً
  const theirSide = rtl ? "flex-end" : "flex-start";

  let prevDay = null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div ref={listRef} onScroll={onScroll} style={{
        flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6,
        WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}>
        {loading && messages.length === 0 ? (
          <div style={{ margin: "auto", color: "var(--muted)", fontSize: 13 }}>{t("chat.loading")}</div>
        ) : messages.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.8, padding: 20 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>💬</div>
            {emptyText || t("chat.noMessages")}
          </div>
        ) : messages.map(m => {
          const mine = m.sender_id === meId;
          const k = dayKey(m.created_at);
          const showDay = k !== prevDay;
          prevDay = k;
          const label = !mine && theirLabel ? theirLabel(m) : null;
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {showDay && (
                <div style={{ alignSelf: "center", margin: "10px 0 4px", fontSize: 11, color: "var(--muted)",
                  background: "var(--surface)", border: "1px solid var(--border)", padding: "3px 12px", borderRadius: 999 }}>
                  {dayLabel(m.created_at)}
                </div>
              )}
              <div style={{
                alignSelf: mine ? mineSide : theirSide, maxWidth: "82%", minWidth: 60,
                background: mine ? "var(--accent)" : "var(--card)",
                color: mine ? "#0d0f14" : "var(--text)",
                border: mine ? "none" : "1px solid var(--border)",
                borderRadius: 16,
                borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4,
                padding: "8px 12px",
              }}>
                {label && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent2)", marginBottom: 3 }}>{label}</div>}
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
                <div className="mono" style={{ fontSize: 10, marginTop: 3, opacity: 0.65, textAlign: mine ? "end" : "start" }}>
                  {timeLabel(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* حقل الإرسال */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 8,
        padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--border)", background: "var(--surface)",
      }}>
        <textarea ref={taRef} rows={1} value={text} maxLength={2000}
          onChange={e => setText(e.target.value)} onKeyDown={onKeyDown}
          placeholder={t("chat.typeMessage")}
          style={{
            flex: 1, resize: "none", minHeight: 44, maxHeight: 120, boxSizing: "border-box",
            padding: "11px 14px", borderRadius: 22, border: "1px solid var(--border)",
            background: "var(--card)", color: "var(--text)", fontSize: 14, lineHeight: 1.4,
            outline: "none", fontFamily: "inherit",
          }} />
        <button type="button" onClick={submit} disabled={!text.trim() || sending}
          aria-label={t("chat.send")} title={t("chat.send")}
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", flexShrink: 0,
            background: "var(--accent)", color: "#0d0f14",
            opacity: !text.trim() || sending ? 0.45 : 1,
            cursor: !text.trim() || sending ? "default" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
          <PlaneIcon flip={rtl} />
        </button>
      </div>
    </div>
  );
}