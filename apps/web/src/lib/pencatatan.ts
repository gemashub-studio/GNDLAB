/**
 * PENCATATAN DATA (DEC-074, menggantikan menu Bahan Baku): catatan AWAL per item (N butir/unit bernomor: berat awal,
 * volume air, berat air, tebal daging) lalu catatan AKHIR (berat & tebal akhir tiap nomor) → perbandingan & kesimpulan.
 * Semua angka = isian pengguna; aplikasi hanya menghitung selisih, persen, rata-rata (deskriptif, tanpa klaim).
 * Disimpan di IndexedDB `gemas-catat` (ikut file cadangan).
 */
import { openDB, type DBSchema } from 'idb';
import { deviceTag } from './device';
import { isCoconutItem, NOT_RECORDED, parseMeasure } from './labStore';
import { fmtNum, type ChartSpec } from './reportCharts';
import type { ReportBlock, ResearchReport } from './researchReport';

export const MAX_ROWS = 500;

export interface CatatRow {
  no: number;
  /** Berat awal (g). */
  beratAwal: string;
  /** Volume air (mL). */
  volAir: string;
  /** Berat air (g). */
  beratAir: string;
  /** Tebal daging awal (mm). */
  tebalAwal: string;
  /** Berat akhir (g) — diisi di pencatatan data akhir. */
  beratAkhir?: string;
  /** Tebal daging akhir (mm). */
  tebalAkhir?: string;
  /** Foto nomor ini saat data awal (JPEG data URL, DEC-075). */
  fotoAwal?: string;
  /** Foto nomor ini saat data akhir. */
  fotoAkhir?: string;
}

/** Perlakuan per jalur (DEC-079): jumlah perlakuan + metode (pilihan tetap dari owner). */
export const TREATMENT_GROUPS = [
  { key: 'kopra', title: 'Jumlah perlakuan kopra', methods: ['GreenHouse', 'Oven Gas', 'Oven Briket'] },
  { key: 'bibit', title: 'Jumlah perlakuan bibit bio leather', methods: ['A - PH 40', 'B - PH 40'] },
  { key: 'cuka', title: 'Jumlah perlakuan cuka', methods: ['CUKA 1 - GULA 25g', 'CUKA 2 - GULA 75g', 'CUKA 3 - GULA 50'] },
  { key: 'bio', title: 'Jumlah perlakuan bio leather', methods: ['Bio Leather A - Gula 25g', 'Bio Leather B - Gula 50g'] },
] as const;
export type TreatmentKey = (typeof TREATMENT_GROUPS)[number]['key'];
export interface TreatmentEntry {
  /** Jumlah perlakuan (isian). */
  count: string;
  /** Perlakuan/metode terpilih. */
  method: string;
}
/** Tiap jenis perlakuan bisa punya beberapa kolom (tombol +, DEC-081). Catatan lama menyimpan satu objek. */
export type Treatments = Partial<Record<TreatmentKey, TreatmentEntry[] | TreatmentEntry>>;

/** Daftar kolom perlakuan satu jenis (menerima format lama satu objek). */
export const treatmentEntries = (t: Treatments | undefined, key: TreatmentKey): TreatmentEntry[] => {
  const v = t?.[key];
  return v ? (Array.isArray(v) ? v : [v]) : [];
};

/** Baris tabel perlakuan yang terisi (jumlah atau metode), satu baris per kolom. */
export const treatmentRows = (t?: Treatments): [string, string, string][] =>
  TREATMENT_GROUPS.flatMap((g) =>
    treatmentEntries(t, g.key)
      .filter((e) => e.count.trim() || e.method)
      .map((e): [string, string, string] => [g.title, e.count.trim() || '–', e.method || '–']),
  );

export interface CatatRecord {
  /** PD-YYMMDD-NN (+ kode perangkat bila sinkron aktif). */
  id: string;
  item: string;
  count: number;
  rows: CatatRow[];
  createdAt: string;
  /** Terisi saat pencatatan data akhir dikonfirmasi. */
  finishedAt?: string;
  /** Data akhir disimpan sementara ("Simpan dulu", belum lengkap) — DEC-082. */
  akhirSavedAt?: string;
  /** Jumlah perlakuan & metode per jalur (DEC-079). */
  treatments?: Treatments;
}

