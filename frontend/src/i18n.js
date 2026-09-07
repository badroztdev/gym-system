// src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

// اللغة المحفوظة سابقاً في المتصفح، أو العربية افتراضياً
const savedLang = localStorage.getItem("gym-pro-lang") || "ar";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      fr: { translation: fr },
    },
    lng: savedLang,
    fallbackLng: "ar",
    interpolation: { escapeValue: false },
  });

// عند تغيير اللغة، نحفظها ونُحدّث اتجاه الصفحة تلقائياً (RTL للعربية، LTR للفرنسية)
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("gym-pro-lang", lng);
  document.documentElement.setAttribute("lang", lng);
  document.documentElement.setAttribute("dir", lng === "ar" ? "rtl" : "ltr");
});

// تطبيق الاتجاه الصحيح فوراً عند أول تحميل للصفحة
document.documentElement.setAttribute("lang", savedLang);
document.documentElement.setAttribute("dir", savedLang === "ar" ? "rtl" : "ltr");

export default i18n;
