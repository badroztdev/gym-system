// src/pages/Settings.jsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Input, Select } from "@/components/ui";
import { settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

const TABS = [
  { id: "gym",         label: "معلومات الصالة", icon: "🏋️" },
  { id: "profile",     label: "ملفي الشخصي",    icon: "👤" },
  { id: "preferences", label: "إعدادات عامة",    icon: "⚙️" },
];

// ══ تبويب 1 — معلومات الصالة ═════════════════════════════════
function GymTab() {
  const qc = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const isOwner = user?.role === "owner";

  const { data, isLoading } = useQuery({ queryKey: ["gym-settings"], queryFn: settingsService.getGym });
  const gym = data?.data;

  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });

  useEffect(() => {
    if (gym) setForm({ name: gym.name || "", address: gym.address || "", phone: gym.phone || "", email: gym.email || "" });
  }, [gym]);

  const mutation = useMutation({
    mutationFn: settingsService.updateGym,
    onSuccess: (res) => {
      toast.success("تم تحديث معلومات الصالة ✅");
      qc.invalidateQueries({ queryKey: ["gym-settings"] });
      // تحديث اسم الصالة في الـ authStore ليظهر في الـ sidebar فوراً
      updateUser({ ...user, gymName: res.data.name });
    },
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>جاري التحميل...</div>;

  return (
    <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 700, color: "#0d0f14",
          }}>{form.name?.[0] || "G"}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{form.name || "اسم الصالة"}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>معرّف الصالة: {gym?.id?.slice(0, 8)}...</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="اسم الصالة" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!isOwner} />
          <Input label="العنوان" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} disabled={!isOwner} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="الهاتف" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={!isOwner} />
            <Input label="البريد الإلكتروني" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!isOwner} />
          </div>

          {isOwner ? (
            <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending} style={{ alignSelf: "flex-start", marginTop: 8 }}>
              حفظ التغييرات
            </Button>
          ) : (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              ⓘ فقط المالك يمكنه تعديل معلومات الصالة
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══ تبويب 2 — الملف الشخصي ═══════════════════════════════════
function ProfileTab() {
  const qc = useQueryClient();
  const { user, updateUser } = useAuthStore();

  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: settingsService.getProfile });
  const profile = data?.data;

  const [form, setForm] = useState({ fullName: "", email: "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  useEffect(() => {
    if (profile) setForm({ fullName: profile.full_name || "", email: profile.email || "" });
  }, [profile]);

  const ROLE_LABELS = { owner: "المالك", coach: "مدرب", assistant: "مساعد مدرب" };

  const profileMutation = useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (res) => {
      toast.success("تم تحديث ملفك الشخصي ✅");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      updateUser({ ...user, fullName: res.data.full_name, email: res.data.email });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: settingsService.changePassword,
    onSuccess: (res) => {
      toast.success(res.data?.message || "تم تغيير كلمة المرور ✅");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
  });

  const handlePasswordSubmit = () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة");
      return;
    }
    passwordMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>جاري التحميل...</div>;

  return (
    <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* بطاقة الملف */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
            background: "var(--accent2)25", color: "var(--accent2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 700,
          }}>{profile?.full_name?.[0]}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{profile?.full_name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{ROLE_LABELS[profile?.role] || profile?.role}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="الاسم الكامل" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          <Input label="رقم الهاتف" value={profile?.phone} disabled />
          <Input label="البريد الإلكتروني" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Button onClick={() => profileMutation.mutate(form)} loading={profileMutation.isPending} style={{ alignSelf: "flex-start" }}>
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {/* تغيير كلمة المرور */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>🔒 تغيير كلمة المرور</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input
            label="كلمة المرور الحالية" type="password"
            value={pwForm.currentPassword}
            onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
          />
          <Input
            label="كلمة المرور الجديدة" type="password"
            value={pwForm.newPassword}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
          />
          <Input
            label="تأكيد كلمة المرور الجديدة" type="password"
            value={pwForm.confirmPassword}
            onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
          />
          <Button onClick={handlePasswordSubmit} loading={passwordMutation.isPending} style={{ alignSelf: "flex-start" }}>
            تغيير كلمة المرور
          </Button>
        </div>
      </div>
    </div>
  );
}

