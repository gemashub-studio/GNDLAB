/**
 * Ekspor DOCX & PPTX TANPA dependensi (DEC-052): file Office = zip (metode "store") berisi XML
 * Office Open XML minimal. Gambar = thumbnail JPEG yang sudah tersimpan + grafik PNG (DEC-058). Offline di browser.
 */
import type { ChartSpec } from './reportCharts';
import type { ResearchReport } from './researchReport';

// ------------------------------------------------------------------ zip (store, tanpa kompresi)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

const enc = new TextEncoder();

/** Zip "stored" (tanpa kompresi) — cukup untuk DOCX/PPTX; nama berkas UTF-8. */
export function zipStore(files: readonly ZipFile[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true); // UTF-8
    v.setUint16(8, 0, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, f.data.length, true);
    v.setUint32(22, f.data.length, true);
    v.setUint16(26, name.length, true);
    local.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const w = new DataView(cd.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x0800, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, f.data.length, true);
    w.setUint32(24, f.data.length, true);
    w.setUint16(28, name.length, true);
    w.setUint32(42, offset, true);
    cd.set(name, 46);
    chunks.push(local, f.data);
    central.push(cd);
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true);
  e.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// ------------------------------------------------------------------ util

export const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const txt = (s: string) => enc.encode(s);

function dataUrlBytes(dataUrl: string): Uint8Array | undefined {
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
  if (!m) return undefined;
  const bin = atob(m[1]!);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Ukuran JPEG (piksel) dari penanda SOF; default 4:3 bila tak terbaca. */
export function jpegSize(b: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (marker >= 0xc0 && marker <= 0xc3) return { h: (b[i + 5]! << 8) | b[i + 6]!, w: (b[i + 7]! << 8) | b[i + 8]! };
    i += 2 + len;
  }
  return { w: 480, h: 360 };
}

const EMU_PER_PX = 9525;
const EMU_PER_IN = 914400;
const CT_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
// palet template infografik Canva owner (DEC-121 → DEC-123): kertas putih, cokelat tua, karat, zaitun, marun, taupe
const INK = '2B2320';
const MINT = 'A64B2A';
const MINT_D = '5E7B3A';
const PAPER = 'F1EDE8';
const GRID = 'DCD4CC';
const MUTED = '7D6E66';
const AMBER = '7B3B34';
/** Warna kertas slide, teks isi kedua, angka tipis besar, bilah abu kepala. */
const BG = 'FBFAF7';
const BODY2 = '4A3F3A';
const TAUPE = 'A58E83';
const BAR = 'ECE8E3';
/** Komponen infografik referensi owner (DEC-126): bilah kicker abu bertulisan putih, label tegak abu muda, angka tipis. */
const KICK_BAR = 'A8A29E';
const SIDE = 'CFC8C3';
const THIN_NUM = 'B3A6A0';
const LIGHT_FONT = 'Segoe UI Light';

/** Gambar grafik (PNG) per `ChartSpec.id`, dibuat di browser dari SVG yang sama dengan PDF (DEC-058). */
export interface ChartPng {
  bytes: Uint8Array;
  w: number;
  h: number;
}
export type ChartPngs = ReadonlyMap<string, ChartPng>;

interface Pic {
  rid: string;
  file: string;
  bytes: Uint8Array;
  w: number;
  h: number;
  caption: string;
}

const imgCaption = (im: ResearchReport['blocks'][number]['images'][number]) => `${im.video ? 'VIDEO · ' : ''}${im.caption || im.name}`;
/** "Label: isi" dipisah supaya label bisa ditebalkan; selain itu [undefined, teks]. */
const splitLabel = (t: string): [string | undefined, string] => {
  const m = /^([A-Za-z][^:·]{1,34}): (.+)$/.exec(t);
  return m ? [m[1], m[2]!] : [undefined, t];
};
const pad2 = (n: number) => String(n).padStart(2, '0');

// ------------------------------------------------------------------ DOCX

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

type RunOpt = { b?: boolean; sz?: number; color?: string; mono?: boolean; shade?: string; i?: boolean };
const wRun = (t: string, o: RunOpt = {}) =>
  `<w:r><w:rPr>${o.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ''}${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
const wP = (runs: string, o: { after?: number; before?: number; border?: string; keepNext?: boolean; jc?: string } = {}) =>
  `<w:p><w:pPr>${o.keepNext ? '<w:keepNext/>' : ''}${o.border ?? ''}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 80}"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`;
const wPara = (t: string, o: RunOpt & { after?: number } = {}) => wP(wRun(t, o), { after: o.after ?? 80 });
const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
const noBorders = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>';
const cellPr = (fill?: string, extra = '') => `<w:tcPr>${extra}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar></w:tcPr>`;

function wLine(t: string): string {
  const [label, val] = splitLabel(t);
  return label ? wP(wRun(`${label}  `, { b: true, sz: 17, color: MUTED }) + wRun(val, { sz: 20, ...(val === 'belum dicatat' && { i: true, color: MUTED }) })) : wPara(t, { sz: 20 });
}

function wTable(head: string[], rows: string[][]): string {
  const border = '<w:tblBorders>' + ['top', 'bottom'].map((s) => `<w:${s} w:val="single" w:sz="6" w:color="${GRID}"/>`).join('') + `<w:insideH w:val="single" w:sz="4" w:color="${GRID}"/></w:tblBorders>`;
  const cell = (t: string, h: boolean, zebra: boolean) => `<w:tc>${cellPr(h ? INK : zebra ? PAPER : undefined)}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${wRun(t || '–', h ? { b: true, sz: 16, color: MINT, mono: true } : { sz: 18 })}</w:p></w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>${[head, ...rows]
    .map((r, i) => `<w:tr>${i === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${r.map((c) => cell(c, i === 0, i % 2 === 0)).join('')}</w:tr>`)
    .join('')}</w:tbl>${wPara('', { after: 120 })}`;
}

function wDrawing(rid: string, id: number, name: string, cx: number, cy: number): string {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Gambar ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/** Ukuran di dalam kotak (inci) dengan rasio asli. */
const fit = (w: number, h: number, maxW: number, maxH: number) => {
  const k = Math.min(maxW / w, maxH / h);
  return { cx: Math.round(w * k * EMU_PER_IN), cy: Math.round(h * k * EMU_PER_IN) };
};

export function buildDocx(r: ResearchReport, charts: ChartPngs = new Map()): Uint8Array {
  const pics: (Pic & { ext: 'jpeg' | 'png' })[] = [];
  const addPic = (bytes: Uint8Array, ext: 'jpeg' | 'png', w: number, h: number, caption: string) => {
    const n = pics.length + 1;
    const p = { rid: `rIdImg${n}`, file: `image${n}.${ext}`, bytes, w, h, caption, ext };
    pics.push(p);
    return { p, id: n };
  };
  const photo = (dataUrl: string, maxW: number, maxH: number, name: string) => {
    const bytes = dataUrlBytes(dataUrl);
    if (!bytes) return '';
    const sz = jpegSize(bytes);
    const { p, id } = addPic(bytes, 'jpeg', sz.w, sz.h, name);
    const f = fit(sz.w, sz.h, maxW, maxH);
    return wDrawing(p.rid, id, p.file, f.cx, f.cy);
  };
  const body: string[] = [];
  let sec = 0;
  const section = (title: string) =>
    body.push(
      wP(wRun(` ${pad2(++sec)} `, { b: true, sz: 20, color: MINT, shade: INK, mono: true }) + wRun(`  ${title}`, { b: true, sz: 30, color: INK }), {
        before: 360,
        after: 160,
        keepNext: true,
        border: `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${MINT}"/></w:pBdr>`,
      }),
    );

  // sampul
  body.push(wPara('GnD LAB · RISET PRODUK', { b: true, sz: 18, color: MINT_D, mono: true, after: 240 }));
  body.push(wP(wRun(r.title, { b: true, sz: 52, color: INK }), { after: 200, border: `<w:pBdr><w:bottom w:val="single" w:sz="24" w:space="8" w:color="${MINT}"/></w:pBdr>` }));
  body.push(wP(wRun(`  ${r.cover.status}  `, { b: true, sz: 20, color: INK, shade: r.cover.done ? MINT : AMBER }), { after: 280 }));
  body.push(
    `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="${GRID}"/><w:bottom w:val="single" w:sz="4" w:color="${GRID}"/><w:top w:val="single" w:sz="4" w:color="${GRID}"/></w:tblBorders></w:tblPr>${r.cover.meta
      .map(([k, v]) => `<w:tr><w:tc>${cellPr(undefined, '<w:tcW w:w="1400" w:type="pct"/>')}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${wRun(k.toUpperCase(), { sz: 15, color: MUTED, mono: true })}</w:p></w:tc><w:tc>${cellPr()}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${wRun(v, { sz: 22 })}</w:p></w:tc></w:tr>`)
      .join('')}</w:tbl>`,
  );
  if (r.cover.image?.dataUrl) {
    const d = photo(r.cover.image.dataUrl, 6.5, 3.4, r.cover.image.name);
    if (d) body.push(wP(d, { before: 240, after: 60 }), wPara(imgCaption(r.cover.image), { sz: 16, color: MUTED }));
  }
  body.push(wPara(`Dibuat ${r.generatedAt} dari catatan tersimpan di perangkat. Isi = catatan pengguna; bukan klaim produk aman/memenuhi standar.`, { sz: 16, color: MUTED, after: 0 }), PAGE_BREAK);

  // ringkasan KPI (3 per baris)
  section('Ringkasan');
  const rows: string[] = [];
  for (let i = 0; i < r.kpis.length; i += 3) {
    rows.push(
      `<w:tr>${r.kpis
        .slice(i, i + 3)
        .map((k) => `<w:tc>${cellPr(PAPER, `<w:tcW w:w="1666" w:type="pct"/><w:tcBorders><w:left w:val="single" w:sz="24" w:color="${MINT_D}"/><w:top w:val="single" w:sz="18" w:color="FFFFFF"/><w:bottom w:val="single" w:sz="18" w:color="FFFFFF"/><w:right w:val="single" w:sz="18" w:color="FFFFFF"/></w:tcBorders>`)}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${wRun(k.value, { b: true, sz: 40, color: INK })}</w:p><w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${wRun(k.label.toUpperCase(), { sz: 15, color: MUTED, mono: true })}</w:p></w:tc>`)
        .join('')}</w:tr>`,
    );
  }
  body.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${noBorders}</w:tblPr>${rows.join('')}</w:tbl>`, wPara('', { after: 80 }));

  for (const b of r.blocks.filter((x) => !x.pptxOnly)) {
    if (b.level === 1) section(b.heading);
    else body.push(wP(wRun(b.heading, { b: true, sz: 23, color: MINT_D }), { before: 240, after: 100, keepNext: true, border: `<w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="${MINT}"/></w:pBdr>` }));
    for (const l of b.lines) body.push(wLine(l));
    if (b.table) body.push(wTable(b.table.head, b.table.rows));
    for (const c of b.charts ?? []) {
      body.push(wP(wRun(c.title, { b: true, sz: 21, color: INK }), { before: 160, after: 60, keepNext: true }));
      const png = charts.get(c.id);
      if (png) {
        const { p, id } = addPic(png.bytes, 'png', png.w, png.h, c.title);
        const f = fit(png.w, png.h, 6.5, 3.5);
        body.push(wP(wDrawing(p.rid, id, p.file, f.cx, f.cy), { after: 40, keepNext: true }));
      } else {
        body.push(wPara('(gambar grafik tidak tersedia — lihat tabel ringkasan di atas)', { sz: 16, color: MUTED, i: true }));
      }
      body.push(wPara(c.note, { sz: 15, color: MUTED, after: 160 }));
    }
    // galeri 3 kolom
    for (let i = 0; i < b.images.length; i += 3) {
      const cells = b.images.slice(i, i + 3).map((im) => {
        const d = im.dataUrl ? photo(im.dataUrl, 2.05, 1.6, im.name) : '';
        return `<w:tc>${cellPr(undefined, '<w:tcW w:w="1666" w:type="pct"/>')}${d ? wP(d, { after: 40 }) : wPara('(tanpa pratinjau)', { sz: 15, color: MUTED, i: true })}${wPara(imgCaption(im), { sz: 15, after: 0 })}${wPara(im.name, { sz: 13, color: MUTED, mono: true, after: 60 })}</w:tc>`;
      });
      while (cells.length < 3) cells.push(`<w:tc>${cellPr(undefined, '<w:tcW w:w="1666" w:type="pct"/>')}<w:p/></w:tc>`);
      body.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${noBorders}</w:tblPr><w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join('')}</w:tr></w:tbl>`);
    }
    if (b.images.length) body.push(wPara('', { after: 80 }));
  }

  const footer = `${CT_HEAD}<w:ftr ${W_NS}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${GRID}"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>${wRun(r.footer, { sz: 14, color: MUTED, mono: true })}<w:r><w:tab/></w:r>${wRun('Hal. ', { sz: 14, color: MUTED, mono: true })}<w:r><w:rPr><w:sz w:val="14"/><w:color w:val="${MUTED}"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="14"/><w:color w:val="${MUTED}"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const doc = `${CT_HEAD}<w:document ${W_NS}><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr></w:body></w:document>`;
  const rels = `${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${pics.map((p) => `<Relationship Id="${p.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${p.file}"/>`).join('')}</Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: txt(`${CT_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`) },
    { name: '_rels/.rels', data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/document.xml', data: txt(doc) },
    { name: 'word/_rels/document.xml.rels', data: txt(rels) },
    { name: 'word/footer1.xml', data: txt(footer) },
    ...pics.map((p) => ({ name: `word/media/${p.file}`, data: p.bytes })),
  ]);
}

