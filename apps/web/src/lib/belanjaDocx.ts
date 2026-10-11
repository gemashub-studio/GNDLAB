/**
 * LPJ / Laporan Belanja → Word (.docx) tanpa dependensi (DEC-059), susunan mengikuti contoh owner:
 * memo → nominal anggaran & realisasi (+ terbilang) → bukti per alokasi (nota | foto barang) → penutup &
 * tanda tangan → Lampiran 1 rincian alokasi → Lampiran 2 timeline & output.
 */
import {
  allocationTotal,
  daysInclusive,
  fmtInt,
  fmtRp,
  itemTotal,
  parseRp,
  realizationTotal,
  sectionTotal,
  subtotals,
  tanggalPanjang,
  tanggalPendek,
  terbilang,
  usedPrice,
  type LpjPhoto,
  type LpjReport,
} from './belanja';
import { jpegSize, xml, zipStore } from './officeExport';

const enc = new TextEncoder();
const CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const GRAY = 'D9D9D9';
const LIGHT = 'F2F2F2';
const BLANK = '……………………';

type R = { b?: boolean; i?: boolean; u?: boolean; sz?: number; color?: string };
const run = (t: string, o: R = {}) =>
  `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.sz ?? 22}"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
const para = (runs: string, o: { jc?: 'center' | 'right' | 'both'; after?: number; before?: number; tabs?: number[]; keep?: boolean } = {}) =>
  `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}${o.tabs ? `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>` : ''}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 100}"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`;
const p = (t: string, o: R & { jc?: 'center' | 'right' | 'both'; after?: number; before?: number; keep?: boolean } = {}) => para(run(t, o), o);
const TAB = '<w:r><w:tab/></w:r>';
const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
const or = (v: string, blank = BLANK) => (v.trim() ? v.trim() : blank);

