'use client';

/**
 * Buku catatan eksperimen GEMA RnD (architecture/07-rnd/arsitektur-GEMA-RnD.md §4) — disimpan di
 * perangkat (IndexedDB `gemas-lab`, offline). Eksperimen tidak pernah ditimpa: tiap catatan punya ID
 * sendiri dan `add` menolak ID yang sudah ada. Kolom kosong = "belum dicatat", tidak diisi tebakan.
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

export interface Experiment {
  /** Mis. KE-2610-001 (produk-TahunBulan-urut, pola PRD_RnD RD-01). */
  id: string;
  product: LabProductId;
  title: string;
  startedAt: string;
  question: string;
  objective: string;
  methodVersion: string;
  processConditions: string;
  resultSummary: string;
  conclusion: string;
  status: LabStatus;
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
export async function addExperiment(e: Omit<Experiment, 'createdAt'>): Promise<void> {
  await (await db()).add('experiments', { ...e, createdAt: new Date().toISOString() });
}

export async function listExperiments(): Promise<Experiment[]> {
  return (await (await db()).getAllFromIndex('experiments', 'createdAt')).reverse();
}

/** Cadangan lengkap (JSON) — bisa dipulihkan nanti; berisi versi format agar aman diubah. */
export function labBackupJson(experiments: readonly Experiment[], exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ format: 'gemas-lab', version: 1, exportedAt, experiments }, null, 2);
}