// ------------------------------------------------------------------ PPTX

const P_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const SW = 12192000;
const SH = 6858000;
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const emptyTree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

/** serif = judul gaya koran (Georgia); caps = kapital kecil berjarak (label rubrik); mono = label berjarak. */
type PRun = { t: string; sz: number; b?: boolean; i?: boolean; color?: string; mono?: boolean; serif?: boolean; caps?: boolean; font?: string };
type PPara = PRun | PRun[];
const aRun = (p: PRun) => `<a:r><a:rPr lang="id-ID" sz="${p.sz}"${p.b ? ' b="1"' : ''}${p.i ? ' i="1"' : ''}${p.caps ? ' cap="small" spc="150"' : p.mono ? ' spc="60"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${p.color ?? INK}"/></a:solidFill>${p.font ? `<a:latin typeface="${p.font}"/>` : p.serif ? '<a:latin typeface="Georgia"/>' : ''}</a:rPr><a:t>${xml(p.t)}</a:t></a:r>`;
const aParas = (paras: PPara[], spcAft = 300, align?: 'ctr' | 'r') => paras.map((p) => `<a:p><a:pPr${align ? ` algn="${align}"` : ''}><a:spcAft><a:spcPts val="${spcAft}"/></a:spcAft></a:pPr>${(Array.isArray(p) ? p : [p]).map(aRun).join('')}</a:p>`).join('') || '<a:p><a:endParaRPr lang="id-ID"/></a:p>';

function pTextBox(id: number, x: number, y: number, w: number, h: number, paras: PPara[], o: { fill?: string; geom?: string; anchor?: 't' | 'ctr' | 'b'; autofit?: boolean; align?: 'ctr' | 'r' } = {}): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Teks ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${o.geom ?? 'rect'}"><a:avLst/></a:prstGeom>${o.fill ? `<a:solidFill><a:srgbClr val="${o.fill}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${o.anchor ?? 't'}">${o.autofit === false ? '' : '<a:normAutofit/>'}</a:bodyPr><a:lstStyle/>${aParas(paras, 300, o.align)}</p:txBody></p:sp>`;
}

const pRect = (id: number, x: number, y: number, w: number, h: number, fill: string, geom = 'rect') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Bentuk ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;

/**
 * Kepala ala infografik referensi (DEC-126): "GnD Lab" serif di kotak putih bergaris tipis (seperti "Ciencia"),
 * di kanannya kalimat pembuka — awalan tebal karat + teks biasa (seperti "El evento tecnológico…").
 */
function masthead(id: number, x: number, lead: string, text: string, big = false): string {
  const k = big ? 1.35 : 1;
  const w = 2100000 * k;
  const h = 520000 * k;
  const y = 120000;
  const leadX = x + w + 200000;
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Kepala ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${GRID}"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="0" rIns="91440" bIns="0" anchor="ctr"/><a:lstStyle/><a:p>${aRun({ t: 'GnD Lab', sz: Math.round(3000 * k), serif: true })}</a:p></p:txBody></p:sp>` +
    pTextBox(id + 1, leadX, y, SW - 500000 - leadX - 900000, h, [[{ t: `${lead} `, sz: 1000, b: true, color: MINT }, { t: text, sz: 1000, color: BODY2 }]], { anchor: 'ctr', autofit: false })
  );
}

/** Bilah kicker abu bertulisan putih kapital (seperti "DÍA INTERNACIONAL DE LA PROTECCIÓN AL MANGLAR"), di tengah. */
function kickerBar(id: number, cx: number, y: number, t: string, icon?: IconKind): string {
  const w = Math.min(7000000, 260000 + t.length * 78000);
  return (
    pTextBox(id, cx - w / 2, y, w, 230000, [{ t: t.toUpperCase(), sz: 850, b: true, color: 'FFFFFF', mono: true }], { fill: KICK_BAR, anchor: 'ctr', autofit: false, align: 'ctr' }) +
    (icon ? pIcon(9100, icon, cx - w / 2 - 330000, y - 50000, 300000, MINT) : '')
  );
}

/** Lingkaran sebagai path kubik (untuk ikon). */
const circ = (cx: number, cy: number, r: number) => {
  const k = 0.5523 * r;
  return `M${cx - r} ${cy} C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} Z`;
};

/**
 * Ikon vektor gaya infografik (DEC-127) — siluet datar seperti pohon bakau di referensi, digambar pada kotak 100×100.
 * fill = bagian berwarna, cut = lubang/aksen yang dicat warna kertas. Path SVG sederhana (M/L/C/Z, koordinat mutlak).
 */
export type IconKind = 'palm' | 'coconut' | 'briket' | 'flask' | 'leaf' | 'flame' | 'sack' | 'drop' | 'tree';
export const ICONS: Record<IconKind, { fill: string[]; cut?: string[] }> = {
  palm: {
    fill: [
      'M47 100 C48 78 50 58 52 42 L57 42 C55 58 54 78 55 100 Z',
      'M54 40 C42 30 24 32 8 48 C24 40 40 40 54 44 Z',
      'M56 40 C68 30 86 32 98 48 C84 40 70 40 56 44 Z',
      'M54 40 C46 24 34 16 18 16 C32 22 42 30 52 42 Z',
      'M56 40 C64 24 76 16 92 18 C78 24 68 30 58 42 Z',
      'M55 40 C53 26 56 14 64 4 C62 16 60 28 58 40 Z',
      circ(50, 46, 4),
      circ(59, 47, 4),
    ],
  },
  coconut: { fill: [circ(50, 52, 42)], cut: [circ(38, 40, 5), circ(53, 33, 5), circ(47, 52, 5)] },
  briket: { fill: ['M27 8 L73 8 L97 50 L73 92 L27 92 L3 50 Z'], cut: [circ(50, 50, 15)] },
  flask: {
    fill: ['M38 4 L62 4 L62 11 L58 11 L58 38 L86 86 C89 92 85 97 78 97 L22 97 C15 97 11 92 14 86 L42 38 L42 11 L38 11 Z'],
    cut: [circ(42, 80, 4), circ(57, 72, 3), circ(50, 86, 2.5)],
  },
  leaf: { fill: ['M8 92 C8 40 40 8 92 8 C92 60 60 92 8 92 Z'], cut: ['M14 89 L85 14 L88 17 L17 92 Z'] },
  flame: {
    fill: ['M50 2 C62 24 82 38 82 64 C82 84 68 98 50 98 C32 98 18 84 18 64 C18 46 30 38 34 22 C42 34 44 42 48 48 C52 34 52 18 50 2 Z'],
    cut: ['M50 58 C58 67 64 73 64 81 C64 89 58 94 50 94 C42 94 36 89 36 81 C36 73 44 67 50 58 Z'],
  },
  sack: {
    fill: ['M34 6 L66 6 L60 21 C80 31 92 54 90 76 C88 92 76 98 50 98 C24 98 12 92 10 76 C8 54 20 31 40 21 Z'],
    cut: ['M38 23 L62 23 L62 29 L38 29 Z'],
  },
  drop: {
    fill: ['M50 2 C64 26 84 46 84 66 C84 86 68 98 50 98 C32 98 16 86 16 66 C16 46 36 26 50 2 Z'],
    cut: ['M33 66 C33 56 37 50 42 45 C40 54 40 61 42 69 Z'],
  },
  tree: {
    fill: [
      'M8 46 C2 30 16 16 32 20 C36 4 62 2 68 18 C84 12 98 28 90 44 C98 56 84 66 70 60 C62 70 42 70 36 60 C22 68 4 60 8 46 Z',
      'M45 58 L55 58 L56 78 C60 86 68 92 78 98 L70 98 C64 94 59 90 55 86 L55 98 L45 98 L45 86 C41 90 36 94 30 98 L22 98 C32 92 40 86 44 78 Z',
    ],
  },
};

