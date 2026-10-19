/**
 * Unduh Excel (.xlsx) satu pencatatan (DEC-098): data awal & akhir, perbandingan awal vs akhir, tebal daging,
 * perlakuan, dan kesimpulan — tiap bagian satu sheet. Ditulis langsung (SpreadsheetML + zip), tanpa dependensi baru.
 */
import { parseMeasure } from './labStore';
import { zipStore, xml, type ZipFile } from './officeExport';
import { awalColumns, compareRecord, compareTable, conclusions, formulaNote, hasThickness, treatmentItems, type CatatRecord } from './pencatatan';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Cell = string | number | undefined;
interface Sheet {
  name: string;
  rows: Cell[][];
  /** baris judul tabel (dicetak tebal), indeks 0-based */
  heads: number[];
  widths: number[];
}

const enc = new TextEncoder();
const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
/** Teks isian angka ("1.000", "6,5") → angka bila bisa, selain itu teks apa adanya. */
const num = (v?: string): Cell => {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  return parseMeasure(t) ?? t;
};
const round = (v: number | undefined, d = 2) => (v === undefined ? undefined : Number(v.toFixed(d)));

function sheetXml(s: Sheet): string {
  const rows = s.rows
    .map((r, ri) => {
      const cells = r
        .map((c, ci) => {
          if (c === undefined || c === '') return '';
          const ref = `${colName(ci)}${ri + 1}`;
          const st = s.heads.includes(ri) ? ' s="1"' : ri === 0 ? ' s="2"' : '';
          return typeof c === 'number' ? `<c r="${ref}"${st}><v>${c}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xml(c)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  const cols = s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

/** Susun isi tiap sheet (murni — diuji tanpa zip). */
export function catatSheets(rec: CatatRecord): Sheet[] {
  const cols = awalColumns(rec.item);
  const coco = hasThickness(rec.item);
  const title = (t: string): Cell[] => [`${t} — ${rec.id} · ${rec.item} · ${rec.count} item`];

  const dataHead = ['No', ...cols.map(([, l]) => l), 'Berat akhir (g)', ...(coco ? ['Tebal akhir (mm)'] : [])];
  const data: Sheet = {
    name: 'Data awal & akhir',
    rows: [
      title('Data awal & akhir'),
      [`Dicatat ${rec.createdAt.slice(0, 16).replace('T', ' ')}${rec.finishedAt ? ` · data akhir ${rec.finishedAt.slice(0, 16).replace('T', ' ')}` : ''}${rec.closedAt ? ' · SELESAI' : ''}`],
      [],
      dataHead,
      ...rec.rows.map((r) => [r.no, ...cols.map(([k]) => num(r[k])), num(r.beratAkhir), ...(coco ? [num(r.tebalAkhir)] : [])]),
    ],
    heads: [3],
    widths: dataHead.map((h, i) => (i ? Math.max(14, h.length + 2) : 8)),
  };

  const stats = compareRecord(rec);
  const cmpRows: Cell[][] = [title('Perbandingan awal & akhir'), []];
  const cmpHeads: number[] = [];
  for (const s of stats.filter((x) => x.label !== 'Tebal daging')) {
    const t = compareTable(s);
    cmpRows.push([s.label], [formulaNote(s)]);
    cmpHeads.push(cmpRows.length);
    cmpRows.push(t.head);
    for (const r of s.rows) {
      cmpRows.push(s.formula === 'awal-air-akhir' ? [r.no, round(r.awal), round(r.air), round(r.basis), round(r.akhir), round(r.selisih), round(r.pct, 1)] : [r.no, round(r.awal), round(r.akhir), round(r.selisih), round(r.pct, 1)]);
    }
    cmpRows.push(s.formula === 'awal-air-akhir' ? ['Rata-rata', round(s.meanAwal), round(s.meanAir), round(s.meanBasis), round(s.meanAkhir), round(s.meanSelisih), round(s.meanPct, 1)] : ['Rata-rata', round(s.meanAwal), round(s.meanAkhir), round(s.meanSelisih), round(s.meanPct, 1)], []);
  }
  const cmp: Sheet = { name: 'Perbandingan', rows: cmpRows, heads: cmpHeads, widths: [10, 16, 16, 16, 16, 16, 14] };

  const tebalStat = stats.find((x) => x.label === 'Tebal daging');
  const tebal: Sheet = {
    name: 'Tebal daging',
    rows: tebalStat
      ? [
          title('Tebal daging'),
          [formulaNote(tebalStat)],
          [],
          ['No', 'Tebal awal (mm)', 'Tebal akhir (mm)', 'Selisih (mm)', 'Perubahan (%)'],
          ...tebalStat.rows.map((r) => [r.no, round(r.awal), round(r.akhir), round(r.selisih), round(r.pct, 1)]),
          ['Rata-rata', round(tebalStat.meanAwal), round(tebalStat.meanAkhir), round(tebalStat.meanSelisih), round(tebalStat.meanPct, 1)],
        ]
      : [title('Tebal daging'), [`Item ${rec.item} tidak mencatat tebal daging.`]],
    heads: tebalStat ? [3] : [],
    widths: [10, 16, 16, 14, 14],
  };

  const items = treatmentItems(rec.treatments);
  const perlakuan: Sheet = {
    name: 'Perlakuan',
    rows: [title('Perlakuan'), [], ['Perlakuan', 'Jumlah', 'Perlakuan/metode', 'Keterangan'], ...(items.length ? items.map((i) => [i.title, num(i.count), i.method, i.note]) : [['Belum ada perlakuan yang dicatat.']])],
    heads: [2],
    widths: [28, 10, 24, 40],
  };

  const kesimpulan: Sheet = {
    name: 'Kesimpulan',
    rows: [title('Kesimpulan'), [], ...conclusions(rec).map((c, i) => [i + 1, c]), [], ['Catatan', 'Deskriptif dari angka isian pengguna; tanpa uji statistik dan bukan klaim mutu produk.']],
    heads: [],
    widths: [8, 120],
  };
  return [data, cmp, tebal, perlakuan, kesimpulan];
}

export function buildCatatXlsx(rec: CatatRecord): Uint8Array {
  const sheets = catatSheets(rec);
  const files: ZipFile[] = [];
  const add = (name: string, s: string) => files.push({ name, data: enc.encode(s) });
  add(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  add(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  // gaya: 0 = biasa, 1 = judul tabel (tebal, latar mint), 2 = judul sheet (tebal besar)
  add(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF63E6CF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
  );
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zipStore(files);
}
