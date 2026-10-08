'use client';

/**
 * Skenario offline di IndexedDB (ux_spec §4: "simpan ke IndexedDB, sinkron saat online").
 * `id` dibuat di client & dikirim ke server sebagai `clientId` → sinkron idempoten (retry aman).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ScenarioState } from './scenario';

export interface LocalScenario {
  id: string;
  name: string;
  state: ScenarioState;
  datasetVersion: string;
  createdAt: string;
  /** slug di server setelah tersinkron. */
  shareSlug?: string;
  synced: boolean;
}

interface Db extends DBSchema {
  scenarios: { key: string; value: LocalScenario; indexes: { createdAt: string } };
}

let dbp: Promise<IDBPDatabase<Db>> | undefined;
const db = () =>
  (dbp ??= openDB<Db>('gemas', 1, {
    upgrade(d) {
      d.createObjectStore('scenarios', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    },
  }));

export async function saveLocal(x: Omit<LocalScenario, 'id' | 'createdAt' | 'synced'>): Promise<LocalScenario> {
  const rec: LocalScenario = { ...x, id: crypto.randomUUID(), createdAt: new Date().toISOString(), synced: false };
  await (await db()).put('scenarios', rec);
  return rec;
}

export async function listLocal(): Promise<LocalScenario[]> {
  const all = await (await db()).getAllFromIndex('scenarios', 'createdAt');
  return all.reverse();
}

export async function deleteLocal(id: string): Promise<void> {
  await (await db()).delete('scenarios', id);
}

export async function markSynced(id: string, shareSlug: string): Promise<void> {
  const d = await db();
  const rec = await d.get('scenarios', id);
  if (rec) await d.put('scenarios', { ...rec, synced: true, shareSlug });
}

/** Kirim skenario yang belum tersinkron. Mengembalikan jumlah yang berhasil; 401 → berhenti (belum login). */
export async function syncPending(): Promise<{ synced: number; needLogin: boolean }> {
  let synced = 0;
  for (const s of await listLocal()) {
    if (s.synced) continue;
    const res = await fetch('/api/v1/scenarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: s.id, name: s.name, state: s.state }),
    });
    if (res.status === 401) return { synced, needLogin: true };
    if (!res.ok) continue;
    const body = (await res.json()) as { shareSlug: string };
    await markSynced(s.id, body.shareSlug);
    synced++;
  }
  return { synced, needLogin: false };
}