export const blankRows = (n: number): CatatRow[] => Array.from({ length: n }, (_, i) => ({ no: i + 1, beratAwal: '', volAir: '', beratAir: '', tebalAwal: '' }));

/** Kolom yang dipakai item: kelapa = berat awal, volume air, berat air, tebal daging; lainnya = berat awal saja. */
export const awalColumns = (item: string) =>
  isCoconutItem(item)
    ? ([['beratAwal', 'Berat awal (g)'], ['volAir', 'Volume air (mL)'], ['beratAir', 'Berat air (g)'], ['tebalAwal', 'Tebal daging (mm)']] as const)
    : ([['beratAwal', 'Berat awal (g)']] as const);

/** Pencatatan akhir mengikuti tebal hanya bila item kelapa. */
export const hasThickness = (item: string) => isCoconutItem(item);

/** Nomor baris yang kosong untuk kolom wajib catatan awal (berat awal; kelapa juga tebal daging). */
export function missingAwal(item: string, rows: readonly CatatRow[]): number[] {
  return rows.filter((r) => !r.beratAwal.trim() || (hasThickness(item) && !r.tebalAwal.trim())).map((r) => r.no);
}

/** Nomor baris yang kosong untuk catatan akhir (berat akhir; tebal akhir bila tebal awal diisi). */
export function missingAkhir(item: string, rows: readonly CatatRow[]): number[] {
  return rows.filter((r) => !(r.beratAkhir ?? '').trim() || (hasThickness(item) && r.tebalAwal.trim() && !(r.tebalAkhir ?? '').trim())).map((r) => r.no);
}

// ------------------------------------------------------------------ perbandingan (murni)

export interface CompareRow {
  no: number;
  awal?: number;
  /** Berat air (hanya rumus berat kelapa). */
  air?: number;
  /** Berat awal − berat air (hanya rumus berat kelapa). */
  basis?: number;
  akhir?: number;
  /** Rumus "awal-air-akhir": awal − air − akhir. Rumus biasa: akhir − awal. */
  selisih?: number;
  /** Persen selisih terhadap (awal − air) atau terhadap awal. */
  pct?: number;
}

export interface CompareStat {
  label: string;
  unit: string;
  /** 'awal-air-akhir' = selisih berat = berat awal − berat air − berat akhir (DEC-083, rumus owner). */
  formula: 'awal-air-akhir' | 'akhir-awal';
  rows: CompareRow[];
  n: number;
  meanAwal?: number;
  meanAir?: number;
  meanBasis?: number;
  meanAkhir?: number;
  meanSelisih?: number;
  meanPct?: number;
  /** Nomor yang punya berat awal & akhir tetapi berat air kosong (tidak dihitung). */
  noAir: number[];
}

const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined);

function compareOne(label: string, unit: string, rows: readonly CatatRow[], a: (r: CatatRow) => string, b: (r: CatatRow) => string, sub?: (r: CatatRow) => string): CompareStat {
  const noAir: number[] = [];
  const out = rows.map<CompareRow>((r) => {
    const x = parseMeasure(a(r));
    const y = parseMeasure(b(r));
    const row: CompareRow = { no: r.no };
    if (x !== undefined) row.awal = x;
    if (y !== undefined) row.akhir = y;
    if (sub) {
      const w = parseMeasure(sub(r));
      if (w !== undefined) row.air = w;
      if (x !== undefined && w !== undefined) row.basis = x - w;
      if (row.basis !== undefined && y !== undefined) {
        row.selisih = row.basis - y;
        if (row.basis !== 0) row.pct = (row.selisih / row.basis) * 100;
      } else if (x !== undefined && y !== undefined && w === undefined) noAir.push(r.no);
    } else if (x !== undefined && y !== undefined) {
      row.selisih = y - x;
      if (x !== 0) row.pct = ((y - x) / x) * 100;
    }
    return row;
  });
  const both = out.filter((r) => r.selisih !== undefined);
  const st: CompareStat = { label, unit, formula: sub ? 'awal-air-akhir' : 'akhir-awal', rows: out, n: both.length, noAir };
  const set = (k: 'meanAwal' | 'meanAir' | 'meanBasis' | 'meanAkhir' | 'meanSelisih' | 'meanPct', v?: number) => {
    if (v !== undefined) st[k] = v;
  };
  set('meanAwal', mean(both.map((r) => r.awal!)));
  set('meanAkhir', mean(both.map((r) => r.akhir!)));
  set('meanSelisih', mean(both.map((r) => r.selisih!)));
  set('meanPct', mean(out.filter((r) => r.pct !== undefined).map((r) => r.pct!)));
  if (sub) {
    set('meanAir', mean(both.map((r) => r.air!)));
    set('meanBasis', mean(both.map((r) => r.basis!)));
  }
  return st;
}

