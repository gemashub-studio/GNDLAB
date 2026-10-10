'use client';

/**
 * Isian ceklis di IndexedDB (offline). Database terpisah dari skenario (`gemas`) supaya tidak
 * perlu menaikkan versi DB skenario yang sudah terpasang di HP pengguna.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ChecklistFill } from './checklist';

interface Db extends DBSchema {
  fills: { key: string; value: ChecklistFill; indexes: { updatedAt: string; checklistId: string } };
}

let dbp: Promise<IDBPDatabase<Db>> | undefined;
const db = () =>
  (dbp ??= openDB<Db>('gemas-ceklis', 1, {
    upgrade(d) {
      const s = d.createObjectStore('fills', { keyPath: 'id' });
      s.createIndex('updatedAt', 'updatedAt');
      s.createIndex('checklistId', 'checklistId');
    },
  }));

export async function saveFill(fill: ChecklistFill): Promise<void> {
  await (await db()).put('fills', { ...fill, updatedAt: new Date().toISOString() });
}

export async function listFills(): Promise<ChecklistFill[]> {
  return (await (await db()).getAllFromIndex('fills', 'updatedAt')).reverse();
}

export async function deleteFill(id: string): Promise<void> {
  await (await db()).delete('fills', id);
}