// ══ تبويب 3 — إعدادات عامة ═══════════════════════════════════
const CURRENCIES = [
  { value: "DZD", label: "دينار جزائري (DZD)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
  { value: "EUR", label: "يورو (EUR)" },
];
const TIMEZONES = [
  { value: "Africa/Algiers", label: "الجزائر (GMT+1)" },
  { value: "Africa/Tunis",   label: "تونس (GMT+1)" },
  { value: "Africa/Casablanca", label: "المغرب (GMT+1)" },
];
const WEEK_STARTS = [
  { value: "0", label: "الأحد" },
  { value: "6", label: "السبت" },
  { value: "1", label: "الاثنين" },
];

function PreferencesTab() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";

  const { data, isLoading } = useQuery({ queryKey: ["gym-settings"], queryFn: settingsService.getGym });
  const settings = data?.data?.settings || {};

  const [form, setForm] = useState({ currency: "DZD", timezone: "Africa/Algiers", qrValidityMinutes: "10", weekStartsOn: "0" });

  useEffect(() => {
    setForm({
      currency: settings.currency || "DZD",
      timezone: settings.timezone || "Africa/Algiers",
      qrValidityMinutes: String(settings.session_qr_validity_minutes ?? 10),
      weekStartsOn: String(settings.week_starts_on ?? 0),
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: settingsService.updatePreferences,
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات ✅");
      qc.invalidateQueries({ queryKey: ["gym-settings"] });
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      currency: form.currency,
      timezone: form.timezone,
      qrValidityMinutes: Number(form.qrValidityMinutes),
      weekStartsOn: Number(form.weekStartsOn),
    });
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>جاري التحميل...</div>;

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>⚙️ الإعدادات العامة</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select label="العملة" options={CURRENCIES} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} disabled={!isOwner} />
          <Select label="المنطقة الزمنية" options={TIMEZONES} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} disabled={!isOwner} />
          <Select label="بداية الأسبوع" options={WEEK_STARTS} value={form.weekStartsOn} onChange={e => setForm(f => ({ ...f, weekStartsOn: e.target.value }))} disabled={!isOwner} />

          <div>
            <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 6 }}>
              مدة صلاحية رمز QR (بالدقائق)
            </label>
            <input
              type="number" min="1" max="60"
              value={form.qrValidityMinutes}
              onChange={e => setForm(f => ({ ...f, qrValidityMinutes: e.target.value }))}
              disabled={!isOwner}
              style={{
                width: "100%", padding: "10px 14px", background: "var(--surface)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text)", fontSize: 13, outline: "none", direction: "rtl",
                opacity: isOwner ? 1 : 0.6,
              }}
            />
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              المدة التي يبقى فيها الرياضي قادراً على تسجيل حضوره بعد بداية الحصة
            </p>
          </div>

          {isOwner ? (
            <Button onClick={handleSubmit} loading={mutation.isPending} style={{ alignSelf: "flex-start", marginTop: 4 }}>
              حفظ الإعدادات
            </Button>
          ) : (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>ⓘ فقط المالك يمكنه تعديل هذه الإعدادات</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══ الصفحة الرئيسية ══════════════════════════════════════════
export default function SettingsPage() {
  const [tab, setTab] = useState("gym");

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="إدارة معلومات الصالة وملفك الشخصي">
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "7px 16px", fontSize: 12, fontWeight: 600,
              borderRadius: "var(--radius-sm)", border: "none",
              background: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "#0d0f14" : "var(--muted)",
              cursor: "pointer", fontFamily: "'Sora', sans-serif",
              whiteSpace: "nowrap",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </PageHeader>
      <main style={{ padding: "24px 28px" }}>
        {tab === "gym"         && <GymTab />}
        {tab === "profile"     && <ProfileTab />}
        {tab === "preferences" && <PreferencesTab />}
      </main>
    </>
  );
}