// src/components/sessions/SessionForm.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button } from "@/components/ui";
import { sessionsService } from "@/services/sessions.service";
import { roomsService } from "@/services/rooms.service";
import { categoriesService } from "@/services/categories.service";
import { staffService } from "@/services/staff.service";
import toast from "react-hot-toast";

// ✅ الأيام والوقت — دوال تعتمد على الترجمة الحالية بدل ثوابت خارجية
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

const AGE_CATEGORIES = [
  { value: "مدارس" },  { value: "كتاكيت" },
  { value: "براعم" },  { value: "أصاغر" },
  { value: "أشبال" },  { value: "أواسط" },
  { value: "أمال" },   { value: "أكابر" },
];

// ✅ إصلاح: .toISOString() يحوّل للتوقيت العالمي (UTC) لا المحلي
// في الجزائر (UTC+1)، هذا يُسبب ظهور تاريخ الأمس خلال الساعة 00:00-01:00
function toLocalDateString(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = () => toLocalDateString(new Date());

const EMPTY = {
  title: "", description: "", sessionDate: today(),
  startTime: "08:00", endTime: "09:00",
  capacity: "20", coachId: "", roomId: "", categoryId: "",
  ageCategories: [],
  isRecurring: false, recurrenceDays: [], recurrenceEnd: "",
};

function Section({ title }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginTop: 8 }}>
      {title}
    </div>
  );
}

export default function SessionForm({ open, onClose, session, onSuccess }) {
  const { t } = useTranslation();
  const DAYS = getDays(t);
  const TIME_OPTIONS = getTimeOptions(t);
  // ✅ نفس نمط الفئات في MemberForm: القيمة (value) تبقى بالعربية دائماً
  // لمطابقة ما يُخزَّن في قاعدة البيانات، فقط التسمية تُترجم
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

  const { data: roomsData }    = useQuery({ queryKey: ["rooms"],      queryFn: roomsService.getAll,      enabled: open });
  const { data: categoriesData}= useQuery({ queryKey: ["categories"], queryFn: categoriesService.getAll, enabled: open });
  const { data: coachesData }  = useQuery({
    queryKey: ["coaches-list"],
    queryFn: () => staffService.getAll(),
    enabled: open,
  });

  const rooms      = (roomsData?.data      || []).filter(r => r.is_active);
  const categories = categoriesData?.data  || [];
  const coaches    = (coachesData?.data    || []).filter(c => c.is_active);

  const ROLE_LABELS = { owner: t("common.owner"), coach: t("common.coach"), assistant: t("common.assistant") };
  const roomOptions     = [{ value: "", label: t("sessionForm.roomSelect") }, ...rooms.map(r => ({ value: r.id, label: `${r.name} (${r.capacity} ${t("sessionForm.roomSeats")})` }))];
  const categoryOptions = [{ value: "", label: t("sessionForm.categorySelect") }, ...categories.map(c => ({ value: c.id, label: c.name }))];
  const coachOptions    = [{ value: "", label: t("sessionForm.coachSelect") }, ...coaches.map(c => ({ value: c.id, label: `${c.full_name} (${ROLE_LABELS[c.role] || c.role})` }))];

  useEffect(() => {
    if (!open) return;
    if (session) {
      setForm({
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
        isRecurring: false,
        recurrenceDays: [],
        recurrenceEnd: "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, session]);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleDay = (d) => setForm(p => ({
    ...p,
    recurrenceDays: p.recurrenceDays.includes(d)
      ? p.recurrenceDays.filter(x => x !== d)
      : [...p.recurrenceDays, d],
  }));
  const toggleAgeCategory = (v) => setForm(p => ({
    ...p,
    ageCategories: p.ageCategories.includes(v)
      ? p.ageCategories.filter(x => x !== v)
      : [...p.ageCategories, v],
  }));

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

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);

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

    try {
      const payload = {
        ...form,
        startTime: toTime24(form.startTime),
        endTime:   toTime24(form.endTime),
        capacity:      Number(form.capacity),
        recurrenceDays: form.isRecurring ? form.recurrenceDays : undefined,
        recurrenceEnd:  form.isRecurring ? form.recurrenceEnd  : undefined,
      };
      if (isEdit) {
        await sessionsService.update(session.id, payload);
        toast.success(t("sessionForm.toastUpdated"));
      } else {
        const res = await sessionsService.create(payload);
        const count = res.data?.sessions?.length;
        toast.success(count ? t("sessionForm.toastCreatedMultiple", { count }) : t("sessionForm.toastCreatedSingle"));
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("sessionForm.editTitle") : t("sessionForm.addTitle")} width={540}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <Section title={t("sessionForm.sectionBasic")} />

        <Input label={t("sessionForm.sessionTitle")} placeholder={t("sessionForm.sessionTitlePlaceholder")} value={form.title} onChange={set("title")} error={errors.title} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label={t("sessionForm.room")} options={roomOptions} value={form.roomId} onChange={set("roomId")} />
          <Input label={t("sessionForm.capacity")} type="number" min="1" value={form.capacity} onChange={set("capacity")} />
        </div>

        <Section title={t("sessionForm.sectionTiming")} />

        {/* Toggle تكرار */}
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

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("sessionForm.cancel")}</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? t("sessionForm.saveChanges") : t("sessionForm.createSession")}</Button>
        </div>
      </div>
    </Modal>
  );
}