/** Path SVG (M/L/C/Z mutlak, kotak 100×100) → <a:path> DrawingML. */
export function iconPath(d: string): string {
  const tok = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) ?? [];
  let out = '';
  let i = 0;
  const pt = () => `<a:pt x="${Math.round(Number(tok[i++]) * 100)}" y="${Math.round(Number(tok[i++]) * 100)}"/>`;
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') out += `<a:moveTo>${pt()}</a:moveTo>`;
    else if (c === 'L') out += `<a:lnTo>${pt()}</a:lnTo>`;
    else if (c === 'C') out += `<a:cubicBezTo>${pt()}${pt()}${pt()}</a:cubicBezTo>`;
    else if (c === 'Z') out += '<a:close/>';
  }
  return `<a:path w="10000" h="10000">${out}</a:path>`;
}

const custShape = (id: number, name: string, x: number, y: number, w: number, h: number, paths: string[], fill: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${paths.map(iconPath).join('')}</a:pathLst></a:custGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;

/** Ikon vektor (2 bentuk: isi + lubang berwarna kertas). Memakai id dan id+1. */
export function pIcon(id: number, kind: IconKind, x: number, y: number, size: number, color: string, paper = BG): string {
  const ic = ICONS[kind];
  return custShape(id, `Ikon ${kind}`, x, y, size, size, ic.fill, color) + (ic.cut?.length ? custShape(id + 1, `Ikon ${kind} aksen`, x, y, size, size, ic.cut, paper) : '');
}

/** Ikon untuk judul bagian berdasarkan kata kuncinya. */
export function iconFor(title: string): IconKind {
  const t = title.toLowerCase();
  if (/belanja|nota/.test(t)) return 'sack';
  if (/briket|arang/.test(t)) return 'flame';
  if (/bahan|komposisi|resep|alat|protokol/.test(t)) return 'flask';
  if (/perbandingan|selisih|grafik|air/.test(t)) return 'drop';
  if (/foto|perlakuan|kopra/.test(t)) return 'coconut';
  if (/harian|laporan|riwayat|versi/.test(t)) return 'leaf';
  if (/ringkasan|kesimpulan/.test(t)) return 'palm';
  return 'tree';
}

/**
 * Panel "Jalur produk kelapa" ala "ESPECIES DE MANGLE" (DEC-127): judul karat + keterangan, siluet taupe di atas pita
 * tanah coklat berlabel putih, dan lingkaran keterangan marun bertulisan putih di kanan.
 */
const GROUND = '5B4636';
function productPanel(x: number, y: number, w: number): string {
  const items: [IconKind, string, number][] = [
    ['palm', 'Kelapa', 1150000],
    ['coconut', 'Kopra', 700000],
    ['flame', 'Arang', 760000],
    ['briket', 'Briket', 640000],
    ['flask', 'Cuka', 820000],
    ['leaf', 'Bio leather', 700000],
  ];
  const circleD = 1650000;
  const areaW = w - circleD - 300000;
  const groundY = y + 1750000;
  let out = pTextBox(9200, x, y, areaW, 260000, [{ t: 'JALUR PRODUK KELAPA', sz: 1100, b: true, color: MINT }], { autofit: false });
  out += pTextBox(9201, x, y + 230000, areaW, 260000, [{ t: 'Olahan kelapa yang dicatat di GnD Lab, dari buah sampai produk jadi.', sz: 1000, color: BODY2 }], { autofit: false });
  out += pRect(9202, x, groundY, areaW, 260000, GROUND);
  const slot = areaW / items.length;
  items.forEach(([kind, label, size], i) => {
    const cx = x + slot * i + slot / 2;
    out += pIcon(9210 + i * 3, kind, cx - size / 2, groundY - size, size, TAUPE, BG);
    out += pTextBox(9212 + i * 3, cx - slot / 2, groundY, slot, 260000, [{ t: label.toUpperCase(), sz: 800, b: true, color: 'FFFFFF', mono: true }], { anchor: 'ctr', autofit: false, align: 'ctr' });
  });
  const cx = x + w - circleD;
  out += pTextBox(9250, cx, y + 300000, circleD, circleD, [{ t: 'Isi laporan = catatan pengguna.', sz: 1100, b: true, color: 'FFFFFF' }, { t: 'Bukan klaim produk aman atau memenuhi standar.', sz: 1000, color: 'FFFFFF' }], { fill: AMBER, geom: 'ellipse', anchor: 'ctr', autofit: false, align: 'ctr' });
  return out;
}

/** Nomor halaman kecil abu di pojok kanan atas (seperti "26"). */
const pageNo = (id: number, n: number) => pTextBox(id, SW - 500000 - 700000, 150000, 700000, 300000, [{ t: String(n), sz: 1100, b: true, color: MUTED }], { autofit: false, align: 'r' });

/** Label tegak abu muda besar di tepi kanan (seperti "Contextos") + keterangan kecil di sampingnya. */
const sideLabel = (id: number, t: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Label ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${SW - 440000}" y="1300000"/><a:ext cx="360000" cy="3900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr vert="vert270" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/>${aRun({ t, sz: 2000, b: true, color: SIDE })}</a:p><a:p><a:pPr algn="ctr"/>${aRun({ t: 'GnD Lab · catatan lab kelapa', sz: 650, color: SIDE })}</a:p></p:txBody></p:sp>`;

/** Video tertanam (PowerPoint 2010+): poster = gambar pratinjau; a:videoFile + p14:media menunjuk berkas video. */
function pVideo(id: number, posterRid: string, rid: string, mrid: string, x: number, y: number, w: number, h: number, name: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xml(name)}"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr><a:videoFile r:link="${rid}"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="${mrid}"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${posterRid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

/** Urutan klik (p:timing) sama seperti buatan PowerPoint: klik video → putar/jeda. */
function videoTiming(spids: number[]): string {
  let id = 1;
  const nodes = spids.map((sp) => {
    const t = [++id, ++id, ++id, ++id, ++id];
    return `<p:seq concurrent="1" nextAc="seek"><p:cTn id="${t[0]}" restart="whenNotActive" fill="hold" evtFilter="cancelBubble" nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" delay="0"><p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl></p:cond></p:stCondLst><p:endSync evt="end" delay="0"><p:rtn val="all"/></p:endSync><p:childTnLst><p:par><p:cTn id="${t[1]}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${t[2]}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${t[3]}" presetID="2" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="togglePause"><p:cBhvr><p:cTn id="${t[4]}" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:nextCondLst><p:cond evt="onClick" delay="0"><p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl></p:cond></p:nextCondLst></p:seq>`;
  });
  const media = spids.map((sp) => `<p:video><p:cMediaNode vol="80000"><p:cTn id="${++id}" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl></p:cMediaNode></p:video>`);
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${nodes.join('')}${media.join('')}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

