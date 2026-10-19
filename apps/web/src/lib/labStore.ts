'use client';

/**
 * Buku catatan eksperimen GEMA RnD (architecture/07-rnd/asal-chatgpt/arsitektur-GEMA-RnD.md §4, §11–12) —
 * disimpan di perangkat (IndexedDB `gemas-lab`, offline; laptop & HP = penyimpanan terpisah).
 * - Eksperimen tidak pernah ditimpa: `add` menolak ID yang sudah ada; perubahan menyimpan versi lama di `history`.
 * - Catatan harian APPEND-ONLY: tidak ada fungsi ubah/hapus; koreksi = entri baru yang merujuk entri lama.
 * - Protokol (resep & proses buatan pengguna) berversi: perubahan = versi baru; versi lama tak disentuh.
 * - Kolom kosong = "belum dicatat", tidak diisi tebakan.
 */
import { deviceTag } from './device';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { parseNum } from './format';
import type { ExperimentDesign } from './labDesign';

export const LAB_PRODUCTS = [
  { id: 'KE', name: 'Kopra Edibel' },
  { id: 'CK', name: 'Cuka Air Kelapa' },
  { id: 'BL', name: 'Bioleather' },
  { id: 'AR', name: 'Arang' },
  { id: 'BR', name: 'Briket' },
] as const;
export type LabProductId = (typeof LAB_PRODUCTS)[number]['id'];

export const LAB_STATUS = [
  { id: 'rencana', label: 'Rencana' },
  { id: 'berjalan', label: 'Berjalan' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'gagal', label: 'Gagal' },
] as const;
export type LabStatus = (typeof LAB_STATUS)[number]['id'];

export interface NextStep {
  id: string;
  action: string;
  done: boolean;
}

/** Bagian yang boleh dilengkapi setelah eksperimen dibuat. */
export interface ExperimentEditable {
  title: string;
  question: string;
  objective: string;
  methodVersion: string;
  processConditions: string;
  resultSummary: string;
  conclusion: string;
  status: LabStatus;
  nextSteps: NextStep[];
  /** Dugaan yang diuji (opsional). */
  hypothesis?: string;
  /** Desain: faktor, level, ulangan, variabel ukur, unit percobaan (DEC-051). */
  design?: ExperimentDesign;
}

export interface Experiment extends ExperimentEditable {
  /** Mis. KE-2610-001 (produk-TahunBulan-urut, pola PRD_RnD RD-01). */
  id: string;
  product: LabProductId;
  startedAt: string;
  createdAt: string;
  updatedAt?: string;
  /** Salinan versi sebelumnya (terlama dulu) — catatan lama tidak hilang saat dilengkapi. */
  history?: (ExperimentEditable & { savedAt: string })[];
}

/** Baris bahan: jumlah disimpan PERSIS seperti diketik pengguna (teks), satuan terpisah. */
export interface MaterialLine {
  name: string;
  batch: string;
  amount: string;
  unit: string;
}

/** Hasil ukur mentah. `value` = teks apa adanya; grafik hanya memakai yang bisa dibaca sebagai angka. */
export interface Measurement {
  name: string;
  value: string;
  unit: string;
  /** Waktu ukur, format input datetime-local (YYYY-MM-DDTHH:mm). */
  at: string;
  /** Ulangan / kelompok pembanding, mis. "U1", "kontrol". */
  group: string;
  note: string;
}

/** Entri catatan harian (append-only). Label bagian mengikuti spesifikasi: rencana ≠ realisasi ≠ hasil ukur ≠ interpretasi. */
export interface DailyEntry {
  /** Mis. KE-2610-001-H01. */
  id: string;
  experimentId: string;
  /** Tanggal kerja yang dicatat (YYYY-MM-DD). */
  entryDate: string;
  createdAt: string;
  /** Versi protokol yang BENAR-BENAR dipakai hari itu (id versi), bila ada. */
  protocolId: string;
  plan: string;
  actual: string;
  materials: MaterialLine[];
  tools: string;
  conditions: string;
  measurements: Measurement[];
  deviations: string;
  interpretation: string;
  nextStep: string;
  mediaIds: string[];
  /** Bila entri ini mengoreksi entri lain (entri lama tetap ada). */
  correctsEntryId?: string;
  /** Laporan harian riset produk: tandai riset SELESAI (laporan penutup). */
  finished?: boolean;
}

