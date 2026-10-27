// src/utils/insuranceDocx.js
// ─────────────────────────────────────────────────────────────
// توليد ملف Word (.docx) حقيقي بدون أي مكتبة خارجية:
// ملف docx = أرشيف ZIP يحوي ملفات XML، فنبني الأرشيف (بدون ضغط) يدوياً.
// ─────────────────────────────────────────────────────────────

// ── CRC32 ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP (طريقة STORE) ──
function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255];
  const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const DOS_TIME = 0, DOS_DATE = (46 << 9) | (1 << 5) | 1; // 2026-01-01

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.content);
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(crc),
      ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    chunks.push(local, name, data);
    central.push({ name, crc, size: data.length, offset });
    offset += local.length + name.length + data.length;
  }
  const cdStart = offset;
  for (const c of central) {
    const h = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE), ...u32(c.crc),
      ...u32(c.size), ...u32(c.size), ...u16(c.name.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset),
    ]);
    chunks.push(h, c.name);
    offset += h.length + c.name.length;
  }
  const cdSize = offset - cdStart;
  chunks.push(new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
    ...u32(cdSize), ...u32(cdStart), ...u16(0),
  ]));
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

// ── XML ──
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // حذف محارف التحكم غير المسموحة في XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const FONT = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>';

// فقرة: lines = مصفوفة أسطر (كل سطر نص)، rtl = اتجاه الفقرة
function para(lines, { rtl, bold, size = 22, align = "left", color, after = 0, before = 0 }) {
  const runs = lines.map((txt, i) =>
    `<w:r><w:rPr>${FONT}${bold ? "<w:b/><w:bCs/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${rtl ? "<w:rtl/>" : ""}</w:rPr>${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(txt)}</w:t></w:r>`
  ).join("");
  // في فقرة bidi: "left" تعني بداية السطر (يمين)، لذلك نستخدم start/end الصريحة
  const jc = align === "center" ? "center" : (align === "end" ? "right" : "left");
  return `<w:p><w:pPr>${rtl ? "<w:bidi/>" : ""}<w:spacing w:before="${before}" w:after="${after}"/><w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`;
}

function cell(lines, width, opts) {
  const shade = opts.header ? '<w:shd w:val="clear" w:color="auto" w:fill="E7EDF3"/>' : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}<w:vAlign w:val="center"/></w:tcPr>${para(lines, opts)}</w:tc>`;
}

/**
 * @param {object} o
 *  title: string[]            عنوان المستند (سطر أو سطران)
 *  subtitle: string[]         سطر تحت العنوان (اسم النادي + التاريخ)
 *  headers: string[][]        رؤوس الأعمدة (كل رأس = أسطر)
 *  rows: string[][]           الصفوف
 *  rtl: boolean               اتجاه المستند (عربي = true)
 *  totalLabel: string         مثل «العدد الإجمالي: 12»
 * @returns {Blob}
 */
export function buildInsuranceDocx({ title, subtitle = [], headers, rows, rtl, totalLabel }) {
  // أعمدة: الرقم، الاسم واللقب، تاريخ الميلاد، العنوان — مجموعها عرض الصفحة (A4 − هوامش)
  const widths = [800, 3900, 1900, 3606];

  const headRow =
    `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${headers
      .map((h, i) => cell(h, widths[i], { rtl, bold: true, size: 21, align: "center", header: true })).join("")}</w:tr>`;

  const bodyRows = rows.map((r) =>
    `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="420" w:hRule="atLeast"/></w:trPr>${r
      .map((v, i) => cell([v], widths[i], { rtl, size: 21, align: i === 0 || i === 2 ? "center" : "left" })).join("")}</w:tr>`
  ).join("");

  const border = (n) => `<w:${n} w:val="single" w:sz="6" w:space="0" w:color="555555"/>`;
  const table =
    `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${rtl ? "<w:bidi/>" : ""}` +
    `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${headRow}${bodyRows}</w:tbl>`;

  const body =
    para(title, { rtl, bold: true, size: 30, align: "center", after: 80 }) +
    (subtitle.length ? para(subtitle, { rtl, size: 21, align: "center", color: "555555", after: 240 }) : "") +
    table +
    para([totalLabel], { rtl, bold: true, size: 21, align: "end", before: 200 }) +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="567" w:footer="567" w:gutter="0"/>${rtl ? "<w:bidi/>" : ""}</w:sectPr>`;

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

  const files = [
    { name: "[Content_Types].xml", content:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: "_rels/.rels", content:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/document.xml", content: documentXml },
  ];

  return new Blob([zip(files)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// تنزيل Blob كملف
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
