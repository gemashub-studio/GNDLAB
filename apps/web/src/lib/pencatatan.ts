/**
 * PENCATATAN DATA (DEC-074, menggantikan menu Bahan Baku): catatan AWAL per item (N butir/unit bernomor: berat awal,
 * volume air, berat air, tebal daging) lalu catatan AKHIR (berat & tebal akhir tiap nomor) → perbandingan & kesimpulan.
 * Semua angka = isian pengguna; aplikasi hanya menghitung selisih, persen, rata-rata (deskriptif, tanpa klaim).
 * Disimpan di IndexedDB `gemas-catat` (ikut file cadangan).
 */
import { openDB, type DBSchema } from 'idb';
import { deviceTag } from './device';
import { addTomb } from './labSync';
import { isCoconutItem, NOT_RECORDED, parseMeasure } from './labStore';
import { fmtNum, type ChartSpec } from './reportCharts';
import type { PhotoPair, ReportBlock, ResearchReport } from './researchReport';

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

/**
 * Penjelasan UMUM tiap perlakuan untuk slide PPTX (DEC-087) — diturunkan dari nama perlakuan yang dipakai owner,
 * BUKAN protokol, dosis, atau klaim hasil. Detail proses mengikuti protokol/catatan lab masing-masing.
 */
export const TREATMENT_INFO: Record<TreatmentKey, { about: string; methods: Record<string, string> }> = {
  kopra: {
    about: 'Pengeringan daging kelapa menjadi kopra. Perlakuan dibedakan dari sumber panas / tempat pengeringan.',
    methods: { GreenHouse: 'dijemur dengan panas matahari di dalam rumah kaca (greenhouse)', 'Oven Gas': 'dikeringkan di oven berbahan bakar gas', 'Oven Briket': 'dikeringkan di oven berbahan bakar briket' },
  },
  bibit: {
    about: 'Bibit (kultur starter) untuk pembuatan bio leather dari air kelapa. Varian dibedakan dengan kode A dan B.',
    methods: { 'A - PH 40': 'bibit varian A, label "PH 40" sesuai isian', 'B - PH 40': 'bibit varian B, label "PH 40" sesuai isian' },
  },
  cuka: {
    about: 'Fermentasi air kelapa menjadi cuka. Perlakuan dibedakan dari jumlah gula yang ditambahkan (sesuai label).',
    methods: { 'CUKA 1 - GULA 25g': 'tambahan gula 25 g', 'CUKA 2 - GULA 75g': 'tambahan gula 75 g', 'CUKA 3 - GULA 50': 'tambahan gula 50 (satuan sesuai label)' },
  },
  bio: {
    about: 'Lembaran bio leather (selulosa hasil fermentasi). Perlakuan dibedakan dari jumlah gula (sesuai label).',
    methods: { 'Bio Leather A - Gula 25g': 'varian A, gula 25 g', 'Bio Leather B - Gula 50g': 'varian B, gula 50 g' },
  },
};
export interface TreatmentEntry {
  /** Jumlah perlakuan (isian). */
  count: string;
  /** Perlakuan/metode terpilih. */
  method: string;
  /** Keterangan bebas (DEC-089). */
  note?: string;
  /** Foto perlakuan, JPEG data URL potret 3:4 (DEC-089). */
  photo?: string;
}
/** Tiap jenis perlakuan bisa punya beberapa kolom (tombol +, DEC-081). Catatan lama menyimpan satu objek. */
export type Treatments = Partial<Record<TreatmentKey, TreatmentEntry[] | TreatmentEntry>>;

/** Daftar kolom perlakuan satu jenis (menerima format lama satu objek). */
export const treatmentEntries = (t: Treatments | undefined, key: TreatmentKey): TreatmentEntry[] => {
  const v = t?.[key];
  return v ? (Array.isArray(v) ? v : [v]) : [];
};