export interface MediaItem {
  id: string;
  experimentId: string;
  entryId: string;
  name: string;
  type: string;
  size: number;
  caption: string;
  createdAt: string;
  /** Pratinjau kecil (data URL JPEG) untuk layar & PDF; bisa kosong bila tak bisa dibuat. */
  thumb: string;
  blob: Blob;
}

export interface ProtocolIngredient {
  name: string;
  amount: string;
  unit: string;
  /** Foto/video bahan (id di store media). */
  mediaIds?: string[];
}
export interface ProtocolStep {
  text: string;
  duration: string;
  conditions: string;
  /** Foto/video langkah (id di store media). */
  mediaIds?: string[];
}

/** Alat yang digunakan (bisa dengan foto/video). */
export interface ProtocolTool {
  name: string;
  amount?: string;
  unit?: string;
  mediaIds?: string[];
}

/** Item bahan baku (owner 2026-10-13/14): pilihan dropdown Item/barang. */
export const RAW_ITEMS = ['Kelapa tua', 'Kelapa muda', 'Arang', 'Arang mix residu', 'Granul halus', 'Granul kasar', 'Sekam'] as const;

/** Item kelapa (punya air & daging) → air, perlakuan daging & tebal daging WAJIB. */
export const isCoconutItem = (item: string) => /^kelapa/i.test(item.trim());

/**
 * Kolom wajib per item (owner 2026-10-14): semua item wajib barang & berat utuh; item kelapa juga wajib air,
 * perlakuan daging & tebal daging. Sekam, granul, arang (termasuk mix residu) tidak wajib air/daging/tebal.
 * Mengembalikan nama kolom yang masih kosong.
 */
export function missingRawFields(r: Pick<RawMaterial, 'item' | 'name' | 'wholeWeight' | 'water' | 'meatVariant' | 'meatThickness'>): string[] {
  const miss: string[] = [];
  if (!r.name.trim()) miss.push('Barang');
  if (!r.wholeWeight.trim()) miss.push('Berat utuh');
  if (isCoconutItem(r.item)) {
    if (!r.water.trim()) miss.push('Air');
    if (!r.meatVariant) miss.push('Perlakuan daging');
    if (!r.meatThickness.trim()) miss.push('Tebal daging');
  }
  return miss;
}

/** Jalur produk Resep baru bila tidak ada varian: item non-kelapa memakai nama itemnya (Arang → preset AR). */
export const jalurFromRaw = (r: RawMaterial): string => (r.variant ? variantLabel(r.variant) : isCoconutItem(r.item) ? 'Kopra Edibel' : r.item);

/**
 * Bahan baku (DEC-068/069) — diisi di menu Bahan Baku lalu ikut ke Resep baru. Semua isian pengguna.
 * Perlakuan air (Cuka1–10 / Bioleather1–10) & perlakuan daging (Kopra1–10) = dua pilihan TERPISAH;
 * varian terpilih jadi jalur produk Resep baru. Tebal daging diisi langsung dalam mm.
 */
export interface RawMaterial {
  item: string;
  name: string;
  /** Berat utuh (g). */
  wholeWeight: string;
  /** Air (mL). */
  water: string;
  /** Perlakuan air: slot varian, mis. "CK-3" (Cuka3) / "BL-2" (Bioleather2); '' = tidak dipilih. */
  waterVariant: string;
  /** Perlakuan daging: slot varian, mis. "KE-1" (Kopra1); '' = tidak dipilih. */
  meatVariant: string;
  /** Tebal daging (mm). */
  meatThickness: string;
  /** Varian yang dipakai sebagai jalur produk resep (salah satu dari dua di atas). */
  variant: string;
  /** Riset lain yang sudah memakai varian itu (rujukan). */
  refKeys: string[];
}

export const blankRaw = (): RawMaterial => ({ item: 'Kelapa tua', name: '', wholeWeight: '', water: '', waterVariant: '', meatVariant: '', meatThickness: '', variant: '', refKeys: [] });

export type TreatmentKind = 'air' | 'daging';

/** Jumlah slot varian per jalur (owner: Cuka1…Cuka10, Bioleather1…10, Kopra1…10). */
export const VARIANT_MAX = 10;

