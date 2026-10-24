// src/components/sessions/SessionForm.jsx
// نافذة الحصة: إنشاء حصة جديدة، أو تعديلها بتبويبات
//   تدريب  → الجدولة | الحضور
//   منافسة → الجدولة | الحضور | النتائج
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input, Select, Button } from "@/components/ui";
import { sessionsService } from "@/services/sessions.service";
import { roomsService } from "@/services/rooms.service";
import { categoriesService } from "@/services/categories.service";
import { staffService } from "@/services/staff.service";
import { attendanceService } from "@/services/attendance.service";
import { sessionExtrasService } from "@/services/sessionExtras.service";
import toast from "react-hot-toast";

// ════════════════════════════════════════════════════════════
//  ثوابت ودوال مساعدة
// ════════════════════════════════════════════════════════════
const getDays = (t) => {
  const labels = t("sessionForm.days", { returnObjects: true });
  return [0, 1, 2, 3, 4, 5, 6].map(value => ({ value, label: labels[value] }));
};

// خيارات الوقت 24 ساعة بخطوة 30 دقيقة
const getTimeOptions = (t) => {
  const opts = [{ value: "", label: t("sessionForm.chooseTime") }];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
    }
  }
  return opts;
};

const AGE_CATEGORIES = [
  { value: "مدارس" },  { value: "كتاكيت" },
  { value: "براعم" },  { value: "أصاغر" },
  { value: "أشبال" },  { value: "أواسط" },
  { value: "أمال" },   { value: "أكابر" },
];

