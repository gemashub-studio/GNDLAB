/**
 * Ekspor DOCX & PPTX TANPA dependensi (DEC-052): file Office = zip (metode "store") berisi XML
 * Office Open XML minimal. Gambar = thumbnail JPEG yang sudah tersimpan + grafik PNG (DEC-058). Offline di browser.
 */
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
const INK = '0E1A1F';
const MINT = '63E6CF';
const MINT_D = '1FA88F';
const PAPER = 'F3F6F7';
const GRID = 'E2E8EA';
const MUTED = '5B6B72';
const AMBER = 'F5A524';

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
  body.push(wPara('GEMA RND LAB · RISET PRODUK', { b: true, sz: 18, color: MINT_D, mono: true, after: 240 }));
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

type PRun = { t: string; sz: number; b?: boolean; color?: string; mono?: boolean };
type PPara = PRun | PRun[];
const aRun = (p: PRun) => `<a:r><a:rPr lang="id-ID" sz="${p.sz}"${p.b ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${p.color ?? INK}"/></a:solidFill>${p.mono ? '<a:latin typeface="Consolas"/>' : ''}</a:rPr><a:t>${xml(p.t)}</a:t></a:r>`;
const aParas = (paras: PPara[], spcAft = 300, align?: 'ctr') => paras.map((p) => `<a:p><a:pPr${align ? ` algn="${align}"` : ''}><a:spcAft><a:spcPts val="${spcAft}"/></a:spcAft></a:pPr>${(Array.isArray(p) ? p : [p]).map(aRun).join('')}</a:p>`).join('') || '<a:p><a:endParaRPr lang="id-ID"/></a:p>';

function pTextBox(id: number, x: number, y: number, w: number, h: number, paras: PPara[], o: { fill?: string; geom?: string; anchor?: 't' | 'ctr' | 'b'; autofit?: boolean; align?: 'ctr' } = {}): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Teks ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${o.geom ?? 'rect'}"><a:avLst/></a:prstGeom>${o.fill ? `<a:solidFill><a:srgbClr val="${o.fill}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${o.anchor ?? 't'}">${o.autofit === false ? '' : '<a:normAutofit/>'}</a:bodyPr><a:lstStyle/>${aParas(paras, 300, o.align)}</p:txBody></p:sp>`;
}

const pRect = (id: number, x: number, y: number, w: number, h: number, fill: string, geom = 'rect') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Bentuk ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;

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