/** Berat kelapa memakai rumus owner: berat awal − berat air − berat akhir (bila item punya kolom berat air). */
export function compareRecord(rec: CatatRecord): CompareStat[] {
  const air = awalColumns(rec.item).some(([k]) => k === 'beratAir');
  return [
    compareOne('Berat', 'g', rec.rows, (r) => r.beratAwal, (r) => r.beratAkhir ?? '', air ? (r) => r.beratAir : undefined),
    ...(hasThickness(rec.item) ? [compareOne('Tebal daging', 'mm', rec.rows, (r) => r.tebalAwal, (r) => r.tebalAkhir ?? '')] : []),
  ];
}

/** Keterangan rumus untuk laporan & halaman hasil. */
export const formulaNote = (s: CompareStat) =>
  s.formula === 'awal-air-akhir'
    ? 'Rumus: selisih = berat awal − berat air − berat akhir; persen = selisih ÷ (berat awal − berat air) × 100. Nomor dengan berat air kosong tidak dihitung.'
    : `Rumus: selisih = ${s.label.toLowerCase()} akhir − ${s.label.toLowerCase()} awal; persen terhadap nilai awal.`;

/** Tabel perbandingan (satu sumber untuk halaman hasil, PDF, Word & PPTX) + baris rata-rata. */
export function compareTable(s: CompareStat): { head: string[]; rows: string[][] } {
  const u = s.unit;
  const g = (v?: number) => f(v, 2);
  if (s.formula === 'awal-air-akhir')
    return {
      head: ['No', `Berat awal (${u})`, `Berat air (${u})`, `Awal − air (${u})`, `Berat akhir (${u})`, `Selisih (${u})`, 'Selisih (%)'],
      rows: [
        ...s.rows.map((r) => [String(r.no), g(r.awal), g(r.air), g(r.basis), g(r.akhir), g(r.selisih), fp(r.pct)]),
        ['Rata-rata', g(s.meanAwal), g(s.meanAir), g(s.meanBasis), g(s.meanAkhir), g(s.meanSelisih), fp(s.meanPct)],
      ],
    };
  return {
    head: ['No', `Awal (${u})`, `Akhir (${u})`, `Selisih (${u})`, 'Perubahan'],
    rows: [...s.rows.map((r) => [String(r.no), g(r.awal), g(r.akhir), g(r.selisih), fp(r.pct)]), ['Rata-rata', g(s.meanAwal), g(s.meanAkhir), g(s.meanSelisih), fp(s.meanPct)]],
  };
}

const f = (v?: number, d = 1) => (v === undefined ? '–' : fmtNum(Number(v.toFixed(d))));
const fp = (v?: number) => (v === undefined ? '–' : `${v > 0 ? '+' : ''}${fmtNum(Number(v.toFixed(1)))}%`);