/** Jalur varian per perlakuan: air → Cuka & Bioleather; daging → Kopra. */
export const variantLines = (kind: TreatmentKind): { product: string; label: string }[] =>
  kind === 'air' ? [{ product: 'CK', label: 'Cuka' }, { product: 'BL', label: 'Bioleather' }] : [{ product: 'KE', label: 'Kopra' }];

export interface VariantSlot {
  /** mis. "CK-3" */
  id: string;
  /** mis. "Cuka3" */
  label: string;
  product: string;
  n: number;
  /** Riset terbaru yang berjalur produk sama dengan slot ini; kosong = belum dipakai. */
  research?: ProtocolVersion;
}

/** Slot varian terisi OTOMATIS dari Riset Produk: slot "Cuka3" terisi bila ada riset berjalur produk "Cuka3". */
export function variantSlots(kind: TreatmentKind, protocols: readonly ProtocolVersion[]): VariantSlot[] {
  return variantLines(kind).flatMap(({ product, label }) =>
    Array.from({ length: VARIANT_MAX }, (_, i) => {
      const name = `${label}${i + 1}`;
      const research = protocols.filter((p) => (p.productName ?? '').toLowerCase() === name.toLowerCase()).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      return { id: `${product}-${i + 1}`, label: name, product, n: i + 1, ...(research && { research }) };
    }),
  );
}

/** Nama varian dari id slot: "CK-3" → "Cuka3". */
export const variantLabel = (id: string) => {
  const [p, n] = id.split('-');
  const l = { CK: 'Cuka', BL: 'Bioleather', KE: 'Kopra' }[p ?? ''];
  return l && n ? `${l}${n}` : id;
};

export const findSlot = (variant: string, protocols: readonly ProtocolVersion[]) =>
  variant ? variantSlots(variant.startsWith('KE-') ? 'daging' : 'air', protocols).find((s) => s.id === variant) : undefined;

/** Produk awal resep dari bahan baku. */
export const productFromRaw = (r: RawMaterial): string => (r.variant ? r.variant.split('-')[0]! : resolveProduct(jalurFromRaw(r)).product);

/**
 * Penghitungan bahan baku kelapa (DEC-064) — satu baris per butir/bahan, semua angka & teks = isian pengguna.
 * Berat dalam gram, volume dalam mL, ketebalan daging dalam mm.
 */
export interface CoconutRow {
  name: string;
  wholeStart: string;
  wholeEnd: string;
  waterWeight: string;
  waterVolume: string;
  meatStart: string;
  meatEnd: string;
  waterProcess: string;
  meatProcess: string;
  waterResult: string;
  meatResult: string;
  mediaIds?: string[];
}

export const blankCoconut = (n = 1): CoconutRow => ({ name: `Kelapa ${n}`, wholeStart: '', wholeEnd: '', waterWeight: '', waterVolume: '', meatStart: '', meatEnd: '', waterProcess: '', meatProcess: '', waterResult: '', meatResult: '' });

/** Baris dianggap terisi bila ada salah satu isian selain nama. */
export const coconutFilled = (r: CoconutRow) => (['wholeStart', 'wholeEnd', 'waterWeight', 'waterVolume', 'meatStart', 'meatEnd', 'waterProcess', 'meatProcess', 'waterResult', 'meatResult'] as const).some((k) => r[k].trim());

export interface CoconutStat {
  label: string;
  unit: string;
  n: number;
  total?: number;
  mean?: number;
}

/**
 * Ringkasan penghitungan kelapa (label pendek: Utuh = berat utuh; Selisih utuh = awal - akhir per baris): jumlah & rata-rata tiap kolom angka (hanya isian yang berupa angka; n = jumlah
 * baris terisi) + selisih berat utuh (awal - akhir) per baris yang keduanya terisi. Tanpa angka acuan/literatur.
 */
