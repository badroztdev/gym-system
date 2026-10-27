// src/components/members/InsuranceExportModal.jsx
// تصدير جدول التأمين (Word): الرقم — الاسم واللقب — تاريخ الميلاد — العنوان
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { userCan } from "@/utils/permissions";
import { Modal, Button, Spinner } from "@/components/ui";
import { buildInsuranceDocx, downloadBlob } from "@/utils/insuranceDocx";

// القيم المخزَّنة بالعربية دائماً؛ فقط العرض يُترجم
const CATEGORY_KEYS = {
  "مدارس": "members.categorySchools", "كتاكيت": "members.categoryChicks",
  "براعم": "members.categoryBuds", "أصاغر": "members.categoryYoungCubs",
  "أشبال": "members.categoryCubs", "أواسط": "members.categoryMids",
  "أمال": "members.categoryHopes", "أكابر": "members.categorySeniors",
};

// نصوص المستند نفسه (مستقلة عن لغة الواجهة — يختارها المستخدم)
const DOC = {
  ar: {
    title: ["قائمة الرياضيين المراد تأمينهم"],
    headers: [["الرقم"], ["الاسم واللقب"], ["تاريخ الميلاد"], ["العنوان"]],
    total: (n) => `العدد الإجمالي: ${n}`,
  },
  fr: {
    title: ["Liste des athlètes à assurer"],
    headers: [["N°"], ["Nom et prénom"], ["Date de naissance"], ["Adresse"]],
    total: (n) => `Total : ${n}`,
  },
  both: {
    title: ["Liste des athlètes à assurer", "قائمة الرياضيين المراد تأمينهم"],
    headers: [["N°", "الرقم"], ["Nom et prénom", "الاسم واللقب"], ["Date de naissance", "تاريخ الميلاد"], ["Adresse", "العنوان"]],
    total: (n) => `Total / العدد الإجمالي : ${n}`,
  },
};

const LS_SEL = "sgms-insurance-selected";
const LS_LANG = "sgms-insurance-lang";

const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : v; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } };

