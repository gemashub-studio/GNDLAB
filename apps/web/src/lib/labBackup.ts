'use client';

/**
 * Cadangan & pemulihan GEMA RnD — satu file JSON berisi eksperimen, catatan harian, protokol, dan
 * media (foto/video asli sebagai base64). Pemulihan HANYA MENAMBAH: catatan dengan ID yang sudah ada
 * dilewati & dilaporkan, tidak pernah ditimpa. Tiap perangkat (laptop/HP) punya penyimpanan sendiri;
 * file ini adalah cara memindahkan data secara manual sampai sinkronisasi diputuskan.
 */
import { labDb, type DailyEntry, type Experiment, type MediaItem, type NewMedia, type ProtocolDraft, type ProtocolVersion } from './labStore';

export type MediaJson = Omit<MediaItem, 'blob'> & { data: string };
type NewMediaJson = Omit<NewMedia, 'blob'> & { data: string };
export type DraftJson = Omit<ProtocolDraft, 'pending'> & { pending: { ingredients: NewMediaJson[][]; tools: NewMediaJson[][]; steps: NewMediaJson[][] } };

export interface LabBackup {
  format: 'gemas-lab';
  version: 1 | 2;
  exportedAt: string;
  experiments: Experiment[];
  entries?: DailyEntry[];
  protocols?: ProtocolVersion[];
  media?: MediaJson[];
  drafts?: DraftJson[];
}

/** Bentuk cadangan tanpa media (dipakai juga oleh uji unit). */
export function labBackupJson(experiments: readonly Experiment[], exportedAt = new Date().toISOString(), rest: Partial<Pick<LabBackup, 'entries' | 'protocols' | 'media' | 'drafts'>> = {}): string {
  return JSON.stringify({ format: 'gemas-lab', version: 2, exportedAt, experiments, entries: rest.entries ?? [], protocols: rest.protocols ?? [], media: rest.media ?? [], ...(rest.drafts?.length && { drafts: rest.drafts }) }, null, 2);
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
  add: { experiments: Experiment[]; entries: DailyEntry[]; protocols: ProtocolVersion[]; media: MediaJson[]; drafts: DraftJson[] };
  skipped: { kind: string; id: string }[];
}

/** Rencana pemulihan: yang ID-nya belum ada ditambah; yang sudah ada dilewati (tidak menimpa). */
export function planRestore(b: LabBackup, existing: { experiments: Set<string>; entries: Set<string>; protocols: Set<string>; media: Set<string>; drafts?: Set<string> }): RestorePlan {
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
  for (const dr of drafts) draftJson.push({ ...dr, pending: { ingredients: await conv(dr.pending.ingredients), tools: await conv(dr.pending.tools), steps: await conv(dr.pending.steps) } });
  return {
    json: labBackupJson(experiments, new Date().toISOString(), { entries, protocols, media: mediaJson, drafts: draftJson }),
    counts: { eksperimen: experiments.length, 'catatan harian': entries.length, 'riset produk': protocols.length, draf: drafts.length, media: media.length },
  };
}

export async function previewRestore(text: string): Promise<RestorePlan> {
  const b = parseBackup(text);
  const d = await labDb();
  const keys = async (s: 'experiments' | 'entries' | 'protocols' | 'media') => new Set((await d.getAllKeys(s)).map(String));
  return planRestore(b, { experiments: await keys('experiments'), entries: await keys('entries'), protocols: await keys('protocols'), media: await keys('media'), drafts: new Set((await d.getAllKeys('drafts')).map(String)) });
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
  for (const dr of plan.add.drafts) await tx.objectStore('drafts').add({ ...dr, pending: { ingredients: back(dr.pending.ingredients), tools: back(dr.pending.tools), steps: back(dr.pending.steps) } });
  await tx.done;
}