export function coconutSummary(rows: readonly CoconutRow[]): CoconutStat[] {
  const col = (label: string, unit: string, vals: (number | undefined)[], withTotal = true): CoconutStat => {
    const v = vals.filter((x): x is number => x !== undefined);
    const total = v.reduce((a, b) => a + b, 0);
    return { label, unit, n: v.length, ...(v.length && { ...(withTotal && { total }), mean: total / v.length }) };
  };
  const num = (s: string) => parseMeasure(s);
  return [
    col('Utuh awal', 'g', rows.map((r) => num(r.wholeStart))),
    col('Utuh akhir', 'g', rows.map((r) => num(r.wholeEnd))),
    col('Selisih utuh', 'g', rows.map((r) => { const a = num(r.wholeStart); const b = num(r.wholeEnd); return a !== undefined && b !== undefined ? a - b : undefined; })),
    col('Berat air', 'g', rows.map((r) => num(r.waterWeight))),
    col('Volume air', 'mL', rows.map((r) => num(r.waterVolume))),
    col('Tebal daging awal', 'mm', rows.map((r) => num(r.meatStart)), false),
    col('Tebal daging akhir', 'mm', rows.map((r) => num(r.meatEnd)), false),
  ];
}

/** Daftar alat ternormalisasi (versi awal fitur menyimpan teks saja). */
export const toolList = (v: Pick<ProtocolVersion, 'tools'>): ProtocolTool[] => (v.tools ?? []).map((t) => (typeof t === 'string' ? { name: t } : t));

/** Berkas yang akan dilampirkan saat menyimpan versi riset produk. */
export type NewMedia = Omit<MediaItem, 'id' | 'entryId' | 'experimentId' | 'createdAt'>;

/**
 * DRAF resep riset produk (DEC-054): isian yang belum selesai — BOLEH diubah & disimpan ulang
 * ("Simpan"), dibuka lagi kapan saja ("On going proses"). "Selesai" mengubahnya menjadi versi resmi
 * yang tidak bisa diubah, lalu draf dihapus dalam transaksi yang sama.
 */
export interface ProtocolDraft {
  /** Mis. D-lx3k9a. */
  id: string;
  /** Bila draf = versi baru dari resep yang ada. */
  baseId?: string;
  /** Kode jalur (preset LAB_PRODUCTS atau kode dari nama isian manual, DEC-063). */
  product: string;
  /** Nama jalur bila diisi manual (bukan preset). */
  productName?: string;
  name: string;
  author: string;
  assistants: string;
  startDate: string;
  reason: string;
  ingredients: ProtocolIngredient[];
  tools: ProtocolTool[];
  steps: ProtocolStep[];
  /** Penghitungan bahan baku kelapa (DEC-064). */
  coconuts?: CoconutRow[];
  /** Bahan baku dari menu Bahan Baku (DEC-068). */
  raw?: RawMaterial;
  /** Data pencatatan yang dipilih di Resep baru (DEC-101). */
  catatId?: string;
  /** Foto/video yang sudah dipilih tapi belum jadi versi resmi (per baris). */
  pending: { ingredients: NewMedia[][]; tools: NewMedia[][]; steps: NewMedia[][]; coconuts?: NewMedia[][] };
  createdAt: string;
  updatedAt: string;
}

/** Versi protokol buatan pengguna — tidak pernah diubah setelah disimpan. */
export interface ProtocolVersion {
  /** Mis. KE-P01-v2. */
  id: string;
  /** Mis. KE-P01 — sama untuk semua versi satu resep. */
  key: string;
  version: number;
  /** Kode jalur: preset (KE, CK, …) atau dari nama isian manual (DEC-063). */
  product: string;
  /** Nama jalur bila diisi manual. */
  productName?: string;
  name: string;
  ingredients: ProtocolIngredient[];
  steps: ProtocolStep[];
  /** Tanggal mulai riset (YYYY-MM-DD) — disalin ke versi berikutnya. */
  startDate?: string;
  /** Nama asisten (selain pembuat). */
  assistants?: string[];
  /** Alat yang digunakan (teks lama = string). */
  tools?: (ProtocolTool | string)[];
  /** Penghitungan bahan baku kelapa (DEC-064). */
  coconuts?: CoconutRow[];
  /** Bahan baku dari menu Bahan Baku (DEC-068). */
  raw?: RawMaterial;
  /** Data pencatatan yang dipilih di Resep baru (DEC-101) — foto per perlakuan ikut laporan. */
  catatId?: string;
  reason: string;
  author: string;
  createdAt: string;
}

export const NOT_RECORDED = 'belum dicatat';

