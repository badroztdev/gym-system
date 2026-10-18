// src/portal/fontScale.js
// حجم الخط في بوابة الرياضي — يُحفظ في المتصفح ويُطبَّق على كل صفحات البوابة.
// القيمة الافتراضية 1.15 (أكبر من الحجم الأصلي بـ 15%).
export const FONT_SCALES = [
  { value: 1,    label: "عادي" },
  { value: 1.15, label: "كبير" },
  { value: 1.3,  label: "أكبر" },
];
export const DEFAULT_FONT_SCALE = 1.15;
const KEY = "sgms-portal-font-scale";

export function getFontScale() {
  try {
    const saved = parseFloat(localStorage.getItem(KEY));
    if (FONT_SCALES.some(s => s.value === saved)) return saved;
  } catch { /* localStorage غير متاح */ }
  return DEFAULT_FONT_SCALE;
}

export function saveFontScale(value) {
  try { localStorage.setItem(KEY, String(value)); } catch { /* تجاهل */ }
}

export function nextFontScale(current) {
  const i = FONT_SCALES.findIndex(s => s.value === current);
  return FONT_SCALES[(i + 1) % FONT_SCALES.length].value;
}