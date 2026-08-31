// src/pages/Notifications.jsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery as useQ } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Spinner, Empty, Select } from "@/components/ui";
import { notificationsService } from "@/services/notifications.service";
import { membersService } from "@/services/members.service";
import toast from "react-hot-toast";

const TABS = [
  { id: "send",    label: "إرسال إشعار",     icon: "📤" },
  { id: "history", label: "سجل الإشعارات",   icon: "📋" },
];

const NOTIF_TYPES = [
  { value: "general",             label: "عام" },
  { value: "attendance",          label: "حضور/غياب" },
  { value: "subscription_expiry", label: "انتهاء اشتراك" },
  { value: "payment",             label: "دفعة" },
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
      toast.success(`✅ تم الإرسال لـ ${res.data?.saved || 0} مستخدم (Push: ${res.data?.pushed || 0})`);
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
      toast.error("العنوان والنص مطلوبان");
      return;
    }
    const ids = getTargetIds();
    if (!ids.length) { toast.error("اختر مستلماً واحداً على الأقل"); return; }
    sendMutation.mutate({ userIds: ids, title: form.title, body: form.body, type: form.type });
  };

  const toggleMember = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const TARGET_OPTIONS = [
    { value: "all",       label: "🌐 الجميع (رياضيون + أولياء الأمور)" },
    { value: "athletes",  label: "🏋️ الرياضيون فقط" },
    { value: "guardians", label: "👨‍👩‍👦 أولياء الأمور فقط" },
    { value: "specific",  label: "🔍 أشخاص محددون" },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: isMobile ? 14 : 20,
    }}>

      {/* نموذج الإرسال */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>📤 إنشاء إشعار</div>

        <Select label="المستلمون" options={TARGET_OPTIONS} value={target} onChange={e => { setTarget(e.target.value); setSelected([]); }} />

        {/* بحث عن أعضاء محددين */}
        {target === "specific" && (
          <div>
            <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
              ابحث واختر الأعضاء ({selectedIds.length} مختار)
            </label>
            <input
              placeholder="ابحث بالاسم..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", marginBottom: 8,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", color: "var(--text)",
                fontSize: 13, outline: "none", direction: "rtl",
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

        <Select label="نوع الإشعار" options={NOTIF_TYPES} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />

        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>العنوان *</label>
          <input
            placeholder="مثال: تذكير بالحصة"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{
              width: "100%", padding: "10px 12px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              color: "var(--text)", fontSize: 13, outline: "none", direction: "rtl",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>نص الإشعار *</label>
          <textarea
            placeholder="اكتب نص الإشعار هنا..."
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              color: "var(--text)", fontSize: 13, outline: "none", direction: "rtl",
              resize: "vertical", fontFamily: "'Sora', sans-serif",
            }}
          />
        </div>

        {/* معاينة */}
        {(form.title || form.body) && (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>معاينة الإشعار</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18 }}>{TYPE_INFO[form.type]?.icon || "🔔"}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{form.title || "العنوان"}</div>
                <div style={{ fontSize: 11, color: "var(--muted-lt)", marginTop: 2 }}>{form.body || "النص"}</div>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSend} loading={sendMutation.isPending} style={{ width: "100%", justifyContent: "center" }}>
          📤 إرسال الإشعار
        </Button>
      </div>

      {/* الإشعارات التلقائية */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AutoNotifCard
          icon="⚠️"
          title="إشعار انتهاء الاشتراكات"
          desc="يرسل إشعاراً تلقائياً لكل رياضي واشتراكه ينتهي خلال 3 أيام أو أقل"
          color="var(--warning)"
          onSend={async () => {
            const res = await notificationsService.notifyExpiring();
            toast.success(`تم إشعار ${res.data?.notified || 0} اشتراك`);
          }}
        />
        <SessionReminderCard />
      </div>
    </div>
  );
}

// ══ بطاقة تذكير بحصة اليوم — مع فلترة حسب الفئة العمرية والفوج ══
const AGE_CATEGORIES_FILTER = [
  { value: "", label: "كل الفئات العمرية" },
  { value: "مدارس", label: "مدارس" },
  { value: "براعم", label: "براعم" },
  { value: "أصاغر", label: "أصاغر" },
  { value: "أشبال", label: "أشبال" },
  { value: "أواسط", label: "أواسط" },
  { value: "أمال",  label: "أمال" },
  { value: "أكابر", label: "أكابر" },
];

function SessionReminderCard() {
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
        toast.error("لا يوجد رياضيون مطابقون لهذا الفلتر");
        setLoading(false);
        return;
      }

      const sendRes = await notificationsService.sendManual({
        userIds: athletes.map(m => m.id),
        title: "تذكير بحصة اليوم 📅",
        body: "لا تنسَ حضور حصتك اليوم — سجّل حضورك بمسح QR القاعة",
        type: "general",
      });
      toast.success(`تم الإرسال لـ ${sendRes.data?.saved || 0} رياضي`);
    } catch {
      toast.error("فشل الإرسال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--accent2)30", borderRadius: "var(--radius)", padding: 18 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>تذكير بحصة اليوم</div>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
        أرسل تذكيراً للرياضيين بحصص اليوم — حدّد الفئة العمرية والفوج (اختياري) لتضييق المستلمين
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <select
          value={ageCategory}
          onChange={e => setAgeCategory(e.target.value)}
          style={{
            padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", outline: "none", direction: "rtl",
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {AGE_CATEGORIES_FILTER.map(c => (
            <option key={c.value} value={c.value} style={{ background: "var(--card)", color: "var(--text)" }}>{c.label}</option>
          ))}
        </select>

        <input
          placeholder="الفوج (اختياري، مثال: الفوج 1)"
          value={group}
          onChange={e => setGroup(e.target.value)}
          style={{
            padding: "8px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", outline: "none", direction: "rtl",
            fontFamily: "'Sora', sans-serif",
          }}
        />
      </div>

      <Button variant="secondary" size="sm" loading={loading} onClick={handleSend} style={{ color: "var(--accent2)" }}>
        إرسال الآن
      </Button>
    </div>
  );
}

function AutoNotifCard({ icon, title, desc, color, onSend }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onSend(); } catch { toast.error("فشل الإرسال"); } finally { setLoading(false); }
  };
  return (
    <div style={{ background: "var(--card)", border: `1px solid ${color}30`, borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>{desc}</div>
      <Button variant="secondary" size="sm" loading={loading} onClick={handle} style={{ color }}>إرسال الآن</Button>
    </div>
  );
}

// ══ تبويب السجل ══════════════════════════════════════════════
function HistoryTab() {
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
        <Empty icon="📭" title="لا توجد إشعارات" description="لم يُرسَل أي إشعار بعد" />
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
  const [tab, setTab] = useState("send");
  const isMobile = useIsMobile();

  return (
    <>
      <PageHeader title="الإشعارات" subtitle="إرسال وإدارة إشعارات الرياضيين وأولياء الأمور">
        <div style={{
          display: "flex", gap: 4, background: "var(--surface)",
          borderRadius: "var(--radius-sm)", padding: 4,
          width: isMobile ? "100%" : "auto",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: isMobile ? "8px 10px" : "7px 16px",
              fontSize: 12, fontWeight: 600,
              borderRadius: "var(--radius-sm)", border: "none",
              background: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "#0d0f14" : "var(--muted)",
              cursor: "pointer", fontFamily: "'Sora', sans-serif",
              flex: isMobile ? 1 : "none",
              whiteSpace: "nowrap",
            }}>
              {t.icon} {t.label}
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