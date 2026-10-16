/**
 * Sinkron laptop ↔ HP lewat satu file di Google Drive pemilik (DEC-065). Inti penggabungan, MURNI (diuji unit):
 * - catatan append-only (eksperimen, catatan harian, versi riset, media): yang belum ada ditambah, yang ada tidak ditimpa;
 * - yang boleh diubah (draf, laporan belanja): versi dengan `updatedAt` lebih baru menang;
 * - penghapusan (draf, laporan belanja, hasil riset) dicatat sebagai "nisan" agar tidak muncul lagi dari perangkat lain.
 */
import type { RawRecord } from './bahanBaku';
import type { LpjReport } from './belanja';
import type { CatatRecord } from './pencatatan';
import type { DraftJson, LabBackup, RestorePlan } from './labBackup';

export type TombKind = 'draf' | 'belanja' | 'riset' | 'catat';
export interface Tomb {
  kind: TombKind;
  id: string;
  at: string;
}

const TOMB_KEY = 'gemas-lab-deleted';

export function readTombs(): Tomb[] {
  try {
    const v = JSON.parse(localStorage.getItem(TOMB_KEY) ?? '[]') as Tomb[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function writeTombs(t: readonly Tomb[]): void {
  try {
    localStorage.setItem(TOMB_KEY, JSON.stringify(t));
  } catch {
    /* penyimpanan browser tak tersedia — sinkron tetap jalan, penghapusan bisa muncul lagi */
  }
}

/** Catat penghapusan (dipanggil saat draf/laporan belanja/hasil riset dihapus atau draf diselesaikan). */
export function addTomb(kind: TombKind, id: string): void {
  writeTombs(mergeTombs(readTombs(), [{ kind, id, at: new Date().toISOString() }]));
}

export function mergeTombs(a: readonly Tomb[], b: readonly Tomb[]): Tomb[] {
  const m = new Map<string, Tomb>();
  for (const t of [...a, ...b]) if (!m.has(`${t.kind}|${t.id}`)) m.set(`${t.kind}|${t.id}`, t);
  return [...m.values()];
}

export interface LocalState {
  /** id → createdAt (untuk mendeteksi ID kembar dengan isi berbeda) */
  experiments: Map<string, string>;
  entries: Map<string, string>;
  protocols: Map<string, string>;
  media: Set<string>;
  /** id → updatedAt */
  drafts: Map<string, string>;
  belanja: Map<string, string>;
  /** kunci riset yang ada di perangkat ini */
  researchKeys: Set<string>;
  /** pencatatan data: id → versi (updatedAt/akhir/createdAt) — DEC-085 */
  catat?: Map<string, string>;
  /** catatan bahan baku lama (append-only) */
  bahan?: Set<string>;
}

/** Versi pencatatan data untuk membandingkan perangkat (catatan lama belum punya updatedAt). */
export const catatRev = (r: CatatRecord) => r.updatedAt ?? r.finishedAt ?? r.akhirSavedAt ?? r.createdAt;

export interface SyncPlan {
  add: RestorePlan['add'];
  replaceDrafts: DraftJson[];
  replaceBelanja: LpjReport[];
  replaceCatat: CatatRecord[];
  /** ID sama tapi isi beda (dibuat terpisah di 2 perangkat sebelum sinkron) — TIDAK digabung, dilaporkan. */
  conflicts: string[];
  /** Nisan dari perangkat lain yang barangnya masih ada di sini → hapus di sini. */
  deleteLocal: Tomb[];
  tombs: Tomb[];
}

export function planSync(remote: LabBackup, local: LocalState, localTombs: readonly Tomb[]): SyncPlan {
  const tombs = mergeTombs(localTombs, remote.deleted ?? []);
  const dead = (kind: TombKind, id: string) => tombs.some((t) => t.kind === kind && t.id === id);
  const deadKey = (key: string) => dead('riset', key);
  const add: RestorePlan['add'] = {
    experiments: remote.experiments.filter((x) => !local.experiments.has(x.id)),
    entries: (remote.entries ?? []).filter((x) => !local.entries.has(x.id) && !deadKey(x.experimentId)),
    protocols: (remote.protocols ?? []).filter((x) => !local.protocols.has(x.id) && !deadKey(x.key)),
    media: (remote.media ?? []).filter((x) => !local.media.has(x.id) && !deadKey(x.experimentId)),
    drafts: (remote.drafts ?? []).filter((x) => !local.drafts.has(x.id) && !dead('draf', x.id)),
    belanja: (remote.belanja ?? []).filter((x) => !local.belanja.has(x.id) && !dead('belanja', x.id)),
    catat: (remote.catat ?? []).filter((x) => !local.catat?.has(x.id) && !dead('catat', x.id)),
    bahan: (remote.bahan ?? []).filter((x: RawRecord) => !local.bahan?.has(x.id)),
  };
  const clash = <T extends { id: string; createdAt: string }>(list: T[] | undefined, m: Map<string, string>) => (list ?? []).filter((x) => m.has(x.id) && m.get(x.id) !== x.createdAt).map((x) => x.id);
  const conflicts = [...clash(remote.experiments, local.experiments), ...clash(remote.protocols, local.protocols), ...clash(remote.entries, local.entries)];
  const newer = (id: string, at: string, m: Map<string, string>) => m.has(id) && at > (m.get(id) ?? '');
  const remoteTombs = remote.deleted ?? [];
  const deleteLocal = remoteTombs.filter(
    (t) => !localTombs.some((l) => l.kind === t.kind && l.id === t.id) && (t.kind === 'draf' ? local.drafts.has(t.id) : t.kind === 'belanja' ? local.belanja.has(t.id) : t.kind === 'catat' ? !!local.catat?.has(t.id) : local.researchKeys.has(t.id)),
  );
  return {
    add,
    replaceDrafts: (remote.drafts ?? []).filter((x) => !dead('draf', x.id) && newer(x.id, x.updatedAt, local.drafts)),
    replaceBelanja: (remote.belanja ?? []).filter((x) => !dead('belanja', x.id) && newer(x.id, x.updatedAt, local.belanja)),
    replaceCatat: (remote.catat ?? []).filter((x) => !dead('catat', x.id) && !!local.catat && newer(x.id, catatRev(x), local.catat)),
    conflicts,
    deleteLocal,
    tombs,
  };
}

export const syncCount = (p: SyncPlan) =>
  p.add.experiments.length + p.add.entries.length + p.add.protocols.length + p.add.media.length + p.add.drafts.length + p.add.belanja.length + p.replaceDrafts.length + p.replaceBelanja.length + p.replaceCatat.length + (p.add.catat?.length ?? 0) + (p.add.bahan?.length ?? 0) + p.deleteLocal.length;
