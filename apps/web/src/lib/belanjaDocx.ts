/**
 * Laporan Belanja → Word (.docx) tanpa dependensi (DEC-059, disederhanakan owner): HANYA bukti alokasi.
 * Tiap alokasi: judul ALOKASI → tabel (kiri foto bukti bayar/nota, kanan foto barang) → baris total Rp +
 * terbilang → keterangan di bawah tabel.
 */
import { fmtRp, parseRp, realizationTotal, terbilang, type LpjPhoto, type LpjReport } from './belanja';
import { jpegSize, xml, zipStore } from './officeExport';

const enc = new TextEncoder();
const CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const LIGHT = 'F2F2F2';

type R = { b?: boolean; i?: boolean; u?: boolean; sz?: number; color?: string };
const run = (t: string, o: R = {}) =>
  `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.sz ?? 22}"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
const para = (runs: string, o: { jc?: 'center' | 'right' | 'both'; after?: number; before?: number; tabs?: number[]; keep?: boolean } = {}) =>
  `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}${o.tabs ? `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>` : ''}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 100}"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`;
const p = (t: string, o: R & { jc?: 'center' | 'right' | 'both'; after?: number; before?: number; keep?: boolean } = {}) => para(run(t, o), o);

const borders = (sz = 4) => `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:color="000000"/>`).join('')}</w:tblBorders>`;
const tc = (content: string, o: { w?: number; fill?: string; span?: number; vAlign?: 'center' } = {}) =>
  `<w:tc><w:tcPr>${o.w ? `<w:tcW w:w="${o.w}" w:type="pct"/>` : ''}${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}${o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : ''}</w:tcPr>${content || '<w:p/>'}</w:tc>`;
const tbl = (rows: string[], o: { borders?: string; grid?: number[] } = {}) =>
  `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${o.borders ?? borders()}<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>${o.grid ? `<w:tblGrid>${o.grid.map((g) => `<w:gridCol w:w="${g}"/>`).join('')}</w:tblGrid>` : ''}${rows.join('')}</w:tbl>`;
const tr = (cells: string, header = false) => `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells}</w:tr>`;

interface Img {
  rid: string;
  file: string;
  bytes: Uint8Array;
}

function bytesOf(dataUrl: string): Uint8Array | undefined {
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
  if (!m) return undefined;
  const bin = atob(m[1]!);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function buildLpjDocx(r: LpjReport): Uint8Array {
  const imgs: Img[] = [];
  const drawing = (ph: LpjPhoto, maxIn: number) => {
    const bytes = bytesOf(ph.dataUrl);
    if (!bytes) return p(`[${ph.name}] (tanpa pratinjau)`, { sz: 16, i: true });
    const n = imgs.length + 1;
    const img = { rid: `rIdImg${n}`, file: `image${n}.jpeg`, bytes };
    imgs.push(img);
    const sz = jpegSize(bytes);
    const k = Math.min(maxIn / sz.w, maxIn / sz.h);
    const cx = Math.round(sz.w * k * 914400);
    const cy = Math.round(sz.h * k * 914400);
    return para(
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Gambar ${n}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${xml(ph.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${img.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
      { jc: 'center', after: 40 },
    );
  };

  const body: string[] = [];
  body.push(p('BUKTI ALOKASI', { b: true, sz: 28, jc: 'center', after: 40 }));
  body.push(p(`${r.id}${r.purpose.trim() ? ` · ${r.purpose.trim()}` : ''}`, { sz: 18, color: '595959', jc: 'center', after: 240 }));

  r.proofs.forEach((pr, i) => {
    const cell = (label: string, photos: LpjPhoto[]) =>
      tc(p(label, { b: true, sz: 18, jc: 'center', after: 60 }) + (photos.length ? photos.map((ph) => drawing(ph, photos.length > 1 ? 1.9 : 2.9)).join('') : p('(belum dilampirkan)', { i: true, sz: 18, color: '7F7F7F', jc: 'center' })), { w: 2500 });
    body.push(p(`ALOKASI${r.proofs.length > 1 ? ` ${i + 1}` : ''}${pr.title.trim() ? ` — ${pr.title.trim()}` : ''}`, { b: true, sz: 24, before: i ? 360 : 0, after: 100, keep: true }));
    body.push(
      tbl([
        tr(cell('Foto Bukti Bayar / Nota', pr.receipts) + cell('Foto Barang yang Dibeli', pr.goods)),
        tr(tc(para(run('Total Alokasi ', { b: true }) + run(fmtRp(parseRp(pr.total)), { b: true }) + run('   Terbilang: ') + run(terbilang(parseRp(pr.total)), { i: true }), { after: 20 }), { span: 2, fill: LIGHT })),
      ], { grid: [4819, 4819] }),
    );
    body.push(p(pr.description.trim() ? `Keterangan: ${pr.description.trim()}` : 'Keterangan: –', { before: 80, after: 120, jc: 'both' }));
  });
  if (r.proofs.length > 1) body.push(p(`Total seluruh alokasi: ${fmtRp(realizationTotal(r))} (${terbilang(realizationTotal(r))}).`, { b: true, before: 200 }));

  const footer = `${CT}<w:ftr ${NS}><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run(`${r.id} · Hal. `, { sz: 16, color: '7F7F7F' })}<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const doc = `${CT}<w:document ${NS}><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const rels = `${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${imgs.map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.file}"/>`).join('')}</Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(`${CT}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`) },
    { name: '_rels/.rels', data: enc.encode(`${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/document.xml', data: enc.encode(doc) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(rels) },
    { name: 'word/footer1.xml', data: enc.encode(footer) },
    ...imgs.map((m) => ({ name: `word/media/${m.file}`, data: m.bytes })),
  ]);
}