// ✅ .toISOString() يحوّل للتوقيت العالمي (UTC) لا المحلي — نستخدم المحلي
function toLocalDateString(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const today = () => toLocalDateString(new Date());

// ✅ الأفواج المتاحة — نفس قائمة نموذج العضو (القيمة بالعربية دائماً لمطابقة users.group_name)
const SESSION_GROUPS = ["الفوج 1", "الفوج 2", "الفوج 3", "الفوج 4"];

const EMPTY = {
  title: "", description: "", sessionDate: today(),
  startTime: "08:00", endTime: "09:00",
  capacity: "20", coachId: "", roomId: "", categoryId: "",
  ageCategories: [], ageGroups: {}, sessionType: "training",
  isRecurring: false, recurrenceDays: [], recurrenceEnd: "",
};

// تحويل الوقت من 12h إلى 24h إذا لزم الأمر
const toTime24 = (t) => {
  if (!t) return t;
  if (t.includes("AM") || t.includes("PM")) {
    const [time, modifier] = t.split(" ");
    let [hours, minutes] = time.split(":");
    hours = parseInt(hours, 10);
    if (modifier === "AM" && hours === 12) hours = 0;
    if (modifier === "PM" && hours !== 12) hours += 12;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  return t;
};

function useIsMobile(bp = 560) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

let _rowKey = 0;
const newKey = () => `r${++_rowKey}`;
const emptyResult = () => ({ key: newKey(), athleteId: "", specialty: "", result: "", rank: "", medal: "" });

// ════════════════════════════════════════════════════════════
//  أيقونات (SVG مضمّنة — بدون مكتبات)
// ════════════════════════════════════════════════════════════
const Svg = ({ children, size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);
const IconCheck     = (p) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
const IconCheckAll  = (p) => <Svg {...p}><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></Svg>;
const IconClock     = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
const IconX         = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
const IconCalX      = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M10 14l4 4M14 14l-4 4" /></Svg>;
const IconTrash     = (p) => <Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></Svg>;
const IconPlus      = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
const IconWhatsApp  = (p) => (
  <svg width={p?.size || 22} height={p?.size || 22} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1c-1.5 0-2.93-.4-4.18-1.14l-.3-.18-3.08.89.9-3-.2-.31A8.1 8.1 0 1 1 12.04 20.1Zm4.45-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12s-.63.79-.77.95c-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.58.18 1.1.16 1.52.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
  </svg>
);

const STATUS_DEFS = [
  { id: "present", color: "var(--accent)",  Icon: IconCheck, key: "statusPresent" },
  { id: "late",    color: "var(--warning)", Icon: IconClock, key: "statusLate"    },
  { id: "absent",  color: "var(--danger)",  Icon: IconX,     key: "statusAbsent"  },
  { id: "excused", color: "var(--accent3)", Icon: IconCalX,  key: "statusExcused" },
];

const MEDAL_ICON = { gold: "🥇", silver: "🥈", bronze: "🥉" };

// ════════════════════════════════════════════════════════════
//  مكوّنات صغيرة
// ════════════════════════════════════════════════════════════
function TimeSelect({ label, value, onChange, error, timeOptions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500 }}>{label}</label>}
      <select value={value} onChange={onChange} style={{
        width: "100%", padding: "10px 14px",
        background: "var(--surface)",
        border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        color: value ? "var(--text)" : "var(--muted)",
        fontSize: 14, outline: "none", cursor: "pointer",
        direction: "ltr", textAlign: "center",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {timeOptions.map(o => (
          <option key={o.value} value={o.value} style={{ background: "var(--card)", color: "var(--text)" }}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

function Section({ title }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginTop: 8 }}>
      {title}
    </div>
  );
}

const fieldInputStyle = (hasError) => ({
  width: "100%", boxSizing: "border-box", padding: "11px 14px",
  background: "var(--surface)",
  border: `1px solid ${hasError ? "var(--danger)" : "var(--border)"}`,
  borderRadius: "var(--radius-sm)", color: "var(--text)",
  fontSize: 14, outline: "none", fontFamily: "inherit",
});

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  تبويب الحضور
// ════════════════════════════════════════════════════════════
function AttendancePanel({ sessionId, draft, setDraft }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-session", sessionId],
    queryFn:  () => attendanceService.getBySession(sessionId),
    enabled:  !!sessionId,
  });
  const list = data?.data || [];

  const statusOf = (a) => draft[a.athlete_id] ?? a.status ?? null;
  const done  = list.filter(a => statusOf(a)).length;
  const total = list.length;
  const remaining = total - done;

  const setStatus = (athleteId, status) => setDraft(p => ({ ...p, [athleteId]: status }));
  const markRest = () => setDraft(p => {
    const next = { ...p };
    list.forEach(a => { if (!(next[a.athlete_id] ?? a.status)) next[a.athlete_id] = "present"; });
    return next;
  });

  if (isLoading) {
    return <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>…</div>;
  }
  if (!list.length) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
        {t("sessions.noEligibleAthletes")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ملخّص + تسجيل الباقين */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap", padding: "14px 16px",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {t("sessionModal.recordedOf", { done, total })}
        </div>
        <button type="button" onClick={markRest} disabled={remaining === 0} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
          border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)",
          cursor: remaining === 0 ? "default" : "pointer", opacity: remaining === 0 ? 0.45 : 1,
          fontFamily: "inherit",
        }}>
          <IconCheckAll size={18} style={{ color: "var(--accent)" }} />
          {t("sessionModal.markRestPresent")}
        </button>
      </div>

      {/* بطاقة لكل رياضي */}
      {list.map(a => {
        const current = statusOf(a);
        return (
          <div key={a.athlete_id} style={{
            padding: 14, background: "var(--card)",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12, overflowWrap: "anywhere" }}>
              {a.athlete_name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {STATUS_DEFS.map(({ id, color, Icon, key }) => {
                const selected = current === id;
                return (
                  <button key={id} type="button" onClick={() => setStatus(a.athlete_id, id)}
                    aria-pressed={selected}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 4, minHeight: 56, padding: "8px 6px", borderRadius: 12,
                      fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      border: `1.5px solid ${selected ? color : "var(--border)"}`,
                      background: selected ? `color-mix(in srgb, ${color} 16%, transparent)` : "transparent",
                      color: selected ? color : "var(--text)",
                      transition: "all 0.12s",
                    }}>
                    <Icon size={20} />
                    {t(`sessionModal.${key}`)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  تبويب النتائج
// ════════════════════════════════════════════════════════════
function ResultsPanel({ athletes, rows, setRows, loading, errors }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const update = (key, field, value) =>
    setRows(p => p.map(r => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (key) => setRows(p => p.filter(r => r.key !== key));
  const add    = () => setRows(p => [...p, emptyResult()]);

  const medalOptions = [
    { value: "",       label: t("sessionModal.medalNone") },
    { value: "gold",   label: `${MEDAL_ICON.gold} ${t("sessionModal.medalGold")}` },
    { value: "silver", label: `${MEDAL_ICON.silver} ${t("sessionModal.medalSilver")}` },
    { value: "bronze", label: `${MEDAL_ICON.bronze} ${t("sessionModal.medalBronze")}` },
  ];

  if (loading) {
    return <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.length === 0 && (
        <div style={{
          padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.7,
          border: "1px dashed var(--border)", borderRadius: "var(--radius)",
        }}>
          🏆 {t("sessionModal.noResults")}
        </div>
      )}

      {rows.map((r, idx) => (
        <div key={r.key} style={{
          padding: 14, background: "var(--card)",
          border: `1px solid ${errors?.[r.key] ? "var(--danger)" : "var(--border)"}`,
          borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-lt)" }}>
              {r.medal ? MEDAL_ICON[r.medal] : "🏆"} #{idx + 1}
            </span>
            <button type="button" onClick={() => remove(r.key)} title={t("sessionModal.removeResult")}
              aria-label={t("sessionModal.removeResult")}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
                background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
              <IconTrash size={18} />
            </button>
          </div>

          <Field label={t("sessionModal.resultAthlete")}>
            <select value={r.athleteId} onChange={e => update(r.key, "athleteId", e.target.value)}
              style={{ ...fieldInputStyle(errors?.[r.key] && !r.athleteId), cursor: "pointer", color: r.athleteId ? "var(--text)" : "var(--muted)" }}>
              <option value="">{t("sessionModal.resultAthleteSelect")}</option>
              {athletes.map(a => (
                <option key={a.id} value={a.id} style={{ background: "var(--card)", color: "var(--text)" }}>{a.full_name}</option>
              ))}
            </select>
          </Field>

          <Field label={t("sessionModal.resultSpecialty")}>
            <input type="text" maxLength={150} value={r.specialty}
              placeholder={t("sessionModal.resultSpecialtyPlaceholder")}
              onChange={e => update(r.key, "specialty", e.target.value)} style={fieldInputStyle(false)} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <Field label={t("sessionModal.resultResult")}>
              <input type="text" maxLength={150} value={r.result}
                placeholder={t("sessionModal.resultResultPlaceholder")}
                onChange={e => update(r.key, "result", e.target.value)} style={fieldInputStyle(false)} />
            </Field>
            <Field label={t("sessionModal.resultRank")}>
              <input type="number" inputMode="numeric" min="1" step="1" value={r.rank}
                onChange={e => update(r.key, "rank", e.target.value)}
                style={{ ...fieldInputStyle(errors?.[r.key] === "rank"), fontFamily: "'JetBrains Mono', monospace" }} />
            </Field>
          </div>

          <Field label={t("sessionModal.resultMedal")}>
            <select value={r.medal} onChange={e => update(r.key, "medal", e.target.value)}
              style={{ ...fieldInputStyle(false), cursor: "pointer" }}>
              {medalOptions.map(o => (
                <option key={o.value} value={o.value} style={{ background: "var(--card)", color: "var(--text)" }}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>
      ))}

      <button type="button" onClick={add} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "13px 16px", borderRadius: "var(--radius)", cursor: "pointer",
        border: "1.5px dashed var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)",
        color: "var(--accent)", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
      }}>
        <IconPlus size={18} /> {t("sessionModal.addResult")}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  النافذة الرئيسية
// ════════════════════════════════════════════════════════════
export default function SessionForm({ open, onClose, session, onSuccess, onDelete }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const DAYS = getDays(t);
  const TIME_OPTIONS = getTimeOptions(t);
  // القيمة تبقى بالعربية لمطابقة قاعدة البيانات، فقط التسمية تُترجم
  const AGE_CATEGORY_LABELS = {
    "مدارس": t("members.categorySchools"), "كتاكيت": t("members.categoryChicks"),
    "براعم": t("members.categoryBuds"), "أصاغر": t("members.categoryYoungCubs"),
    "أشبال": t("members.categoryCubs"), "أواسط": t("members.categoryMids"),
    "أمال": t("members.categoryHopes"), "أكابر": t("members.categorySeniors"),
  };

  const isEdit = !!session;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState("schedule");
  const [attDraft, setAttDraft] = useState({});       // { athleteId: status } — التغييرات غير المحفوظة فقط
  const [resultRows, setResultRows] = useState([]);
  const [resultErrors, setResultErrors] = useState({});
  const [resultsDirty, setResultsDirty] = useState(false);
  const initialForm = useRef(JSON.stringify(EMPTY));

  const isCompetition = form.sessionType === "competition";

  const { data: roomsData }    = useQuery({ queryKey: ["rooms"],      queryFn: roomsService.getAll,      enabled: open });
  const { data: categoriesData}= useQuery({ queryKey: ["categories"], queryFn: categoriesService.getAll, enabled: open });
  const { data: coachesData }  = useQuery({ queryKey: ["coaches-list"], queryFn: () => staffService.getAll(), enabled: open });

  const rooms      = (roomsData?.data      || []).filter(r => r.is_active);
  const categories = categoriesData?.data  || [];
  const coaches    = (coachesData?.data    || []).filter(c => c.is_active);

  const ROLE_LABELS = { owner: t("common.owner"), coach: t("common.coach"), assistant: t("common.assistant") };
  const roomOptions     = [{ value: "", label: t("sessionForm.roomSelect") }, ...rooms.map(r => ({ value: r.id, label: `${r.name} (${r.capacity} ${t("sessionForm.roomSeats")})` }))];
  const categoryOptions = [{ value: "", label: t("sessionForm.categorySelect") }, ...categories.map(c => ({ value: c.id, label: c.name }))];
  const coachOptions    = [{ value: "", label: t("sessionForm.coachSelect") }, ...coaches.map(c => ({ value: c.id, label: `${c.full_name} (${ROLE_LABELS[c.role] || c.role})` }))];

  // نتائج المنافسة (تُجلب فقط عند فتح تعديل حصة منافسة)
  const resultsEnabled = open && isEdit && isCompetition;
  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ["session-results", session?.id],
    queryFn:  () => sessionExtrasService.getResults(session.id),
    enabled:  resultsEnabled,
  });
  const athletesList = resultsData?.data?.athletes || [];

  // تهيئة النموذج عند الفتح
  useEffect(() => {
    if (!open) return;
    let next = EMPTY;
    if (session) {
      next = {
        title:       session.title        || "",
        description: session.description  || "",
        sessionDate: session.session_date || today(),
        startTime:   session.start_time?.slice(0,5) || "08:00",
        endTime:     session.end_time?.slice(0,5)   || "09:00",
        capacity:    String(session.capacity || 20),
        coachId:     session.coach_id     || "",
        roomId:      session.room_id      || "",
        categoryId:  session.category_id  || "",
        ageCategories: Array.isArray(session.age_category)
          ? session.age_category
          : (session.age_category ? [session.age_category] : []),
        ageGroups: (session.age_groups && typeof session.age_groups === "object" && !Array.isArray(session.age_groups))
          ? session.age_groups : {},
        sessionType: session.session_type === "competition" ? "competition" : "training",
        isRecurring: false,
        recurrenceDays: [],
        recurrenceEnd: "",
      };
    }
    setForm(next);
    initialForm.current = JSON.stringify(next);
    setErrors({});
    setTab("schedule");
    setAttDraft({});
    setResultRows([]);
    setResultErrors({});
    setResultsDirty(false);
  }, [open, session]);

  // تهيئة الصفوف من الخادم (مرة واحدة ما لم يبدأ المستخدم بالتعديل)
  useEffect(() => {
    if (!resultsEnabled || resultsDirty) return;
    const rows = resultsData?.data?.results;
    if (!rows) return;
    setResultRows(rows.map(r => ({
      key: newKey(),
      athleteId: r.athlete_id,
      specialty: r.specialty || "",
      result:    r.result || "",
      rank:      r.rank_position != null ? String(r.rank_position) : "",
      medal:     r.medal || "",
    })));
  }, [resultsData, resultsEnabled, resultsDirty]);

  // منع تمرير الصفحة خلف النافذة + إغلاق بمفتاح Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const attDirty = Object.keys(attDraft).length > 0;
  const formDirty = JSON.stringify(form) !== initialForm.current;
  const isDirty = formDirty || attDirty || resultsDirty;

  const requestClose = () => {
    if (isDirty && !window.confirm(t("sessionModal.discardConfirm"))) return;
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // لو تحوّلت الحصة إلى تدريب وكان تبويب النتائج مفتوحاً
  useEffect(() => { if (!isCompetition && tab === "results") setTab("schedule"); }, [isCompetition, tab]);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleDay = (d) => setForm(p => ({
    ...p,
    recurrenceDays: p.recurrenceDays.includes(d)
      ? p.recurrenceDays.filter(x => x !== d)
      : [...p.recurrenceDays, d],
  }));
  const toggleAgeCategory = (v) => setForm(p => {
    const on = p.ageCategories.includes(v);
    const groups = { ...p.ageGroups };
    if (on) delete groups[v];            // إلغاء الفئة يحذف أفواجها
    return {
      ...p,
      ageCategories: on ? p.ageCategories.filter(x => x !== v) : [...p.ageCategories, v],
      ageGroups: groups,
    };
  });
  // الأفواج لكل فئة: بدون اختيار = كل الأفواج
  const toggleGroup = (cat, g) => setForm(p => {
    const cur = p.ageGroups[cat] || [];
    const next = cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g];
    const groups = { ...p.ageGroups };
    if (next.length) groups[cat] = next; else delete groups[cat];
    return { ...p, ageGroups: groups };
  });
  const clearGroups = (cat) => setForm(p => {
    const groups = { ...p.ageGroups }; delete groups[cat];
    return { ...p, ageGroups: groups };
  });

  const setRows = (updater) => { setResultsDirty(true); setResultRows(updater); };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = t("sessionForm.errorTitle");
    if (!form.coachId)      e.coachId = t("sessionForm.errorCoach");
    if (!form.sessionDate)  e.sessionDate = t("sessionForm.errorDate");
    if (!form.startTime)    e.startTime = t("sessionForm.errorStartTime");
    if (!form.endTime)      e.endTime = t("sessionForm.errorEndTime");
    if (form.startTime && form.endTime && form.startTime >= form.endTime)
      e.endTime = t("sessionForm.errorEndAfterStart");
    if (form.isRecurring && !form.recurrenceDays.length) e.recurrenceDays = t("sessionForm.errorRecurrenceDays");
    if (form.isRecurring && !form.recurrenceEnd) e.recurrenceEnd = t("sessionForm.errorRecurrenceEnd");
    return e;
  };

  // يُنظّف صفوف النتائج: يحذف الفارغ كلياً ويتحقق من الباقي
  const prepareResults = () => {
    const errs = {};
    const out = [];
    for (const r of resultRows) {
      const empty = !r.athleteId && !r.specialty.trim() && !r.result.trim() && r.rank === "" && !r.medal;
      if (empty) continue;
      if (!r.athleteId) { errs[r.key] = "athlete"; continue; }
      if (r.rank !== "" && (!Number.isInteger(Number(r.rank)) || Number(r.rank) < 1)) { errs[r.key] = "rank"; continue; }
      out.push({
        athleteId: r.athleteId, specialty: r.specialty.trim(), result: r.result.trim(),
        rank: r.rank === "" ? null : Number(r.rank), medal: r.medal || null,
      });
    }
    return { errs, out };
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); setTab("schedule"); return; }
    setErrors({});

    let resultsPayload = null;
    if (isEdit && isCompetition && resultsDirty) {
      const { errs, out } = prepareResults();
      setResultErrors(errs);
      if (Object.keys(errs).length) {
        setTab("results");
        const first = Object.values(errs)[0];
        toast.error(first === "rank" ? t("sessionModal.errorResultRank") : t("sessionModal.errorResultAthlete"));
        return;
      }
      resultsPayload = out;
    }

    setLoading(true);
    try {
      // الأفواج: فقط للفئات المحددة، وأفواج صالحة (وتُرسل {} لمسحها عند التعديل)
      const ageGroups = {};
      form.ageCategories.forEach(c => { if (form.ageGroups[c]?.length) ageGroups[c] = form.ageGroups[c]; });
      const payload = {
        ...form,
        ageGroups,
        startTime: toTime24(form.startTime),
        endTime:   toTime24(form.endTime),
        capacity:      Number(form.capacity),
        recurrenceDays: form.isRecurring ? form.recurrenceDays : undefined,
        recurrenceEnd:  form.isRecurring ? form.recurrenceEnd  : undefined,
      };

      if (isEdit) {
        await sessionsService.update(session.id, payload);
        if (attDirty) {
          await sessionExtrasService.saveAttendance(
            session.id,
            Object.entries(attDraft).map(([athleteId, status]) => ({ athleteId, status }))
          );
        }
        if (resultsPayload) await sessionExtrasService.saveResults(session.id, resultsPayload);

        qc.invalidateQueries({ queryKey: ["attendance-session", session.id] });
        qc.invalidateQueries({ queryKey: ["session-results", session.id] });
        qc.invalidateQueries({ queryKey: ["sessions-today"] });
        toast.success(t("sessionModal.toastSaved"));
      } else {
        const res = await sessionsService.create(payload);
        const count = res.data?.sessions?.length;
        toast.success(count ? t("sessionForm.toastCreatedMultiple", { count }) : t("sessionForm.toastCreatedSingle"));
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor يعرض الخطأ */ } finally { setLoading(false); }
  };

  // مشاركة ملخص الحصة عبر واتساب
  const handleWhatsApp = () => {
    const lines = [`*${form.title || session?.title || ""}*`];
    if (form.sessionDate) lines.push(`📅 ${form.sessionDate}`);
    if (form.startTime)   lines.push(`🕐 ${form.startTime} – ${form.endTime}`);
    if (session?.room_name) lines.push(`🏛️ ${session.room_name}`);
    if (isCompetition) {
      const names = Object.fromEntries(athletesList.map(a => [a.id, a.full_name]));
      const shown = resultRows.filter(r => r.athleteId);
      if (shown.length) {
        lines.push("", t("sessionModal.shareResultsTitle"));
        shown.forEach(r => {
          const parts = [
            r.medal ? MEDAL_ICON[r.medal] : (r.rank ? `#${r.rank}` : "•"),
            names[r.athleteId] || "",
            r.specialty, r.result,
          ].filter(Boolean);
          lines.push(parts.join(" — "));
        });
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
  };

  if (!open) return null;

  const tabs = [
    { id: "schedule",   label: t("sessionModal.tabSchedule") },
    ...(isEdit ? [{ id: "attendance", label: t("sessionModal.tabAttendance") }] : []),
    ...(isEdit && isCompetition ? [{ id: "results", label: t("sessionModal.tabResults") }] : []),
  ];

  const typeChoices = [
    { id: "training",    label: t("sessionModal.typeTraining"),    icon: "🏋️" },
    { id: "competition", label: t("sessionModal.typeCompetition"), icon: "🏆" },
  ];

  const iconBtn = (color) => ({
    width: 46, height: 46, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "var(--card)", border: "1px solid var(--border)", color,
  });

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
        padding: isMobile ? 0 : 20,
      }}
    >
      <div role="dialog" aria-modal="true" style={{
        width: "100%", maxWidth: 580, background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: isMobile ? "20px 20px 0 0" : "var(--radius)",
        maxHeight: isMobile ? "94dvh" : "90vh", display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      }}>
        {/* ── الرأس ── */}
        <div style={{ padding: "18px 20px 8px", position: "relative", flexShrink: 0 }}>
          <button type="button" onClick={requestClose} aria-label={t("sessionModal.close")} style={{
            position: "absolute", top: 14, insetInlineEnd: 14,
            width: 34, height: 34, border: "none", background: "transparent",
            color: "var(--muted-lt)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><IconX size={22} /></button>
          <div style={{ paddingInlineEnd: 40 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>
              {isEdit ? t("sessionForm.editTitle") : t("sessionForm.addTitle")}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {isEdit ? t("sessionModal.subtitleEdit") : t("sessionModal.subtitleAdd")}
            </div>
          </div>
        </div>

        {/* ── التبويبات (حبوب) ── */}
        {tabs.length > 1 && (
          <div style={{ padding: "8px 20px 12px", flexShrink: 0 }}>
            <div role="tablist" style={{
              display: "flex", gap: 4, padding: 4, borderRadius: 999,
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              {tabs.map(tb => (
                <button key={tb.id} type="button" role="tab" aria-selected={tab === tb.id}
                  onClick={() => setTab(tb.id)} style={{
                    flex: 1, padding: "11px 8px", borderRadius: 999, border: "none",
                    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    background: tab === tb.id ? "var(--accent)" : "transparent",
                    color: tab === tb.id ? "#0d0f14" : "var(--muted-lt)",
                    transition: "all 0.15s", whiteSpace: "nowrap",
                  }}>{tb.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── المحتوى القابل للتمرير ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 16px", WebkitOverflowScrolling: "touch" }}>
          {tab === "schedule" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* نوع الحصة */}
              <div>
                <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 8 }}>
                  {t("sessionModal.sessionType")}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {typeChoices.map(c => {
                    const on = form.sessionType === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => setForm(p => ({ ...p, sessionType: c.id }))}
                        aria-pressed={on} style={{
                          padding: "12px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                          border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                          background: on ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface)",
                          color: on ? "var(--accent)" : "var(--muted-lt)",
                        }}>
                        <span>{c.icon}</span>{c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Section title={t("sessionForm.sectionBasic")} />

              <Input label={t("sessionForm.sessionTitle")} placeholder={t("sessionForm.sessionTitlePlaceholder")} value={form.title} onChange={set("title")} error={errors.title} />

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <Select label={t("sessionForm.coach")} options={coachOptions} value={form.coachId} onChange={set("coachId")} error={errors.coachId} />
                <Select label={t("sessionForm.category")} options={categoryOptions} value={form.categoryId} onChange={set("categoryId")} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 8 }}>
                  {t("sessionForm.ageCategoryLabel")} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{t("sessionForm.ageCategoryHint")}</span>
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {AGE_CATEGORIES.map(c => (
                    <button key={c.value} type="button" onClick={() => toggleAgeCategory(c.value)} style={{
                      padding: "6px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
                      border: "1px solid " + (form.ageCategories.includes(c.value) ? "var(--accent)" : "var(--border)"),
                      background: form.ageCategories.includes(c.value) ? "var(--accent)20" : "var(--card)",
                      color: form.ageCategories.includes(c.value) ? "var(--accent)" : "var(--muted)",
                      cursor: "pointer", fontFamily: "'Sora', sans-serif",
                    }}>{AGE_CATEGORY_LABELS[c.value]}</button>
                  ))}
                </div>
              </div>

              {/* ✅ الأفواج لكل فئة عمرية محدَّدة */}
              {form.ageCategories.length > 0 && (
                <div style={{
                  border: "1px solid var(--border)", background: "var(--surface)",
                  borderRadius: "var(--radius-sm)", padding: isMobile ? 10 : 12,
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 600 }}>
                      👥 {t("sessionForm.groupsTitle")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>
                      {t("sessionForm.groupsHint")}
                    </div>
                  </div>
                  {form.ageCategories.map(cat => {
                    const sel = form.ageGroups[cat] || [];
                    const chip = (on) => ({
                      minHeight: 34, padding: "6px 12px", fontSize: 12, borderRadius: 999,
                      border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
                      background: on ? "var(--accent)20" : "var(--card)",
                      color: on ? "var(--accent)" : "var(--muted)",
                      cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: on ? 600 : 400,
                    });
                    return (
                      <div key={cat} style={{
                        display: "flex", flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 6 : 12,
                      }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: "var(--text)",
                          minWidth: isMobile ? 0 : 84, flexShrink: 0,
                        }}>{AGE_CATEGORY_LABELS[cat] || cat}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => clearGroups(cat)} style={chip(sel.length === 0)}>
                            {t("sessionForm.groupsAll")}
                          </button>
                          {SESSION_GROUPS.map(g => (
                            <button key={g} type="button" onClick={() => toggleGroup(cat, g)} style={chip(sel.includes(g))}>
                              {t("memberForm.groupLabel", { num: g.replace(/\D/g, "") })}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <Select label={t("sessionForm.room")} options={roomOptions} value={form.roomId} onChange={set("roomId")} />
                <Input label={t("sessionForm.capacity")} type="number" min="1" value={form.capacity} onChange={set("capacity")} />
              </div>

              <Section title={t("sessionForm.sectionTiming")} />

              {!isEdit && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-lt)", cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(p => ({ ...p, isRecurring: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
                  {t("sessionForm.recurringToggle")}
                </label>
              )}

              {!form.isRecurring ? (
                <Input label={t("sessionForm.sessionDate")} type="date" value={form.sessionDate} onChange={set("sessionDate")} error={errors.sessionDate} />
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 8 }}>
                      {t("sessionForm.recurrenceDays")} {errors.recurrenceDays && <span style={{ color: "var(--danger)", fontSize: 11 }}>— {errors.recurrenceDays}</span>}
                    </label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {DAYS.map(d => (
                        <button key={d.value} type="button" onClick={() => toggleDay(d.value)} style={{
                          padding: "6px 12px", fontSize: 12, borderRadius: "var(--radius-sm)",
                          border: "1px solid " + (form.recurrenceDays.includes(d.value) ? "var(--accent)" : "var(--border)"),
                          background: form.recurrenceDays.includes(d.value) ? "var(--accent)20" : "var(--card)",
                          color: form.recurrenceDays.includes(d.value) ? "var(--accent)" : "var(--muted)",
                          cursor: "pointer", fontFamily: "'Sora', sans-serif",
                        }}>{d.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label={t("sessionForm.fromDate")} type="date" value={form.sessionDate}   onChange={set("sessionDate")} />
                    <Input label={t("sessionForm.toDate")}   type="date" value={form.recurrenceEnd} onChange={set("recurrenceEnd")} error={errors.recurrenceEnd} />
                  </div>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <TimeSelect label={t("sessionForm.startTime")} value={form.startTime} onChange={set("startTime")} error={errors.startTime} timeOptions={TIME_OPTIONS} />
                <TimeSelect label={t("sessionForm.endTime")}   value={form.endTime}   onChange={set("endTime")}   error={errors.endTime}   timeOptions={TIME_OPTIONS} />
              </div>

              <Input label={t("sessionForm.notes")} placeholder={t("sessionForm.notesPlaceholder")} value={form.description} onChange={set("description")} />
            </div>
          )}

          {tab === "attendance" && isEdit && (
            <AttendancePanel sessionId={session.id} draft={attDraft} setDraft={setAttDraft} />
          )}

          {tab === "results" && isEdit && isCompetition && (
            <ResultsPanel athletes={athletesList} rows={resultRows} setRows={setRows}
              loading={resultsLoading} errors={resultErrors} />
          )}
        </div>

        {/* ── التذييل ── */}
        <div style={{
          flexShrink: 0, padding: "12px 20px calc(14px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--border)", background: "var(--card)",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          {isEdit && (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
              {onDelete && (
                <button type="button" onClick={() => onDelete(session)} title={t("sessionModal.cancelSession")}
                  aria-label={t("sessionModal.cancelSession")} style={{ ...iconBtn("var(--danger)"), border: "none", background: "transparent" }}>
                  <IconTrash size={22} />
                </button>
              )}
              <button type="button" onClick={handleWhatsApp} title={t("sessionModal.shareWhatsApp")}
                aria-label={t("sessionModal.shareWhatsApp")} style={iconBtn("#25D366")}>
                <IconWhatsApp size={22} />
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={requestClose} disabled={loading}
              style={{ flex: 1, justifyContent: "center", borderRadius: 999, minHeight: 48 }}>
              {t("sessionModal.close")}
            </Button>
            <Button onClick={handleSubmit} loading={loading}
              style={{ flex: 1.3, justifyContent: "center", borderRadius: 999, minHeight: 48, fontWeight: 800 }}>
              {isEdit ? t("sessionModal.save") : t("sessionForm.createSession")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