/** Nama tampil metode (GreenHouse → Green House). */
export const methodLabel = (m: string) => (m === 'GreenHouse' ? 'Green House' : m);
/** Metode perlakuan kopra yang dipilih di form data awal (DEC-101). */
export const KOPRA_METHODS = TREATMENT_GROUPS[0].methods as readonly string[];

export interface PerlakuanRange {
  method: string;
  label: string;
  /** Jumlah produksi (isian). */
  count: number;
  /** Nomor item yang masuk perlakuan ini (berurutan sesuai isian, DEC-101). */
  rows: CatatRow[];
}

/**
 * Bagi item ke perlakuan kopra secara berurutan sesuai isian form data awal (owner, DEC-101):
 * mis. 30 item, Green House 15, Oven Gas 10, Oven Briket 5 → no 1–15, 16–25, 26–30.
 */
export function perlakuanRanges(rec: Pick<CatatRecord, 'rows' | 'treatments'>): PerlakuanRange[] {
  const out: PerlakuanRange[] = [];
  let i = 0;
  for (const e of treatmentEntries(rec.treatments, 'kopra')) {
    const n = Math.max(0, parseInt(e.count, 10) || 0);
    if (!e.method || !n) continue;
    out.push({ method: e.method, label: methodLabel(e.method), count: n, rows: rec.rows.slice(i, i + n) });
    i += n;
  }
  return out;
}

export interface JalurPhoto {
  /** "no:awal" / "no:akhir"; perlakuan non-kopra: "tr:<jenis>:<kolom>" */
  key: string;
  /** Nomor item (0 untuk foto perlakuan non-kopra — tidak memakai nomor urut). */
  no: number;
  kind: 'awal' | 'akhir' | 'perlakuan';
  src: string;
  /** Label foto perlakuan, mis. "CUKA 2 - GULA 75g · jumlah 2". */
  label?: string;
  note?: string;
}
export interface JalurGroup {
  jalur: string;
  range?: PerlakuanRange;
  rows: CatatRow[];
  photos: JalurPhoto[];
  /** Jalur = perlakuan non-kopra (DEC-109): kolom "Perlakuan lainnya (Non Kopra)" dengan metode ini. */
  treatment?: { title: string; entries: TreatmentEntry[] };
}

const sameJalur = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Foto per kolom jalur produk di Resep baru (DEC-105): jalur = perlakuan di form data awal → foto nomor dalam rentang
 * perlakuan itu (berurutan: GH 15 → no 1–15, berikutnya mulai no 16). Pencatatan tanpa perlakuan + jalur kopra → semua nomor.
 * Jalur perlakuan non-kopra → foto kolom "Perlakuan lainnya (Non Kopra)" berjenis sama (tanpa nomor urut, DEC-109).
 * Jalur lain (tidak ada di pencatatan) dilewati. Foto yang dihapus (✕) tidak ikut.
 */