/** ID berikutnya untuk produk & bulan mulai; urut dari ID yang sudah ada (bukan jumlah) agar tak bentrok. */
export function nextExperimentId(product: LabProductId, startedAt: string, existing: readonly string[], tag = deviceTag()): string | undefined {
  const m = /^\d{2}(\d{2})-(\d{2})-\d{2}$/.exec(startedAt);
  if (!m) return undefined;
  const prefix = `${product}-${m[1]}${m[2]}-`;
  const max = existing.filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, parseInt(id.slice(prefix.length), 10) || 0), 0);
  return max >= 999 ? undefined : `${prefix}${String(max + 1).padStart(3, '0')}${tag}`;
}

/** ID entri harian berikutnya: `${eksperimen}-H01`, `-H02`, … */
export function nextEntryId(experimentId: string, existing: readonly string[], tag = deviceTag()): string {
  const prefix = `${experimentId}-H`;
  const max = existing.filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, parseInt(id.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}${tag}`;
}

/** Kunci resep baru per produk: KE-P01, KE-P02, … */
/** Kode 2 huruf dari nama jalur isian manual: "Minyak Kelapa" → MK, "Santan" → SA. */
export function productCode(name: string): string {
  const words = name.toUpperCase().normalize('NFD').replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const code = words.length >= 2 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '').slice(0, 2);
  return code.length === 2 ? code : 'XX';
}

/** Isian jalur produk (bebas) → kode + nama manual (kosong bila cocok dengan preset). */
export function resolveProduct(text: string): { product: string; productName?: string } {
  const t = text.trim();
  const v = /^(cuka|bioleather|kopra)\s*(\d{1,2})$/i.exec(t);
  if (v && Number(v[2]) >= 1 && Number(v[2]) <= VARIANT_MAX) {
    const k = v[1]!.toLowerCase();
    return { product: k === 'cuka' ? 'CK' : k === 'bioleather' ? 'BL' : 'KE', productName: `${k[0]!.toUpperCase()}${k.slice(1)}${Number(v[2])}` };
  }
  const preset = LAB_PRODUCTS.find((p) => p.name.toLowerCase() === t.toLowerCase() || p.id === t.toUpperCase());
  if (preset) return { product: preset.id };
  return t ? { product: productCode(t), productName: t } : { product: 'XX' };
}

/** Nama jalur untuk tampilan: isian manual, nama preset, atau kodenya. */
export const protocolProductName = (p: { product: string; productName?: string }) => p.productName || LAB_PRODUCTS.find((x) => x.id === p.product)?.name || p.product;

export function nextProtocolKey(product: string, existing: readonly ProtocolVersion[], tag = deviceTag()): string {
  const prefix = `${product}-P`;
  const max = existing.filter((p) => p.key.startsWith(prefix)).reduce((n, p) => Math.max(n, parseInt(p.key.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}${tag}`;
}

/** Versi berikutnya dari resep yang sama. */
export function nextProtocolVersion(key: string, existing: readonly ProtocolVersion[], tag = deviceTag()): { id: string; version: number } {
  const version = existing.filter((p) => p.key === key).reduce((n, p) => Math.max(n, p.version), 0) + 1;
  return { id: `${key}-v${version}${tag}`, version };
}

/** Baca angka dengan aturan yang sama seperti kolom angka lain di aplikasi (parseNum); bukan angka → undefined. */
export function parseMeasure(v: string): number | undefined {
  if (!/^\s*-?[\d.,\s]+$/.test(v)) return undefined;
  const n = parseNum(v);
  return Number.isFinite(n) ? n : undefined;
}

export interface SeriesPoint {
  at: string;
  value: number;
  group: string;
  entryId: string;
}
export interface Series {
  name: string;
  unit: string;
  points: SeriesPoint[];
  /** Nilai yang tercatat tapi bukan angka (tetap ditampilkan di tabel, tidak di grafik). */
  nonNumeric: number;
}

/** Kelompokkan hasil ukur per (nama, satuan) dan urutkan menurut waktu — hanya data tercatat. */
export function measurementSeries(entries: readonly DailyEntry[]): Series[] {
  const map = new Map<string, Series>();
  for (const e of entries) {
    for (const m of e.measurements) {
      if (!m.name.trim()) continue;
      const k = `${m.name.trim().toLowerCase()}|${m.unit.trim()}`;
      const s = map.get(k) ?? { name: m.name.trim(), unit: m.unit.trim(), points: [], nonNumeric: 0 };
      const n = parseMeasure(m.value);
      if (n === undefined) s.nonNumeric++;
      else s.points.push({ at: m.at || e.entryDate, value: n, group: m.group.trim(), entryId: e.id });
      map.set(k, s);
    }
  }
  for (const s of map.values()) s.points.sort((a, b) => a.at.localeCompare(b.at));
  return [...map.values()];
}