const borders = (sz = 4) => `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:color="000000"/>`).join('')}</w:tblBorders>`;
const noBorders = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('')}</w:tblBorders>`;
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

  const budget = parseRp(r.budget);
  const real = realizationTotal(r);
  const body: string[] = [];

  // kop memo
  body.push(p(or(r.memoLabel, 'INTERNAL OF MEMO'), { b: true, sz: 24, jc: 'center', after: 40 }));
  body.push(p('LEMBAR PERTANGGUNGJAWABAN', { b: true, u: true, sz: 26, jc: 'center', after: 240 }));
  const kv = (k: string, v: string) => para(run(k) + TAB + run(`: ${v}`), { tabs: [2000], after: 40 });
  body.push(kv('Pengajuan NO', `refer ${or(r.refNo)} | ${or(r.city)}, ${tanggalPanjang(or(r.date))}`));
  body.push(kv('Nomor Surat', or(r.letterNo, '')));
  body.push(kv('Perihal', or(r.subject)));
  body.push(kv('Lampiran', or(r.attachment)));
  body.push(p('Kepada Yth.', { before: 200, after: 40 }), p(or(r.recipient), { b: true, after: 40 }), p(`di ${or(r.recipientPlace)}`, { after: 200 }));
  body.push(p('Salam,', { after: 120 }));
  body.push(p(`Sehubungan dengan pengajuan Anggaran sebelumnya dengan nomor surat ${or(r.refNo)} pada ${or(r.city)}, ${tanggalPanjang(or(r.date))}, untuk kebutuhan ${or(r.purpose)}.`, { jc: 'both' }));
  body.push(p('Berikut kami lampirkan Bukti-Bukti, pertanggungjawaban alokasi Anggaran dengan Nominal', { jc: 'both', after: 120 }));
  const nominal = (label: string, n: number) =>
    tbl([tr(tc(p(label, { b: true, after: 20 }) + p(fmtRp(n), { b: true, sz: 28, after: 20 }), { w: 1900, fill: LIGHT, vAlign: 'center' }) + tc(p('Terbilang:', { sz: 18, color: '595959', after: 20 }) + p(terbilang(n), { i: true, after: 20 }), { w: 3100, vAlign: 'center' }))]);
  body.push(nominal('Anggaran Pengajuan :', budget), p('', { after: 60 }), nominal('Realisasi dan Alokasi :', real));
  if (budget) {
    const diff = budget - real;
    body.push(p(diff === 0 ? 'Realisasi sama dengan anggaran pengajuan.' : `${diff > 0 ? 'Sisa anggaran' : 'Kelebihan realisasi'}: ${fmtRp(Math.abs(diff))} (${terbilang(Math.abs(diff))}).`, { sz: 18, color: '595959', before: 60 }));
  }
  body.push(p('Dibawah ini terlampir bukti-bukti penggunaan alokasi terlampir :', { before: 200 }));

  // bukti per alokasi
  body.push(p('Lampiran', { b: true, sz: 24, before: 120, after: 120 }));
  r.proofs.forEach((pr, i) => {
    const cell = (label: string, photos: LpjPhoto[]) =>
      tc(p(label, { b: true, sz: 18, jc: 'center', after: 60 }) + (photos.length ? photos.map((ph) => drawing(ph, photos.length > 1 ? 1.9 : 2.9)).join('') : p('(belum dilampirkan)', { i: true, sz: 18, color: '7F7F7F', jc: 'center' })), { w: 2500 });
    body.push(
      tbl([
        tr(tc(p(`${i + 1}. ${or(pr.title, 'Judul Alokasi')}`, { b: true, after: 20, keep: true }), { span: 2, fill: GRAY })),
        tr(cell('Nota / Bukti Bayar', pr.receipts) + cell('Foto Barang', pr.goods)),
        tr(tc(para(run('Total Alokasi ', { b: true }) + run(fmtRp(parseRp(pr.total)), { b: true }) + run('   Terbilang: ') + run(terbilang(parseRp(pr.total)), { i: true }), { after: 20 }), { span: 2, fill: LIGHT })),
      ], { grid: [4819, 4819] }),
    );
    body.push(p(or(pr.description, ''), { after: 240, before: 60, jc: 'both' }));
  });

  // penutup & tanda tangan
  body.push(p('Sekian Surat pertanggungjawaban kami atas penggunaan Anggaran dengan lampiran bukti-bukti hasil, atas segala kebijaksanaan dan perhatiannya kami ucapkan besar terimakasih. Semoga Berkenan.', { jc: 'both', before: 120 }));
  body.push(p('Hormat Kami,', { before: 120, after: 40 }), p(`${or(r.closingCity)}, ${tanggalPanjang(or(r.closingDate))}`, { after: 120 }));
  const signers = r.signers.length ? r.signers : [{ name: '', role: '' }];
  body.push(
    tbl([tr(signers.map((s) => tc(p('', { after: 900 }) + p(or(s.name).toUpperCase(), { b: true, u: true, jc: 'center', after: 20 }) + p(or(s.role, ''), { jc: 'center' }), { w: Math.floor(5000 / signers.length) })).join(''))], { borders: noBorders }),
  );

  // Lampiran 1
  body.push(PAGE_BREAK, p('Lampiran 1 Rincian alokasi anggaran', { b: true, sz: 26, after: 160 }));
  if (r.appendixIntro.trim()) body.push(p(r.appendixIntro.trim(), { jc: 'both' }));
  const head = ['No', 'Alokasi', 'Bahan / perlengkapan', 'Jumlah beli', 'Satuan beli', 'Harga dasar (Rp)', 'Faktor (1/0)', 'Harga dipakai (Rp)', 'Jumlah (Rp)'];
  const widths = [350, 600, 1300, 450, 550, 500, 400, 450, 400];
  let no = 0;
  r.sections.forEach((sec, si) => {
    if (si > 0 || sec.title.trim()) body.push(p(or(sec.title, `Bagian ${si + 1}`), { b: true, sz: 23, before: 200, after: 80, keep: true }));
    if (sec.intro.trim()) body.push(p(sec.intro.trim(), { jc: 'both' }));
    const rows = sec.items.map((it) => {
      no++;
      const num = (v: string) => p(v, { sz: 18, jc: 'right', after: 0 });
      const txt = (v: string) => p(v, { sz: 18, after: 0 });
      return tr(
        [txt(String(no)), txt(it.category), txt(it.name), num(it.qty || '-'), txt(it.unit || '-'), num(fmtInt(parseRp(it.basePrice))), num(String(it.factor)), num(fmtInt(usedPrice(it, r.markupPct))), num(fmtInt(itemTotal(it, r.markupPct)))]
          .map((c, i) => tc(c, { w: widths[i]! }))
          .join(''),
      );
    });
    body.push(tbl([tr(head.map((h, i) => tc(p(h, { b: true, sz: 17, jc: 'center', after: 0 }), { w: widths[i]!, fill: GRAY })).join(''), true), ...rows]));
    const subs = subtotals(sec, r.markupPct);
    body.push(p(`Subtotal ${subs.map(([c, n]) => `${c.toLowerCase()} ${fmtRp(n)}`).join('; ')}.${subs.length > 1 ? ` Total ${or(sec.title, 'bagian ini').toLowerCase()} ${fmtRp(sectionTotal(sec, r.markupPct))}.` : ''}`, { before: 80, jc: 'both' }));
    if (sec.note.trim()) body.push(p(sec.note.trim(), { jc: 'both' }));
  });
  body.push(p(`Faktor 1 = harga dasar ditambah batas atas ${or(r.markupPct, '0')}%; faktor 0 = harga dasar dipakai langsung. Jumlah biaya = jumlah beli × harga dipakai. Seluruh angka harga pada tabel dalam rupiah.`, { sz: 19, i: true, before: 120, jc: 'both' }));
  const total = allocationTotal(r);
  body.push(
    p(`Rekonsiliasi total rincian: ${r.sections.map((s, i) => `${or(s.title, `bagian ${i + 1}`).toLowerCase()} ${fmtRp(sectionTotal(s, r.markupPct))}`).join(' + ')} = ${fmtRp(total)}.${budget ? ` Anggaran pengajuan ${fmtRp(budget)}${total === budget ? ' (sama).' : `; selisih ${fmtRp(budget - total)}.`}` : ''}`, { b: true, before: 80, jc: 'both' }),
  );
  if (r.reconciliationNote.trim()) body.push(p(r.reconciliationNote.trim(), { jc: 'both' }));

  // Lampiran 2
  if (r.timeline.some((t) => t.activity.trim()) || r.output.trim()) {
    body.push(PAGE_BREAK, p('Lampiran 2 Timeline dan output R&D', { b: true, sz: 26, after: 160 }));
    if (r.timelineIntro.trim()) body.push(p(r.timelineIntro.trim(), { jc: 'both' }));
    const tw = [400, 2600, 750, 750, 500];
    body.push(
      tbl([
        tr(['No', 'Kegiatan', 'Mulai', 'Selesai', 'Hari'].map((h, i) => tc(p(h, { b: true, sz: 18, jc: 'center', after: 0 }), { w: tw[i]!, fill: GRAY })).join(''), true),
        ...r.timeline
          .filter((t) => t.activity.trim())
          .map((t, i) => tr([String(i + 1), t.activity, tanggalPendek(t.start), tanggalPendek(t.end), String(daysInclusive(t.start, t.end) ?? '-')].map((c, k) => tc(p(c, { sz: 18, after: 0, ...(k !== 1 && { jc: 'center' as const }) }), { w: tw[k]! })).join(''))),
      ]),
    );
    if (r.timelineNote.trim()) body.push(p(r.timelineNote.trim(), { before: 120, jc: 'both' }));
    if (r.output.trim()) body.push(p('Output yang dituju', { b: true, sz: 23, before: 200 }), p(r.output.trim(), { jc: 'both' }));
  }

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
