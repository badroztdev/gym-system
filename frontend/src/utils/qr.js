// src/utils/qr.js
// نص → مصفوفة/مسار SVG لرمز QR (تصحيح أخطاء M، يكفي للطباعة والمسح من مسافة)
import qrcode from "./qrcodeLib.js";

export function qrMatrix(text) {
  const qr = qrcode(0, "M");   // 0 = اختيار النسخة تلقائياً حسب طول النص
  qr.addData(String(text));
  qr.make();
  const n = qr.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

// يعيد { size, path } حيث path مسار SVG واحد لكل الوحدات الداكنة (مع هامش هادئ 4 وحدات)
export function qrPath(text, margin = 4) {
  const m = qrMatrix(text);
  const n = m.length;
  let d = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!m[r][c]) { c++; continue; }
      let start = c;
      while (c < n && m[r][c]) c++;
      d += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
    }
  }
  return { size: n + margin * 2, path: d };
}

// سلسلة <svg> جاهزة (تُستعمل في صفحة الطباعة)
export function qrSvgString(text, px = 400) {
  const { size, path } = qrPath(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
