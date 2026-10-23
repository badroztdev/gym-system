// src/pages/Messages.jsx — رسائل الرياضيين (المدرب يرى رياضييه فقط، والمالك يرى الجميع)
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import ChatConversation from "@/components/chat/ChatConversation";
import { Spinner } from "@/components/ui";
import { chatService } from "@/services/chat.service";
import { useAuthStore } from "@/store/authStore";

function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

function Avatar({ name, size = 42 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent)20", color: "var(--accent)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700,
    }}>{name?.[0]}</div>
  );
}

export default function MessagesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const locale = i18n.language === "ar" ? "ar-DZ" : "fr-FR";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ["chat-threads", debounced],
    queryFn: () => chatService.getThreads(debounced),
    refetchInterval: 15000,
  });
  const threads = threadsData?.data || [];
  const active = threads.find(x => x.id === activeId) || null;

  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: () => chatService.getMessages(activeId),
    enabled: !!activeId,
    refetchInterval: 6000,
  });
  const messages = msgData?.data || [];

  // فتح محادثة يعني أنها قُرئت → حدّث العدّادات
  useEffect(() => {
    if (!msgData || !activeId) return;
    qc.invalidateQueries({ queryKey: ["chat-unread"] });
    qc.invalidateQueries({ queryKey: ["chat-threads"] });
  }, [msgData?.data?.length, activeId]);

  const sendMutation = useMutation({
    mutationFn: (body) => chatService.send(activeId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
    },
  });

  const roleLabel = (r) => r === "guardian" ? t("chat.guardian") : r === "athlete" ? t("chat.athlete") : null;
  const timeShort = (iso) => {
    const d = new Date(iso), now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  const showList = !isMobile || !activeId;
  const showConv = !isMobile || !!activeId;
  const height = isMobile ? "calc(100dvh - 200px)" : "calc(100vh - 78px)";

  const list = (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: 0,
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden",
    }}>
      <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("chat.searchPlaceholder")}
          style={{
            width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
            fontSize: 13, outline: "none", fontFamily: "inherit",
          }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={26} /></div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 700, color: "var(--muted-lt)" }}>{t("chat.noThreads")}</div>
            {!debounced && <div>{t("chat.noThreadsHintStaff")}</div>}
          </div>
        ) : threads.map(th => {
          const on = th.id === activeId;
          return (
            <button key={th.id} type="button" onClick={() => setActiveId(th.id)} style={{
              width: "100%", display: "flex", gap: 12, alignItems: "center", padding: "12px 14px",
              background: on ? "var(--accent)12" : "transparent", border: "none",
              borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "start",
              fontFamily: "inherit", color: "inherit",
            }}>
              <Avatar name={th.athlete_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: th.unread ? 800 : 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {th.athlete_name}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{timeShort(th.last_message_at)}</span>
                </div>
                {isOwner && th.staff_id !== user?.id && (
                  <div style={{ fontSize: 10, color: "var(--accent2)", marginTop: 1 }}>{t("chat.withStaff", { name: th.staff_name })}</div>
                )}
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
          );
        })}
      </div>
    </div>
  );

  const conv = (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: 0,
      background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden",
    }}>
      {!activeId || !active ? (
        <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", padding: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
          <div style={{ fontSize: 14 }}>{t("chat.selectThread")}</div>
        </div>
      ) : (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0,
          }}>
            {isMobile && (
              <button type="button" onClick={() => setActiveId(null)} aria-label={t("chat.back")} style={{
                width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)",
                color: "var(--text)", cursor: "pointer", fontSize: 16, flexShrink: 0,
              }}>{i18n.language === "ar" ? "→" : "←"}</button>
            )}
            <Avatar name={active.athlete_name} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active.athlete_name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {[active.age_category, isOwner && active.staff_id !== user?.id ? t("chat.withStaff", { name: active.staff_name }) : null].filter(Boolean).join(" • ")}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatConversation
              messages={messages} meId={user?.id} loading={msgLoading}
              sending={sendMutation.isPending}
              onSend={(body) => sendMutation.mutateAsync(body)}
              theirLabel={(m) => [m.sender_name, roleLabel(m.sender_role)].filter(Boolean).join(" • ")}
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title={t("chat.pageTitle")} subtitle={isMobile ? "" : t("chat.pageSubtitle")} />
      <main style={{ padding: isMobile ? "10px 10px 0" : "16px 20px", flex: 1 }}>
        <div style={{
          display: "grid", gap: 12, height,
          gridTemplateColumns: isMobile ? "1fr" : "minmax(300px, 360px) 1fr",
        }}>
          {showList && list}
          {showConv && conv}
        </div>
      </main>
    </>
  );
}