export function jalurGroups(rec: Pick<CatatRecord, 'rows' | 'treatments'>, jalurs: readonly string[], exclude: ReadonlySet<string> = new Set()): JalurGroup[] {
  const ranges = perlakuanRanges(rec);
  const out: JalurGroup[] = [];
  for (const j of jalurs) {
    if (!j.trim() || out.some((g) => sameJalur(g.jalur, j))) continue;
    // perlakuan non-kopra (bibit / cuka / bio leather): foto dari kolom perlakuan dengan jenis yang sama — tanpa nomor urut (DEC-109)
    const tg = TREATMENT_GROUPS.find((g) => g.key !== 'kopra' && (g.methods as readonly string[]).some((m) => sameJalur(m, j)));
    if (tg) {
      const entries = treatmentEntries(rec.treatments, tg.key)
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => sameJalur(e.method, j));
      if (!entries.length) continue;
      const photos = entries.flatMap(({ e, i }): JalurPhoto[] => {
        const key = `tr:${tg.key}:${i}`;
        return e.photo && !exclude.has(key) ? [{ key, no: 0, kind: 'perlakuan', src: e.photo, label: `${methodLabel(e.method)}${e.count.trim() ? ` · jumlah ${e.count.trim()}` : ''}`, ...(e.note?.trim() && { note: e.note.trim() }) }] : [];
      });
      out.push({ jalur: j, rows: [], photos, treatment: { title: tg.title.replace('Jumlah perlakuan ', 'Perlakuan '), entries: entries.map(({ e }) => e) } });
      continue;
    }
    const range = ranges.find((r) => sameJalur(r.label, j) || sameJalur(r.method, j));
    const kopra = KOPRA_METHODS.some((m) => sameJalur(m, j) || sameJalur(methodLabel(m), j));
    const rows = range ? range.rows : !ranges.length && kopra ? rec.rows : undefined;
    if (!rows) continue;
    const photos = rows.flatMap((r) =>
      (['awal', 'akhir'] as const).flatMap((kind) => {
        const src = kind === 'awal' ? r.fotoAwal : r.fotoAkhir;
        const key = `${r.no}:${kind}`;
        return src && !exclude.has(key) ? [{ key, no: r.no, kind, src }] : [];
      }),
    );
    out.push({ jalur: j, ...(range && { range }), rows, photos });
  }
  return out;
}

/** Baris tabel perlakuan yang terisi (jumlah atau metode), satu baris per kolom. */
/** Kolom perlakuan dianggap terisi bila ada jumlah, metode, keterangan, atau foto. */
const trFilled = (e: TreatmentEntry) => !!(e.count.trim() || e.method || e.note?.trim() || e.photo);

export const treatmentRows = (t?: Treatments): [string, string, string][] =>
  TREATMENT_GROUPS.flatMap((g) =>
    treatmentEntries(t, g.key)
      .filter(trFilled)
      .map((e): [string, string, string] => [g.title, e.count.trim() || '–', e.method || '–']),
  );

export interface TreatmentItem {
  title: string;
  count: string;
  method: string;
  note: string;
  photo?: string;
}

/** Semua kolom perlakuan yang terisi, lengkap dengan keterangan & foto (DEC-089). */
export const treatmentItems = (t?: Treatments): TreatmentItem[] =>
  TREATMENT_GROUPS.flatMap((g) =>
    treatmentEntries(t, g.key)
      .filter(trFilled)
      .map((e) => ({ title: g.title, count: e.count.trim() || '–', method: e.method || '–', note: e.note?.trim() || '–', ...(e.photo && { photo: e.photo }) })),
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
  /** Waktu perubahan terakhir — penentu versi saat sinkron (DEC-085). */
  updatedAt?: string;
  /** Foto progres harian setelah data lengkap (kamera melayang, DEC-086). */
  progress?: CatatProgress[];
  /** Jumlah perlakuan & metode per jalur (DEC-079). */
  treatments?: Treatments;
  /** Diselesaikan pengguna (tombol "Selesaikan", DEC-098) — kartu hijau. Tanpa batas jumlah catatan (DEC-101). */
  closedAt?: string;
}

export type ProgressStage = 'harian' | 'mingguan' | 'bulanan';
export const PROGRESS_STAGES: readonly { key: ProgressStage; label: string }[] = [
  { key: 'harian', label: 'Harian' },
  { key: 'mingguan', label: 'Mingguan' },
  { key: 'bulanan', label: 'Bulanan' },
];

export interface CatatProgress {
  id: string;
  /** Tanggal foto (YYYY-MM-DD, dari kalender). */
  date: string;
  title: string;
  /** Suhu ruang (°C), isian. */
  temp: string;
  note: string;
  stage: ProgressStage;
  /** JPEG data URL. */
  photo: string;
  /** Waktu unggah. */
  at: string;
}

/**
 * Usulan tahap dari jarak hari ke foto progres PERTAMA catatan itu: hari ke-1–7 = harian, ke-8–30 = mingguan,
 * sesudahnya = bulanan. Hanya usulan — pengguna bisa mengganti di form.
 */
