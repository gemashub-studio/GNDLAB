/**
 * Catatan bahan baku (DEC-071): setiap Konfirmasi di menu Bahan Baku disimpan sebagai catatan (IndexedDB
 * gemas-bahan) agar menu & statistik lab memakai data nyata. Catatan tidak diubah setelah disimpan.
 */
import { openDB, type DBSchema } from 'idb';
import { deviceTag } from './device';
import type { RawMaterial } from './labStore';

export interface RawRecord extends RawMaterial {
  /** BB-YYMMDD-NN (+ kode perangkat bila sinkron aktif). */
  id: string;
  createdAt: string;
}

interface BahanDb extends DBSchema {
  items: { key: string; value: RawRecord };
}

let dbp: ReturnType<typeof openDB<BahanDb>> | undefined;
export const bahanDb = () =>
  (dbp ??= openDB<BahanDb>('gemas-bahan', 1, {
    upgrade(d) {
      d.createObjectStore('items', { keyPath: 'id' });
    },
  }));

export async function listRaw(): Promise<RawRecord[]> {
  return (await (await bahanDb()).getAll('items')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** ID berikutnya: BB-YYMMDD-NN per hari. */
export function nextRawId(existing: readonly string[], now = new Date(), tag = deviceTag()): string {
  const p = `BB-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const n = existing.filter((x) => x.startsWith(p)).map((x) => parseInt(x.slice(p.length), 10) || 0);
  return `${p}${String(Math.max(0, ...n) + 1).padStart(2, '0')}${tag}`;
}

export async function addRaw(r: RawMaterial): Promise<RawRecord> {
  const d = await bahanDb();
  const id = nextRawId((await d.getAllKeys('items')).map(String));
  const rec: RawRecord = { ...r, id, createdAt: new Date().toISOString() };
  await d.add('items', rec);
  return rec;
}
