// src/pages/Register.jsx
// استمارة تسجيل الرياضي (عامة، بلا تسجيل دخول): /register/:gymSlug
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/services/api";

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EMPTY = {
  fullName: "", phone: "", dateOfBirth: "", gender: "", address: "",
  bloodGroup: "", guardianName: "", guardianPhone: "", website: "",
};

// تحويل الأرقام العربية/الفارسية إلى لاتينية وإزالة الفواصل
const normPhone = (v) =>
  String(v || "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[\s\-.()]/g, "");
const PHONE_RE = /^\+?\d{8,15}$/;

const todayIso = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const field = {
  width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 16, // 16px: يمنع تكبير iOS
  background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
  borderRadius: "var(--radius-sm)", outline: "none", fontFamily: "inherit", minWidth: 0,
};

// as="div" للحقول التي تضم أزراراً (الجنس): غلاف label كان سيربط النص بالزر الأول
function Field({ label, error, children, as: Tag = "label" }) {
  return (
    <Tag style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, color: "var(--muted-lt)", fontWeight: 500 }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
    </Tag>
  );
}

export default function Register() {
  const { gymSlug } = useParams();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "ar").slice(0, 2) === "fr" ? "fr" : "ar";

  const [gym, setGym] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | notfound
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");

  // الاتجاه واللغة على مستوى الصفحة
  useEffect(() => {
    const el = document.documentElement;
    const prev = { dir: el.dir, lang: el.lang };
    el.dir = lang === "ar" ? "rtl" : "ltr"; el.lang = lang;
    return () => { el.dir = prev.dir; el.lang = prev.lang; };
  }, [lang]);

  useEffect(() => {
    let alive = true;
    api.get(`/public/registration/${encodeURIComponent(gymSlug)}`)
      .then((r) => { if (alive) { setGym(r.data?.data); setState("ready"); } })
      .catch(() => { if (alive) setState("notfound"); });
    return () => { alive = false; };
  }, [gymSlug]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const chooseLang = (l) => { i18n.changeLanguage(l); try { localStorage.setItem("i18nextLng", l); } catch { /* تجاهل */ } };

  const validate = () => {
    const e = {};
    if (form.fullName.trim().length < 3) e.fullName = t("registration.errName");
    if (!PHONE_RE.test(normPhone(form.phone))) e.phone = t("registration.errPhone");
    if (!form.dateOfBirth || form.dateOfBirth > todayIso() || form.dateOfBirth < "1920-01-01") e.dateOfBirth = t("registration.errDob");
    if (form.guardianPhone && !PHONE_RE.test(normPhone(form.guardianPhone))) e.guardianPhone = t("registration.errPhone");
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    try {
      await api.post(`/public/registration/${encodeURIComponent(gymSlug)}`, {
        ...form, phone: normPhone(form.phone), guardianPhone: normPhone(form.guardianPhone),
      });
      setDone(true);
    } catch (err) {
      setServerError(err?.response?.status === 429 ? t("registration.tooMany") : t("registration.errorGeneric"));
    } finally { setSending(false); }
  };

  const again = () => { setForm(EMPTY); setErrors({}); setDone(false); };

  const chip = (active) => ({
    flex: 1, padding: "12px 10px", fontSize: 15, borderRadius: "var(--radius-sm)", cursor: "pointer",
    border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
    background: active ? "var(--accent)18" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--muted-lt)", fontFamily: "inherit", fontWeight: 600,
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0b0e11)", color: "var(--text)", padding: "16px 14px 40px", boxSizing: "border-box", overflowX: "hidden", position: "relative" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* تبديل اللغة */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 14 }}>
          {["ar", "fr"].map((l) => (
            <button key={l} type="button" onClick={() => chooseLang(l)} style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              border: "1px solid " + (lang === l ? "var(--accent)" : "var(--border)"),
              background: lang === l ? "var(--accent)18" : "var(--card)",
              color: lang === l ? "var(--accent)" : "var(--muted)",
            }}>{l === "ar" ? "العربية" : "Français"}</button>
          ))}
        </div>

        {state === "loading" && <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>…</div>}

        {state === "notfound" && (
          <div style={{ textAlign: "center", padding: 40, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <div style={{ fontSize: 40 }}>🔗</div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>{t("registration.notFound")}</div>
          </div>
        )}

        {state === "ready" && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "22px 18px" }}>
            {/* رأس النادي */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {gym?.logo_url && <img src={gym.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", marginBottom: 10 }} />}
              <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>{gym?.name}</div>
              <h1 style={{ fontSize: 22, margin: "6px 0 6px" }}>{t("registration.title")}</h1>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{t("registration.subtitle")}</p>
            </div>

            {done ? (
              <div style={{ textAlign: "center", padding: "20px 4px" }}>
                <div style={{ fontSize: 46 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 6px" }}>{t("registration.successTitle")}</div>
                <p style={{ fontSize: 14, color: "var(--muted-lt)", lineHeight: 1.7, margin: "0 0 18px" }}>{t("registration.successText")}</p>
                <button type="button" onClick={again} style={{ ...chip(false), flex: "none", padding: "11px 20px" }}>{t("registration.another")}</button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label={t("registration.fullName")} error={errors.fullName}>
                  <input style={field} value={form.fullName} onChange={set("fullName")} autoComplete="name"
                    placeholder={t("registration.fullNamePlaceholder")} maxLength={120} />
                </Field>

                <Field label={t("registration.phone")} error={errors.phone}>
                  <input style={{ ...field, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }} value={form.phone} onChange={set("phone")}
                    type="tel" inputMode="tel" autoComplete="tel" placeholder="0550000000" />
                </Field>

                <Field label={t("registration.dob")} error={errors.dateOfBirth}>
                  <input style={field} type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} max={todayIso()} min="1920-01-01" />
                </Field>

                <Field as="div" label={t("registration.gender")}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" style={chip(form.gender === "male")} onClick={() => setForm((f) => ({ ...f, gender: "male" }))}>{t("registration.male")}</button>
                    <button type="button" style={chip(form.gender === "female")} onClick={() => setForm((f) => ({ ...f, gender: "female" }))}>{t("registration.female")}</button>
                  </div>
                </Field>

                <Field label={t("registration.address")}>
                  <input style={field} value={form.address} onChange={set("address")} autoComplete="street-address"
                    placeholder={t("registration.addressPlaceholder")} maxLength={200} />
                </Field>

                <Field label={t("registration.bloodGroup")}>
                  <select style={field} value={form.bloodGroup} onChange={set("bloodGroup")}>
                    <option value="">{t("registration.bloodSelect")}</option>
                    {BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>

                {/* ولي الأمر */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent2)" }}>{t("registration.guardianSection")}</div>
                  <Field label={t("registration.guardianName")}>
                    <input style={field} value={form.guardianName} onChange={set("guardianName")} maxLength={120} />
                  </Field>
                  <Field label={t("registration.guardianPhone")} error={errors.guardianPhone}>
                    <input style={{ ...field, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }} value={form.guardianPhone} onChange={set("guardianPhone")}
                      type="tel" inputMode="tel" placeholder="0550000000" />
                  </Field>
                </div>

                {/* فخ الروبوتات: يبقى فارغاً عند البشر */}
                <input name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true"
                  style={{ position: "absolute", top: 0, insetInlineStart: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />

                {serverError && (
                  <div style={{ fontSize: 13, color: "var(--danger)", background: "var(--danger)12", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>{serverError}</div>
                )}

                <button type="submit" disabled={sending} style={{
                  padding: "15px 18px", fontSize: 16, fontWeight: 800, border: "none", borderRadius: "var(--radius-sm)",
                  background: "var(--accent)", color: "#0d0f14", cursor: sending ? "default" : "pointer",
                  opacity: sending ? 0.6 : 1, fontFamily: "inherit",
                }}>{sending ? t("registration.sending") : t("registration.submit")}</button>

                <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>🔒 {t("registration.privacy")}</div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
