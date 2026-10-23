// src/portal/pages/PortalMessages.jsx — رسائل الرياضي/ولي الأمر مع المدرب
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ChatConversation from "@/components/chat/ChatConversation";
import { portalService } from "@/portal/services/portal.service";
import { useAuthStore } from "@/store/authStore";

function Avatar({ name, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent)20", color: "var(--accent)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700,
    }}>{name?.[0]}</div>
  );
}

export default function PortalMessages() {
  const { athlete } = useOutletContext();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const rtl = i18n.language === "ar";
  const locale = rtl ? "ar-DZ" : "fr-FR";

  // view: list | new | chat    —   target: { threadId|null, staffId, staffName }
  const [view, setView] = useState("list");
  const [target, setTarget] = useState(null);

  const roleLabel = (r) => r === "owner" ? t("chat.roleOwner") : r === "assistant" ? t("chat.roleAssistant") : t("chat.roleCoach");

  const { data: thData, isLoading } = useQuery({
    queryKey: ["portal-chat-threads", athlete?.id],
    queryFn: () => portalService.getChatThreads(athlete.id),
    enabled: !!athlete?.id,
    refetchInterval: view === "list" ? 15000 : false,
  });
  const threads = thData?.data || [];

  const { data: recData } = useQuery({
    queryKey: ["portal-chat-recipients", athlete?.id],
    queryFn: () => portalService.getChatRecipients(athlete.id),
    enabled: !!athlete?.id && view === "new",
  });
  const recipients = recData?.data || [];

  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ["portal-chat-messages", target?.threadId],
    queryFn: () => portalService.getChatMessages(target.threadId),
    enabled: view === "chat" && !!target?.threadId,
    refetchInterval: 6000,
  });
  const messages = msgData?.data || [];

  // قراءة المحادثة → حدّث العدّادات
  const refreshCounters = () => {
    qc.invalidateQueries({ queryKey: ["portal-chat-unread"] });
    qc.invalidateQueries({ queryKey: ["portal-chat-threads"] });
  };

  const sendMutation = useMutation({
    mutationFn: (body) => portalService.sendChatMessage(athlete.id, target.staffId, body),
    onSuccess: (res) => {
      const threadId = res?.data?.thread_id;
      if (threadId && !target.threadId) setTarget(p => ({ ...p, threadId }));
      qc.invalidateQueries({ queryKey: ["portal-chat-messages", threadId || target.threadId] });
      refreshCounters();
    },
    onError: () => toast.error(t("chat.sendFailed")),
  });

  const openThread = (th) => {
    setTarget({ threadId: th.id, staffId: th.staff_id, staffName: th.staff_name, staffRole: th.staff_role });
    setView("chat");
    setTimeout(refreshCounters, 800);
  };
  const startWith = (staff) => {
    const existing = threads.find(x => x.staff_id === staff.id);
    if (existing) return openThread(existing);
    setTarget({ threadId: null, staffId: staff.id, staffName: staff.full_name, staffRole: staff.role });
    setView("chat");
  };
  const back = () => { setView("list"); setTarget(null); refreshCounters(); };

  const timeShort = (iso) => {
    const d = new Date(iso), now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  const shell = {
    direction: rtl ? "rtl" : "ltr",
    height: "calc(100dvh - 142px)", minHeight: 360,
    display: "flex", flexDirection: "column",
  };

  const topBar = (title, sub) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0,
    }}>
      {view !== "list" && (
        <button type="button" onClick={() => (view === "new" ? setView("list") : back())} aria-label={t("chat.back")} style={{
          width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)",
          color: "var(--text)", cursor: "pointer", fontSize: 16, flexShrink: 0,
        }}>{rtl ? "→" : "←"}</button>
      )}
      {view === "chat" && <Avatar name={target?.staffName} size={38} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}
      </div>
    </div>
  );

  if (!athlete) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>{t("chat.loading")}</div>;
  }

  // ── محادثة ───────────────────────────────────────────────
  if (view === "chat" && target) {
    return (
      <div style={shell}>
        {topBar(target.staffName, roleLabel(target.staffRole))}
        <div style={{ flex: 1, minHeight: 0, background: "var(--bg)" }}>
          <ChatConversation
            messages={messages} meId={user?.id} loading={msgLoading && !!target.threadId}
            sending={sendMutation.isPending}
            onSend={(body) => sendMutation.mutateAsync(body)}
            theirLabel={(m) => m.sender_name}
            emptyText={t("chat.noMessagesPortal", { name: target.staffName })}
          />
        </div>
      </div>
    );
  }

  // ── اختيار المستلم ───────────────────────────────────────
  if (view === "new") {
    return (
      <div style={shell}>
        {topBar(t("chat.newMessage"), t("chat.chooseRecipient"))}
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {recipients.length === 0 ? (
            <div style={{ margin: "auto", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>{t("chat.noRecipients")}</div>
          ) : recipients.map(r => (
            <button key={r.id} type="button" onClick={() => startWith(r)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-sm)",
              background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer",
              textAlign: "start", fontFamily: "inherit", color: "inherit",
            }}>
              <Avatar name={r.full_name} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{r.full_name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{roleLabel(r.role)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── قائمة المحادثات ──────────────────────────────────────
  return (
    <div style={shell}>
      {topBar(t("chat.portalTitle"), athlete.full_name)}
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {isLoading ? (
          <div style={{ margin: "auto", color: "var(--muted)", fontSize: 13 }}>{t("chat.loading")}</div>
        ) : threads.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.8, padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 700, color: "var(--muted-lt)" }}>{t("chat.noThreads")}</div>
            <div>{t("chat.noThreadsHintPortal")}</div>
          </div>
        ) : threads.map(th => (
          <button key={th.id} type="button" onClick={() => openThread(th)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-sm)",
            background: "var(--card)", border: `1px solid ${th.unread ? "var(--accent)" : "var(--border)"}`,
            cursor: "pointer", textAlign: "start", fontFamily: "inherit", color: "inherit",
          }}>
            <Avatar name={th.staff_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 14, fontWeight: th.unread ? 800 : 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {th.staff_name} <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>· {roleLabel(th.staff_role)}</span>
                </span>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{timeShort(th.last_message_at)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 3 }}>
                <span style={{ fontSize: 12, color: th.unread ? "var(--text)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {th.last_message_preview}
                </span>
                {th.unread > 0 && (
                  <span className="mono" style={{
                    minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, flexShrink: 0,
                    background: "var(--accent)", color: "#0d0f14", fontSize: 11, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{th.unread}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        <button type="button" onClick={() => setView("new")} style={{
          width: "100%", minHeight: 46, borderRadius: 999, border: "none", background: "var(--accent)",
          color: "#0d0f14", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        }}>✏️ {t("chat.newMessage")}</button>
      </div>
    </div>
  );
}