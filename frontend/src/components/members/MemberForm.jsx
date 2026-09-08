// src/components/members/MemberForm.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Modal, Input, Select, Button } from "@/components/ui";
import { membersService } from "@/services/members.service";
import toast from "react-hot-toast";

const getRoles = (t) => [
  { value: "athlete",  label: t("members.roleAthlete") },
  { value: "guardian", label: t("members.roleGuardian") },
];
const getGenders = (t) => [
  { value: "",       label: t("memberForm.genderSelect") },
  { value: "male",   label: t("memberForm.male") },
  { value: "female", label: t("memberForm.female") },
];
const getAgeCategories = (t) => [
  { value: "",        label: t("memberForm.ageCategorySelect") },
  { value: "مدارس",  label: t("members.categorySchools") },
  { value: "براعم",  label: t("members.categoryBuds") },
  { value: "أصاغر",  label: t("members.categoryYoungCubs") },
  { value: "أشبال",  label: t("members.categoryCubs") },
  { value: "أواسط",  label: t("members.categoryMids") },
  { value: "أمال",   label: t("members.categoryHopes") },
  { value: "أكابر",  label: t("members.categorySeniors") },
];
const getBloodGroups = (t) => [
  { value: "",    label: t("memberForm.bloodGroupSelect") },
  { value: "A+",  label: "A+" },
  { value: "A-",  label: "A-" },
  { value: "B+",  label: "B+" },
  { value: "B-",  label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+",  label: "O+" },
  { value: "O-",  label: "O-" },
];

// ✅ قائمة الأفواج — القيمة (value) تبقى بالعربية دائماً لمطابقة ما يُخزَّن في قاعدة البيانات
const getGroupNames = (t) => [
  { value: "",        label: t("memberForm.groupSelect") },
  { value: "الفوج 1", label: t("memberForm.groupLabel", { num: 1 }) },
  { value: "الفوج 2", label: t("memberForm.groupLabel", { num: 2 }) },
  { value: "الفوج 3", label: t("memberForm.groupLabel", { num: 3 }) },
  { value: "الفوج 4", label: t("memberForm.groupLabel", { num: 4 }) },
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
  const { t } = useTranslation();
  const ROLES          = getRoles(t);
  const GENDERS        = getGenders(t);
  const AGE_CATEGORIES = getAgeCategories(t);
  const BLOOD_GROUPS   = getBloodGroups(t);
  const GROUP_NAMES    = getGroupNames(t);
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
    { value: "", label: t("memberForm.noGuardian") },
    ...guardians.map(g => ({ value: g.id, label: `${g.full_name} — ${g.phone}` })),
  ];

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = t("memberForm.errorFullName");
    // رقم الهاتف مطلوب فقط إذا لم يكن مرتبطاً بولي أمر
    if (!form.guardianId && !form.phone.trim()) errs.phone = t("memberForm.errorPhone");
    if (form.weightKg && isNaN(Number(form.weightKg)))
      errs.weightKg = t("memberForm.errorWeight");
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
        toast.success(t("memberForm.toastUpdated"));
      } else {
        await membersService.create(payload);
        toast.success(t("memberForm.toastCreated"));
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
      title={isEdit ? t("memberForm.editTitle", { name: member?.full_name }) : t("memberForm.addTitle")}
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <Section title={t("memberForm.sectionBasic")} />

        <Input
          label={t("memberForm.fullName")}
          placeholder={t("memberForm.fullNamePlaceholder")}
          value={form.fullName}
          onChange={set("fullName")}
          error={errors.fullName}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label={form.guardianId ? t("memberForm.phoneOptional") : t("memberForm.phoneRequired")}
            placeholder={form.guardianId ? t("memberForm.phoneOptionalPlaceholder") : t("memberForm.phonePlaceholder")}
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
            type="tel"
          />
          <Input
            label={t("memberForm.email")}
            placeholder={t("memberForm.emailPlaceholder")}
            value={form.email}
            onChange={set("email")}
            type="email"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Select label={t("memberForm.gender")}       options={GENDERS} value={form.gender}      onChange={set("gender")} />
          <Select label={t("memberForm.role")}          options={ROLES}   value={form.role}        onChange={set("role")} />
          <Input  label={t("memberForm.dateOfBirth")}   type="date"       value={form.dateOfBirth} onChange={set("dateOfBirth")} />
        </div>

        <Section title={t("memberForm.sectionSport")} />

        {form.role === "athlete" && (
          <Select
            label={t("memberForm.guardianLink")}
            options={guardianOptions}
            value={form.guardianId}
            onChange={set("guardianId")}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select
            label={t("memberForm.ageCategory")}
            options={AGE_CATEGORIES}
            value={form.ageCategory}
            onChange={set("ageCategory")}
          />
          <Input
            label={t("memberForm.rank")}
            placeholder={t("memberForm.rankPlaceholder")}
            value={form.rank}
            onChange={set("rank")}
          />
        </div>

        <Select
          label={t("memberForm.group")}
          options={GROUP_NAMES}
          value={form.groupName}
          onChange={set("groupName")}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input
            label={t("memberForm.weight")}
            placeholder={t("memberForm.weightPlaceholder")}
            value={form.weightKg}
            onChange={set("weightKg")}
            error={errors.weightKg}
            type="number"
            step="0.1"
            min="0"
          />
          <Select
            label={t("memberForm.bloodGroup")}
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
            {t("memberForm.helpDefaultPassword")}
            {form.guardianId && " " + t("memberForm.helpGuardianPhone")}
            {form.guardianId && " " + t("memberForm.helpGuardianAccess")}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} loading={loading}>
            {isEdit ? t("memberForm.saveChanges") : t("memberForm.addMember")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
