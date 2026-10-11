'use client';

/**
 * Buku catatan eksperimen GEMA RnD (architecture/07-rnd/asal-chatgpt/arsitektur-GEMA-RnD.md §4, §11–12) —
 * disimpan di perangkat (IndexedDB `gemas-lab`, offline; laptop & HP = penyimpanan terpisah).
 * - Eksperimen tidak pernah ditimpa: `add` menolak ID yang sudah ada; perubahan menyimpan versi lama di `history`.
 * - Catatan harian APPEND-ONLY: tidak ada fungsi ubah/hapus; koreksi = entri baru yang merujuk entri lama.
 * - Protokol (resep & proses buatan pengguna) berversi: perubahan = versi baru; versi lama tak disentuh.
 * - Kolom kosong = "belum dicatat", tidak diisi tebakan.
 */
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

/** Daftar alat ternormalisasi (versi awal fitur menyimpan teks saja). */
export const toolList = (v: Pick<ProtocolVersion, 'tools'>): ProtocolTool[] => (v.tools ?? []).map((t) => (typeof t === 'string' ? { name: t } : t));

/** Berkas yang akan dilampirkan saat menyimpan versi riset produk. */
export type NewMedia = Omit<MediaItem, 'id' | 'entryId' | 'experimentId' | 'createdAt'>;

/** Versi protokol buatan pengguna — tidak pernah diubah setelah disimpan. */
export interface ProtocolVersion {
  /** Mis. KE-P01-v2. */
  id: string;
  /** Mis. KE-P01 — sama untuk semua versi satu resep. */
  key: string;
  version: number;
  product: LabProductId;
  name: string;
  ingredients: ProtocolIngredient[];
  steps: ProtocolStep[];
  /** Alat yang digunakan (teks lama = string). */
  tools?: (ProtocolTool | string)[];
  reason: string;
  author: string;
  createdAt: string;
}

export const NOT_RECORDED = 'belum dicatat';

/** ID berikutnya untuk produk & bulan mulai; urut dari ID yang sudah ada (bukan jumlah) agar tak bentrok. */
export function nextExperimentId(product: LabProductId, startedAt: string, existing: readonly string[]): string | undefined {
  const m = /^\d{2}(\d{2})-(\d{2})-\d{2}$/.exec(startedAt);
  if (!m) return undefined;
  const prefix = `${product}-${m[1]}${m[2]}-`;
  const max = existing.filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, Number(id.slice(prefix.length)) || 0), 0);
  return max >= 999 ? undefined : `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** ID entri harian berikutnya: `${eksperimen}-H01`, `-H02`, … */
export function nextEntryId(experimentId: string, existing: readonly string[]): string {
  const prefix = `${experimentId}-H`;
  const max = existing.filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, Number(id.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

/** Kunci resep baru per produk: KE-P01, KE-P02, … */
export function nextProtocolKey(product: LabProductId, existing: readonly ProtocolVersion[]): string {
  const prefix = `${product}-P`;
  const max = existing.filter((p) => p.key.startsWith(prefix)).reduce((n, p) => Math.max(n, Number(p.key.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

/** Versi berikutnya dari resep yang sama. */
export function nextProtocolVersion(key: string, existing: readonly ProtocolVersion[]): { id: string; version: number } {
  const version = existing.filter((p) => p.key === key).reduce((n, p) => Math.max(n, p.version), 0) + 1;
  return { id: `${key}-v${version}`, version };
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
}

let dbp: Promise<IDBPDatabase<LabDb>> | undefined;
export const labDb = () =>
  (dbp ??= openDB<LabDb>('gemas-lab', 2, {
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
  media: { ingredients?: NewMedia[][]; steps?: NewMedia[][]; tools?: NewMedia[][] } = {},
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
    createdAt: now,
  };
  const d = await labDb();
  const tx = d.transaction(['protocols', 'media'], 'readwrite');
  await tx.objectStore('protocols').add(full);
  for (const m of items) await tx.objectStore('media').add(m);
  await tx.done;
  return full;
}

/** Status riset produk: selesai bila ada laporan harian bertanda `finished`. */
export function researchStatus(entries: readonly DailyEntry[]): 'berjalan' | 'selesai' | 'belum-mulai' {
  if (!entries.length) return 'belum-mulai';
  return entries.some((e) => e.finished) ? 'selesai' : 'berjalan';
}

export async function listProtocols(): Promise<ProtocolVersion[]> {
  return (await (await labDb()).getAll('protocols')).sort((a, b) => a.key.localeCompare(b.key) || a.version - b.version);
}
