'use client';

/**
 * Buku catatan eksperimen GEMA RnD (architecture/07-rnd/asal-chatgpt/arsitektur-GEMA-RnD.md §4) — disimpan di
 * perangkat (IndexedDB `gemas-lab`, offline). Eksperimen tidak pernah ditimpa: tiap catatan punya ID
 * sendiri, `add` menolak ID yang sudah ada, dan setiap perubahan menyimpan salinan versi lama di
 * `history`. Kolom kosong = "belum dicatat", tidak diisi tebakan.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

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

export const NOT_RECORDED = 'belum dicatat';

/** ID berikutnya untuk produk & bulan mulai; urut dari ID yang sudah ada (bukan jumlah) agar tak bentrok. */
export function nextExperimentId(product: LabProductId, startedAt: string, existing: readonly string[]): string | undefined {
  const m = /^\d{2}(\d{2})-(\d{2})-\d{2}$/.exec(startedAt);
  if (!m) return undefined;
  const prefix = `${product}-${m[1]}${m[2]}-`;
  const max = existing.filter((id) => id.startsWith(prefix)).reduce((n, id) => Math.max(n, Number(id.slice(prefix.length)) || 0), 0);
  return max >= 999 ? undefined : `${prefix}${String(max + 1).padStart(3, '0')}`;
}

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

interface Db extends DBSchema {
  experiments: { key: string; value: Experiment; indexes: { createdAt: string } };
}

let dbp: Promise<IDBPDatabase<Db>> | undefined;
const db = () =>
  (dbp ??= openDB<Db>('gemas-lab', 1, {
    upgrade(d) {
      d.createObjectStore('experiments', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    },
  }));

/** Menambah eksperimen baru; gagal bila ID sudah dipakai (tidak menimpa). */
export async function addExperiment(e: Omit<Experiment, 'createdAt' | 'nextSteps'> & { nextSteps?: NextStep[] }): Promise<void> {
  await (await db()).add('experiments', { ...e, nextSteps: e.nextSteps ?? [], createdAt: new Date().toISOString() });
}

/** Melengkapi eksperimen; versi sebelumnya ikut tersimpan di `history`. */
export async function updateExperiment(id: string, patch: Partial<ExperimentEditable>): Promise<Experiment> {
  const d = await db();
  const tx = d.transaction('experiments', 'readwrite');
  const cur = await tx.store.get(id);
  if (!cur) throw new Error(`Eksperimen ${id} tidak ditemukan`);
  const next = applyUpdate(cur, patch);
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function listExperiments(): Promise<Experiment[]> {
  return (await (await db()).getAllFromIndex('experiments', 'createdAt')).reverse().map((e) => ({ ...e, nextSteps: e.nextSteps ?? [] }));
}

/** Cadangan lengkap (JSON) — bisa dipulihkan nanti; berisi versi format agar aman diubah. */
export function labBackupJson(experiments: readonly Experiment[], exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ format: 'gemas-lab', version: 1, exportedAt, experiments }, null, 2);
}