export function suggestStage(existing: readonly CatatProgress[] | undefined, date: string): ProgressStage {
  const first = [...(existing ?? [])].map((p) => p.date).sort()[0] ?? date;
  const days = Math.floor((Date.parse(date) - Date.parse(first)) / 86_400_000);
  if (!Number.isFinite(days) || days < 7) return 'harian';
  return days < 30 ? 'mingguan' : 'bulanan';
}

/** Urut tanggal lalu waktu unggah. */
export const sortProgress = (list: readonly CatatProgress[] = []) => [...list].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));

/** Baris data satu foto progres (dipakai halaman hasil & semua unduhan). */
export const progressLines = (p: CatatProgress) => [
  `${p.date} · ${PROGRESS_STAGES.find((s) => s.key === p.stage)?.label ?? p.stage}`,
  p.title || '–',
  `Suhu ruang: ${p.temp.trim() ? `${p.temp.trim()} °C` : '–'}`,
  ...(p.note.trim() ? [p.note.trim()] : []),
];

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

/** Kesimpulan satu perbandingan (berat / tebal daging). */
export function statConclusion(rec: CatatRecord, s: CompareStat): string {
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
}

/** Kesimpulan deskriptif dari angka isian (tanpa uji statistik, tanpa klaim kualitas). */
export function conclusions(rec: CatatRecord): string[] {
  if (!hasAkhir(rec)) return ['Data akhir belum dicatat — kesimpulan muncul setelah pencatatan data akhir.'];
  const draft = rec.finishedAt ? [] : [`Data akhir sementara (belum lengkap): ${akhirFilled(rec)} dari ${rec.count} nomor terisi — angka di bawah bisa berubah.`];
  return [...draft, ...compareRecord(rec).map((s) => statConclusion(rec, s))];
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

/** Bisa diselesaikan: data awal & akhir lengkap (semua nomor terisi). */
export const canCloseCatat = (rec: CatatRecord) => !rec.closedAt && !!rec.finishedAt && !missingAkhir(rec.item, rec.rows).length;

/** Tandai catatan selesai (hijau). Hanya untuk catatan yang data awal & akhirnya lengkap. */
export async function closeCatat(id: string): Promise<CatatRecord> {
  const d = await catatDb();
  const rec = await d.get('records', id);
  if (!rec) throw new Error(`Catatan ${id} tidak ditemukan`);
  if (!canCloseCatat(rec)) throw new Error('Catatan baru bisa diselesaikan setelah data awal & akhir lengkap.');
  const now = new Date().toISOString();
  const next: CatatRecord = { ...rec, closedAt: now, updatedAt: now };
  await d.put('records', next);
  return next;
}

export async function addCatatAwal(item: string, rows: CatatRow[], treatments?: Treatments): Promise<CatatRecord> {
  const d = await catatDb();
  const now = new Date().toISOString();
  const rec: CatatRecord = { id: nextCatatId((await d.getAllKeys('records')).map(String)), item, count: rows.length, rows, createdAt: now, updatedAt: now, ...(treatments && treatmentRows(treatments).length && { treatments }) };
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
  next.updatedAt = now;
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

/** Tambah foto progres harian ke catatan yang SUDAH LENGKAP (DEC-086). */
export async function addCatatProgress(id: string, p: Omit<CatatProgress, 'id' | 'at'>): Promise<CatatRecord> {
  const d = await catatDb();
  const rec = await d.get('records', id);
  if (!rec) throw new Error(`Catatan ${id} tidak ditemukan`);
  if (!rec.finishedAt) throw new Error('Progres hanya untuk catatan yang sudah lengkap (awal & akhir).');
  const at = new Date().toISOString();
  const item: CatatProgress = { ...p, title: p.title.trim(), temp: p.temp.trim(), note: p.note.trim(), id: `PR-${at.replace(/\D/g, '').slice(2, 14)}-${Math.random().toString(36).slice(2, 5)}`, at };
  const next: CatatRecord = { ...rec, progress: [...(rec.progress ?? []), item], updatedAt: at };
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
  // nisan: agar tidak muncul lagi dari perangkat lain saat sinkron (DEC-085)
  for (const id of ids) addTomb('catat', id);
  return n;
}

// ------------------------------------------------------------------ laporan (PDF/Word/PowerPoint)

/** Foto per nomor untuk galeri laporan. */
/** Pasangan foto awal (atas) & akhir (bawah) + data singkat per nomor — untuk grid PowerPoint (DEC-077/101). */
export function photoPairsOf(rec: Pick<CatatRecord, 'item' | 'finishedAt' | 'akhirSavedAt'>, rows: readonly CatatRow[], exclude: ReadonlySet<string> = new Set()): PhotoPair[] {
  const coco = hasThickness(rec.item);
  const akhirOn = !!(rec.finishedAt || rec.akhirSavedAt);
  const u = (s: string | undefined, unit: string) => (s && s.trim() ? `${s.trim()} ${unit}` : '–');
  // foto yang dihapus dari resep (✕) dibuang; nomor yang kedua fotonya dihapus tidak ditampilkan (DEC-105)
  const kept = exclude.size ? rows.filter((r) => !((exclude.has(`${r.no}:awal`) || !r.fotoAwal) && (exclude.has(`${r.no}:akhir`) || !r.fotoAkhir) && (exclude.has(`${r.no}:awal`) || exclude.has(`${r.no}:akhir`)))) : rows;
  return kept.map((r) => ({
    no: r.no,
    awal: {
      ...(r.fotoAwal && !exclude.has(`${r.no}:awal`) && { image: r.fotoAwal }),
      lines: coco ? [`Berat ${u(r.beratAwal, 'g')}`, `Vol. air ${u(r.volAir, 'mL')}`, `Berat air ${u(r.beratAir, 'g')}`, `Tebal ${u(r.tebalAwal, 'mm')}`] : [`Berat ${u(r.beratAwal, 'g')}`],
    },
    ...(akhirOn && { akhir: { ...(r.fotoAkhir && !exclude.has(`${r.no}:akhir`) && { image: r.fotoAkhir }), lines: coco ? [`Berat ${u(r.beratAkhir, 'g')}`, `Tebal ${u(r.tebalAkhir, 'mm')}`] : [`Berat ${u(r.beratAkhir, 'g')}`] } }),
  }));
}

const photos = (rec: CatatRecord, k: 'awal' | 'akhir') =>
  rec.rows
    .filter((r) => (k === 'awal' ? r.fotoAwal : r.fotoAkhir))
    .map((r) => ({ name: `${rec.id}-${String(r.no).padStart(3, '0')}-${k}.jpg`, caption: `No ${r.no} · data ${k}`, dataUrl: (k === 'awal' ? r.fotoAwal : r.fotoAkhir)!, video: false }));

/** Slide penjelasan semua perlakuan yang tersedia (PPTX saja). */
function treatmentInfoBlock(): ReportBlock {
  return {
    heading: 'Penjelasan perlakuan',
    level: 1,
    lines: ['Penjelasan umum dari nama perlakuan — bukan protokol, dosis, atau klaim hasil.'],
    images: [],
    pptxOnly: true,
    cards: TREATMENT_GROUPS.map((g) => ({ title: g.title.replace('Jumlah perlakuan ', 'Perlakuan ').replace(/^./, (c) => c.toUpperCase()), lines: [TREATMENT_INFO[g.key].about, ...g.methods.map((m) => `${m}: ${TREATMENT_INFO[g.key].methods[m] ?? 'sesuai label'}`)] })),
  };
}

export function buildCatatReport(rec: CatatRecord, generatedAt = new Date().toLocaleString('id-ID')): ResearchReport {
  const coco = hasThickness(rec.item);
  const cols = awalColumns(rec.item);
  const cmp = compareRecord(rec);
  const tItems = treatmentItems(rec.treatments);
  const tRows = tItems.map((i) => [i.title, i.count, i.method, i.note]);
  const tHead = ['Perlakuan', 'Jumlah', 'Perlakuan/metode', 'Keterangan'];
  const tPhotos = tItems.filter((i) => i.photo);
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
      ...(tRows.length && { pptxAfterTable: { title: 'Perlakuan', head: tHead, rows: tRows } }),
    });
    // foto perlakuan (PPTX): foto potret berjajar + data di bawahnya (DEC-089)
    if (tPhotos.length)
      blocks.push({
        heading: 'Foto perlakuan',
        level: 1,
        lines: [],
        images: [],
        pptxOnly: true,
        photoCards: tPhotos.map((i) => ({ image: i.photo, lines: [i.title.replace('Jumlah perlakuan ', 'Perlakuan '), i.method, `Jumlah: ${i.count}`, ...(i.note !== '–' ? [i.note] : [])] })),
      });
    if (tRows.length) blocks.push(treatmentInfoBlock());
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
        ...(s.n >= 2 && {
          charts: [chart],
          nativeChart: true,
          chartCaption: `${s.formula === 'awal-air-akhir' ? 'Garis hijau = berat awal − berat air, garis oranye = berat akhir' : `Garis hijau = ${s.label.toLowerCase()} awal, garis oranye = ${s.label.toLowerCase()} akhir`}, per nomor sampel. ${statConclusion(rec, s)}`,
        }),
      });
    }
  }
  // PowerPoint: grid foto + data per nomor (awal atas, akhir bawah; maks. 10 nomor/slide).
  // Ada perlakuan di data awal (DEC-101) → satu bagian per perlakuan berisi item sebanyak jumlah produksinya.
  const ranges = perlakuanRanges(rec);
  const gridBlocks: ReportBlock[] = [];
  if (ranges.length) {
    for (const r of ranges)
      gridBlocks.push({ heading: `Perlakuan ${r.label} · ${r.count} item`, level: 1, lines: [], images: [], pptxOnly: true, photoPairs: photoPairsOf(rec, r.rows) });
    const used = ranges.reduce((n, r) => n + r.rows.length, 0);
    const rest = rec.rows.slice(used);
    if (rest.some((r) => r.fotoAwal || r.fotoAkhir)) gridBlocks.push({ heading: 'Tanpa perlakuan', level: 1, lines: [], images: [], pptxOnly: true, photoPairs: photoPairsOf(rec, rest) });
  } else if (rec.rows.some((r) => r.fotoAwal || r.fotoAkhir)) {
    gridBlocks.push({ heading: akhirOn ? 'Foto data awal & akhir' : 'Foto data awal', level: 1, lines: [], images: [], pptxOnly: true, photoPairs: photoPairsOf(rec, rec.rows) });
  }
  blocks.splice(akhirOn ? 2 : 1, 0, ...gridBlocks);
  // perlakuan: PDF/Word = bagian sendiri; PPTX = disatukan ke slide Kesimpulan (DEC-079)
  if (tRows.length)
    blocks.push({
      heading: 'Perlakuan',
      level: 1,
      lines: [],
      table: { head: tHead, rows: tRows },
      images: tPhotos.map((i) => ({ dataUrl: i.photo!, name: `${i.title} · ${i.method}`, caption: [i.method, `jumlah ${i.count}`, ...(i.note !== '–' ? [i.note] : [])].join(' · '), video: false })),
      pptxSkip: true,
    });
  blocks.push({
    heading: 'Kesimpulan',
    level: 1,
    lines: [...conclusions(rec), 'Kesimpulan deskriptif dari angka isian; bukan uji statistik dan bukan klaim mutu produk.'],
    images: [],
    ...(tRows.length && !akhirOn && { pptxTable: { head: tHead, rows: tRows } }),
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
