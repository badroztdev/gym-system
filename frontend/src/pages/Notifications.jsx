// src/pages/Notifications.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery as useQ } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Spinner, Empty, Select } from "@/components/ui";
import { notificationsService } from "@/services/notifications.service";
import { membersService } from "@/services/members.service";
import toast from "react-hot-toast";

const getTabs = (t) => [
  { id: "send",    label: t("notifications.tabSend"),    icon: "📤" },
  { id: "history", label: t("notifications.tabHistory"), icon: "📋" },
];

const getNotifTypes = (t) => [
  { value: "general",             label: t("notifications.typeGeneral") },
  { value: "attendance",          label: t("notifications.typeAttendance") },
  { value: "subscription_expiry", label: t("notifications.typeSubscriptionExpiry") },
  { value: "payment",             label: t("notifications.typePayment") },
];

const TYPE_INFO = {
  attendance:          { icon: "✅", color: "var(--accent)" },
  subscription_expiry: { icon: "⚠️", color: "var(--warning)" },
  payment:             { icon: "💰", color: "var(--accent2)" },
  general:             { icon: "🔔", color: "var(--muted)" },
};

// كشف حجم الشاشة (نفس النمط المستخدم في بقية الصفحات)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ══ تبويب الإرسال ════════════════════════════════════════════
function SendTab() {
  const { t, i18n } = useTranslation();
  const NOTIF_TYPES = getNotifTypes(t);
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [target, setTarget]       = useState("all");   // all | athletes | guardians | specific
  const [selectedIds, setSelected] = useState([]);
  const [form, setForm]            = useState({ title: "", body: "", type: "general" });
  const [search, setSearch]        = useState("");

  const { data: membersData } = useQuery({
    queryKey: ["members-for-notif", search],
    queryFn: () => membersService.getAll({ search, limit: 20 }),
    enabled: target === "specific",
  });
  const members = membersData?.data || [];

  // جلب كل الأعضاء حسب الدور للإرسال الجماعي
  const { data: allAthletes }  = useQuery({ queryKey: ["athletes-ids"],  queryFn: () => membersService.getAll({ role: "athlete",  limit: 500 }), enabled: target === "athletes" || target === "all" });
  const { data: allGuardians } = useQuery({ queryKey: ["guardians-ids"], queryFn: () => membersService.getAll({ role: "guardian", limit: 500 }), enabled: target === "guardians" || target === "all" });

  const sendMutation = useMutation({
    mutationFn: (payload) => notificationsService.sendManual(payload),
    onSuccess: (res) => {
      toast.success(t("notifications.toastSent", { saved: res.data?.saved || 0, pushed: res.data?.pushed || 0 }));
      setForm({ title: "", body: "", type: "general" });
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["notifications-history"] });
    },
  });

  const getTargetIds = () => {
    if (target === "all")       return [...(allAthletes?.data || []), ...(allGuardians?.data || [])].map(m => m.id);
    if (target === "athletes")  return (allAthletes?.data  || []).map(m => m.id);
    if (target === "guardians") return (allGuardians?.data || []).map(m => m.id);
    return selectedIds;
  };

  const handleSend = () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error(t("notifications.errorTitleBodyRequired"));
      return;
    }
    const ids = getTargetIds();
    if (!ids.length) { toast.error(t("notifications.errorNoRecipient")); return; }
    sendMutation.mutate({ userIds: ids, title: form.title, body: form.body, type: form.type });
  };

  const toggleMember = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const TARGET_OPTIONS = [
    { value: "all",       label: t("notifications.targetAll") },
    { value: "athletes",  label: t("notifications.targetAthletes") },
    { value: "guardians", label: t("notifications.targetGuardians") },
    { value: "specific",  label: t("notifications.targetSpecific") },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: isMobile ? 14 : 20,
    }}>

      {/* نموذج الإرسال */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("notifications.createNotifTitle")}</div>

        <Select label={t("notifications.recipientsLabel")} options={TARGET_OPTIONS} value={target} onChange={e => { setTarget(e.target.value); setSelected([]); }} />

        {/* بحث عن أعضاء محددين */}
        {target === "specific" && (
          <div>
            <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
              {t("notifications.searchSelectLabel", { count: selectedIds.length })}
            </label>
            <input
              placeholder={t("notifications.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", marginBottom: 8,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)",
                fontSize: 13, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
              }}
            />
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {members.map(m => (
                <button key={m.id} onClick={() => toggleMember(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: selectedIds.includes(m.id) ? "var(--accent)15" : "var(--surface)",
                  border: `1px solid ${selectedIds.includes(m.id) ? "var(--accent)40" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)", cursor: "pointer", textAlign: "right",
                }}>
                  <span style={{ fontSize: 14 }}>{selectedIds.includes(m.id) ? "✓" : "○"}</span>
                  <span style={{ fontSize: 12, color: "var(--text)" }}>{m.full_name}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{m.phone}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Select label={t("notifications.notifTypeLabel")} options={NOTIF_TYPES} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />

        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>{t("notifications.titleLabel")}</label>
          <input
            placeholder={t("notifications.titlePlaceholder")}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{
              width: "100%", padding: "10px 12px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              color: "var(--text)", fontSize: 13, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>{t("notifications.bodyLabel")}</label>
          <textarea
            placeholder={t("notifications.bodyPlaceholder")}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              color: "var(--text)", fontSize: 13, outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
              resize: "vertical", fontFamily: "'Sora', sans-serif",
            }}
          />
        </div>

        {/* معاينة */}
        {(form.title || form.body) && (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>{t("notifications.previewLabel")}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18 }}>{TYPE_INFO[form.type]?.icon || "🔔"}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{form.title || t("notifications.previewTitleFallback")}</div>
                <div style={{ fontSize: 11, color: "var(--muted-lt)", marginTop: 2 }}>{form.body || t("notifications.previewBodyFallback")}</div>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSend} loading={sendMutation.isPending} style={{ width: "100%", justifyContent: "center" }}>
          {t("notifications.sendButton")}
        </Button>
      </div>

      {/* الإشعارات التلقائية */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AutoNotifCard
          icon="⚠️"
          title={t("notifications.expiringSubsTitle")}
          desc={t("notifications.expiringSubsDesc")}
          color="var(--warning)"
          onSend={async () => {
            const res = await notificationsService.notifyExpiring();
            toast.success(t("notifications.toastExpiringSent", { count: res.data?.notified || 0 }));
          }}
        />
        <SessionReminderCard />
      </div>
    </div>
  );
}

// ══ بطاقة تذكير بحصة اليوم — مع فلترة حسب الفئة العمرية والفوج ══
function SessionReminderCard() {
  const { t, i18n } = useTranslation();

  // ✅ القيم (value) تبقى بالعربية دائماً لمطابقة قاعدة البيانات، فقط التسمية تُترجم
  const AGE_CATEGORIES_FILTER = [
    { value: "",        label: t("notifications.allAgeCategories") },
    { value: "مدارس",   label: t("members.categorySchools") },
    { value: "كتاكيت",  label: t("members.categoryChicks") },
    { value: "براعم",   label: t("members.categoryBuds") },
    { value: "أصاغر",   label: t("members.categoryYoungCubs") },
    { value: "أشبال",   label: t("members.categoryCubs") },
    { value: "أواسط",   label: t("members.categoryMids") },
    { value: "أمال",    label: t("members.categoryHopes") },
    { value: "أكابر",   label: t("members.categorySeniors") },
  ];

  const GROUP_FILTER_OPTIONS = [
    { value: "",        label: t("notifications.allGroups") },
    { value: "الفوج 1", label: t("memberForm.groupLabel", { num: 1 }) },
    { value: "الفوج 2", label: t("memberForm.groupLabel", { num: 2 }) },
    { value: "الفوج 3", label: t("memberForm.groupLabel", { num: 3 }) },
    { value: "الفوج 4", label: t("memberForm.groupLabel", { num: 4 }) },
  ];

  const [ageCategory, setAgeCategory] = useState("");
  const [group, setGroup] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const params = { role: "athlete", limit: 500 };
      if (ageCategory) params.ageCategory = ageCategory;
      if (group.trim()) params.group = group.trim();

      const res = await membersService.getAll(params);
      const athletes = res.data || [];

      if (!athletes.length) {
        toast.error(t("notifications.errorNoMatchingAthletes"));
        setLoading(false);
        return;
      }

      const sendRes = await notificationsService.sendManual({
        userIds: athletes.map(m => m.id),
        title: t("notifications.sessionReminderNotifTitle"),
        body: t("notifications.sessionReminderNotifBody"),
        type: "general",
      });
      toast.success(t("notifications.toastReminderSent", { count: sendRes.data?.saved || 0 }));
    } catch {
      toast.error(t("notifications.errorSendFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--accent2)30", borderRadius: "var(--radius)", padding: 18 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("notifications.sessionReminderTitle")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
        {t("notifications.sessionReminderDesc")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <select
          value={ageCategory}
          onChange={e => setAgeCategory(e.target.value)}
          style={{
            padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {AGE_CATEGORIES_FILTER.map(c => (
            <option key={c.value} value={c.value} style={{ background: "var(--card)", color: "var(--text)" }}>{c.label}</option>
          ))}
        </select>

        <select
          value={group}
          onChange={e => setGroup(e.target.value)}
          style={{
            padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", outline: "none", direction: i18n.language === "ar" ? "rtl" : "ltr",
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {GROUP_FILTER_OPTIONS.map(g => (
            <option key={g.value} value={g.value} style={{ background: "var(--card)", color: "var(--text)" }}>{g.label}</option>
          ))}
        </select>
      </div>

      <Button variant="secondary" size="sm" loading={loading} onClick={handleSend} style={{ color: "var(--accent2)" }}>
        {t("notifications.sendNow")}
      </Button>
    </div>
  );
}

function AutoNotifCard({ icon, title, desc, color, onSend }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onSend(); } catch { toast.error(t("notifications.errorSendFailed")); } finally { setLoading(false); }
  };
  return (
    <div style={{ background: "var(--card)", border: `1px solid ${color}30`, borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>{desc}</div>
      <Button variant="secondary" size="sm" loading={loading} onClick={handle} style={{ color }}>{t("notifications.sendNow")}</Button>
    </div>
  );
}

// ══ تبويب السجل ══════════════════════════════════════════════
function HistoryTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications-history"],
    queryFn: notificationsService.getAll,
  });
  const notifications = data?.data || [];

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spinner size={28} /></div>
      ) : notifications.length === 0 ? (
        <Empty icon="📭" title={t("notifications.noNotifications")} description={t("notifications.noNotificationsSentYet")} />
      ) : (
        <div>
          {notifications.map(n => {
            const info = TYPE_INFO[n.type] || TYPE_INFO.general;
            return (
              <div key={n.id} style={{
                padding: "14px 18px", borderBottom: "1px solid var(--border)",
                display: "flex", gap: 12, alignItems: "flex-start",
                opacity: n.is_read ? 0.6 : 1,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{info.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-lt)", marginTop: 2, lineHeight: 1.5 }}>{n.body}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                    {new Date(n.sent_at).toLocaleString("ar-DZ")}
                  </div>
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: info.color, marginTop: 4, flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══ الصفحة الرئيسية ══════════════════════════════════════════
export default function NotificationsPage() {
  const { t } = useTranslation();
  const TABS = getTabs(t);
  const [tab, setTab] = useState("send");
  const isMobile = useIsMobile();

  return (
    <>
      <PageHeader title={t("notifications.pageTitle")} subtitle={t("notifications.pageSubtitle")}>
        <div style={{
          display: "flex", gap: 4, background: "var(--surface)",
          borderRadius: "var(--radius-sm)", padding: 4,
          width: isMobile ? "100%" : "auto",
        }}>
          {TABS.map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{
              padding: isMobile ? "8px 10px" : "7px 16px",
              fontSize: 12, fontWeight: 600,
              borderRadius: "var(--radius-sm)", border: "none",
              background: tab === tabItem.id ? "var(--accent)" : "transparent",
              color: tab === tabItem.id ? "#0d0f14" : "var(--muted)",
              cursor: "pointer", fontFamily: "'Sora', sans-serif",
              flex: isMobile ? 1 : "none",
              whiteSpace: "nowrap",
            }}>
              {tabItem.icon} {tabItem.label}
            </button>
          ))}
        </div>
      </PageHeader>
      <main style={{ padding: isMobile ? "14px 12px" : "24px 28px" }}>
        {tab === "send"    && <SendTab />}
        {tab === "history" && <HistoryTab />}
      </main>
    </>
  );
}