/** Kesimpulan deskriptif dari angka isian (tanpa uji statistik, tanpa klaim kualitas). */
export function conclusions(rec: CatatRecord): string[] {
  if (!hasAkhir(rec)) return ['Data akhir belum dicatat — kesimpulan muncul setelah pencatatan data akhir.'];
  const draft = rec.finishedAt ? [] : [`Data akhir sementara (belum lengkap): ${akhirFilled(rec)} dari ${rec.count} nomor terisi — angka di bawah bisa berubah.`];
  return [...draft, ...compareRecord(rec).map((s) => {
    if (!s.n || s.meanPct === undefined) return `${s.label}: belum ada pasangan data awal & akhir yang lengkap.${s.noAir.length ? ` Berat air kosong di nomor ${s.noAir.join(', ')}.` : ''}`;
    const byAbs = s.rows.filter((r) => r.pct !== undefined).sort((p, q) => Math.abs(p.pct!) - Math.abs(q.pct!));
    const lo = byAbs[0];
    const hi = byAbs[byAbs.length - 1];
    const ext = lo && hi && lo.no !== hi.no ? ` Selisih terkecil di nomor ${lo.no} (${fp(lo.pct)}), terbesar di nomor ${hi.no} (${fp(hi.pct)}).` : '';
    const skip = s.noAir.length ? ` Nomor ${s.noAir.join(', ')} belum dihitung karena berat air kosong.` : '';
    if (s.formula === 'awal-air-akhir')
      return `Berat (berat awal − berat air − berat akhir): selisih rata-rata ${f(s.meanSelisih)} g atau ${fp(s.meanPct)} dari berat awal − air (rata-rata ${f(s.meanBasis)} g → berat akhir ${f(s.meanAkhir)} g) pada ${s.n} dari ${rec.count} ${rec.item.toLowerCase()}.${ext}${skip}`;
    const arah = s.meanPct < 0 ? 'turun' : s.meanPct > 0 ? 'naik' : 'tetap';
    return `${s.label} rata-rata ${arah} ${f(Math.abs(s.meanPct))}% (dari ${f(s.meanAwal)} ${s.unit} ke ${f(s.meanAkhir)} ${s.unit}) pada ${s.n} dari ${rec.count} ${rec.item.toLowerCase()}.${ext}`;
  })];
}

// ------------------------------------------------------------------ penyimpanan

interface CatatDb extends DBSchema {
  records: { key: string; value: CatatRecord };
}

let dbp: ReturnType<typeof openDB<CatatDb>> | undefined;
export const catatDb = () =>
  (dbp ??= openDB<CatatDb>('gemas-catat', 1, {
    upgrade(d) {
      d.createObjectStore('records', { keyPath: 'id' });
    },
  }));

