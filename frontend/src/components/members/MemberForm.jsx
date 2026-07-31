// src/components/members/MemberForm.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button } from "@/components/ui";
import { membersService } from "@/services/members.service";
import toast from "react-hot-toast";

const ROLES = [
  { value: "athlete",  label: "رياضي" },
  { value: "guardian", label: "ولي أمر" },
];
const GENDERS = [
  { value: "",       label: "-- الجنس --" },
  { value: "male",   label: "ذكر" },
  { value: "female", label: "أنثى" },
];
const AGE_CATEGORIES = [
  { value: "",        label: "-- الفئة --" },
  { value: "مدارس",  label: "مدارس" },
  { value: "براعم",  label: "براعم" },
  { value: "أصاغر",  label: "أصاغر" },
  { value: "أشبال",  label: "أشبال" },
  { value: "أواسط",  label: "أواسط" },
  { value: "أمال",   label: "أمال" },
  { value: "أكابر",  label: "أكابر" },
];
const BLOOD_GROUPS = [
  { value: "",    label: "-- زمرة الدم --" },
  { value: "A+",  label: "A+" },
  { value: "A-",  label: "A-" },
  { value: "B+",  label: "B+" },
  { value: "B-",  label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+",  label: "O+" },
  { value: "O-",  label: "O-" },
];

const EMPTY_FORM = {
  fullName: "", phone: "", email: "", gender: "",
  dateOfBirth: "", role: "athlete", ageCategory: "",
  rank: "", weightKg: "", bloodGroup: "", guardianId: "", groupName: "",
};

function Section({ title }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: "var(--accent)",
      letterSpacing: "0.08em",
      borderBottom: "1px solid var(--border)", paddingBottom: 6,
      marginTop: 8,
    }}>{title}</div>
  );
}

export default function MemberForm({ open, onClose, member, onSuccess }) {
  const isEdit = !!member;
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [form,    setForm]    = useState(EMPTY_FORM);

  // ── المشكلة كانت هنا: useState لا يتحدث عند تغيير member ──
  // الحل: useEffect يملأ الفورم في كل مرة يُفتح فيها النموذج
  useEffect(() => {
    if (!open) return;
    if (member) {
      setForm({
        fullName:    member.full_name                  || "",
        phone:       member.phone                      || "",
        email:       member.email                      || "",
        gender:      member.gender                     || "",
        dateOfBirth: member.date_of_birth?.slice(0,10) || "",
        role:        member.role                       || "athlete",
        ageCategory: member.age_category               || "",
        rank:        member.rank                       || "",
        groupName:   member.group_name                  || "",
        weightKg:    member.weight_kg != null ? String(member.weight_kg) : "",
        bloodGroup:  member.blood_group                || "",
        guardianId:  "", // سيُعبّى أدناه من بيانات العضو الكاملة عند التعديل
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [open, member]);

  // ── عند التعديل: جلب بيانات العضو الكاملة لمعرفة ولي الأمر الحالي ──
  const { data: memberDetail } = useQuery({
    queryKey: ["member-detail", member?.id],
    queryFn:  () => membersService.getOne(member.id),
    enabled:  open && isEdit && !!member?.id && member.role === "athlete",
  });

  useEffect(() => {
    const guardian = memberDetail?.data?.currentGuardian;
    if (guardian) {
      setForm(f => ({ ...f, guardianId: guardian.id }));
    }
  }, [memberDetail]);

  // ── جلب قائمة أولياء الأمور (لربط الرياضي بولي أمره) ─────────
  const { data: guardiansData } = useQuery({
    queryKey: ["guardians-list"],
    queryFn:  () => membersService.getAll({ role: "guardian", limit: 100 }),
    enabled:  open && form.role === "athlete",
  });
  const guardians = guardiansData?.data || [];
  const guardianOptions = [
    { value: "", label: "-- بدون ولي أمر --" },
    ...guardians.map(g => ({ value: g.id, label: `${g.full_name} — ${g.phone}` })),
  ];

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = "الاسم الكامل مطلوب";
    // رقم الهاتف مطلوب فقط إذا لم يكن مرتبطاً بولي أمر
    if (!form.guardianId && !form.phone.trim()) errs.phone = "رقم الهاتف مطلوب";
    if (form.weightKg && isNaN(Number(form.weightKg)))
      errs.weightKg = "يجب أن يكون رقماً";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const payload = {
        ...form,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
      };
      if (isEdit) {
        await membersService.update(member.id, payload);
        toast.success("تم تحديث بيانات العضو ✅");
      } else {
        await membersService.create(payload);
        toast.success("تم إضافة العضو بنجاح ✅");
      }
      onSuccess?.();
      onClose();
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `تعديل: ${member?.full_name}` : "إضافة عضو جديد"}
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <Section title="المعلومات الأساسية" />

        <Input
          label="الاسم الكامل *"
          placeholder="مثال: محمد بن علي"
          value={form.fullName}
          onChange={set("fullName")}
          error={errors.fullName}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label={form.guardianId ? "رقم الهاتف (اختياري)" : "رقم الهاتف *"}
            placeholder={form.guardianId ? "يمكن تركه فارغاً" : "0550000000"}
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
            type="tel"
          />
          <Input
            label="البريد الإلكتروني"
            placeholder="example@email.com"
            value={form.email}
            onChange={set("email")}
            type="email"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Select label="الجنس"         options={GENDERS} value={form.gender}      onChange={set("gender")} />
          <Select label="الدور"          options={ROLES}   value={form.role}        onChange={set("role")} />
          <Input  label="تاريخ الميلاد" type="date"       value={form.dateOfBirth} onChange={set("dateOfBirth")} />
        </div>

        <Section title="المعلومات الرياضية" />

        {form.role === "athlete" && (
          <Select
            label="ربط بولي الأمر (اختياري)"
            options={guardianOptions}
            value={form.guardianId}
            onChange={set("guardianId")}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select
            label="الفئة العمرية"
            options={AGE_CATEGORIES}
            value={form.ageCategory}
            onChange={set("ageCategory")}
          />
          <Input
            label="الرتبة / المستوى"
            placeholder="مثال: الدرجة الأولى"
            value={form.rank}
            onChange={set("rank")}
          />
        </div>

        <Input
          label="الفوج"
          placeholder="مثال: الفوج 1"
          value={form.groupName}
          onChange={set("groupName")}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label="الوزن (كغ)"
            placeholder="مثال: 72.5"
            value={form.weightKg}
            onChange={set("weightKg")}
            error={errors.weightKg}
            type="number"
            step="0.1"
            min="0"
          />
          <Select
            label="زمرة الدم"
            options={BLOOD_GROUPS}
            value={form.bloodGroup}
            onChange={set("bloodGroup")}
          />
        </div>

        {!isEdit && (
          <p style={{
            fontSize: 11, color: "var(--muted)",
            background: "var(--surface)", padding: "10px 12px",
            borderRadius: "var(--radius-sm)", lineHeight: 1.6,
          }}>
            💡 كلمة المرور الافتراضية هي رقم الهاتف.
            {form.guardianId && " إذا تُرك رقم الهاتف فارغاً، سيتم استخدام اسم الرياضي كأساس لكلمة المرور."}
            {form.guardianId && " سيتمكن ولي الأمر من متابعة هذا الرياضي من حسابه."}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} loading={loading}>
            {isEdit ? "حفظ التغييرات" : "إضافة العضو"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}