function pPic(id: number, rid: string, x: number, y: number, w: number, h: number, name: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

/**
 * Gambar mengisi penuh kotak (mis. potret 3:4) dengan memotong bagian tepi secara simetris lewat srcRect —
 * tidak gepeng; foto lanskap lama tampil bagian tengahnya (DEC-088).
 */
function pPicCover(id: number, rid: string, x: number, y: number, w: number, h: number, name: string, imgW: number, imgH: number, geom = 'rect'): string {
  const box = w / h;
  const img = imgW / imgH;
  let l = 0;
  let t = 0;
  if (img > box) l = Math.round(((1 - box / img) / 2) * 100000);
  else if (img < box) t = Math.round(((1 - img / box) / 2) * 100000);
  const crop = l || t ? `<a:srcRect l="${l}" t="${t}" r="${l}" b="${t}"/>` : '';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function pTable(id: number, x: number, y: number, w: number, head: string[], rows: string[][], opt: { rowH?: number; sz?: number } = {}): string {
  const colW = Math.floor(w / head.length);
  const rowH = opt.rowH ?? 370000;
  const sz = opt.sz ?? 1100;
  const cell = (t: string, h: boolean, zebra: boolean) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${aRun({ t: t || '–', sz: h ? sz - 100 : sz, b: h, color: h ? BG : INK, mono: h })}</a:p></a:txBody><a:tcPr marL="76200" marR="76200" marT="${rowH < 340000 ? 27432 : 45720}" marB="${rowH < 340000 ? 27432 : 45720}"><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="${GRID}"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="${GRID}"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="${h ? AMBER : zebra ? PAPER : BG}"/></a:solidFill></a:tcPr></a:tc>`;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tabel ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${colW * head.length}" cy="${rowH * (rows.length + 1)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>${head.map(() => `<a:gridCol w="${colW}"/>`).join('')}</a:tblGrid>${[head, ...rows]
    .map((r, i) => `<a:tr h="${rowH}">${r.map((c) => cell(c, i === 0, i % 2 === 0)).join('')}</a:tr>`)
    .join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

/** Video asli untuk ditanam di PowerPoint (DEC-073), per `ReportImage.mediaId`. */
export interface VideoFile {
  bytes: Uint8Array;
  /** mp4 | webm | mov | m4v */
  ext: string;
  mime: string;
}
export type VideoFiles = ReadonlyMap<string, VideoFile>;

interface Slide {
  shapes: string;
  pics: (Pic & { ext: 'jpeg' | 'png' })[];
  /** Video tertanam: rid (video) & mrid (media) menunjuk berkas yang sama. */
  vids?: { rid: string; mrid: string; file: string; bytes: Uint8Array; spid: number }[];
  dark?: boolean;
}

const LINES_PER_SLIDE = 9;
const ROWS_PER_SLIDE = 9;

export function buildPptx(r: ResearchReport, charts: ChartPngs = new Map(), videos: VideoFiles = new Map()): Uint8Array {
  let vidN = 0;
  const vidExts = new Map<string, string>();
  const slides: Slide[] = [];
  const M = 500000;
  const CW = SW - 2 * M;
  let picN = 0;
  let sec = 0;
  // judul slide ala infografik referensi (DEC-126): kepala "GnD Lab" + kalimat pembuka, bilah kicker abu, judul serif tengah
  const title = (t: string, num?: number) =>
    masthead(6, M, `${r.cover.code}.`, r.title) +
    kickerBar(3, SW / 2, 700000, num ? `${pad2(num)} · Sains & catatan lab` : 'Sains & catatan lab', iconFor(t)) +
    pTextBox(2, M, 930000, CW, 330000, [{ t, sz: 2000, b: true, serif: true }], { anchor: 'ctr', align: 'ctr', autofit: false });
  const pic = (bytes: Uint8Array, ext: 'jpeg' | 'png', w: number, h: number, caption: string, s: Slide['pics']) => {
    picN++;
    const p = { rid: `rIdP${s.length + 2}`, file: `image${picN}.${ext}`, bytes, w, h, caption, ext };
    s.push(p);
    return p;
  };
  const fitBox = (w: number, h: number, bw: number, bh: number) => {
    const k = Math.min(bw / w, bh / h);
    return { w: w * k, h: h * k };
  };
  const linePara = (t: string): PPara => {
    const [label, val] = splitLabel(t);
    return label ? [{ t: `${label}  `, sz: 1200, b: true, color: INK }, { t: val, sz: 1500 }] : [{ t: '▪ ', sz: 1500, b: true, color: MINT }, { t, sz: 1500 }];
  };

  // sampul ala infografik referensi (DEC-126): kepala "GnD Lab" + kalimat pembuka, foto bulat + lingkaran kecil bersambung,
  // bilah kicker abu, judul serif tengah, baris kredit, linimasa titik (seperti "CATEGORÍA EN RIESGO"), label tegak
  {
    const pics: Slide['pics'] = [];
    const deck0 = r.subtitle || 'Laporan lab GnD Lab';
    const deck = deck0.startsWith(r.cover.code) ? deck0.slice(r.cover.code.length).replace(/^\s*·\s*/, '') : deck0;
    let shapes = masthead(5, M, `${r.cover.code}.`, deck, true);
    const img = r.cover.image?.dataUrl ? dataUrlBytes(r.cover.image.dataUrl) : undefined;
    const d = 3300000;
    const colX = img ? M + d + 500000 : M;
    const colW = SW - 520000 - colX - 200000;
    if (img) {
      const sz = jpegSize(img);
      const p = pic(img, 'jpeg', sz.w, sz.h, 'sampul', pics);
      const cy = 1150000;
      shapes += pRect(16, M - 50000, cy - 50000, d + 100000, d + 100000, AMBER, 'ellipse');
      shapes += pRect(17, M - 20000, cy - 20000, d + 40000, d + 40000, BG, 'ellipse');
      shapes += pPicCover(11, p.rid, M, cy, d, d, p.file, sz.w, sz.h, 'ellipse');
    }
    const dots: [number, number, number, string][] = img
      ? [[M + 200000, 4850000, 420000, AMBER], [M + 1150000, 5250000, 330000, MINT_D], [M + 2150000, 5050000, 380000, TAUPE], [M + 3000000, 4650000, 280000, MINT]]
      : [[M, 5500000, 300000, AMBER], [M + 700000, 5600000, 240000, MINT_D], [M + 1300000, 5500000, 280000, TAUPE]];
    dots.forEach(([x, y, r0], k) => {
      const nx = dots[k + 1];
      if (nx) shapes += pSeg(30 + k, x + r0 / 2, y + r0 / 2, nx[0] + nx[2] / 2, nx[1] + nx[2] / 2, TAUPE, 22225);
    });
    dots.forEach(([x, y, r0, c], k) => (shapes += pRect(40 + k, x, y, r0, r0, c, 'ellipse')));
    const cx = colX + colW / 2;
    shapes += kickerBar(9, cx, 1050000, r.cover.status || 'Laporan lab', 'palm');
    shapes += pTextBox(8, colX, 1320000, colW, 1500000, [{ t: r.title, sz: 3400, b: true, serif: true }], { autofit: true, anchor: 't', align: 'ctr' });
    shapes += pTextBox(14, colX, 2850000, colW, 300000, [[{ t: 'Laporan ', sz: 1000, color: BODY2 }, { t: 'GnD Lab', sz: 1000, b: true }, { t: '  |  Dibuat ', sz: 1000, color: BODY2 }, { t: r.generatedAt, sz: 1000, b: true }]], { autofit: false, align: 'ctr' });
    // linimasa titik: garis tegak + titik per baris identitas
    const metas = r.cover.meta.slice(0, 7);
    const ty = 3300000;
    const step = 360000;
    if (metas.length) shapes += pSeg(50, colX + 90000, ty + 90000, colX + 90000, ty + 90000 + step * (metas.length - 1), BODY2, 9525);
    metas.forEach(([k, v], i) => {
      shapes += pRect(60 + i, colX + 45000, ty + i * step + 45000, 90000, 90000, INK, 'ellipse');
      shapes += pTextBox(70 + i, colX + 230000, ty + i * step - 20000, colW - 230000, 300000, [[{ t: `${k}  `, sz: 1000, b: true, color: MINT }, { t: v, sz: 1100 }]], { autofit: false });
    });
    shapes += pTextBox(12, colX, SH - 520000, colW, 320000, [{ t: 'Isi = catatan pengguna; bukan klaim produk aman/memenuhi standar', sz: 800, i: true, color: MUTED }], { align: 'ctr' });
    shapes += sideLabel(19, 'Contextos lab');
    slides.push({ shapes, pics, dark: true });
  }

  // ringkasan KPI
  {
    let shapes = title('Ringkasan', ++sec);
    const cols = 3;
    const gap = 250000;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = 1350000;
    r.kpis.forEach((k, i) => {
      const x = M + (i % cols) * (cw + gap);
      const y = 1350000 + Math.floor(i / cols) * (ch + 150000);
      // angka besar tipis ala template ("22", "70"): bulatan warna kecil, garis tipis, pemisah antar kolom
      shapes += pRect(20 + i * 3, x, y + 60000, 160000, 160000, [AMBER, MINT_D, MINT][i % 3]!, 'ellipse') + (i % cols ? pRect(21 + i * 3, x - gap / 2, y + 150000, 7000, ch - 300000, GRID) : '');
      shapes += pTextBox(22 + i * 3, x + 240000, y, cw - 240000, ch - 200000, [{ t: k.value, sz: 5000, font: LIGHT_FONT, color: THIN_NUM }, { t: k.label, sz: 1100, b: true }], { anchor: 't' });
    });
    shapes += productPanel(M, 4300000, CW);
    slides.push({ shapes, pics: [] });
  }

  /** Slide grid foto: 10 kolom; ada data akhir → baris awal + pembatas + baris akhir (10 nomor/slide), tanpa akhir → 2 baris awal (20 nomor/slide). */
  function photoGridSlides(pairs: NonNullable<ResearchReport['blocks'][number]['photoPairs']>, head: string, num?: number): Slide[] {
    const hasAkhir = pairs.some((p) => p.akhir);
    const per = hasAkhir ? 10 : 20;
    const COLS = 10;
    const cellW = CW / COLS;
    const gap = 70000;
    const imgW = cellW - gap;
    // potret 3:4 (DEC-088)
    const imgH = Math.round(imgW / 0.75);
    const out: Slide[] = [];
    for (let i = 0; i < pairs.length; i += per) {
      const chunk = pairs.slice(i, i + per);
      const pics: Slide['pics'] = [];
      let id = 100;
      let shapes = title(`${head} · No ${chunk[0]!.no}–${chunk[chunk.length - 1]!.no}`, i === 0 ? num : undefined);
      const cell = (c: { image?: string; lines: string[] }, no: number, x: number, y: number, capH: number, tag: string) => {
        const bytes = c.image ? dataUrlBytes(c.image) : undefined;
        if (bytes) {
          const sz = jpegSize(bytes);
          const p = pic(bytes, 'jpeg', sz.w, sz.h, `No ${no} ${tag}`, pics);
          shapes += pPicCover(id++, p.rid, x, y, imgW, imgH, p.file, sz.w, sz.h);
        } else {
          shapes += pTextBox(id++, x, y, imgW, imgH, [{ t: 'tanpa foto', sz: 800, color: MUTED }], { fill: PAPER, geom: 'rect', anchor: 'ctr', autofit: false });
        }
        shapes += pTextBox(id++, x - 30000, y + imgH + 20000, imgW + 60000, capH, [{ t: `No ${no}`, sz: 900, b: true }, ...c.lines.map((t) => ({ t, sz: 750, color: BODY2 }))], { autofit: false });
      };
      const label = (t: string, y: number, color: string) => {
        shapes += pTextBox(id++, M, y, 3000000, 230000, [{ t, sz: 1000, b: true, color, mono: true }], { autofit: false });
      };
      if (hasAkhir) {
        const yA = 1450000;
        const yB = yA + imgH + 1120000;
        label('DATA AWAL', yA - 250000, MINT);
        chunk.forEach((p, k) => cell(p.awal, p.no, M + k * cellW, yA, 780000, 'awal'));
        shapes += pRect(id++, M, yA + imgH + 840000, CW, 28000, MINT);
        label('DATA AKHIR', yB - 250000, MINT);
        chunk.forEach((p, k) => p.akhir && cell(p.akhir, p.no, M + k * cellW, yB, 420000, 'akhir'));
      } else {
        const yA = 1450000;
        const y2 = yA + imgH + 1120000;
        label('DATA AWAL', yA - 250000, MINT_D);
        chunk.forEach((p, k) => cell(p.awal, p.no, M + (k % COLS) * cellW, k < COLS ? yA : y2, 780000, 'awal'));
        if (chunk.length > COLS) shapes += pRect(id++, M, yA + imgH + 840000, CW, 28000, MINT);
      }
      out.push({ shapes, pics });
    }
    return out;
  }

  const BODY_TOP = 1300000;
  /** Tinggi baris foto di dalam slide (foto + keterangan). */
  const IMG_STRIP_H = 1900000;
  /** Baris foto (maks. 4) mengisi ruang tersisa sebuah slide: foto dipotong rapi + keterangan di bawahnya. */
  const drawImgStrip = (sl: Slide, imgs: ResearchReport['blocks'][number]['images'], y: number, id0: number): number => {
    let id = id0;
    const n = Math.max(1, imgs.length);
    const gap = 180000;
    const boxW = Math.min(2700000, (CW - gap * (n - 1)) / n);
    const boxH = IMG_STRIP_H - 360000;
    imgs.forEach((im, k) => {
      const x = M + k * (boxW + gap);
      const bytes = dataUrlBytes(im.dataUrl);
      if (!bytes) return;
      const sz = jpegSize(bytes);
      const p = pic(bytes, 'jpeg', sz.w, sz.h, imgCaption(im), sl.pics);
      sl.shapes += pPicCover(id++, p.rid, x, y, boxW, boxH, p.file, sz.w, sz.h);
      sl.shapes += pTextBox(id++, x, y + boxH + 30000, boxW, 320000, [{ t: imgCaption(im), sz: 900 }], { autofit: false });
    });
    return id;
  };
  const BODY_BOTTOM = SH - 600000;
  const TROW = 290000;
  const rowsFit = (h: number) => Math.max(1, Math.floor(h / TROW) - 1);
  const textH = (n: number) => n * 340000 + 80000;
  // perkiraan baris setelah teks panjang terlipat (agar tidak menimpa grafik/tabel di bawahnya)
  const paraText = (p: PPara) => (Array.isArray(p) ? p.map((r) => r.t).join('') : p.t);
  const wrapped = (ps: readonly PPara[], perLine: number) => ps.reduce((n, p) => n + Math.max(1, Math.ceil(paraText(p).length / perLine)), 0);
  const shrink = (p: PPara, sz: number): PPara => (Array.isArray(p) ? p.map((r) => ({ ...r, sz: Math.min(r.sz ?? sz, sz) })) : { ...p, sz: Math.min(p.sz ?? sz, sz) });
  let pack: { slide: Slide; y: number; id: number } | null = null;
  let tail: { slide: Slide; y: number } | undefined;
  let sectionPrefix: { head: string; num?: number } | undefined;

  /** Progres 3 tahap berdampingan (Harian | Mingguan | Bulanan): foto berderet ke bawah + data di sampingnya, maks. 10 foto/slide. */
  function progressSlides(cols: NonNullable<ResearchReport['blocks'][number]['progressColumns']>, head: string, num?: number): Slide[] {
    const caps = [4, 3, 3];
    const pages = Math.max(1, ...cols.map((c, k) => Math.ceil(c.items.length / (caps[k] ?? 3))));
    const gap = 180000;
    const colW = (CW - 2 * gap) / 3;
    const out: Slide[] = [];
    for (let pg = 0; pg < pages; pg++) {
      const pics: Slide['pics'] = [];
      let id = 100;
      let shapes = title(pg ? `${head} (lanjutan)` : head, pg ? undefined : num);
      cols.forEach((c, k) => {
        const cap = caps[k] ?? 3;
        const x = M + k * (colW + gap);
        shapes += pTextBox(id++, x, BODY_TOP, colW, 300000, [{ t: `${c.title.toUpperCase()} · ${c.items.length} FOTO`, sz: 1000, b: true, color: k === 0 ? BG : INK, mono: true }], { fill: k === 0 ? MINT_D : k === 1 ? 'E3E8D8' : 'EFE1DC', geom: 'rect', anchor: 'ctr', autofit: false });
        const items = c.items.slice(pg * cap, pg * cap + cap);
        const top = BODY_TOP + 380000;
        const rowH = (BODY_BOTTOM - top) / 4;
        if (!items.length) shapes += pTextBox(id++, x, top, colW, 500000, [{ t: c.items.length ? '—' : 'belum ada foto tahap ini', sz: 1000, color: MUTED }], { autofit: false });
        items.forEach((it, r) => {
          const y = top + r * rowH;
          const imgH = rowH - 90000;
          // potret 3:4 (DEC-088)
          const imgW = Math.min(colW * 0.42, imgH * 0.75);
          const bytes = it.image ? dataUrlBytes(it.image) : undefined;
          if (bytes) {
            const sz = jpegSize(bytes);
            const p = pic(bytes, 'jpeg', sz.w, sz.h, it.lines[0] ?? '', pics);
            shapes += pPicCover(id++, p.rid, x, y, imgW, imgH, p.file, sz.w, sz.h);
          } else shapes += pTextBox(id++, x, y, imgW, imgH, [{ t: 'tanpa foto', sz: 800, color: MUTED }], { fill: PAPER, geom: 'rect', anchor: 'ctr', autofit: false });
          shapes += pTextBox(id++, x + imgW + 70000, y, colW - imgW - 70000, imgH, it.lines.map((t, j) => ({ t, sz: j === 1 ? 1000 : 850, b: j === 1, color: j === 0 ? MINT_D : BODY2 })), { autofit: false });
          if (r < items.length - 1) shapes += pRect(id++, x, y + rowH - 45000, colW, 9000, GRID);
        });
      });
      out.push({ shapes, pics });
    }
    return out;
  }

  /**
   * Laporan belanja padat (DEC-096): kelompok (nota → cabang → barang) dikemas berdampingan, maks. 8 kolom barang per slide.
   * Satu kelompok tidak pernah dipisah dari notanya: >8 barang → kelompok lanjutan yang mengulang foto nota.
   */
  function belanjaSlides(groups: NonNullable<ResearchReport['blocks'][number]['belanja']>, head: string, num?: number): Slide[] {
    const UNITS = 8;
    const parts: { g: (typeof groups)[number]; leaves: (typeof groups)[number]['leaves']; cont: boolean }[] = [];
    for (const g of groups) {
      if (!g.leaves.length) parts.push({ g, leaves: [], cont: false });
      for (let i = 0; i < g.leaves.length; i += UNITS) parts.push({ g, leaves: g.leaves.slice(i, i + UNITS), cont: i > 0 });
    }
    const units = (x: (typeof parts)[number]) => Math.max(2, x.leaves.length);
    const pages: (typeof parts)[] = [];
    for (const x of parts) {
      const cur = pages[pages.length - 1];
      if (cur && cur.reduce((n, y) => n + units(y), 0) + units(x) <= UNITS) cur.push(x);
      else pages.push([x]);
    }
    const out: Slide[] = [];
    const gap = 140000;
    const top = BODY_TOP;
    const bottom = SH - 560000;
    pages.forEach((pg, pi) => {
      const pics: Slide['pics'] = [];
      let id = 400;
      let shapes = title(head + (pi ? ' (lanjutan)' : ''), pi ? undefined : num);
      const used = pg.reduce((n, y) => n + units(y), 0);
      // kolom dilebarkan agar slide penuh (ruang kosong minimal)
      const unitW = (CW - gap * (pg.length - 1)) / used;
      let x = M;
      for (const part of pg) {
        const w = unitW * units(part);
        // bingkai kelompok: nota & barang selalu dalam satu kotak
        shapes += pRect(id++, x, top, w, bottom - top, PAPER, 'rect') + pRect(id++, x + 120000, top, w - 240000, 50000, MINT_D);
        shapes += pTextBox(id++, x + 80000, top + 70000, w - 160000, 300000, [{ t: part.g.label + (part.cont ? ' (lanjutan)' : ''), sz: 1100, b: true }], { autofit: false, align: 'ctr' });
        const roots = part.g.roots.length ? part.g.roots.slice(0, 2) : [{ label: 'tanpa foto nota' }];
        const rootY = top + 400000;
        const rootH = 1600000;
        const rw = (w - 240000 - (roots.length - 1) * 80000) / roots.length;
        roots.forEach((n, k) => {
          const rx = x + 120000 + k * (rw + 80000);
          const bytes = n.image ? dataUrlBytes(n.image) : undefined;
          if (bytes) {
            const sz = jpegSize(bytes);
            const p = pic(bytes, 'jpeg', sz.w, sz.h, `Nota · ${part.g.label}`, pics);
            const f = fitBox(sz.w, sz.h, rw, rootH);
            const fx = rx + (rw - f.w) / 2;
            const fy = rootY + (rootH - f.h) / 2;
            shapes += pRect(id++, fx - 30000, fy - 30000, f.w + 60000, f.h + 60000, MINT);
            shapes += pPic(id++, p.rid, fx, fy, f.w, f.h, p.file);
          } else shapes += pTextBox(id++, rx, rootY, rw, rootH, [{ t: n.label, sz: 900, color: MUTED }], { fill: BG, geom: 'rect', anchor: 'ctr', autofit: false, align: 'ctr' });
        });
        shapes += pTextBox(id++, x + 80000, rootY + rootH + 10000, w - 160000, 220000, [{ t: 'NOTA / BUKTI BAYAR', sz: 750, b: true, color: MINT_D, mono: true }], { autofit: false, align: 'ctr' });
        const n = part.leaves.length;
        const stemTop = rootY + rootH + 240000;
        const branchY = stemTop + 170000;
        const leafY = branchY + 160000;
        const capH = 380000;
        const cellW = (w - 160000) / Math.max(n, 1);
        const leafW = cellW - 90000;
        const leafH = bottom - leafY - capH - 60000;
        const cx = (k: number) => x + 80000 + cellW * k + cellW / 2;
        if (n) {
          shapes += pLine(id++, x + w / 2, stemTop, x + w / 2, branchY);
          if (n > 1) shapes += pLine(id++, cx(0), branchY, cx(n - 1), branchY);
          part.leaves.forEach((leaf, k) => {
            shapes += pLine(id++, cx(k), branchY, cx(k), leafY - 20000);
            const lx = cx(k) - leafW / 2;
            const bytes = leaf.image ? dataUrlBytes(leaf.image) : undefined;
            let bottomY = leafY + leafH;
            if (bytes) {
              const sz = jpegSize(bytes);
              const p = pic(bytes, 'jpeg', sz.w, sz.h, leaf.label, pics);
              const f = fitBox(sz.w, sz.h, leafW, leafH);
              const fx = lx + (leafW - f.w) / 2;
              shapes += pRect(id++, fx - 12000, leafY - 12000, f.w + 24000, f.h + 24000, GRID);
              shapes += pPic(id++, p.rid, fx, leafY, f.w, f.h, p.file);
              bottomY = leafY + f.h;
            } else shapes += pTextBox(id++, lx, leafY, leafW, Math.min(leafH, 1200000), [{ t: 'tanpa foto', sz: 800, color: MUTED }], { fill: BG, geom: 'rect', anchor: 'ctr', autofit: false, align: 'ctr' });
            if (!bytes) bottomY = leafY + Math.min(leafH, 1200000);
            shapes += pTextBox(id++, lx - 40000, bottomY + 30000, leafW + 80000, capH, [{ t: leaf.label || '(tanpa nama)', sz: n > 5 ? 800 : 950, b: true }], { autofit: false, align: 'ctr' });
          });
        } else shapes += pTextBox(id++, x + 80000, leafY, w - 160000, 400000, [{ t: 'Belum ada foto barang.', sz: 900, color: MUTED }], { autofit: false, align: 'ctr' });
        x += w + gap;
      }
      out.push({ shapes, pics });
    });
    return out;
  }

  for (const b0 of r.blocks.filter((x) => !x.pptxSkip)) {
    const b = b0.pptxTable ? { ...b0, table: b0.pptxTable } : b0;
    let num = b.level === 1 ? ++sec : undefined;
    let head = b.heading;
    // DEC-093: bagian tanpa isi (mis. "Laporan harian") tidak dibuatkan slide sendiri → awalan judul slide berikutnya
    const emptySection = !b.lines.length && !(b.table?.rows.length) && !(b.charts?.length) && !b.photoPairs && !b.progressColumns && !b.cards?.length && !b.photoCards?.length && !b.belanja?.length && (b.pptxOmitImages || !b.images.length);
    if (emptySection) {
      sectionPrefix = { head, ...(num && { num }) };
      continue;
    }
    if (sectionPrefix) {
      head = `${sectionPrefix.head} · ${head}`;
      num = num ?? sectionPrefix.num;
      sectionPrefix = undefined;
    }
    const lines = b.lines.map(linePara);
    const tableRows = b.table?.rows ?? [];
    const lineChunks: PPara[][] = [];
    for (let i = 0; i < lines.length; i += LINES_PER_SLIDE) lineChunks.push(lines.slice(i, i + LINES_PER_SLIDE));
    const rowChunks: string[][][] = [];
    for (let i = 0; i < tableRows.length; i += ROWS_PER_SLIDE) rowChunks.push(tableRows.slice(i, i + ROWS_PER_SLIDE));
    let first = true;
    const t = () => {
      const s = title(head + (first ? '' : ' (lanjutan)'), first ? num : undefined);
      first = false;
      return s;
    };
    if (b.belanja?.length) {
      for (const sl of belanjaSlides(b.belanja, head, num)) slides.push(sl);
      tail = undefined;
      continue;
    }
    // grid foto per nomor (DEC-077): maks. 20 foto/slide — 10 awal di atas, garis pembatas, 10 akhir di bawah
    if (b.photoPairs?.length) {
      for (const s of photoGridSlides(b.photoPairs, head, first ? num : undefined)) slides.push(s);
      first = false;
    }
    tail = undefined;
    // kartu penjelasan 2 kolom dalam satu slide (mis. penjelasan perlakuan, DEC-087)
    if (b.cards?.length) {
      let sh = t();
      let id = 300;
      const gap = 200000;
      const cw = (CW - gap) / 2;
      const top = BODY_TOP + (b.lines.length ? 380000 : 0);
      if (b.lines.length) sh += pTextBox(id++, M, BODY_TOP, CW, 340000, b.lines.map((l) => ({ t: l, sz: 1100, color: MUTED })), { autofit: false });
      const rowsN = Math.ceil(b.cards.length / 2);
      const ch = (BODY_BOTTOM - top - gap * (rowsN - 1)) / rowsN;
      b.cards.forEach((c, k) => {
        const x = M + (k % 2) * (cw + gap);
        const yy = top + Math.floor(k / 2) * (ch + gap);
        sh += pRect(id++, x, yy, cw, ch, PAPER, 'rect') + pRect(id++, x, yy + 150000, 60000, ch - 300000, MINT_D);
        sh += pTextBox(id++, x + 200000, yy + 90000, cw - 300000, ch - 180000, [{ t: c.title, sz: 1300, b: true }, ...c.lines.map((l, j) => (j === 0 ? { t: l, sz: 1000, color: BODY2 } : [{ t: '• ', sz: 1000, b: true, color: MINT_D }, { t: l, sz: 1000 }]))], { autofit: false });
      });
      slides.push({ shapes: sh, pics: [] });
      pack = null;
      continue;
    }
    // foto berjajar potret + data di bawahnya, maks. 5 per slide (mis. foto perlakuan, DEC-089)
    if (b.photoCards?.length) {
      const per = 5;
      const gap = 180000;
      const cw = (CW - gap * (per - 1)) / per;
      const imgH = Math.round(cw / 0.75);
      for (let i = 0; i < b.photoCards.length; i += per) {
        const pics: Slide['pics'] = [];
        let sh = t();
        let id = 500;
        b.photoCards.slice(i, i + per).forEach((c, k) => {
          const x = M + k * (cw + gap);
          const bytes = c.image ? dataUrlBytes(c.image) : undefined;
          if (bytes) {
            const sz = jpegSize(bytes);
            const p = pic(bytes, 'jpeg', sz.w, sz.h, c.lines[0] ?? '', pics);
            sh += pPicCover(id++, p.rid, x, BODY_TOP, cw, imgH, p.file, sz.w, sz.h);
          } else sh += pTextBox(id++, x, BODY_TOP, cw, imgH, [{ t: 'tanpa foto', sz: 900, color: MUTED }], { fill: PAPER, geom: 'rect', anchor: 'ctr', autofit: false });
          sh += pTextBox(id++, x, BODY_TOP + imgH + 60000, cw, BODY_BOTTOM - BODY_TOP - imgH - 60000, c.lines.map((l, j) => ({ t: l, sz: j === 0 ? 1100 : 950, b: j === 0, color: j === 1 ? MINT_D : BODY2 })), { autofit: false });
        });
        slides.push({ shapes: sh, pics });
      }
      pack = null;
      continue;
    }
    // progres foto 3 tahap (DEC-086)
    if (b.progressColumns) {
      for (const sl of progressSlides(b.progressColumns, head, first ? num : undefined)) slides.push(sl);
      first = false;
      pack = null;
      continue;
    }
    // DEC-086: slide dipadatkan — teks, grafik, dan tabel blok yang sama digabung selama muat;
    // blok teks pendek berturut-turut ditumpuk di satu slide. Isi/penjelasan tidak diubah.
    const charts0 = b.charts ?? [];
    const blockLines = b.photoPairs ? [] : lines;
    const inlineImgs = b.pptxOmitImages ? [] : b.images.filter((im) => !(im.video && im.mediaId && videos.get(im.mediaId)) && dataUrlBytes(im.dataUrl));
    const small = !b.photoPairs && !b.pptxAfterTable && !charts0.length && tableRows.length <= 10 && blockLines.length <= 7 && inlineImgs.length <= 4 && inlineImgs.length === (b.pptxOmitImages ? 0 : b.images.length);
    if (small) {
      const linesH = blockLines.length ? (tableRows.length || inlineImgs.length ? wrapped(blockLines, 135) * 260000 + 60000 : textH(wrapped(blockLines, 110))) : 0;
      const tableH = tableRows.length ? (tableRows.length + 1) * TROW + 80000 : 0;
      const imgH = inlineImgs.length ? IMG_STRIP_H : 0;
      const bodyH = Math.max(linesH + tableH + imgH, blockLines.length || tableRows.length || inlineImgs.length ? 0 : 400000);
      const draw = (sl: Slide, y0: number, idBase: number) => {
        let y = y0;
        let id = idBase;
        if (blockLines.length) {
          const ps = tableRows.length || inlineImgs.length ? blockLines.map((p) => shrink(p, 1200)) : blockLines;
          sl.shapes += pTextBox(id++, M, y, CW, linesH, ps);
          y += linesH;
        } else if (!tableRows.length && !inlineImgs.length) {
          sl.shapes += pTextBox(id++, M, y, CW, 400000, [{ t: 'belum dicatat', sz: 1500, color: MUTED }]);
          y += 400000;
        }
        if (tableRows.length) {
          sl.shapes += pTable(id++, M, y, CW, b.table!.head, tableRows, { rowH: TROW, sz: 1000 });
          y += tableH;
        }
        if (inlineImgs.length) {
          id = drawImgStrip(sl, inlineImgs, y, id);
          y += imgH;
        }
        return { y, id };
      };
      const need = 420000 + bodyH;
      if (pack && pack.y + need <= BODY_BOTTOM) {
        // tumpuk di slide sebelumnya: sub-judul (bernomor bila bagian utama) + isi
        if (num) pack.slide.shapes += pTextBox(pack.id++, M, pack.y, 560000, 340000, [{ t: pad2(num), sz: 2000, b: true, color: MINT, serif: true }], { anchor: 'ctr', autofit: false });
        pack.slide.shapes += pTextBox(pack.id++, num ? M + 640000 : M, pack.y - 20000, CW - 640000, 380000, [{ t: head, sz: num ? 1800 : 1500, b: true, serif: true }], { anchor: 'ctr', autofit: false });
        pack.slide.shapes += pRect(pack.id++, M, pack.y - 60000, CW, 7000, INK);
        const r = draw(pack.slide, pack.y + 420000, pack.id);
        pack.id = r.id;
        pack.y = r.y + 160000;
        continue;
      }
      const sl: Slide = { shapes: t(), pics: [] };
      slides.push(sl);
      const r = draw(sl, BODY_TOP, 200);
      pack = { slide: sl, y: r.y + 200000, id: r.id + 1 };
      continue;
    }
    pack = null;
    // teks panjang: slide teks penuh, sisa baris terakhir ikut slide gabungan
    const chunks: PPara[][] = [];
    for (let i = 0; i < blockLines.length; i += LINES_PER_SLIDE) chunks.push(blockLines.slice(i, i + LINES_PER_SLIDE));
    const lastLines = chunks.length ? chunks.pop()! : [];
    for (const c of chunks) slides.push({ shapes: t() + pTextBox(30, M, BODY_TOP, CW, SH - 1900000, c), pics: [] });
    const rows = [...tableRows];
    let inlineDone = 0;
    const compactLines = charts0.length > 0 || rows.length > 0;
    if (!b.photoPairs && (lastLines.length || charts0.length || rows.length || !b.images.length)) {
      // slide gabungan: teks (ringkas) → grafik (maks. 2 berdampingan) → tabel di bawahnya
      const pics: Slide['pics'] = [];
      let shapes = t();
      let y = BODY_TOP;
      if (lastLines.length) {
        const small = compactLines ? lastLines.map((p) => shrink(p, 1200)) : lastLines;
        const h = compactLines ? wrapped(lastLines, 135) * 260000 + 60000 : textH(wrapped(lastLines, 110));
        shapes += pTextBox(30, M, y, CW, h, small);
        y += h + 80000;
      } else if (!charts0.length && !rows.length) {
        shapes += pTextBox(30, M, y, CW, 600000, [{ t: b.images.length ? '' : 'belum dicatat', sz: 1500, color: MUTED }]);
      }
      const onSlide = b.nativeChart ? charts0.slice(0, 1) : charts0.slice(0, 2);
      if (b.nativeChart && onSlide.length) {
        // grafik garis native + teks penjelasan singkat di bawahnya (DEC-087)
        const cap = b.chartCaption ? [{ t: b.chartCaption, sz: 1100 }] : [];
        const capH = b.chartCaption ? Math.ceil(b.chartCaption.length / 185) * 240000 + 90000 : 0;
        // sisakan tempat agar minimal beberapa baris tabel muat di bawah grafik & penjelasan (DEC-086/087)
        const keep = rows.length ? (Math.min(rows.length, 5) + 1) * TROW : 0;
        const free = BODY_BOTTOM - y - 140000 - capH - keep;
        const chartH = rows.length ? Math.max(1600000, Math.min(2500000, free)) : Math.max(1600000, free);
        const g = pLineChart(400, M, y, CW, chartH, onSlide[0]!);
        shapes += g.xml;
        y += chartH + 40000;
        if (cap.length) {
          shapes += pTextBox(48, M, y, CW, capH, cap, { fill: PAPER, geom: 'rect', autofit: false });
          y += capH + 100000;
        }
      } else if (onSlide.length) {
        const gap = 200000;
        const cw = onSlide.length === 2 ? (CW - gap) / 2 : CW;
        const avail = BODY_BOTTOM - y - 280000;
        const chartH = rows.length ? Math.min(2600000, avail * 0.58) : avail;
        let hUsed = 0;
        onSlide.forEach((c, k) => {
          const x = M + k * (cw + gap);
          const png = charts.get(c.id);
          if (png) {
            const p = pic(png.bytes, 'png', png.w, png.h, c.title, pics);
            const f = fitBox(png.w, png.h, cw, chartH);
            shapes += pPic(40 + k, p.rid, x + (cw - f.w) / 2, y, f.w, f.h, p.file);
            hUsed = Math.max(hUsed, f.h);
          } else {
            shapes += pTextBox(40 + k, x, y, cw, 600000, [{ t: c.title, sz: 1200, b: true }, { t: '(gambar grafik tidak tersedia — lihat tabel)', sz: 1100, color: MUTED }]);
            hUsed = Math.max(hUsed, 600000);
          }
          shapes += pTextBox(44 + k, x, y + hUsed + 20000, cw, 260000, [{ t: c.note, sz: 900, color: MUTED }], { autofit: false });
        });
        y += hUsed + 300000;
      }
      if (rows.length) {
        const n = rowsFit(BODY_BOTTOM - y);
        if (n >= Math.min(3, rows.length)) {
          const part = rows.splice(0, n);
          shapes += pTable(31, M, y, CW, b.table!.head, part, { rowH: TROW, sz: 1000 });
          y += (part.length + 1) * TROW;
        }
      }
      const comp: Slide = { shapes, pics };
      // foto ikut di slide yang sama bila tabel sudah habis & masih ada ruang (DEC-093)
      if (!rows.length && inlineImgs.length && y + IMG_STRIP_H <= BODY_BOTTOM) {
        const take = inlineImgs.slice(0, 4);
        drawImgStrip(comp, take, y + 60000, 600);
        y += IMG_STRIP_H + 60000;
        inlineDone = take.length;
      }
      slides.push(comp);
      tail = { slide: comp, y: rows.length ? BODY_BOTTOM : y };
      // grafik ke-3 dst: 2 per slide
      for (let i = 2; i < charts0.length; i += 2) {
        const pics2: Slide['pics'] = [];
        let sh = t();
        const pair = charts0.slice(i, i + 2);
        const gap = 200000;
        const cw = pair.length === 2 ? (CW - gap) / 2 : CW;
        pair.forEach((c, k) => {
          const x = M + k * (cw + gap);
          const png = charts.get(c.id);
          if (png) {
            const p = pic(png.bytes, 'png', png.w, png.h, c.title, pics2);
            const f = fitBox(png.w, png.h, cw, BODY_BOTTOM - BODY_TOP - 300000);
            sh += pPic(40 + k, p.rid, x + (cw - f.w) / 2, BODY_TOP, f.w, f.h, p.file);
            sh += pTextBox(44 + k, x, BODY_TOP + f.h + 20000, cw, 260000, [{ t: c.note, sz: 900, color: MUTED }], { autofit: false });
          } else sh += pTextBox(40 + k, x, BODY_TOP, cw, 600000, [{ t: c.title, sz: 1200, b: true }, { t: '(gambar grafik tidak tersedia)', sz: 1100, color: MUTED }]);
        });
        slides.push({ shapes: sh, pics: pics2 });
      }
    }
    // sisa baris tabel: sebanyak mungkin per slide
    const per = rowsFit(BODY_BOTTOM - BODY_TOP);
    while (rows.length) {
      const part = rows.splice(0, per);
      const sl: Slide = { shapes: t() + pTable(31, M, BODY_TOP, CW, b.table!.head, part, { rowH: TROW, sz: 1000 }), pics: [] };
      slides.push(sl);
      tail = { slide: sl, y: BODY_TOP + (part.length + 1) * TROW };
    }
    // tabel tambahan tepat di bawah tabel utama (mis. perlakuan di bawah data akhir)
    if (b.pptxAfterTable && b.pptxAfterTable.rows.length) {
      const at = b.pptxAfterTable;
      const need = 330000 + (at.rows.length + 1) * TROW;
      let target = tail && tail.y + 150000 + need <= BODY_BOTTOM ? tail : undefined;
      if (!target) {
        const sl: Slide = { shapes: t(), pics: [] };
        slides.push(sl);
        target = { slide: sl, y: BODY_TOP - 150000 };
      }
      const y0 = target.y + 150000;
      target.slide.shapes += pTextBox(70, M, y0, CW, 300000, [{ t: at.title.toUpperCase(), sz: 1000, b: true, color: MINT_D, mono: true }], { autofit: false });
      target.slide.shapes += pTable(71, M, y0 + 330000, CW, at.head, at.rows, { rowH: TROW, sz: 1000 });
    }
    // foto: 6 per slide (2 baris × 3); kelompok berisi video tetap 3 per slide agar video cukup besar
    const restImgs = inlineDone ? b.images.filter((im) => !inlineImgs.slice(0, inlineDone).includes(im)) : b.images;
    for (let i = 0; !b.pptxOmitImages && i < restImgs.length; ) {
      const hasVid = restImgs.slice(i, i + 6).some((im) => im.video && im.mediaId && videos.get(im.mediaId));
      const take = hasVid ? 3 : 6;
      const group = restImgs.slice(i, i + take);
      i += take;
      const pics: Slide['pics'] = [];
      const vids: NonNullable<Slide['vids']> = [];
      let shapes = title(`${head} — foto/video`);
      const gap = 220000;
      const boxW = (CW - 2 * gap) / 3;
      const rowsN = take === 6 && group.length > 3 ? 2 : 1;
      const capH = rowsN === 2 ? 420000 : 900000;
      const imgH = rowsN === 2 ? (BODY_BOTTOM - BODY_TOP - 2 * capH - 100000) / 2 : 3400000;
      group.forEach((im, k) => {
        const x = M + (k % 3) * (boxW + gap);
        const y = BODY_TOP + Math.floor(k / 3) * (imgH + capH + 100000);
        const bytes = dataUrlBytes(im.dataUrl);
        if (bytes) {
          const sz = jpegSize(bytes);
          const p = pic(bytes, 'jpeg', sz.w, sz.h, imgCaption(im), pics);
          const f = fitBox(sz.w, sz.h, boxW, imgH);
          const v = im.video && im.mediaId ? videos.get(im.mediaId) : undefined;
          if (v) {
            // video asli tertanam (bisa diputar di PowerPoint); gambar pratinjau = poster
            vidN++;
            const file = `media${vidN}.${v.ext}`;
            vidExts.set(v.ext, v.mime);
            const rid = `rIdV${vids.length + 1}`;
            const mrid = `rIdM${vids.length + 1}`;
            vids.push({ rid, mrid, file, bytes: v.bytes, spid: 50 + k });
            shapes += pVideo(50 + k, p.rid, rid, mrid, x + (boxW - f.w) / 2, y, f.w, f.h, im.name);
          } else shapes += pPic(50 + k, p.rid, x + (boxW - f.w) / 2, y, f.w, f.h, p.file);
        } else shapes += pRect(50 + k, x, y, boxW, Math.min(imgH, 1200000), PAPER, 'rect');
        shapes += pTextBox(60 + k, x, y + imgH + 30000, boxW, capH, rowsN === 2 ? [{ t: imgCaption(im), sz: 1000 }, { t: im.name, sz: 800, color: MUTED, mono: true }] : [{ t: imgCaption(im), sz: 1100 }, { t: im.name, sz: 900, color: MUTED, mono: true }], { autofit: rowsN === 1 });
      });
      slides.push({ shapes, pics, ...(vids.length && { vids }) });
    }
  }

  // nomor halaman (setelah jumlah slide diketahui)
  slides.forEach((s, i) => {
    if (i === 0) return;
    // folio ala infografik referensi (DEC-126): nomor halaman kecil abu di kanan atas, label tegak, keterangan bawah
    s.shapes += pageNo(91, i + 1) + sideLabel(92, 'Contextos lab');
    s.shapes += pTextBox(90, M, SH - 450000, CW * 0.8, 300000, [{ t: `${r.cover.code} · ${r.footer}`, sz: 800, color: MUTED }]);
  });

  return packPptx(slides, vidExts);
}

/** Bungkus slide jadi berkas .pptx (tema, master, layout, relasi, media). */
function packPptx(slides: Slide[], vidExts: ReadonlyMap<string, string> = new Map()): Uint8Array {
  const files: ZipFile[] = [];
  const slideXml = (s: Slide) => `${CT_HEAD}<p:sld ${P_NS}><p:cSld><p:spTree>${emptyTree}${s.shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${s.vids?.length ? videoTiming(s.vids.map((v) => v.spid)) : ''}</p:sld>`;
  slides.forEach((s, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: txt(slideXml(s)) });
    files.push({
      name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${s.pics.map((p) => `<Relationship Id="${p.rid}" Type="${REL_NS}/image" Target="../media/${p.file}"/>`).join('')}${(s.vids ?? []).map((v) => `<Relationship Id="${v.rid}" Type="${REL_NS}/video" Target="../media/${v.file}"/><Relationship Id="${v.mrid}" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/${v.file}"/>`).join('')}</Relationships>`),
    });
    for (const p of s.pics) files.push({ name: `ppt/media/${p.file}`, data: p.bytes });
    for (const v of s.vids ?? []) files.push({ name: `ppt/media/${v.file}`, data: v.bytes });
  });

  const theme = `${CT_HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="GEMA"><a:themeElements><a:clrScheme name="GEMA"><a:dk1><a:srgbClr val="2B2320"/></a:dk1><a:lt1><a:srgbClr val="FBFAF7"/></a:lt1><a:dk2><a:srgbClr val="4A3F3A"/></a:dk2><a:lt2><a:srgbClr val="F1EDE8"/></a:lt2><a:accent1><a:srgbClr val="A64B2A"/></a:accent1><a:accent2><a:srgbClr val="7B3B34"/></a:accent2><a:accent3><a:srgbClr val="5E7B3A"/></a:accent3><a:accent4><a:srgbClr val="A58E83"/></a:accent4><a:accent5><a:srgbClr val="7D6E66"/></a:accent5><a:accent6><a:srgbClr val="DCD4CC"/></a:accent6><a:hlink><a:srgbClr val="5E7B3A"/></a:hlink><a:folHlink><a:srgbClr val="7D6E66"/></a:folHlink></a:clrScheme><a:fontScheme name="GEMA"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial Narrow"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="GEMA"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const master = `${CT_HEAD}<p:sldMaster ${P_NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${BG}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
  const layout = `${CT_HEAD}<p:sldLayout ${P_NS} type="blank" preserve="1"><p:cSld name="Kosong"><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const pres = `${CT_HEAD}<p:presentation ${P_NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${SW}" cy="${SH}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels = `${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="${REL_NS}/theme" Target="theme/theme1.xml"/>${slides.map((_, i) => `<Relationship Id="rId${i + 3}" Type="${REL_NS}/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`;
  const types = `${CT_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>${[...vidExts].map(([e, m]) => `<Default Extension="${e}" ContentType="${m}"/>`).join('')}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`;
  return zipStore([
    { name: '[Content_Types].xml', data: txt(types) },
    { name: '_rels/.rels', data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`) },
    { name: 'ppt/presentation.xml', data: txt(pres) },
    { name: 'ppt/_rels/presentation.xml.rels', data: txt(presRels) },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: txt(master) },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL_NS}/theme" Target="../theme/theme1.xml"/></Relationships>`) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: txt(layout) },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`) },
    { name: 'ppt/theme/theme1.xml', data: txt(theme) },
    ...files,
  ]);
}

/** Segmen garis ke arah mana pun (flipH/flipV), untuk grafik garis native (DEC-087). */
const pSeg = (id: number, x1: number, y1: number, x2: number, y2: number, color: string, w = 25400) => {
  const fh = x2 < x1 ? ' flipH="1"' : '';
  const fv = y2 < y1 ? ' flipV="1"' : '';
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Garis ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${fh}${fv}><a:off x="${Math.round(Math.min(x1, x2))}" y="${Math.round(Math.min(y1, y2))}"/><a:ext cx="${Math.max(1, Math.round(Math.abs(x2 - x1)))}" cy="${Math.max(1, Math.round(Math.abs(y2 - y1)))}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${w}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></p:spPr></p:cxnSp>`;
};

/** Warna seri aplikasi (mint/amber) → palet tanah slide (DEC-121); warna lain dipakai apa adanya. */
const EARTH: Record<string, string> = { '1FA88F': MINT_D, '63E6CF': MINT_D, F5A524: MINT };
const earth = (c: string) => {
  const h = c.replace('#', '').toUpperCase();
  return EARTH[h] ?? h;
};

/** Angka sumbu ringkas (koma desimal). */
const axisNum = (v: number) => {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return String(r).replace('.', ',');
};

/**
 * Grafik garis digambar langsung dengan bentuk PowerPoint (tanpa gambar): sumbu, garis bantu, label,
 * garis tiap seri + titik, legenda. Mengembalikan XML & id berikutnya.
 */
export function pLineChart(id0: number, x: number, y: number, w: number, h: number, spec: ChartSpec): { xml: string; next: number } {
  let id = id0;
  let xml = '';
  const vals = spec.series.flatMap((se) => se.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  if (!vals.length) return { xml: pTextBox(id++, x, y, w, 400000, [{ t: '(belum ada angka untuk grafik)', sz: 1100, color: MUTED }]), next: id };
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const left = x + 620000;
  const top = y + 330000;
  const right = x + w - 120000;
  const bottom = y + h - 470000;
  const n = spec.x.length;
  const px = (i: number) => (n <= 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1));
  const py = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  // garis bantu & label sumbu Y (5 tingkat)
  for (let k = 0; k <= 4; k++) {
    const v = lo + ((hi - lo) * k) / 4;
    const yy = py(v);
    xml += pSeg(id++, left, yy, right, yy, k === 0 ? INK : GRID, k === 0 ? 12700 : 6350);
    xml += pTextBox(id++, x, yy - 120000, 560000, 240000, [{ t: axisNum(v), sz: 800, color: MUTED, mono: true }], { autofit: false });
  }
  // label sumbu X (maks. ±14 label)
  const step = Math.max(1, Math.ceil(n / 14));
  spec.x.forEach((lab, i) => {
    if (i % step && i !== n - 1) return;
    xml += pTextBox(id++, px(i) - 200000, bottom + 40000, 400000, 220000, [{ t: lab, sz: 800, color: MUTED, mono: true }], { autofit: false, align: 'ctr' });
  });
  if (spec.xTitle) xml += pTextBox(id++, left, bottom + 240000, right - left, 200000, [{ t: spec.xTitle, sz: 800, color: MUTED }], { autofit: false, align: 'ctr' });
  if (spec.unit) xml += pTextBox(id++, x, top - 300000, 900000, 220000, [{ t: spec.unit, sz: 800, b: true, color: MUTED, mono: true }], { autofit: false });
  // seri: garis antar titik berurutan yang ada nilainya + titik kecil
  spec.series.forEach((se) => {
    const col = earth(se.color);
    let prev: [number, number] | undefined;
    se.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        prev = undefined;
        return;
      }
      const pt: [number, number] = [px(i), py(v)];
      if (prev) xml += pSeg(id++, prev[0], prev[1], pt[0], pt[1], col, 28575);
      if (n <= 60) xml += pRect(id++, pt[0] - 38000, pt[1] - 38000, 76000, 76000, col, 'ellipse');
      prev = pt;
    });
  });
  // legenda (kanan atas)
  let lx = right;
  [...spec.series].reverse().forEach((se) => {
    const tw = 160000 + se.name.length * 70000;
    lx -= tw + 120000;
    xml += pRect(id++, lx, y + 90000, 150000, 60000, earth(se.color));
    xml += pTextBox(id++, lx + 180000, y + 10000, tw, 220000, [{ t: se.name, sz: 900, b: true }], { autofit: false });
  });
  return { xml, next: id };
}