export async function listCatat(): Promise<CatatRecord[]> {
  return (await (await catatDb()).getAll('records')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const getCatat = async (id: string) => (await catatDb()).get('records', id);

export function nextCatatId(existing: readonly string[], now = new Date(), tag = deviceTag()): string {
  const p = `PD-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const n = existing.filter((x) => x.startsWith(p)).map((x) => parseInt(x.slice(p.length), 10) || 0);
  return `${p}${String(Math.max(0, ...n) + 1).padStart(2, '0')}${tag}`;
}

export async function addCatatAwal(item: string, rows: CatatRow[], treatments?: Treatments): Promise<CatatRecord> {
  const d = await catatDb();
  const rec: CatatRecord = { id: nextCatatId((await d.getAllKeys('records')).map(String)), item, count: rows.length, rows, createdAt: new Date().toISOString(), ...(treatments && treatmentRows(treatments).length && { treatments }) };
  await d.add('records', rec);
  return rec;
}

export interface AkhirInput {
  no: number;
  beratAkhir: string;
  tebalAkhir: string;
  fotoAkhir?: string;
}

/** Ada data akhir (lengkap atau sementara)? */
export const hasAkhir = (rec: CatatRecord) => !!(rec.finishedAt || rec.akhirSavedAt);
/** Jumlah nomor yang sudah punya berat akhir. */
export const akhirFilled = (rec: CatatRecord) => rec.rows.filter((r) => (r.beratAkhir ?? '').trim()).length;

/**
 * Simpan data akhir. `final` = konfirmasi lengkap (finishedAt); tanpa itu = "Simpan dulu" (akhirSavedAt):
 * catatan tetap menunggu data akhir, isian & perlakuan terbaru tersimpan dan ikut unduhan (DEC-082).
 */
export async function saveCatatAkhir(id: string, akhir: AkhirInput[], treatments?: Treatments, final = true): Promise<CatatRecord> {
  const d = await catatDb();
  const rec = await d.get('records', id);
  if (!rec) throw new Error(`Catatan ${id} tidak ditemukan`);
  const by = new Map(akhir.map((a) => [a.no, a]));
  const next: CatatRecord = {
    ...rec,
    rows: rec.rows.map((r) => {
      const a = by.get(r.no);
      const { fotoAkhir: _old, ...rest } = r;
      return { ...rest, beratAkhir: a?.beratAkhir.trim() ?? '', tebalAkhir: a?.tebalAkhir.trim() ?? '', ...(a?.fotoAkhir && { fotoAkhir: a.fotoAkhir }) };
    }),
  };
  const now = new Date().toISOString();
  if (final) {
    next.finishedAt = now;
    delete next.akhirSavedAt;
  } else next.akhirSavedAt = now;
  if (treatments) {
    if (treatmentRows(treatments).length) next.treatments = treatments;
    else delete next.treatments;
  }
  await d.put('records', next);
  return next;
}

/** Hapus PERMANEN catatan terpilih (DEC-076; hanya yang lengkap awal & akhir — dijaga di UI & di sini). */
export async function deleteCatat(ids: readonly string[]): Promise<number> {
  const d = await catatDb();
  const tx = d.transaction('records', 'readwrite');
  let n = 0;
  for (const id of ids) {
    const r = await tx.store.get(id);
    if (r?.finishedAt) {
      await tx.store.delete(id);
      n++;
    }
  }
  await tx.done;
  return n;
}

// ------------------------------------------------------------------ laporan (PDF/Word/PowerPoint)

/** Foto per nomor untuk galeri laporan. */
const photos = (rec: CatatRecord, k: 'awal' | 'akhir') =>
  rec.rows
    .filter((r) => (k === 'awal' ? r.fotoAwal : r.fotoAkhir))
    .map((r) => ({ name: `${rec.id}-${String(r.no).padStart(3, '0')}-${k}.jpg`, caption: `No ${r.no} · data ${k}`, dataUrl: (k === 'awal' ? r.fotoAwal : r.fotoAkhir)!, video: false }));

export function buildCatatReport(rec: CatatRecord, generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  const coco = hasThickness(rec.item);
  const cols = awalColumns(rec.item);
  const cmp = compareRecord(rec);
  const v = (s?: string) => (s && s.trim() ? s.trim() : '–');
  const blocks: ReportBlock[] = [
    {
      heading: 'Data awal',
      level: 1,
      lines: [`Item: ${rec.item}`, `Jumlah: ${rec.count}`, `Dicatat: ${rec.createdAt.slice(0, 16).replace('T', ' ')}`],
      table: { head: ['No', ...cols.map(([, l]) => l)], rows: rec.rows.map((r) => [String(r.no), ...cols.map(([k]) => v(r[k]))]) },
      images: photos(rec, 'awal'),
      pptxOmitImages: true,
    },
  ];
  const akhirOn = hasAkhir(rec);
  if (akhirOn) {
    blocks.push({
      heading: rec.finishedAt ? 'Data akhir' : 'Data akhir (sementara, belum lengkap)',
      level: 1,
      lines: rec.finishedAt
        ? [`Dicatat: ${rec.finishedAt.slice(0, 16).replace('T', ' ')}`]
        : [`Disimpan sementara: ${rec.akhirSavedAt!.slice(0, 16).replace('T', ' ')}`, `Terisi: ${akhirFilled(rec)} dari ${rec.count} nomor`],
      table: { head: ['No', 'Berat akhir (g)', ...(coco ? ['Tebal daging akhir (mm)'] : [])], rows: rec.rows.map((r) => [String(r.no), v(r.beratAkhir), ...(coco ? [v(r.tebalAkhir)] : [])]) },
      images: photos(rec, 'akhir'),
      pptxOmitImages: true,
    });
    for (const s of cmp) {
      const chart: ChartSpec = {
        id: `cmp-${s.label}`,
        title: `${s.label} (${s.unit}) — awal vs akhir per nomor`,
        unit: s.unit,
        kind: 'line',
        x: s.rows.map((r) => String(r.no)),
        xTitle: 'Nomor',
        series: [
          s.formula === 'awal-air-akhir'
            ? { name: 'Awal − air', color: '#1FA88F', values: s.rows.map((r) => r.basis ?? null) }
            : { name: 'Awal', color: '#1FA88F', values: s.rows.map((r) => r.awal ?? null) },
          { name: 'Akhir', color: '#F5A524', values: s.rows.map((r) => r.akhir ?? null) },
        ],
        note: 'Nilai isian pengguna; nomor tanpa angka dibiarkan kosong.',
      };
      blocks.push({
        heading: `Perbandingan ${s.label.toLowerCase()}`,
        level: 1,
        lines: [formulaNote(s), `Pasangan lengkap: ${s.n} dari ${rec.count}`, `Rata-rata selisih: ${f(s.meanSelisih, 2)} ${s.unit} (${fp(s.meanPct)})`],
        table: compareTable(s),
        images: [],
        ...(s.n >= 2 && { charts: [chart] }),
      });
    }
  }
  // PowerPoint: grid foto + data per nomor (awal atas, akhir bawah; akhir tanpa volume/berat air)
  if (rec.rows.some((r) => r.fotoAwal || r.fotoAkhir)) {
    const u = (s: string | undefined, unit: string) => (s && s.trim() ? `${s.trim()} ${unit}` : '–');
    blocks.splice(akhirOn ? 2 : 1, 0, {
      heading: akhirOn ? 'Foto data awal & akhir' : 'Foto data awal',
      level: 1,
      lines: [],
      images: [],
      pptxOnly: true,
      photoPairs: rec.rows.map((r) => ({
        no: r.no,
        awal: {
          ...(r.fotoAwal && { image: r.fotoAwal }),
          lines: coco ? [`Berat ${u(r.beratAwal, 'g')}`, `Vol. air ${u(r.volAir, 'mL')}`, `Berat air ${u(r.beratAir, 'g')}`, `Tebal ${u(r.tebalAwal, 'mm')}`] : [`Berat ${u(r.beratAwal, 'g')}`],
        },
        ...(akhirOn && { akhir: { ...(r.fotoAkhir && { image: r.fotoAkhir }), lines: coco ? [`Berat ${u(r.beratAkhir, 'g')}`, `Tebal ${u(r.tebalAkhir, 'mm')}`] : [`Berat ${u(r.beratAkhir, 'g')}`] } }),
      })),
    });
  }
  // perlakuan: PDF/Word = bagian sendiri; PPTX = disatukan ke slide Kesimpulan (DEC-079)
  const tRows = treatmentRows(rec.treatments);
  const tHead = ['Perlakuan', 'Jumlah', 'Perlakuan/metode'];
  if (tRows.length) blocks.push({ heading: 'Perlakuan', level: 1, lines: [], table: { head: tHead, rows: tRows }, images: [], pptxSkip: true });
  blocks.push({
    heading: 'Kesimpulan',
    level: 1,
    lines: [...conclusions(rec), 'Kesimpulan deskriptif dari angka isian; bukan uji statistik dan bukan klaim mutu produk.'],
    images: [],
    ...(tRows.length && { pptxTable: { head: tHead, rows: tRows } }),
  });
  const title = `Pencatatan data — ${rec.item} (${rec.count})`;
  const status = rec.finishedAt ? 'Awal & akhir lengkap' : rec.akhirSavedAt ? 'Menunggu data akhir · tersimpan sementara' : 'Menunggu data akhir';
  return {
    title,
    subtitle: `${rec.id} · ${status}`,
    generatedAt,
    cover: {
      code: rec.id,
      product: rec.item,
      status,
      done: !!rec.finishedAt,
      meta: [
        ['Kode', rec.id],
        ['Item', rec.item],
        ['Jumlah', String(rec.count)],
        ['Data awal', rec.createdAt.slice(0, 10)],
        ['Data akhir', rec.finishedAt ? rec.finishedAt.slice(0, 10) : rec.akhirSavedAt ? `sementara ${rec.akhirSavedAt.slice(0, 10)}` : 'belum dicatat'],
      ],
    },
    kpis: [
      { label: 'Jumlah item', value: String(rec.count) },
      { label: 'Data awal terisi', value: String(rec.rows.filter((r) => r.beratAwal.trim()).length) },
      { label: 'Data akhir terisi', value: String(rec.rows.filter((r) => (r.beratAkhir ?? '').trim()).length) },
      ...cmp.map((s) => ({ label: `Rata-rata selisih ${s.label.toLowerCase()}`, value: akhirOn ? fp(s.meanPct) : NOT_RECORDED })),
    ],
    blocks,
    footer: `GnD Lab · pencatatan data ${rec.id} · dibuat ${generatedAt}`,
  };
}