/** Grafik hanya layak bila ada ≥ 2 titik angka. */
export const chartable = (s: Series) => s.points.length >= 2;

const editable = (e: Experiment): ExperimentEditable => ({
  title: e.title,
  question: e.question,
  objective: e.objective,
  methodVersion: e.methodVersion,
  processConditions: e.processConditions,
  resultSummary: e.resultSummary,
  conclusion: e.conclusion,
  status: e.status,
  nextSteps: (e.nextSteps ?? []).map((s) => ({ ...s })),
  ...(e.hypothesis !== undefined && { hypothesis: e.hypothesis }),
  ...(e.design && { design: structuredClone(e.design) }),
});

/** Terapkan perubahan; versi lama disalin ke `history` (tidak ada yang dibuang). */
export function applyUpdate(e: Experiment, patch: Partial<ExperimentEditable>, now = new Date().toISOString()): Experiment {
  const before = editable(e);
  return { ...e, ...patch, updatedAt: now, history: [...(e.history ?? []), { ...before, savedAt: e.updatedAt ?? e.createdAt }] };
}

export interface LabFilter {
  q?: string;
  product?: LabProductId | 'all';
  status?: LabStatus | 'all';
}

/** Cari teks di ID, judul, pertanyaan, tujuan, metode, kondisi, hasil, kesimpulan. */
export function filterExperiments(items: readonly Experiment[], f: LabFilter): Experiment[] {
  const q = f.q?.trim().toLowerCase();
  return items.filter((e) => {
    if (f.product && f.product !== 'all' && e.product !== f.product) return false;
    if (f.status && f.status !== 'all' && e.status !== f.status) return false;
    if (!q) return true;
    return [e.id, e.title, e.question, e.objective, e.methodVersion, e.processConditions, e.resultSummary, e.conclusion]
      .some((s) => s.toLowerCase().includes(q));
  });
}

/** Langkah berikutnya yang belum selesai, lintas eksperimen. */
export function openNextSteps(items: readonly Experiment[]): { experiment: Experiment; step: NextStep }[] {
  return items.flatMap((e) => (e.nextSteps ?? []).filter((s) => !s.done).map((step) => ({ experiment: e, step })));
}

export interface LabDb extends DBSchema {
  experiments: { key: string; value: Experiment; indexes: { createdAt: string } };
  entries: { key: string; value: DailyEntry; indexes: { experimentId: string } };
  media: { key: string; value: MediaItem; indexes: { experimentId: string; entryId: string } };
  protocols: { key: string; value: ProtocolVersion; indexes: { product: string; key: string } };
  drafts: { key: string; value: ProtocolDraft };
}

let dbp: Promise<IDBPDatabase<LabDb>> | undefined;
export const labDb = () =>
  (dbp ??= openDB<LabDb>('gemas-lab', 3, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) d.createObjectStore('experiments', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      if (oldVersion < 2) {
        d.createObjectStore('entries', { keyPath: 'id' }).createIndex('experimentId', 'experimentId');
        const m = d.createObjectStore('media', { keyPath: 'id' });
        m.createIndex('experimentId', 'experimentId');
        m.createIndex('entryId', 'entryId');
        const p = d.createObjectStore('protocols', { keyPath: 'id' });
        p.createIndex('product', 'product');
        p.createIndex('key', 'key');
      }
      if (oldVersion < 3) d.createObjectStore('drafts', { keyPath: 'id' });
    },
  }));

/** Menambah eksperimen baru; gagal bila ID sudah dipakai (tidak menimpa). */
export async function addExperiment(e: Omit<Experiment, 'createdAt' | 'nextSteps'> & { nextSteps?: NextStep[] }): Promise<void> {
  await (await labDb()).add('experiments', { ...e, nextSteps: e.nextSteps ?? [], createdAt: new Date().toISOString() });
}

