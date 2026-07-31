// src/components/sessions/SessionForm.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button } from "@/components/ui";
import { sessionsService } from "@/services/sessions.service";
import { roomsService } from "@/services/rooms.service";
import { categoriesService } from "@/services/categories.service";
import { staffService } from "@/services/staff.service";
import toast from "react-hot-toast";

const DAYS = [
  { value: 0, label: "أحد" },
  { value: 1, label: "اثنين" },
  { value: 2, label: "ثلاثاء" },
  { value: 3, label: "أربعاء" },
  { value: 4, label: "خميس" },
  { value: 5, label: "جمعة" },
  { value: 6, label: "سبت" },
];

// خيارات الوقت 24 ساعة بخطوة 30 دقيقة
const TIME_OPTIONS = (() => {
  const opts = [{ value: "", label: "-- اختر الوقت --" }];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
    }
  }
  return opts;
})();

function TimeSelect({ label, value, onChange, error }) {
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
        {TIME_OPTIONS.map(o => (
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
  { value: "",        label: "-- كل الفئات --" },
  { value: "مدارس",  label: "مدارس" },
  { value: "براعم",  label: "براعم" },
  { value: "أصاغر",  label: "أصاغر" },
  { value: "أشبال",  label: "أشبال" },
  { value: "أواسط",  label: "أواسط" },
  { value: "أمال",   label: "أمال" },
  { value: "أكابر",  label: "أكابر" },
];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  title: "", description: "", sessionDate: today(),
  startTime: "08:00", endTime: "09:00",
  capacity: "20", coachId: "", roomId: "", categoryId: "",
  ageCategory: "",
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

  const ROLE_LABELS = { owner: "المالك", coach: "مدرب", assistant: "مساعد مدرب" };
  const roomOptions     = [{ value: "", label: "-- بدون قاعة --" }, ...rooms.map(r => ({ value: r.id, label: `${r.name} (${r.capacity} مقعد)` }))];
  const categoryOptions = [{ value: "", label: "-- بدون فئة --" }, ...categories.map(c => ({ value: c.id, label: c.name }))];
  const coachOptions    = [{ value: "", label: "-- اختر المدرب --" }, ...coaches.map(c => ({ value: c.id, label: `${c.full_name} (${ROLE_LABELS[c.role] || c.role})` }))];

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
        ageCategory: session.age_category || "",
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

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "العنوان مطلوب";
    if (!form.coachId)      e.coachId = "المدرب مطلوب";
    if (!form.sessionDate)  e.sessionDate = "التاريخ مطلوب";
    if (!form.startTime)    e.startTime = "وقت البداية مطلوب";
    if (!form.endTime)      e.endTime = "وقت النهاية مطلوب";
    if (form.startTime && form.endTime && form.startTime >= form.endTime)
      e.endTime = "وقت النهاية يجب أن يكون بعد وقت البداية";
    if (form.isRecurring && !form.recurrenceDays.length) e.recurrenceDays = "اختر يوماً واحداً على الأقل";
    if (form.isRecurring && !form.recurrenceEnd) e.recurrenceEnd = "تاريخ الانتهاء مطلوب";
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
        toast.success("تم تحديث الحصة ✅");
      } else {
        const res = await sessionsService.create(payload);
        const count = res.data?.sessions?.length;
        toast.success(count ? `تم إنشاء ${count} حصة بنجاح ✅` : "تم إنشاء الحصة ✅");
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "تعديل الحصة" : "حصة جديدة"} width={540}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <Section title="المعلومات الأساسية" />

        <Input label="عنوان الحصة *" placeholder="مثال: تدريب كمال الأجسام" value={form.title} onChange={set("title")} error={errors.title} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="المدرب *" options={coachOptions} value={form.coachId} onChange={set("coachId")} error={errors.coachId} />
          <Select label="الفئة الرياضية" options={categoryOptions} value={form.categoryId} onChange={set("categoryId")} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="الفئة العمرية" options={AGE_CATEGORIES} value={form.ageCategory} onChange={set("ageCategory")} />
          <Select label="القاعة" options={roomOptions} value={form.roomId} onChange={set("roomId")} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <Input label="الطاقة الاستيعابية" type="number" min="1" value={form.capacity} onChange={set("capacity")} />
        </div>

        <Section title="التوقيت" />

        {/* Toggle تكرار */}
        {!isEdit && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-lt)", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(p => ({ ...p, isRecurring: e.target.checked }))} style={{ cursor: "pointer", width: 16, height: 16 }} />
            حصة متكررة أسبوعياً
          </label>
        )}

        {!form.isRecurring ? (
          <Input label="تاريخ الحصة *" type="date" value={form.sessionDate} onChange={set("sessionDate")} error={errors.sessionDate} />
        ) : (
          <>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500, display: "block", marginBottom: 8 }}>
                أيام التكرار * {errors.recurrenceDays && <span style={{ color: "var(--danger)", fontSize: 11 }}>— {errors.recurrenceDays}</span>}
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
              <Input label="من تاريخ *"     type="date" value={form.sessionDate}   onChange={set("sessionDate")} />
              <Input label="إلى تاريخ *"    type="date" value={form.recurrenceEnd} onChange={set("recurrenceEnd")} error={errors.recurrenceEnd} />
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TimeSelect label="وقت البداية *" value={form.startTime} onChange={set("startTime")} error={errors.startTime} />
          <TimeSelect label="وقت النهاية *" value={form.endTime}   onChange={set("endTime")}   error={errors.endTime} />
        </div>

        <Input label="ملاحظات" placeholder="اختياري" value={form.description} onChange={set("description")} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? "حفظ التغييرات" : "إنشاء الحصة"}</Button>
        </div>
      </div>
    </Modal>
  );
}