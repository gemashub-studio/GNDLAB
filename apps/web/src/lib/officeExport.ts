/**
 * Ekspor DOCX & PPTX TANPA dependensi (DEC-052): file Office = zip (metode "store") berisi XML
 * Office Open XML minimal. Gambar = thumbnail JPEG yang sudah tersimpan. Bekerja offline di browser.
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
const CT_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

interface Pic {
  rid: string;
  file: string;
  bytes: Uint8Array;
  w: number;
  h: number;
  caption: string;
}

// ------------------------------------------------------------------ DOCX

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

const wRun = (t: string, o: { b?: boolean; sz?: number; color?: string } = {}) =>
  `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
const wPara = (t: string, o: { b?: boolean; sz?: number; color?: string; after?: number } = {}) => `<w:p><w:pPr><w:spacing w:after="${o.after ?? 80}"/></w:pPr>${wRun(t, o)}</w:p>`;

function wTable(head: string[], rows: string[][]): string {
  const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="A9B8BE"/>`).join('') + '</w:tblBorders>';
  const cell = (t: string, h: boolean) => `<w:tc><w:tcPr>${h ? '<w:shd w:val="clear" w:color="auto" w:fill="E2E8EA"/>' : ''}</w:tcPr><w:p>${wRun(t, { b: h, sz: 18 })}</w:p></w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>${[head, ...rows].map((r, i) => `<w:tr>${r.map((c) => cell(c, i === 0)).join('')}</w:tr>`).join('')}</w:tbl>${wPara('', { after: 120 })}`;
}

function wImage(p: Pic, id: number): string {
  const maxW = 260;
  const k = Math.min(1, maxW / p.w);
  const cx = Math.round(p.w * k * EMU_PER_PX);
  const cy = Math.round(p.h * k * EMU_PER_PX);
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Gambar ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(p.file)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${p.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>${wPara(p.caption, { sz: 16, color: '5B6B72', after: 160 })}`;
}

export function buildDocx(r: ResearchReport): Uint8Array {
  const pics: Pic[] = [];
  const body: string[] = [wPara(r.title, { b: true, sz: 36, after: 60 }), wPara(r.subtitle, { sz: 20, color: '5B6B72', after: 240 })];
  for (const b of r.blocks) {
    body.push(wPara(b.heading, { b: true, sz: b.level === 1 ? 28 : 22, color: b.level === 1 ? '0E1A1F' : '1FA88F', after: 100 }));
    for (const l of b.lines) body.push(wPara(l, { sz: 20 }));
    if (b.table) body.push(wTable(b.table.head, b.table.rows));
    for (const im of b.images) {
      const bytes = dataUrlBytes(im.dataUrl);
      const cap = `${im.video ? 'VIDEO · ' : ''}${im.name}${im.caption ? ` — ${im.caption}` : ''}`;
      if (!bytes) {
        body.push(wPara(`[${cap}] (tanpa pratinjau)`, { sz: 16, color: '5B6B72' }));
        continue;
      }
      const n = pics.length + 1;
      const p: Pic = { rid: `rIdImg${n}`, file: `image${n}.jpeg`, bytes, ...jpegSize(bytes), caption: cap };
      pics.push(p);
      body.push(wImage(p, n));
    }
  }
  body.push(wPara(r.footer, { sz: 16, color: '5B6B72' }));
  const doc = `${CT_HEAD}<w:document ${W_NS}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const rels = `${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pics.map((p) => `<Relationship Id="${p.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${p.file}"/>`).join('')}</Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: txt(`${CT_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { name: '_rels/.rels', data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/document.xml', data: txt(doc) },
    { name: 'word/_rels/document.xml.rels', data: txt(rels) },
    ...pics.map((p) => ({ name: `word/media/${p.file}`, data: p.bytes })),
  ]);
}

// ------------------------------------------------------------------ PPTX

const P_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const SW = 12192000;
const SH = 6858000;
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const emptyTree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function pTextBox(id: number, x: number, y: number, w: number, h: number, paras: { t: string; sz: number; b?: boolean; color?: string }[], fill?: string): string {
  const ps = paras.map((p) => `<a:p><a:r><a:rPr lang="id-ID" sz="${p.sz}"${p.b ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${p.color ?? '0E1A1F'}"/></a:solidFill></a:rPr><a:t>${xml(p.t)}</a:t></a:r></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Teks ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"><a:normAutofit/></a:bodyPr><a:lstStyle/>${ps || '<a:p><a:endParaRPr lang="id-ID"/></a:p>'}</p:txBody></p:sp>`;
}

function pPic(id: number, rid: string, x: number, y: number, w: number, h: number, name: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

interface Slide {
  shapes: string;
  pics: Pic[];
}

const LINES_PER_SLIDE = 12;

export function buildPptx(r: ResearchReport): Uint8Array {
  const slides: Slide[] = [];
  const M = 457200;
  const title = (t: string, sub?: string) => pTextBox(2, M, 300000, SW - 2 * M, 700000, [{ t, sz: 2600, b: true }, ...(sub ? [{ t: sub, sz: 1400, color: '5B6B72' }] : [])]);
  const foot = pTextBox(90, M, SH - 420000, SW - 2 * M, 320000, [{ t: r.footer, sz: 900, color: '5B6B72' }]);

  slides.push({ shapes: pTextBox(2, M, 2000000, SW - 2 * M, 2400000, [{ t: r.title, sz: 4000, b: true, color: '63E6CF' }, { t: r.subtitle, sz: 2000, color: 'F3F6F7' }, { t: r.generatedAt, sz: 1400, color: 'A9B8BE' }], '0E1A1F'), pics: [] });

  let picN = 0;
  for (const b of r.blocks) {
    const lines = [...b.lines, ...(b.table ? [b.table.head.join(' | '), ...b.table.rows.map((row) => row.join(' | '))] : [])];
    const chunks: string[][] = [];
    for (let i = 0; i < Math.max(lines.length, 1); i += LINES_PER_SLIDE) chunks.push(lines.slice(i, i + LINES_PER_SLIDE));
    chunks.forEach((c, i) => {
      slides.push({
        shapes: title(b.heading + (i ? ' (lanjutan)' : '')) + pTextBox(3, M, 1150000, SW - 2 * M, SH - 1700000, c.map((t) => ({ t, sz: b.table && c.indexOf(t) >= b.lines.length ? 1200 : 1500 }))) + foot,
        pics: [],
      });
    });
    // foto: 2 per slide
    for (let i = 0; i < b.images.length; i += 2) {
      const pair = b.images.slice(i, i + 2);
      const pics: Pic[] = [];
      let shapes = title(`${b.heading} — foto/video`);
      pair.forEach((im, k) => {
        const x = M + k * ((SW - 2 * M) / 2);
        const boxW = (SW - 2 * M) / 2 - 200000;
        const cap = `${im.video ? 'VIDEO · ' : ''}${im.name}${im.caption ? ` — ${im.caption}` : ''}`;
        const bytes = dataUrlBytes(im.dataUrl);
        if (bytes) {
          picN++;
          const sz = jpegSize(bytes);
          const boxH = 3800000;
          const k2 = Math.min(boxW / (sz.w * EMU_PER_PX), boxH / (sz.h * EMU_PER_PX));
          const w = Math.round(sz.w * EMU_PER_PX * k2);
          const h = Math.round(sz.h * EMU_PER_PX * k2);
          const p: Pic = { rid: `rIdP${pics.length + 2}`, file: `image${picN}.jpeg`, bytes, w: sz.w, h: sz.h, caption: cap };
          pics.push(p);
          shapes += pPic(10 + k, p.rid, Math.round(x), 1200000, w, h, p.file);
        }
        shapes += pTextBox(20 + k, Math.round(x), 5150000, Math.round(boxW), 700000, [{ t: bytes ? cap : `${cap} (tanpa pratinjau)`, sz: 1100, color: '5B6B72' }]);
      });
      slides.push({ shapes: shapes + foot, pics });
    }
  }

  const files: ZipFile[] = [];
  const slideXml = (s: Slide) => `${CT_HEAD}<p:sld ${P_NS}><p:cSld><p:spTree>${emptyTree}${s.shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  slides.forEach((s, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: txt(slideXml(s)) });
    files.push({
      name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      data: txt(`${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${s.pics.map((p) => `<Relationship Id="${p.rid}" Type="${REL_NS}/image" Target="../media/${p.file}"/>`).join('')}</Relationships>`),
    });
    for (const p of s.pics) files.push({ name: `ppt/media/${p.file}`, data: p.bytes });
  });

  const theme = `${CT_HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="GEMA"><a:themeElements><a:clrScheme name="GEMA"><a:dk1><a:srgbClr val="0E1A1F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2A3A41"/></a:dk2><a:lt2><a:srgbClr val="F3F6F7"/></a:lt2><a:accent1><a:srgbClr val="63E6CF"/></a:accent1><a:accent2><a:srgbClr val="F5A524"/></a:accent2><a:accent3><a:srgbClr val="1FA88F"/></a:accent3><a:accent4><a:srgbClr val="5B6B72"/></a:accent4><a:accent5><a:srgbClr val="A9B8BE"/></a:accent5><a:accent6><a:srgbClr val="E2E8EA"/></a:accent6><a:hlink><a:srgbClr val="1FA88F"/></a:hlink><a:folHlink><a:srgbClr val="5B6B72"/></a:folHlink></a:clrScheme><a:fontScheme name="GEMA"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="GEMA"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const master = `${CT_HEAD}<p:sldMaster ${P_NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
  const layout = `${CT_HEAD}<p:sldLayout ${P_NS} type="blank" preserve="1"><p:cSld name="Kosong"><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const pres = `${CT_HEAD}<p:presentation ${P_NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${SW}" cy="${SH}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels = `${CT_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="${REL_NS}/theme" Target="theme/theme1.xml"/>${slides.map((_, i) => `<Relationship Id="rId${i + 3}" Type="${REL_NS}/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`;
  const types = `${CT_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`;
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

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