function pTable(id: number, x: number, y: number, w: number, head: string[], rows: string[][], opt: { rowH?: number; sz?: number } = {}): string {
  const colW = Math.floor(w / head.length);
  const rowH = opt.rowH ?? 370000;
  const sz = opt.sz ?? 1100;
  const cell = (t: string, h: boolean, zebra: boolean) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${aRun({ t: t || '–', sz: h ? sz - 100 : sz, b: h, color: h ? MINT : INK, mono: h })}</a:p></a:txBody><a:tcPr marL="76200" marR="76200" marT="${rowH < 340000 ? 27432 : 45720}" marB="${rowH < 340000 ? 27432 : 45720}"><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="${GRID}"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="${GRID}"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="${h ? INK : zebra ? PAPER : 'FFFFFF'}"/></a:solidFill></a:tcPr></a:tc>`;
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
  const title = (t: string, num?: number) =>
    (num ? pTextBox(3, M, 330000, 620000, 420000, [{ t: pad2(num), sz: 1400, b: true, color: MINT, mono: true }], { fill: INK, geom: 'roundRect', anchor: 'ctr', autofit: false }) : '') +
    pTextBox(2, num ? M + 720000 : M, 280000, CW - (num ? 720000 : 0), 560000, [{ t, sz: 2400, b: true }], { anchor: 'ctr' }) +
    pRect(4, M, 900000, 900000, 50000, MINT);
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
    return label ? [{ t: `${label}  `, sz: 1200, b: true, color: MUTED }, { t: val, sz: 1500 }] : { t, sz: 1500 };
  };

  // sampul
  {
    const pics: Slide['pics'] = [];
    let shapes = pRect(5, 0, 0, SW, SH, INK) + pRect(6, M, 1150000, 1100000, 60000, MINT);
    shapes += pTextBox(7, M, 650000, CW, 400000, [{ t: 'GEMA RND LAB · RISET PRODUK', sz: 1200, b: true, color: MINT, mono: true }]);
    const img = r.cover.image?.dataUrl ? dataUrlBytes(r.cover.image.dataUrl) : undefined;
    const textW = img ? CW * 0.56 : CW;
    shapes += pTextBox(8, M, 1350000, textW, 1500000, [{ t: r.title, sz: 3400, b: true, color: 'FFFFFF' }], { autofit: true });
    shapes += pTextBox(9, M, 2950000, 2200000, 380000, [{ t: r.cover.status, sz: 1200, b: true, color: INK }], { fill: r.cover.done ? MINT : AMBER, geom: 'roundRect', anchor: 'ctr', autofit: false });
    shapes += pTextBox(10, M, 3500000, textW, 2700000, r.cover.meta.map(([k, v]) => [{ t: `${k.toUpperCase()}   `, sz: 1000, color: 'A9B8BE', mono: true }, { t: v, sz: 1400, color: 'F3F6F7' }]), {});
    if (img) {
      const sz = jpegSize(img);
      const p = pic(img, 'jpeg', sz.w, sz.h, 'sampul', pics);
      const f = fitBox(sz.w, sz.h, CW * 0.4, 4200000);
      shapes += pPic(11, p.rid, SW - M - f.w, 1350000, f.w, f.h, p.file);
    }
    shapes += pTextBox(12, M, SH - 600000, CW, 360000, [{ t: `Dibuat ${r.generatedAt} · isi = catatan pengguna; bukan klaim produk aman/memenuhi standar`, sz: 900, color: 'A9B8BE', mono: true }]);
    slides.push({ shapes, pics, dark: true });
  }

  // ringkasan KPI
  {
    let shapes = title('Ringkasan', ++sec);
    const cols = 3;
    const gap = 250000;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = 1900000;
    r.kpis.forEach((k, i) => {
      const x = M + (i % cols) * (cw + gap);
      const y = 1300000 + Math.floor(i / cols) * (ch + gap);
      shapes += pRect(20 + i * 3, x, y, cw, ch, PAPER, 'roundRect') + pRect(21 + i * 3, x, y + 200000, 70000, ch - 400000, MINT_D);
      shapes += pTextBox(22 + i * 3, x + 250000, y + 250000, cw - 350000, ch - 500000, [{ t: k.value, sz: 4000, b: true }, { t: k.label.toUpperCase(), sz: 1100, color: MUTED, mono: true }], { anchor: 'ctr' });
    });
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
    const imgH = 1050000;
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
          const f = fitBox(sz.w, sz.h, imgW, imgH);
          shapes += pPic(id++, p.rid, x + (imgW - f.w) / 2, y + (imgH - f.h) / 2, f.w, f.h, p.file);
        } else {
          shapes += pTextBox(id++, x, y, imgW, imgH, [{ t: 'tanpa foto', sz: 800, color: MUTED }], { fill: PAPER, geom: 'roundRect', anchor: 'ctr', autofit: false });
        }
        shapes += pTextBox(id++, x - 30000, y + imgH + 20000, imgW + 60000, capH, [{ t: `No ${no}`, sz: 900, b: true }, ...c.lines.map((t) => ({ t, sz: 750, color: '2A3A41' }))], { autofit: false });
      };
      const label = (t: string, y: number, color: string) => {
        shapes += pTextBox(id++, M, y, 3000000, 230000, [{ t, sz: 1000, b: true, color, mono: true }], { autofit: false });
      };
      if (hasAkhir) {
        const yA = 1300000;
        const yB = 3720000;
        label('DATA AWAL', yA - 260000, MINT_D);
        chunk.forEach((p, k) => cell(p.awal, p.no, M + k * cellW, yA, 950000, 'awal'));
        shapes += pRect(id++, M, 3320000, CW, 28000, MINT);
        label('DATA AKHIR', yB - 260000, AMBER);
        chunk.forEach((p, k) => p.akhir && cell(p.akhir, p.no, M + k * cellW, yB, 620000, 'akhir'));
      } else {
        label('DATA AWAL', 1040000, MINT_D);
        chunk.forEach((p, k) => cell(p.awal, p.no, M + (k % COLS) * cellW, k < COLS ? 1300000 : 3720000, 950000, 'awal'));
        if (chunk.length > COLS) shapes += pRect(id++, M, 3320000, CW, 28000, MINT);
      }
      out.push({ shapes, pics });
    }
    return out;
  }

  const BODY_TOP = 1150000;
  const BODY_BOTTOM = SH - 600000;
  const TROW = 290000;
  const rowsFit = (h: number) => Math.max(1, Math.floor(h / TROW) - 1);
  const textH = (n: number) => n * 340000 + 80000;
  // perkiraan baris setelah teks panjang terlipat (agar tidak menimpa grafik/tabel di bawahnya)
  const paraText = (p: PPara) => (Array.isArray(p) ? p.map((r) => r.t).join('') : p.t);
  const wrapped = (ps: readonly PPara[], perLine: number) => ps.reduce((n, p) => n + Math.max(1, Math.ceil(paraText(p).length / perLine)), 0);
  const shrink = (p: PPara, sz: number): PPara => (Array.isArray(p) ? p.map((r) => ({ ...r, sz: Math.min(r.sz ?? sz, sz) })) : { ...p, sz: Math.min(p.sz ?? sz, sz) });
  let pack: { slide: Slide; y: number; id: number } | null = null;

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
        shapes += pTextBox(id++, x, BODY_TOP, colW, 300000, [{ t: `${c.title.toUpperCase()} · ${c.items.length} FOTO`, sz: 1000, b: true, color: INK, mono: true }], { fill: k === 0 ? MINT : k === 1 ? 'C9F3EA' : 'FDE7C2', geom: 'roundRect', anchor: 'ctr', autofit: false });
        const items = c.items.slice(pg * cap, pg * cap + cap);
        const top = BODY_TOP + 380000;
        const rowH = (BODY_BOTTOM - top) / 4;
        if (!items.length) shapes += pTextBox(id++, x, top, colW, 500000, [{ t: c.items.length ? '—' : 'belum ada foto tahap ini', sz: 1000, color: MUTED }], { autofit: false });
        items.forEach((it, r) => {
          const y = top + r * rowH;
          const imgW = colW * 0.42;
          const imgH = rowH - 90000;
          const bytes = it.image ? dataUrlBytes(it.image) : undefined;
          if (bytes) {
            const sz = jpegSize(bytes);
            const p = pic(bytes, 'jpeg', sz.w, sz.h, it.lines[0] ?? '', pics);
            const f = fitBox(sz.w, sz.h, imgW, imgH);
            shapes += pPic(id++, p.rid, x + (imgW - f.w) / 2, y + (imgH - f.h) / 2, f.w, f.h, p.file);
          } else shapes += pTextBox(id++, x, y, imgW, imgH, [{ t: 'tanpa foto', sz: 800, color: MUTED }], { fill: PAPER, geom: 'roundRect', anchor: 'ctr', autofit: false });
          shapes += pTextBox(id++, x + imgW + 70000, y, colW - imgW - 70000, imgH, it.lines.map((t, j) => ({ t, sz: j === 1 ? 1000 : 850, b: j === 1, color: j === 0 ? MINT_D : '2A3A41' })), { autofit: false });
          if (r < items.length - 1) shapes += pRect(id++, x, y + rowH - 45000, colW, 9000, GRID);
        });
      });
      out.push({ shapes, pics });
    }
    return out;
  }

  for (const b0 of r.blocks.filter((x) => !x.pptxSkip)) {
    const b = b0.pptxTable ? { ...b0, table: b0.pptxTable } : b0;
    const num = b.level === 1 ? ++sec : undefined;
    const head = b.heading;
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
    // grid foto per nomor (DEC-077): maks. 20 foto/slide — 10 awal di atas, garis pembatas, 10 akhir di bawah
    if (b.photoPairs?.length) {
      for (const s of photoGridSlides(b.photoPairs, head, first ? num : undefined)) slides.push(s);
      first = false;
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
    const textOnly = !b.photoPairs && !charts0.length && !tableRows.length && (b.pptxOmitImages || !b.images.length);
    const blockLines = b.photoPairs ? [] : lines;
    if (textOnly && blockLines.length <= LINES_PER_SLIDE) {
      const need = 420000 + textH(Math.max(wrapped(blockLines, 110), 1));
      if (pack && pack.y + need <= BODY_BOTTOM) {
        // tumpuk di slide teks sebelumnya: sub-judul bernomor + baris
        let sh = '';
        if (num) sh += pTextBox(pack.id++, M, pack.y, 560000, 340000, [{ t: pad2(num), sz: 1100, b: true, color: MINT, mono: true }], { fill: INK, geom: 'roundRect', anchor: 'ctr', autofit: false });
        sh += pTextBox(pack.id++, num ? M + 640000 : M, pack.y - 20000, CW - 640000, 380000, [{ t: head, sz: 1800, b: true }], { anchor: 'ctr', autofit: false });
        sh += pTextBox(pack.id++, M, pack.y + 420000, CW, textH(Math.max(wrapped(blockLines, 110), 1)), blockLines.length ? blockLines : [{ t: 'belum dicatat', sz: 1500, color: MUTED }]);
        pack.slide.shapes += sh;
        pack.y += need + 120000;
        continue;
      }
      const sl: Slide = { shapes: t() + pTextBox(30, M, BODY_TOP, CW, textH(Math.max(blockLines.length, 1)), blockLines.length ? blockLines : [{ t: 'belum dicatat', sz: 1500, color: MUTED }]), pics: [] };
      slides.push(sl);
      pack = { slide: sl, y: BODY_TOP + textH(Math.max(wrapped(blockLines, 110), 1)) + 200000, id: 200 };
      continue;
    }
    pack = null;
    // teks panjang: slide teks penuh, sisa baris terakhir ikut slide gabungan
    const chunks: PPara[][] = [];
    for (let i = 0; i < blockLines.length; i += LINES_PER_SLIDE) chunks.push(blockLines.slice(i, i + LINES_PER_SLIDE));
    const lastLines = chunks.length ? chunks.pop()! : [];
    for (const c of chunks) slides.push({ shapes: t() + pTextBox(30, M, BODY_TOP, CW, SH - 1900000, c), pics: [] });
    const rows = [...tableRows];
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
      const onSlide = charts0.slice(0, 2);
      if (onSlide.length) {
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
        if (n >= 3) {
          shapes += pTable(31, M, y, CW, b.table!.head, rows.splice(0, n), { rowH: TROW, sz: 1000 });
        }
      }
      slides.push({ shapes, pics });
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
    while (rows.length) slides.push({ shapes: t() + pTable(31, M, BODY_TOP, CW, b.table!.head, rows.splice(0, per), { rowH: TROW, sz: 1000 }), pics: [] });
    // foto: 6 per slide (2 baris × 3); kelompok berisi video tetap 3 per slide agar video cukup besar
    for (let i = 0; !b.pptxOmitImages && i < b.images.length; ) {
      const hasVid = b.images.slice(i, i + 6).some((im) => im.video && im.mediaId && videos.get(im.mediaId));
      const take = hasVid ? 3 : 6;
      const group = b.images.slice(i, i + take);
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
        } else shapes += pRect(50 + k, x, y, boxW, Math.min(imgH, 1200000), PAPER, 'roundRect');
        shapes += pTextBox(60 + k, x, y + imgH + 30000, boxW, capH, rowsN === 2 ? [{ t: imgCaption(im), sz: 1000 }, { t: im.name, sz: 800, color: MUTED, mono: true }] : [{ t: imgCaption(im), sz: 1100 }, { t: im.name, sz: 900, color: MUTED, mono: true }], { autofit: rowsN === 1 });
      });
      slides.push({ shapes, pics, ...(vids.length && { vids }) });
    }
  }

  // nomor halaman (setelah jumlah slide diketahui)
  slides.forEach((s, i) => {
    if (i === 0) return;
    s.shapes += pTextBox(90, M, SH - 480000, CW * 0.8, 320000, [{ t: `${r.cover.code} · ${r.footer}`, sz: 800, color: MUTED, mono: true }]);
    s.shapes += pTextBox(91, SW - M - 1200000, SH - 480000, 1200000, 320000, [{ t: `${i + 1} / ${slides.length}`, sz: 900, color: MUTED, mono: true }]);
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

  const theme = `${CT_HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="GEMA"><a:themeElements><a:clrScheme name="GEMA"><a:dk1><a:srgbClr val="0E1A1F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2A3A41"/></a:dk2><a:lt2><a:srgbClr val="F3F6F7"/></a:lt2><a:accent1><a:srgbClr val="63E6CF"/></a:accent1><a:accent2><a:srgbClr val="F5A524"/></a:accent2><a:accent3><a:srgbClr val="1FA88F"/></a:accent3><a:accent4><a:srgbClr val="5B6B72"/></a:accent4><a:accent5><a:srgbClr val="A9B8BE"/></a:accent5><a:accent6><a:srgbClr val="E2E8EA"/></a:accent6><a:hlink><a:srgbClr val="1FA88F"/></a:hlink><a:folHlink><a:srgbClr val="5B6B72"/></a:folHlink></a:clrScheme><a:fontScheme name="GEMA"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="GEMA"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const master = `${CT_HEAD}<p:sldMaster ${P_NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
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
      let shapes = pRect(id++, 0, 0, SW, 120000, INK) + pTextBox(id++, M, 230000, CW, 560000, [{ t: it.title + (ci ? ' (lanjutan)' : ''), sz: 2800, b: true }], { anchor: 'ctr', autofit: false });
      shapes += pTextBox(id++, M, 760000, CW, 330000, [{ t: it.subtitle, sz: 1300, color: MUTED }], { autofit: false });
      // label akar di atas, lalu foto nota (bingkai rapat mengikuti foto)
      shapes += pTextBox(id++, M, 1100000, CW, 300000, [{ t: it.rootLabel, sz: 1100, b: true, color: MINT_D }], { autofit: false, align: 'ctr' });
      const roots = it.roots.length ? it.roots.slice(0, 3) : [{ label: 'tanpa foto nota' }];
      const rootBoxW = 2300000;
      const rootBoxH = 1650000;
      const rootY = 1430000;
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
        } else shapes += pTextBox(id++, x, rootY, rootBoxW, rootBoxH, [{ t: n.label, sz: 1100, color: MUTED }], { fill: PAPER, geom: 'roundRect', anchor: 'ctr', autofit: false, align: 'ctr' });
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
          } else shapes += pTextBox(id++, x, leafY, leafW, leafH, [{ t: 'tanpa foto', sz: 900, color: MUTED }], { fill: PAPER, geom: 'roundRect', anchor: 'ctr', autofit: false, align: 'ctr' });
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
