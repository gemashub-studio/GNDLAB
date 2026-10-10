'use client';

/**
 * Register lot bahan baku (Fase G): asal kebun, ketinggian, kelas DR/DT, jumlah — disimpan di
 * perangkat (IndexedDB `gemas-lot`, offline) sampai modul lot di server tersedia.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface RawLot {
  /** Kode lot, mis. DT-261010-001 (pola dari dataset rantai). */
  code: string;
  origin: 'DR' | 'DT';
  date: string;
  region: string;
  supplier: string;
  altitudeM: number;
  nuts: number;
  note: string;
  updatedAt?: string;
}

interface Db extends DBSchema {
  lots: { key: string; value: RawLot; indexes: { updatedAt: string } };
}

let dbp: Promise<IDBPDatabase<Db>> | undefined;
const db = () =>
  (dbp ??= openDB<Db>('gemas-lot', 1, {
    upgrade(d) {
      d.createObjectStore('lots', { keyPath: 'code' }).createIndex('updatedAt', 'updatedAt');
    },
  }));

export async function saveLot(lot: RawLot): Promise<void> {
  await (await db()).put('lots', { ...lot, updatedAt: new Date().toISOString() });
}

export async function listLots(): Promise<RawLot[]> {
  return (await (await db()).getAllFromIndex('lots', 'updatedAt')).reverse();
}

export async function deleteLot(code: string): Promise<void> {
  await (await db()).delete('lots', code);
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV register lot untuk tracking (dibuka di Excel/Sheets). */
export function lotsCsv(lots: readonly RawLot[]): string {
  const head = ['kode_lot', 'kelas_asal', 'tanggal', 'daerah', 'pemasok', 'ketinggian_mdpl', 'butir', 'catatan'];
  const rows = lots.map((l) => [l.code, l.origin, l.date, l.region, l.supplier, l.altitudeM, l.nuts, l.note].map(esc).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}
