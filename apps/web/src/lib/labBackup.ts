'use client';

/**
 * Cadangan & pemulihan GEMA RnD — satu file JSON berisi eksperimen, catatan harian, protokol, laporan
 * belanja, dan media (foto/video asli sebagai base64). Pemulihan HANYA MENAMBAH: catatan dengan ID yang sudah ada
 * dilewati & dilaporkan, tidak pernah ditimpa. Tiap perangkat (laptop/HP) punya penyimpanan sendiri;
 * file ini adalah cara memindahkan data secara manual sampai sinkronisasi diputuskan.
 */
import { belanjaDb, type LpjReport } from './belanja';
import { bahanDb, type RawRecord } from './bahanBaku';
import { catatDb, type CatatRecord } from './pencatatan';
import { readTombs, writeTombs, type SyncPlan, type Tomb, catatRev } from './labSync';
import { labDb, type DailyEntry, type Experiment, type MediaItem, type NewMedia, type ProtocolDraft, type ProtocolVersion } from './labStore';

export type MediaJson = Omit<MediaItem, 'blob'> & { data: string };
type NewMediaJson = Omit<NewMedia, 'blob'> & { data: string };
export type DraftJson = Omit<ProtocolDraft, 'pending'> & { pending: { ingredients: NewMediaJson[][]; tools: NewMediaJson[][]; steps: NewMediaJson[][]; coconuts?: NewMediaJson[][] } };

export interface LabBackup {
  format: 'gemas-lab';
  version: 1 | 2;
  exportedAt: string;
  experiments: Experiment[];
  entries?: DailyEntry[];
  protocols?: ProtocolVersion[];
  media?: MediaJson[];
  drafts?: DraftJson[];
  /** Laporan belanja (DEC-061) — foto nota/barang sudah berupa data URL di dalamnya. */
  belanja?: LpjReport[];
  /** Catatan bahan baku (DEC-071). */
  bahan?: RawRecord[];
  /** Pencatatan data awal/akhir (DEC-074). */
  catat?: CatatRecord[];
  /** Nisan penghapusan untuk sinkron (DEC-065). */
  deleted?: Tomb[];
}

/** Bentuk cadangan tanpa media (dipakai juga oleh uji unit). */
export function labBackupJson(experiments: readonly Experiment[], exportedAt = new Date().toISOString(), rest: Partial<Pick<LabBackup, 'entries' | 'protocols' | 'media' | 'drafts' | 'belanja' | 'bahan' | 'catat' | 'deleted'>> = {}): string {
  return JSON.stringify({ format: 'gemas-lab', version: 2, exportedAt, experiments, entries: rest.entries ?? [], protocols: rest.protocols ?? [], media: rest.media ?? [], ...(rest.drafts?.length && { drafts: rest.drafts }), ...(rest.belanja?.length && { belanja: rest.belanja }), ...(rest.bahan?.length && { bahan: rest.bahan }), ...(rest.catat?.length && { catat: rest.catat }), ...(rest.deleted?.length && { deleted: rest.deleted }) }, null, 2);
}

export function parseBackup(text: string): LabBackup {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('File bukan JSON yang valid.');
  }
  const b = j as Partial<LabBackup>;
  if (b?.format !== 'gemas-lab' || (b.version !== 1 && b.version !== 2) || !Array.isArray(b.experiments)) {
    throw new Error('Ini bukan file cadangan GEMA RnD (format gemas-lab).');
  }
  return { entries: [], protocols: [], media: [], ...b } as LabBackup;
}

export interface RestorePlan {
  add: { experiments: Experiment[]; entries: DailyEntry[]; protocols: ProtocolVersion[]; media: MediaJson[]; drafts: DraftJson[]; belanja: LpjReport[]; bahan?: RawRecord[]; catat?: CatatRecord[] };
  skipped: { kind: string; id: string }[];
}