/** Melengkapi eksperimen; versi sebelumnya ikut tersimpan di `history`. */
export async function updateExperiment(id: string, patch: Partial<ExperimentEditable>): Promise<Experiment> {
  const d = await labDb();
  const tx = d.transaction('experiments', 'readwrite');
  const cur = await tx.store.get(id);
  if (!cur) throw new Error(`Eksperimen ${id} tidak ditemukan`);
  const next = applyUpdate(cur, patch);
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function listExperiments(): Promise<Experiment[]> {
  return (await (await labDb()).getAllFromIndex('experiments', 'createdAt')).reverse().map((e) => ({ ...e, nextSteps: e.nextSteps ?? [] }));
}

/** Simpan entri harian BARU beserta medianya dalam satu transaksi (gagal bila ID sudah ada). */
export async function addEntry(entry: Omit<DailyEntry, 'createdAt' | 'mediaIds'>, media: Omit<MediaItem, 'id' | 'entryId' | 'experimentId' | 'createdAt'>[]): Promise<DailyEntry> {
  const d = await labDb();
  const now = new Date().toISOString();
  const items: MediaItem[] = media.map((m, i) => ({ ...m, id: `${entry.id}-M${String(i + 1).padStart(2, '0')}`, entryId: entry.id, experimentId: entry.experimentId, createdAt: now }));
  const full: DailyEntry = { ...entry, createdAt: now, mediaIds: items.map((m) => m.id) };
  const tx = d.transaction(['entries', 'media'], 'readwrite');
  await tx.objectStore('entries').add(full);
  for (const m of items) await tx.objectStore('media').add(m);
  await tx.done;
  return full;
}

export async function listEntries(experimentId?: string): Promise<DailyEntry[]> {
  const d = await labDb();
  const all = experimentId ? await d.getAllFromIndex('entries', 'experimentId', experimentId) : await d.getAll('entries');
  return all.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt));
}

export async function listMedia(experimentId?: string): Promise<MediaItem[]> {
  const d = await labDb();
  return experimentId ? d.getAllFromIndex('media', 'experimentId', experimentId) : d.getAll('media');
}

/** Simpan versi protokol baru; gagal bila ID versi sudah ada (versi lama tidak bisa ditimpa). */
/**
 * Simpan versi riset produk baru beserta foto/video BARU per bahan & per langkah (satu transaksi).
 * Media lama (dari versi sebelumnya) tetap dirujuk lewat mediaIds — tidak disalin, tidak diubah.
 */
export async function addProtocolVersion(
  p: Omit<ProtocolVersion, 'createdAt'>,
  media: { ingredients?: NewMedia[][]; steps?: NewMedia[][]; tools?: NewMedia[][]; coconuts?: NewMedia[][]; /** Draf yang diselesaikan (dihapus dalam transaksi yang sama). */ draftId?: string } = {},
): Promise<ProtocolVersion> {
  const now = new Date().toISOString();
  const items: MediaItem[] = [];
  const attach = (prefix: string, list: NewMedia[] | undefined, existing: string[] | undefined) => {
    const ids = [...(existing ?? [])];
    (list ?? []).forEach((m, k) => {
      const id = `${p.id}-${prefix}-M${String(k + 1).padStart(2, '0')}`;
      items.push({ ...m, id, entryId: p.id, experimentId: p.key, createdAt: now });
      ids.push(id);
    });
    return ids.length ? { mediaIds: ids } : {};
  };
  const full: ProtocolVersion = {
    ...p,
    ingredients: p.ingredients.map((x, i) => ({ ...x, ...attach(`I${i + 1}`, media.ingredients?.[i], x.mediaIds) })),
    steps: p.steps.map((x, i) => ({ ...x, ...attach(`S${i + 1}`, media.steps?.[i], x.mediaIds) })),
    tools: toolList(p).map((x, i) => ({ ...x, ...attach(`T${i + 1}`, media.tools?.[i], x.mediaIds) })),
    ...(p.coconuts?.length && { coconuts: p.coconuts.map((x, i) => ({ ...x, ...attach(`K${i + 1}`, media.coconuts?.[i], x.mediaIds) })) }),
    createdAt: now,
  };
  const d = await labDb();
  const tx = d.transaction(['protocols', 'media', 'drafts'], 'readwrite');
  await tx.objectStore('protocols').add(full);
  for (const m of items) await tx.objectStore('media').add(m);
  if (media.draftId) await tx.objectStore('drafts').delete(media.draftId);
  await tx.done;
  if (media.draftId) (await import('./labSync')).addTomb('draf', media.draftId);
  return full;
}