/** Garis lurus (konektor) untuk diagram. */
const pLine = (id: number, x1: number, y1: number, x2: number, y2: number, color = MINT, w = 22225) =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Garis ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${Math.round(Math.min(x1, x2))}" y="${Math.round(Math.min(y1, y2))}"/><a:ext cx="${Math.round(Math.abs(x2 - x1))}" cy="${Math.round(Math.abs(y2 - y1))}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${w}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></p:spPr></p:cxnSp>`;

export interface TreeNode {
  /** JPEG data URL; kosong = kotak "tanpa foto". */
  image?: string;
  label: string;
}

export interface TreeSlide {
  title: string;
  subtitle: string;
  /** Akar diagram (mis. foto nota) — maks. 3 berdampingan. */
  roots: TreeNode[];
  rootLabel: string;
  /** Cabang (mis. foto barang + nama). */
  leaves: TreeNode[];
  footer: string;
}

/**
 * PowerPoint diagram cabang (DEC-078, laporan belanja): judul, akar (foto nota) di atas, garis bercabang ke bawah
 * menuju tiap daun (foto barang + nama). Maks. 8 daun per slide; lebih → slide lanjutan dengan akar yang sama.
 */
export function buildTreePptx(items: TreeSlide[]): Uint8Array {
  const M = 500000;
  const CW = SW - 2 * M;
  const MAX_LEAVES = 8;
  const slides: Slide[] = [];
  let picN = 0;
  const pics0 = (bytes: Uint8Array, list: Slide['pics']) => {
    picN++;
    const sz = jpegSize(bytes);
    const p = { rid: `rIdP${list.length + 2}`, file: `image${picN}.jpeg`, bytes, w: sz.w, h: sz.h, caption: '', ext: 'jpeg' as const };
    list.push(p);
    return p;
  };
  const fit = (w: number, h: number, bw: number, bh: number) => {
    const k = Math.min(bw / w, bh / h);
    return { w: w * k, h: h * k };
  };
  for (const it of items) {
    const chunks: TreeNode[][] = [];
    for (let i = 0; i < Math.max(it.leaves.length, 1); i += MAX_LEAVES) chunks.push(it.leaves.slice(i, i + MAX_LEAVES));
    chunks.forEach((leaves, ci) => {
      const pics: Slide['pics'] = [];
      let id = 10;
      // kepala ala infografik referensi (DEC-126)
      let shapes = masthead(id, M, 'Laporan belanja.', it.subtitle) + sideLabel(id + 2, 'Contextos lab') + pageNo(id + 3, slides.length + 1);
      id += 4;
      shapes += kickerBar(id++, SW / 2, 640000, 'Laporan belanja', 'sack');
      shapes += pTextBox(id++, M, 860000, CW, 300000, [{ t: it.title + (ci ? ' (lanjutan)' : ''), sz: 2000, b: true, serif: true }], { anchor: 'ctr', autofit: false, align: 'ctr' });
      // label akar di atas, lalu foto nota (bingkai rapat mengikuti foto)
      shapes += pTextBox(id++, M, 1190000, CW, 280000, [{ t: it.rootLabel, sz: 1000, b: true, color: MINT, caps: true }], { autofit: false, align: 'ctr' });
      const roots = it.roots.length ? it.roots.slice(0, 3) : [{ label: 'tanpa foto nota' }];
      const rootBoxW = 2300000;
      const rootBoxH = 1650000;
      const rootY = 1490000;
      const totalRootW = roots.length * rootBoxW + (roots.length - 1) * 150000;
      const rootX0 = M + (CW - totalRootW) / 2;
      roots.forEach((n, k) => {
        const x = rootX0 + k * (rootBoxW + 150000);
        const bytes = n.image ? dataUrlBytes(n.image) : undefined;
        if (bytes) {
          const p = pics0(bytes, pics);
          const f = fit(p.w, p.h, rootBoxW, rootBoxH);
          const fx = x + (rootBoxW - f.w) / 2;
          const fy = rootY + (rootBoxH - f.h) / 2;
          shapes += pRect(id++, fx - 45000, fy - 45000, f.w + 90000, f.h + 90000, MINT);
          shapes += pPic(id++, p.rid, fx, fy, f.w, f.h, p.file);
        } else shapes += pTextBox(id++, x, rootY, rootBoxW, rootBoxH, [{ t: n.label, sz: 1100, color: MUTED }], { fill: PAPER, geom: 'rect', anchor: 'ctr', autofit: false, align: 'ctr' });
      });
      // cabang: batang dari bawah nota → garis datar → turun ke tiap barang
      const n = leaves.length;
      const stemTop = rootY + rootBoxH + 60000;
      const branchY = stemTop + 320000;
      const leafY = branchY + 280000;
      const cellW = CW / Math.max(n, 1);
      const leafW = Math.min(cellW - 180000, 1900000);
      const leafH = Math.min(SH - leafY - 1000000, 1600000);
      const cx = (k: number) => M + cellW * k + cellW / 2;
      const rootCx = M + CW / 2;
      if (n) {
        shapes += pLine(id++, rootCx, stemTop, rootCx, branchY);
        if (n > 1) shapes += pLine(id++, cx(0), branchY, cx(n - 1), branchY);
        leaves.forEach((leaf, k) => {
          shapes += pLine(id++, cx(k), branchY, cx(k), leafY - 30000);
          const x = cx(k) - leafW / 2;
          const bytes = leaf.image ? dataUrlBytes(leaf.image) : undefined;
          let bottom = leafY + leafH;
          if (bytes) {
            const p = pics0(bytes, pics);
            const f = fit(p.w, p.h, leafW, leafH);
            const fx = x + (leafW - f.w) / 2;
            shapes += pRect(id++, fx - 15000, leafY - 15000, f.w + 30000, f.h + 30000, GRID);
            shapes += pPic(id++, p.rid, fx, leafY, f.w, f.h, p.file);
            bottom = leafY + f.h;
          } else shapes += pTextBox(id++, x, leafY, leafW, leafH, [{ t: 'tanpa foto', sz: 900, color: MUTED }], { fill: PAPER, geom: 'rect', anchor: 'ctr', autofit: false, align: 'ctr' });
          shapes += pTextBox(id++, x - 80000, bottom + 50000, leafW + 160000, 520000, [{ t: leaf.label || '(tanpa nama)', sz: 1100, b: true }], { autofit: false, align: 'ctr' });
        });
      } else {
        shapes += pTextBox(id++, M, leafY, CW, 400000, [{ t: 'Belum ada foto barang.', sz: 1200, color: MUTED }], { autofit: false, align: 'ctr' });
      }
      shapes += pTextBox(90, M, SH - 420000, CW, 300000, [{ t: it.footer, sz: 800, color: MUTED, mono: true }], { autofit: false });
      slides.push({ shapes, pics });
    });
  }
  return packPptx(slides);
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
