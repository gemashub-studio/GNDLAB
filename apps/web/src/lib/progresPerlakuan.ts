/**
 * Upload Progres Perlakuan (DEC-095): foto + nama perlakuan + kategori (harian/mingguan/bulanan) + jumlah produksi/item
 * + waktu otomatis. Tersimpan di perangkat (IndexedDB) dan ikut sinkron Supabase (rnd_data menu "progres_perlakuan").
 */
import { openDB, type DBSchema } from 'idb';
import { deviceTag } from './device';
import { TREATMENT_GROUPS, TREATMENT_INFO } from './pencatatan';

export type ProgresCategory = 'harian' | 'mingguan' | 'bulanan';
export const PROGRES_CATEGORIES: readonly { key: ProgresCategory; label: string }[] = [
  { key: 'harian', label: 'Harian' },
  { key: 'mingguan', label: 'Mingguan' },
  { key: 'bulanan', label: 'Bulanan' },
];

export interface ProgresItem {
  /** PP-YYMMDD-NN (+ kode perangkat bila sinkron aktif). */
  id: string;
  /** Nama perlakuan (metode), mis. "Oven Gas", "CUKA 2 - GULA 75g". */
  treatment: string;
  /** Kelompok perlakuan, mis. "Perlakuan kopra". */
  group: string;
  category: ProgresCategory;
  /** Jumlah produksi / item (angka). */
  qty: string;
  /** Waktu (ISO) — otomatis saat form dibuka, bisa diubah. */
  at: string;
  /** JPEG data URL. */
  photo: string;
  createdAt: string;
}

/** Pilihan "Nama Perlakuan": semua metode di form data akhir + keterangan singkatnya. */
export const TREATMENT_OPTIONS = TREATMENT_GROUPS.flatMap((g) =>
  g.methods.map((m) => ({
    value: m,
    label: m === 'GreenHouse' ? 'Green House' : m,
    group: g.title.replace('Jumlah perlakuan ', 'Perlakuan '),
    note: TREATMENT_INFO[g.key].methods[m] ?? '',
  })),
);

interface ProgresDb extends DBSchema {
  items: { key: string; value: ProgresItem };
}
let dbp: ReturnType<typeof openDB<ProgresDb>> | undefined;
export function progresDb() {
  dbp ??= openDB<ProgresDb>('gemas-progres', 1, {
    upgrade(db) {
      db.createObjectStore('items', { keyPath: 'id' });
    },
  });
  return dbp;
}

export async function listProgres(): Promise<ProgresItem[]> {
  return (await (await progresDb()).getAll('items')).sort((a, b) => b.at.localeCompare(a.at));
}

export function nextProgresId(existing: readonly string[], now = new Date(), tag = deviceTag()): string {
  const p = `PP-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const n = existing.filter((x) => x.startsWith(p)).map((x) => parseInt(x.slice(p.length), 10) || 0);
  return `${p}${String(Math.max(0, ...n) + 1).padStart(2, '0')}${tag}`;
}

export function progresError(v: { photo?: string; treatment: string; category: string; qty: string; at: string }): string | undefined {
  if (!v.photo) return 'Pilih foto dulu.';
  if (!v.treatment) return 'Pilih nama perlakuan.';
  if (!PROGRES_CATEGORIES.some((c) => c.key === v.category)) return 'Pilih kategori.';
  if (!/^\d+$/.test(v.qty.trim())) return 'Jumlah produksi/item hanya angka.';
  if (!v.at || Number.isNaN(Date.parse(v.at))) return 'Tanggal & jam tidak valid.';
  return undefined;
}

export async function addProgres(v: { photo: string; treatment: string; category: ProgresCategory; qty: string; at: string }): Promise<ProgresItem> {
  const bad = progresError(v);
  if (bad) throw new Error(bad);
  const d = await progresDb();
  const opt = TREATMENT_OPTIONS.find((o) => o.value === v.treatment);
  const item: ProgresItem = {
    id: nextProgresId((await d.getAllKeys('items')).map(String)),
    treatment: v.treatment,
    group: opt?.group ?? '',
    category: v.category,
    qty: v.qty.trim(),
    at: new Date(v.at).toISOString(),
    photo: v.photo,
    createdAt: new Date().toISOString(),
  };
  await d.add('items', item);
  return item;
}

/** Kelompokkan per kategori (untuk 3 tabel di halaman progres). */
export function groupByCategory(items: readonly ProgresItem[]): Record<ProgresCategory, ProgresItem[]> {
  const out: Record<ProgresCategory, ProgresItem[]> = { harian: [], mingguan: [], bulanan: [] };
  for (const it of [...items].sort((a, b) => b.at.localeCompare(a.at))) out[it.category]?.push(it);
  return out;
}

/** "YYYY-MM-DDTHH:mm" waktu lokal (untuk input datetime-local). */
export const localDateTime = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const fmtWaktu = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