/** Simpan/perbarui draf (boleh ditimpa — draf belum jadi catatan resmi). */
export async function saveDraft(dr: Omit<ProtocolDraft, 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<ProtocolDraft> {
  const now = new Date().toISOString();
  const full: ProtocolDraft = { ...dr, createdAt: dr.createdAt ?? now, updatedAt: now };
  await (await labDb()).put('drafts', full);
  return full;
}

/**
 * Hapus SATU hasil riset produk (DEC-060, atas permintaan owner): semua versi resep + laporan harian +
 * foto/video riset itu, dalam satu transaksi. Ditolak bila ada eksperimen lain yang memakai versinya
 * (catatan eksperimen tidak boleh kehilangan rujukan). Mengembalikan jumlah yang dihapus.
 */
export async function deleteResearch(key: string): Promise<{ versions: number; entries: number; media: number }> {
  const d = await labDb();
  const tx = d.transaction(['protocols', 'entries', 'media'], 'readwrite');
  const versions = (await tx.objectStore('protocols').getAll()).filter((p) => p.key === key);
  if (!versions.length) throw new RangeError(`Riset ${key} tidak ditemukan`);
  const ids = new Set(versions.map((v) => v.id));
  const entries = await tx.objectStore('entries').getAll();
  const usedBy = entries.filter((e) => e.experimentId !== key && ids.has(e.protocolId));
  if (usedBy.length) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error(`Riset ${key} dipakai ${usedBy.length} catatan eksperimen (${[...new Set(usedBy.map((e) => e.experimentId))].join(', ')}) — tidak dihapus.`);
  }
  const own = entries.filter((e) => e.experimentId === key);
  const media = (await tx.objectStore('media').getAll()).filter((m) => m.experimentId === key);
  for (const v of versions) await tx.objectStore('protocols').delete(v.id);
  for (const e of own) await tx.objectStore('entries').delete(e.id);
  for (const m of media) await tx.objectStore('media').delete(m.id);
  await tx.done;
  (await import('./labSync')).addTomb('riset', key);
  return { versions: versions.length, entries: own.length, media: media.length };
}

/** Hapus draf (hanya draf — versi resmi & catatan harian tidak bisa dihapus). */
export async function deleteDraft(id: string): Promise<void> {
  await (await labDb()).delete('drafts', id);
  (await import('./labSync')).addTomb('draf', id);
}

export async function listDrafts(): Promise<ProtocolDraft[]> {
  return (await (await labDb()).getAll('drafts')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Hari ke-N dari tanggal mulai (Hari ke-1 = tanggal mulai); undefined bila tanggal tak valid/sebelum mulai. */
export function dayNumber(start: string | undefined, date: string): number | undefined {
  if (!start || !/^\d{4}-\d{2}-\d{2}/.test(start) || !/^\d{4}-\d{2}-\d{2}/.test(date)) return undefined;
  const d = Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${start.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return d >= 0 ? d + 1 : undefined;
}

/** Tanggal riset: mulai (isian), selesai OTOMATIS = tanggal laporan penutup paling awal, & durasi (hari). */
export function researchDates(start: string | undefined, entries: readonly DailyEntry[]): { start?: string; end?: string; days?: number } {
  const closing = entries.filter((e) => e.finished).map((e) => e.entryDate).sort()[0];
  const out: { start?: string; end?: string; days?: number } = {};
  if (start) out.start = start;
  if (closing) {
    out.end = closing;
    const n = dayNumber(start, closing);
    if (n) out.days = n;
  }
  return out;
}

/** Status riset produk: selesai bila ada laporan harian bertanda `finished`. */
export function researchStatus(entries: readonly DailyEntry[]): 'berjalan' | 'selesai' | 'belum-mulai' {
  if (!entries.length) return 'belum-mulai';
  return entries.some((e) => e.finished) ? 'selesai' : 'berjalan';
}

export async function listProtocols(): Promise<ProtocolVersion[]> {
  return (await (await labDb()).getAll('protocols')).sort((a, b) => a.key.localeCompare(b.key) || a.version - b.version);
}