const fmtDate = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const todayLocal = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return { iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, fr: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` };
};

const inputStyle = {
  width: "100%", padding: "7px 10px", fontSize: 12, boxSizing: "border-box",
  background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)",
  borderRadius: 8, outline: "none", fontFamily: "inherit", minWidth: 0,
};

export default function InsuranceExportModal({ open, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = userCan(user, "members.edit");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["insurance-list"],
    queryFn: () => api.get("/members/insurance-list").then((r) => r.data),
    enabled: open,
    staleTime: 0,
  });
  const list = data?.data || [];

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [vals, setVals] = useState({}); // قيم الحقول المعدّلة محلياً { id: {dob,address} }
  const [selected, setSelected] = useState(() => {
    try { return new Set(JSON.parse(lsGet(LS_SEL, "[]"))); } catch { return new Set(); }
  });
  const [docLang, setDocLang] = useState(() => {
    const v = lsGet(LS_LANG, "");
    return ["ar", "fr", "both"].includes(v) ? v : "ar";
  });

  const persistSel = (set) => { setSelected(set); lsSet(LS_SEL, JSON.stringify([...set])); };
  const chooseLang = (l) => { setDocLang(l); lsSet(LS_LANG, l); };

  const valOf = (r) => {
    const v = vals[r.id] || {};
    return {
      dob: v.dob ?? String(r.date_of_birth || "").slice(0, 10),
      address: v.address ?? (r.address || ""),
    };
  };
  const setField = (id, field, value) =>
    setVals((p) => ({ ...p, [id]: { ...(p[id] || {}), [field]: value } }));

  const saveField = async (r, field) => {
    const orig = field === "dob" ? String(r.date_of_birth || "").slice(0, 10) : (r.address || "");
    const cur = (valOf(r)[field] || "").trim();
    if (!cur) { setField(r.id, field, orig); return; } // لا يمكن مسح قيمة محفوظة من هنا
    if (cur === orig) return;
    try {
      await api.patch(`/members/${r.id}`, { [field === "dob" ? "dateOfBirth" : "address"]: cur });
      toast.success(t("members.insuranceSaved"));
      qc.invalidateQueries({ queryKey: ["insurance-list"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch {
      setField(r.id, field, orig); // الخطأ يعرضه المعترض (interceptor)
    }
  };

  const categories = useMemo(
    () => [...new Set(list.map((r) => r.age_category).filter(Boolean))],
    [list]
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) =>
      (!q || r.full_name.toLowerCase().includes(q)) &&
      (!cat || r.age_category === cat) &&
      (!onlyActive || r.has_active_sub)
    );
  }, [list, search, cat, onlyActive]);

  const chosen = list.filter((r) => selected.has(r.id));
  const incomplete = chosen.filter((r) => { const v = valOf(r); return !v.dob || !v.address.trim(); }).length;

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    persistSel(s);
  };
  const selectShown = () => persistSel(new Set([...selected, ...shown.map((r) => r.id)]));
  const clearAll = () => persistSel(new Set());

  const catLabel = (c) => (CATEGORY_KEYS[c] ? t(CATEGORY_KEYS[c]) : c);
  const groupLabel = (g) => {
    const m = String(g || "").match(/(\d+)/);
    return m ? t("memberForm.groupLabel", { num: m[1] }) : g;
  };

  const download = () => {
    if (!chosen.length) { toast.error(t("members.insuranceNoSelection")); return; }
    const d = DOC[docLang];
    const today = todayLocal();
    const rows = chosen.map((r, i) => {
      const v = valOf(r);
      return [String(i + 1), r.full_name, fmtDate(v.dob), v.address.trim()];
    });
    const sub = [[user?.gymName, today.fr].filter(Boolean).join(" — ")];
    const blob = buildInsuranceDocx({
      title: d.title, subtitle: sub, headers: d.headers, rows,
      rtl: docLang === "ar", totalLabel: d.total(rows.length),
    });
    downloadBlob(blob, `assurance-athletes-${today.iso}.docx`);
    toast.success(t("members.insuranceDone"));
  };

  const langOpts = [
    { v: "ar", label: t("members.insuranceLangAr") },
    { v: "fr", label: t("members.insuranceLangFr") },
    { v: "both", label: t("members.insuranceLangBoth") },
  ];

  const chip = (active, color = "var(--accent2)") => ({
    padding: "7px 12px", fontSize: 12, borderRadius: "var(--radius-sm)", cursor: "pointer",
    border: "1px solid " + (active ? color : "var(--border)"),
    background: active ? color + "20" : "var(--card)",
    color: active ? color : "var(--muted)", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap",
  });

  return (
    <Modal open={open} onClose={onClose} title={t("members.insuranceTitle")} width={760}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{t("members.insuranceHint")}</p>

        {/* بحث وفلاتر */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("members.insuranceSearch")}
            style={{ ...inputStyle, flex: "1 1 160px", padding: "9px 12px", fontSize: 13 }}
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...inputStyle, width: "auto", flex: "0 0 auto", padding: "9px 12px", fontSize: 12 }}>
            <option value="">{t("members.allCategories")}</option>
            {categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <button type="button" onClick={() => setOnlyActive((v) => !v)} style={chip(onlyActive, "var(--accent)")}>
            {t("members.insuranceOnlyActive")}
          </button>
        </div>

        {/* أدوات التحديد */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={selectShown} disabled={!shown.length} style={chip(false)}>
            {t("members.insuranceSelectAll", { count: shown.length })}
          </button>
          <button type="button" onClick={clearAll} disabled={!selected.size} style={chip(false, "var(--danger)")}>
            {t("members.insuranceClear")}
          </button>
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, marginInlineStart: "auto" }}>
            {t("members.insuranceSelected", { count: chosen.length, total: list.length })}
          </span>
        </div>

        {/* القائمة */}
        <div style={{
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)",
          maxHeight: "min(46vh, 420px)", overflowY: "auto",
        }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner size={26} /></div>
          ) : isError ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--danger)" }}>{t("members.insuranceLoadError")}</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>{t("members.insuranceNone")}</div>
          ) : shown.map((r) => {
            const on = selected.has(r.id);
            const v = valOf(r);
            const missing = !v.dob || !v.address.trim();
            return (
              <div key={r.id} style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                background: on ? "var(--accent)0d" : "transparent",
              }}>
                <input
                  type="checkbox" checked={on} onChange={() => toggle(r.id)}
                  aria-label={r.full_name}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{r.full_name}</span>
                    {r.age_category && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "var(--accent2)20", color: "var(--accent2)" }}>{catLabel(r.age_category)}</span>}
                    {r.group_name && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "var(--accent3)20", color: "var(--accent3)" }}>{groupLabel(r.group_name)}</span>}
                    {missing && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "var(--warning)20", color: "var(--warning)" }}>⚠ {t("members.insuranceIncomplete")}</span>}
                  </div>
                  {canEdit ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                      <input
                        type="date" value={v.dob} aria-label={t("memberForm.dateOfBirth")}
                        onChange={(e) => setField(r.id, "dob", e.target.value)}
                        onBlur={() => saveField(r, "dob")}
                        style={inputStyle}
                      />
                      <input
                        type="text" dir="auto" value={v.address} placeholder={t("memberForm.address")}
                        aria-label={t("memberForm.address")}
                        onChange={(e) => setField(r.id, "address", e.target.value)}
                        onBlur={() => saveField(r, "address")}
                        style={{ ...inputStyle, gridColumn: "span 2" }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--muted-lt)" }}>
                      {fmtDate(v.dob) || "—"} · {v.address || "—"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {incomplete > 0 && (
          <div style={{ fontSize: 11, color: "var(--warning)", background: "var(--warning)12", padding: "8px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.6 }}>
            ⚠ {t("members.insuranceMissing", { count: incomplete })}
          </div>
        )}

        {/* لغة المستند + التحميل */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("members.insuranceDocLang")}</span>
            {langOpts.map((o) => (
              <button key={o.v} type="button" onClick={() => chooseLang(o.v)} style={chip(docLang === o.v)}>{o.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={download} disabled={!chosen.length}>⬇ {t("members.insuranceDownload")}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