/** Rencana pemulihan: yang ID-nya belum ada ditambah; yang sudah ada dilewati (tidak menimpa). */
export function planRestore(b: LabBackup, existing: { experiments: Set<string>; entries: Set<string>; protocols: Set<string>; media: Set<string>; drafts?: Set<string>; belanja?: Set<string>; bahan?: Set<string>; catat?: Set<string> }): RestorePlan {
  const skipped: RestorePlan['skipped'] = [];
  const pick = <T extends { id: string }>(kind: string, list: T[] | undefined, have: Set<string>) =>
    (list ?? []).filter((x) => {
      if (have.has(x.id)) {
        skipped.push({ kind, id: x.id });
        return false;
      }
      return true;
    });
  return {
    add: {
      experiments: pick('eksperimen', b.experiments, existing.experiments),
      entries: pick('catatan harian', b.entries, existing.entries),
      protocols: pick('protokol', b.protocols, existing.protocols),
      media: pick('media', b.media, existing.media),
      drafts: pick('draf', b.drafts, existing.drafts ?? new Set()),
      belanja: pick('laporan belanja', b.belanja, existing.belanja ?? new Set()),
      bahan: pick('bahan baku', b.bahan, existing.bahan ?? new Set()),
      catat: pick('pencatatan data', b.catat, existing.catat ?? new Set()),
    },
    skipped,
  };
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

const base64ToBlob = (data: string, type: string) => {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};

/** Satu media → bentuk JSON (base64) — dipakai sinkron Supabase per dokumen (DEC-085). */
export async function mediaToJson({ blob, ...m }: MediaItem): Promise<MediaJson> {
  return { ...m, data: await blobToBase64(blob) };
}

/** Satu draf → bentuk JSON (foto/video tertunda sebagai base64). */
export async function draftToJson(dr: ProtocolDraft): Promise<DraftJson> {
  const conv = async (rows: NewMedia[][]) => {
    const out: NewMediaJson[][] = [];
    for (const row of rows) {
      const r: NewMediaJson[] = [];
      for (const { blob, ...m } of row) r.push({ ...m, data: await blobToBase64(blob) });
      out.push(r);
    }
    return out;
  };
  return { ...dr, pending: { ingredients: await conv(dr.pending.ingredients), tools: await conv(dr.pending.tools), steps: await conv(dr.pending.steps), ...(dr.pending.coconuts && { coconuts: await conv(dr.pending.coconuts) }) } };
}

/** Kumpulkan seluruh isi lab (termasuk media asli) menjadi teks JSON cadangan. */
export async function exportLabBackup(): Promise<{ json: string; counts: Record<string, number> }> {
  const d = await labDb();
  const [experiments, entries, protocols, media, drafts] = await Promise.all([d.getAll('experiments'), d.getAll('entries'), d.getAll('protocols'), d.getAll('media'), d.getAll('drafts')]);
  const mediaJson: MediaJson[] = [];
  for (const { blob, ...m } of media) mediaJson.push({ ...m, data: await blobToBase64(blob) });
  const conv = async (rows: NewMedia[][]) => {
    const out: NewMediaJson[][] = [];
    for (const row of rows) {
      const r: NewMediaJson[] = [];
      for (const { blob, ...m } of row) r.push({ ...m, data: await blobToBase64(blob) });
      out.push(r);
    }
    return out;
  };
  const draftJson: DraftJson[] = [];
  const belanja = await (await belanjaDb()).getAll('reports');
  const bahan = await (await bahanDb()).getAll('items');
  const catat = await (await catatDb()).getAll('records');
  for (const dr of drafts) draftJson.push({ ...dr, pending: { ingredients: await conv(dr.pending.ingredients), tools: await conv(dr.pending.tools), steps: await conv(dr.pending.steps), ...(dr.pending.coconuts && { coconuts: await conv(dr.pending.coconuts) }) } });
  return {
    json: labBackupJson(experiments, new Date().toISOString(), { entries, protocols, media: mediaJson, drafts: draftJson, belanja, bahan, catat, deleted: readTombs() }),
    counts: { eksperimen: experiments.length, 'catatan harian': entries.length, 'riset produk': protocols.length, draf: drafts.length, media: media.length, 'laporan belanja': belanja.length, 'bahan baku': bahan.length, 'pencatatan data': catat.length },
  };
}

export async function previewRestore(text: string): Promise<RestorePlan> {
  const b = parseBackup(text);
  const d = await labDb();
  const keys = async (s: 'experiments' | 'entries' | 'protocols' | 'media') => new Set((await d.getAllKeys(s)).map(String));
  return planRestore(b, { experiments: await keys('experiments'), entries: await keys('entries'), protocols: await keys('protocols'), media: await keys('media'), drafts: new Set((await d.getAllKeys('drafts')).map(String)), belanja: new Set((await (await belanjaDb()).getAllKeys('reports')).map(String)), bahan: new Set((await (await bahanDb()).getAllKeys('items')).map(String)), catat: new Set((await (await catatDb()).getAllKeys('records')).map(String)) });
}

/** Terapkan rencana: hanya `add` (gagal bila ada bentrok ID baru — tidak menimpa). */
export async function applyRestore(plan: RestorePlan): Promise<void> {
  const d = await labDb();
  const tx = d.transaction(['experiments', 'entries', 'protocols', 'media', 'drafts'], 'readwrite');
  for (const e of plan.add.experiments) await tx.objectStore('experiments').add({ ...e, nextSteps: e.nextSteps ?? [] });
  for (const e of plan.add.entries) await tx.objectStore('entries').add(e);
  for (const p of plan.add.protocols) await tx.objectStore('protocols').add(p);
  for (const { data, ...m } of plan.add.media) await tx.objectStore('media').add({ ...m, blob: base64ToBlob(data, m.type) });
  const back = (rows: NewMediaJson[][]) => rows.map((row) => row.map(({ data, ...m }) => ({ ...m, blob: base64ToBlob(data, m.type) })));
  for (const dr of plan.add.drafts) await tx.objectStore('drafts').add({ ...dr, pending: { ingredients: back(dr.pending.ingredients), tools: back(dr.pending.tools), steps: back(dr.pending.steps), ...(dr.pending.coconuts && { coconuts: back(dr.pending.coconuts) }) } });
  await tx.done;
  if (plan.add.catat?.length) {
    const ct = (await catatDb()).transaction('records', 'readwrite');
    for (const r of plan.add.catat) await ct.store.add(r);
    await ct.done;
  }
  if (plan.add.bahan?.length) {
    const bt = (await bahanDb()).transaction('items', 'readwrite');
    for (const r of plan.add.bahan) await bt.store.add(r);
    await bt.done;
  }
  if (plan.add.belanja.length) {
    const bt = (await belanjaDb()).transaction('reports', 'readwrite');
    for (const r of plan.add.belanja) await bt.store.add(r);
    await bt.done;
  }
}

/** Keadaan lokal untuk rencana sinkron. */
export async function localSyncState() {
  const d = await labDb();
  const created = async (st: 'experiments' | 'entries' | 'protocols') => new Map((await d.getAll(st)).map((x) => [x.id, x.createdAt] as const));
  const drafts = new Map((await d.getAll('drafts')).map((x) => [x.id, x.updatedAt] as const));
  const belanja = new Map((await (await belanjaDb()).getAll('reports')).map((x) => [x.id, x.updatedAt] as const));
  const researchKeys = new Set((await d.getAll('protocols')).map((p) => p.key));
  const catat = new Map((await (await catatDb()).getAll('records')).map((x) => [x.id, catatRev(x)] as const));
  const bahan = new Set((await (await bahanDb()).getAllKeys('items')).map(String));
  return { experiments: await created('experiments'), entries: await created('entries'), protocols: await created('protocols'), media: new Set((await d.getAllKeys('media')).map(String)), drafts, belanja, researchKeys, catat, bahan };
}

/** Terapkan rencana sinkron: tambah, ganti draf/laporan belanja yang lebih baru, hapus yang dihapus di perangkat lain. */
export async function applySync(plan: SyncPlan): Promise<void> {
  await applyRestore({ add: plan.add, skipped: [] });
  const { deleteDraft, deleteResearch } = await import('./labStore');
  const { deleteLpj } = await import('./belanja');
  const d = await labDb();
  const back = (rows: NewMediaJson[][]) => rows.map((row) => row.map(({ data, ...m }) => ({ ...m, blob: base64ToBlob(data, m.type) })));
  for (const dr of plan.replaceDrafts) await d.put('drafts', { ...dr, pending: { ingredients: back(dr.pending.ingredients), tools: back(dr.pending.tools), steps: back(dr.pending.steps), ...(dr.pending.coconuts && { coconuts: back(dr.pending.coconuts) }) } });
  if (plan.replaceBelanja.length) {
    const b = await belanjaDb();
    for (const r of plan.replaceBelanja) await b.put('reports', r);
  }
  if (plan.replaceCatat.length) {
    const c = await catatDb();
    for (const r of plan.replaceCatat) await c.put('records', r);
  }
  for (const t of plan.deleteLocal) {
    try {
      if (t.kind === 'draf') await deleteDraft(t.id);
      else if (t.kind === 'belanja') await deleteLpj(t.id);
      else if (t.kind === 'catat') await (await catatDb()).delete('records', t.id);
      else await deleteResearch(t.id);
    } catch {
      /* mis. riset masih dipakai eksperimen — dibiarkan */
    }
  }
  writeTombs(plan.tombs);
}
