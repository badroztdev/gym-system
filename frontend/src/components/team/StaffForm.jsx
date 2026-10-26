// src/components/team/StaffForm.jsx
// إضافة/تعديل مدرب أو مساعد: البيانات + صلاحيات النظام + نطاق البيانات
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Input, Select, Button } from "@/components/ui";
import { staffService } from "@/services/staff.service";
import { categoriesService } from "@/services/categories.service";
import {
  PERMISSION_GROUPS, ALL_PERMISSIONS, VIEW_ONLY_PERMISSIONS,
  AGE_CATEGORY_VALUES, GROUP_VALUES,
} from "@/utils/permissions";
import toast from "react-hot-toast";

function useIsMobile(bp = 640) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

const EMPTY = {
  fullName: "", phone: "", email: "", role: "coach", password: "",
  permMode: "default",           // default | custom
  perms: [],                     // عند التخصيص
  categories: [], ageCategories: [], groups: [],
};

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em",
      borderBottom: "1px solid var(--border)", paddingBottom: 6, marginTop: 6,
    }}>{children}</div>
  );
}

// زر شريحة قابلة للتبديل
function Chip({ on, onClick, children, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} style={{
      minHeight: 34, padding: "6px 12px", fontSize: 12, borderRadius: 999,
      border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
      background: on ? "var(--accent)20" : "var(--card)",
      color: on ? "var(--accent)" : "var(--muted)",
      fontWeight: on ? 700 : 400, cursor: disabled ? "default" : "pointer",
      fontFamily: "'Sora', sans-serif", opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}

export default function StaffForm({ open, onClose, staff, onSuccess }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isEdit = !!staff;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY);
  const initial = useRef(JSON.stringify(EMPTY));

  const ROLES = [
    { value: "coach",     label: t("staffForm.roleCoach") },
    { value: "assistant", label: t("staffForm.roleAssistant") },
  ];

  const { data: catData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll(),
    enabled: open,
  });
  const sportCategories = (catData?.data || []).filter(c => c.is_active !== false);

  const AGE_LABELS = {
    "مدارس": t("members.categorySchools"), "كتاكيت": t("members.categoryChicks"),
    "براعم": t("members.categoryBuds"), "أصاغر": t("members.categoryYoungCubs"),
    "أشبال": t("members.categoryCubs"), "أواسط": t("members.categoryMids"),
    "أمال": t("members.categoryHopes"), "أكابر": t("members.categorySeniors"),
  };

  // تهيئة النموذج عند الفتح
  useEffect(() => {
    if (!open) return;
    let next = EMPTY;
    if (staff) {
      const sc = staff.access_scope || {};
      next = {
        fullName: staff.full_name || "", phone: staff.phone || "", email: staff.email || "",
        role: staff.role || "coach", password: "",
        permMode: Array.isArray(staff.permissions) ? "custom" : "default",
        perms: Array.isArray(staff.permissions) ? staff.permissions : [],
        categories: sc.categories || [], ageCategories: sc.ageCategories || [], groups: sc.groups || [],
      };
    }
    setForm(next);
    initial.current = JSON.stringify(next);
    setErrors({});
  }, [open, staff]);

  const dirty = JSON.stringify(form) !== initial.current;
  const requestClose = () => {
    if (dirty && !loading && !window.confirm(t("sessionModal.discardConfirm"))) return;
    onClose();
  };

  // إغلاق بمفتاح Esc + منع تمرير الصفحة خلف النافذة
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  });

  if (!open) return null;

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
  const toggleIn = (field, value) => setForm(p => ({
    ...p,
    [field]: p[field].includes(value) ? p[field].filter(x => x !== value) : [...p[field], value],
  }));

  // تبديل صلاحية: أي إجراء غير "عرض" يفعّل "عرض"، وإلغاء "عرض" يلغي كل إجراءات القسم
  const togglePerm = (group, action) => setForm(p => {
    const key = `${group.id}.${action}`;
    const viewKey = `${group.id}.view`;
    const has = p.perms.includes(key);
    let next = new Set(p.perms);
    if (has) {
      next.delete(key);
      if (action === "view") group.actions.forEach(a => next.delete(`${group.id}.${a}`));
    } else {
      next.add(key);
      if (action !== "view") next.add(viewKey);
    }
    return { ...p, perms: [...next] };
  });
  const setPerms = (list) => setForm(p => ({ ...p, perms: list }));

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = t("staffForm.errorFullName");
    if (!form.phone.trim())    e.phone = t("staffForm.errorPhone");
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      const hasScope = form.categories.length || form.ageCategories.length || form.groups.length;
      const payload = {
        fullName: form.fullName, phone: form.phone, email: form.email, role: form.role,
        permissions: form.permMode === "custom" ? form.perms : null,
        accessScope: hasScope
          ? { categories: form.categories, ageCategories: form.ageCategories, groups: form.groups }
          : null,
      };
      if (form.password) payload.password = form.password;

      if (isEdit) {
        await staffService.update(staff.id, payload);
        toast.success(t("staffForm.toastUpdated"));
      } else {
        await staffService.create(payload);
        toast.success(t("staffForm.toastCreated"));
      }
      onSuccess?.();
      onClose();
    } catch { /* interceptor */ } finally { setLoading(false); }
  };

  const modeBtn = (id, label) => {
    const on = form.permMode === id;
    return (
      <button key={id} type="button" aria-pressed={on}
        onClick={() => setForm(p => ({ ...p, permMode: id, perms: id === "custom" && !p.perms.length ? [...VIEW_ONLY_PERMISSIONS] : p.perms }))}
        style={{
          flex: 1, padding: "11px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
          fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
          background: on ? "var(--accent)15" : "var(--surface)",
          color: on ? "var(--accent)" : "var(--muted-lt)",
        }}>{label}</button>
    );
  };

  const custom = form.permMode === "custom";
  const hasScope = form.categories.length || form.ageCategories.length || form.groups.length;
  const ACTION_LABEL = (a) => t(`staffForm.action${a[0].toUpperCase()}${a.slice(1)}`);
  const MODULE_LABEL = (id) => t(`staffForm.module${id[0].toUpperCase()}${id.slice(1)}`);

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
        width: "100%", maxWidth: 720, background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: isMobile ? "20px 20px 0 0" : "var(--radius)",
        maxHeight: isMobile ? "94dvh" : "92vh", display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      }}>
        {/* الرأس */}
        <div style={{ padding: "18px 20px 10px", position: "relative", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
          <button type="button" onClick={requestClose} aria-label={t("staffForm.close")} style={{
            position: "absolute", top: 14, insetInlineEnd: 14, width: 34, height: 34,
            border: "none", background: "transparent", color: "var(--muted-lt)",
            cursor: "pointer", fontSize: 22, lineHeight: 1,
          }}>✕</button>
          <div style={{ paddingInlineEnd: 40 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>
              {isEdit ? t("staffForm.editTitle", { name: staff?.full_name }) : t("staffForm.addTitle")}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {isEdit ? t("staffForm.subtitleEdit") : t("staffForm.subtitleAdd")}
            </div>
          </div>
        </div>

        {/* المحتوى */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 18px", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <SectionTitle>{t("staffForm.sectionBasic")}</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Input label={t("staffForm.fullName")} placeholder={t("staffForm.fullNamePlaceholder")} value={form.fullName} onChange={set("fullName")} error={errors.fullName} />
              <Input label={t("staffForm.phone")} placeholder="0550000000" value={form.phone} onChange={set("phone")} error={errors.phone} type="tel" />
              <Input label={t("staffForm.email")} placeholder={t("staffForm.emailPlaceholder")} value={form.email} onChange={set("email")} type="email" />
              <Select label={t("staffForm.role")} options={ROLES} value={form.role} onChange={set("role")} />
            </div>
            <Input
              label={isEdit ? t("staffForm.passwordEdit") : t("staffForm.passwordAdd")}
              placeholder={isEdit ? t("staffForm.passwordEditPlaceholder") : t("staffForm.passwordAddPlaceholder")}
              value={form.password} onChange={set("password")} type="password"
            />
            {!isEdit && (
              <p style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6, margin: 0 }}>
                {t("staffForm.helpPassword")}
              </p>
            )}

            {/* ═══ الصلاحيات ═══ */}
            <SectionTitle>🔐 {t("staffForm.sectionPermissions")}</SectionTitle>
            <div style={{ display: "flex", gap: 8 }}>
              {modeBtn("default", t("staffForm.permModeDefault"))}
              {modeBtn("custom", t("staffForm.permModeCustom"))}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              {custom ? t("staffForm.permCustomHint") : t("staffForm.permDefaultHint")}
            </p>

            {custom && (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip on={false} onClick={() => setPerms([...ALL_PERMISSIONS])}>{t("staffForm.presetAll")}</Chip>
                  <Chip on={false} onClick={() => setPerms([...VIEW_ONLY_PERMISSIONS])}>{t("staffForm.presetViewOnly")}</Chip>
                  <Chip on={false} onClick={() => setPerms([])}>{t("staffForm.presetNone")}</Chip>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                  {PERMISSION_GROUPS.map(g => {
                    const hasView = form.perms.includes(`${g.id}.view`);
                    return (
                      <div key={g.id} style={{
                        background: "var(--surface)", border: "1px solid " + (hasView ? "var(--accent)40" : "var(--border)"),
                        borderRadius: "var(--radius-sm)", padding: 12,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{g.icon}</span>{MODULE_LABEL(g.id)}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {g.actions.map(a => (
                            <Chip key={a} on={form.perms.includes(`${g.id}.${a}`)} onClick={() => togglePerm(g, a)}>
                              {ACTION_LABEL(a)}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {form.perms.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--warning)", margin: 0 }}>⚠️ {t("staffForm.noPermsWarn")}</p>
                )}
              </>
            )}

            {/* ═══ نطاق البيانات ═══ */}
            <SectionTitle>🎯 {t("staffForm.sectionScope")}</SectionTitle>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{t("staffForm.scopeHint")}</p>

            <div>
              <div style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 600, marginBottom: 8 }}>🏷️ {t("staffForm.scopeCategories")}</div>
              {sportCategories.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("staffForm.scopeNone")}</div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sportCategories.map(c => (
                    <Chip key={c.id} on={form.categories.includes(c.id)} onClick={() => toggleIn("categories", c.id)}>{c.name}</Chip>
                  ))}
                </div>
              )}
              {form.categories.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{t("staffForm.scopeCategoryNote")}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 600, marginBottom: 8 }}>🎂 {t("staffForm.scopeAges")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AGE_CATEGORY_VALUES.map(v => (
                  <Chip key={v} on={form.ageCategories.includes(v)} onClick={() => toggleIn("ageCategories", v)}>{AGE_LABELS[v]}</Chip>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 600, marginBottom: 8 }}>👥 {t("staffForm.scopeGroups")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {GROUP_VALUES.map(g => (
                  <Chip key={g} on={form.groups.includes(g)} onClick={() => toggleIn("groups", g)}>
                    {t("memberForm.groupLabel", { num: g.replace(/\D/g, "") })}
                  </Chip>
                ))}
              </div>
            </div>

            <div style={{
              fontSize: 12, padding: "10px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6,
              background: hasScope ? "var(--accent)10" : "var(--surface)",
              border: "1px solid " + (hasScope ? "var(--accent)40" : "var(--border)"),
              color: hasScope ? "var(--accent)" : "var(--muted)",
            }}>
              {hasScope ? `🔒 ${t("staffForm.scopeSummary")}` : `🌐 ${t("staffForm.scopeUnrestricted")}`}
            </div>
          </div>
        </div>

        {/* التذييل */}
        <div style={{
          flexShrink: 0, padding: "12px 20px", borderTop: "1px solid var(--border)",
          background: "var(--card)", display: "flex", gap: 10,
          flexDirection: isMobile ? "column-reverse" : "row", justifyContent: "flex-end",
        }}>
          <Button variant="secondary" onClick={requestClose} disabled={loading} style={isMobile ? { justifyContent: "center", width: "100%" } : undefined}>
            {t("staffForm.cancel")}
          </Button>
          <Button onClick={handleSubmit} loading={loading} style={isMobile ? { justifyContent: "center", width: "100%" } : undefined}>
            {isEdit ? t("staffForm.saveChanges") : t("staffForm.addMember")}
          </Button>
        </div>
      </div>
    </div>
  );
}
