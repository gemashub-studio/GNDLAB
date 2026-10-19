/**
 * Bentuk "dokumen" untuk sinkron Supabase (DEC-085) — MURNI (diuji unit), tanpa jaringan/IndexedDB.
 * - Tiap catatan lab = satu baris lab_docs (kind, id, rev, data).
 * - Foto/video (data URL & base64 media) dipindah ke Storage; di dokumen diganti penanda "sbblob:".
 * - Penggabungan memakai planSync (labSync.ts) yang sama dengan sinkron Drive.
 */
import type { LabBackup } from './labBackup';
import { catatRev, type Tomb, type TombKind } from './labSync';

export type DocKind = 'experiment' | 'entry' | 'protocol' | 'media' | 'draft' | 'belanja' | 'bahan' | 'catat' | 'progres' | 'tomb';

export interface LabDoc {
  kind: DocKind;
  id: string;
  rev: string;
  data: unknown;
}

export interface DocMeta {
  kind: DocKind;
  id: string;
  rev: string;
}

export interface RemoteMeta {
  rev: string;
  deleted: boolean;
}

/** Jenis yang boleh berubah (versi lebih baru menang); sisanya append-only (sekali unggah). */
export const MUTABLE: ReadonlySet<DocKind> = new Set<DocKind>(['draft', 'belanja', 'catat']);

export const docKey = (kind: string, id: string) => `${kind}|${id}`;

const tombId = (t: Tomb) => `${t.kind}|${t.id}`;

/** Cadangan lab (JSON) → dokumen. */
export function docsFromBackup(b: LabBackup): LabDoc[] {
  const out: LabDoc[] = [];
  const push = (kind: DocKind, id: string, rev: string | undefined, data: unknown) => out.push({ kind, id, rev: rev ?? '', data });
  for (const x of b.experiments) push('experiment', x.id, x.createdAt, x);
  for (const x of b.entries ?? []) push('entry', x.id, x.createdAt, x);
  for (const x of b.protocols ?? []) push('protocol', x.id, x.createdAt, x);
  for (const x of b.media ?? []) push('media', x.id, x.createdAt, x);
  for (const x of b.drafts ?? []) push('draft', x.id, x.updatedAt, x);
  for (const x of b.belanja ?? []) push('belanja', x.id, x.updatedAt, x);
  for (const x of b.bahan ?? []) push('bahan', x.id, x.createdAt, x);
  for (const x of b.catat ?? []) push('catat', x.id, catatRev(x), x);
  for (const x of b.progres ?? []) push('progres', x.id, x.createdAt, x);
  for (const t of b.deleted ?? []) push('tomb', tombId(t), t.at, t);
  return out;
}

/** Dokumen (sudah dipulihkan foto/videonya) → bentuk cadangan untuk planSync. */
export function backupFromDocs(docs: readonly LabDoc[]): LabBackup {
  const of = <T,>(k: DocKind) => docs.filter((d) => d.kind === k).map((d) => d.data as T);
  return {
    format: 'gemas-lab',
    version: 2,
    exportedAt: new Date().toISOString(),
    experiments: of('experiment'),
    entries: of('entry'),
    protocols: of('protocol'),
    media: of('media'),
    drafts: of('draft'),
    belanja: of('belanja'),
    bahan: of('bahan'),
    catat: of('catat'),
    progres: of('progres'),
    deleted: of<Tomb>('tomb'),
  } as LabBackup;
}

/**
 * Dokumen lokal yang perlu diunggah: belum ada di server, atau (jenis yang bisa berubah) versinya lebih baru.
 * Yang sudah ditandai terhapus di server tidak dihidupkan lagi.
 */
export function pushPlan(local: readonly DocMeta[], remote: ReadonlyMap<string, RemoteMeta>): DocMeta[] {
  return local.filter((d) => {
    const r = remote.get(docKey(d.kind, d.id));
    if (!r) return true;
    if (r.deleted) return false;
    return MUTABLE.has(d.kind) && d.rev > r.rev;
  });
}

/** Dokumen server yang perlu diterapkan ke perangkat ini (baru / versi beda). Nisan selalu diterapkan. */
export function pullFilter<T extends { kind: string; id: string; rev: string; deleted: boolean }>(rows: readonly T[], local: ReadonlyMap<string, string>): T[] {
  return rows.filter((r) => !r.deleted && (r.kind === 'tomb' || local.get(docKey(r.kind, r.id)) !== r.rev));
}

/** Target penghapusan di server untuk satu nisan: [jenis, kolom filter, nilai]. */
export function tombTargets(t: { kind: TombKind; id: string }): [DocKind, 'id' | 'data->>key' | 'data->>experimentId', string][] {
  if (t.kind === 'draf') return [['draft', 'id', t.id]];
  if (t.kind === 'belanja') return [['belanja', 'id', t.id]];
  if (t.kind === 'catat') return [['catat', 'id', t.id]];
  return [
    ['protocol', 'data->>key', t.id],
    ['entry', 'data->>experimentId', t.id],
    ['media', 'data->>experimentId', t.id],
  ];
}

// ------------------------------------------------------------------ foto/video ↔ Storage

/** Teks base64 yang cukup panjang untuk dianggap berkas (bukan teks biasa). */
const MIN_BLOB = 256;
const DATA_URL = /^data:([^;,]+)(?:;[^;,]*)*;base64,/;

export const isBlobMarker = (s: unknown): s is string => typeof s === 'string' && s.startsWith('sbblob:');

/**
 * Ganti setiap foto/video di dalam dokumen:
 * - string data URL (mis. foto pencatatan, nota belanja) → "sbblob:u:<mime>:<path>"
 * - objek media { type, data: base64 } → data "sbblob:b:<path>"
 * `put(mime, base64)` mengunggah & mengembalikan path (mis. hash SHA-256).
 */
export async function extractBlobs(v: unknown, put: (mime: string, b64: string) => Promise<string>): Promise<unknown> {
  if (typeof v === 'string') {
    const m = v.length >= MIN_BLOB ? DATA_URL.exec(v) : null;
    return m ? `sbblob:u:${m[1]}:${await put(m[1]!, v.slice(m[0].length))}` : v;
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (const x of v) out.push(await extractBlobs(x, put));
    return out;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const raw = typeof o.type === 'string' && typeof o.data === 'string' && o.data.length >= MIN_BLOB && !o.data.startsWith('data:') && !isBlobMarker(o.data);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = raw && k === 'data' ? `sbblob:b:${await put(o.type as string, x as string)}` : await extractBlobs(x, put);
    return out;
  }
  return v;
}

/** Kebalikan extractBlobs: `get(path)` mengembalikan base64 isi berkas. */
export async function restoreBlobs(v: unknown, get: (path: string) => Promise<string>): Promise<unknown> {
  if (typeof v === 'string') {
    if (v.startsWith('sbblob:u:')) {
      const rest = v.slice('sbblob:u:'.length);
      const i = rest.lastIndexOf(':');
      return `data:${rest.slice(0, i)};base64,${await get(rest.slice(i + 1))}`;
    }
    if (v.startsWith('sbblob:b:')) return get(v.slice('sbblob:b:'.length));
    return v;
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (const x of v) out.push(await restoreBlobs(x, get));
    return out;
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = await restoreBlobs(x, get);
    return out;
  }
  return v;
}

// ------------------------------------------------------------------ tabel bersama rnd_data (DEC-090)

export type RndMenu = 'pencatatan_data' | 'riset_produk' | 'eksperimen' | 'catatan_harian' | 'laporan_belanja' | 'bahan_baku' | 'media' | 'draf_riset' | 'progres_perlakuan' | 'penghapusan';

/** Jenis dokumen → menu GnD Lab (= nilai kolom `menu`). */
export const MENU_OF: Record<DocKind, RndMenu> = {
  catat: 'pencatatan_data',
  protocol: 'riset_produk',
  experiment: 'eksperimen',
  entry: 'catatan_harian',
  belanja: 'laporan_belanja',
  bahan: 'bahan_baku',
  media: 'media',
  draft: 'draf_riset',
  progres: 'progres_perlakuan',
  tomb: 'penghapusan',
};
export const KIND_OF = Object.fromEntries(Object.entries(MENU_OF).map(([k, m]) => [m, k])) as Record<RndMenu, DocKind>;

/** Kolom isi; Pencatatan Data dipecah ke empat kolom, menu lain satu kolom bernama sama dengan menunya. */
export const RND_COLS = ['data_awal', 'data_akhir', 'perlakuan', 'progres_harian', 'riset_produk', 'eksperimen', 'catatan_harian', 'laporan_belanja', 'bahan_baku', 'media', 'draf_riset', 'progres_perlakuan', 'penghapusan'] as const;
export type RndCol = (typeof RND_COLS)[number];

export type RndRow = { menu: RndMenu; id: string; rev: string; deleted: boolean } & Partial<Record<RndCol, unknown>>;

type Obj = Record<string, unknown>;
const omit = (o: Obj, keys: readonly string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const defined = (o: Obj) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const AKHIR_ROW = ['beratAkhir', 'tebalAkhir', 'fotoAkhir'];

/** Pencatatan → {data_awal, data_akhir, perlakuan, progres_harian} (sama persis dengan migrasi SQL). */
export function splitCatat(rec: Obj): Pick<RndRow, 'data_awal' | 'data_akhir' | 'perlakuan' | 'progres_harian'> {
  const rows = (Array.isArray(rec.rows) ? rec.rows : []) as Obj[];
  return {
    data_awal: { ...omit(rec, ['rows', 'finishedAt', 'akhirSavedAt', 'closedAt', 'treatments', 'progress']), rows: rows.map((r) => omit(r, AKHIR_ROW)) },
    data_akhir: defined({ finishedAt: rec.finishedAt, akhirSavedAt: rec.akhirSavedAt, closedAt: rec.closedAt, rows: rows.map((r) => defined({ no: r.no, beratAkhir: r.beratAkhir, tebalAkhir: r.tebalAkhir, fotoAkhir: r.fotoAkhir })) }),
    perlakuan: rec.treatments ?? null,
    progres_harian: rec.progress ?? null,
  };
}

/** Kebalikan splitCatat. */
export function joinCatat(r: Pick<RndRow, 'data_awal' | 'data_akhir' | 'perlakuan' | 'progres_harian'>): Obj | undefined {
  const awal = r.data_awal as Obj | null | undefined;
  if (!awal) return undefined;
  const akhir = (r.data_akhir ?? {}) as Obj;
  const byNo = new Map(((akhir.rows ?? []) as Obj[]).map((x) => [x.no, x]));
  const rows = ((awal.rows ?? []) as Obj[]).map((x) => ({ ...x, ...omit(byNo.get(x.no) ?? {}, ['no']) }));
  return defined({ ...awal, rows, finishedAt: akhir.finishedAt, akhirSavedAt: akhir.akhirSavedAt, closedAt: akhir.closedAt, treatments: r.perlakuan ?? undefined, progress: r.progres_harian ?? undefined });
}

/** Dokumen → baris rnd_data. */
export function docToRow(d: LabDoc): RndRow {
  const base = { menu: MENU_OF[d.kind], id: d.id, rev: d.rev, deleted: false };
  if (d.kind === 'catat') return { ...base, ...splitCatat(d.data as Obj) };
  return { ...base, [MENU_OF[d.kind]]: d.data };
}

/** Baris rnd_data → dokumen (undefined bila terhapus/kosong). */
export function rowToDoc(r: RndRow): LabDoc | undefined {
  const kind = KIND_OF[r.menu];
  if (!kind || r.deleted) return undefined;
  const data = kind === 'catat' ? joinCatat(r) : r[r.menu as RndCol];
  return data == null ? undefined : { kind, id: r.id, rev: r.rev, data };
}

/** Target penghapusan di rnd_data untuk satu nisan: [menu, kolom filter, nilai]. */
export function rndTombTargets(t: { kind: TombKind; id: string }): [RndMenu, string, string][] {
  if (t.kind === 'draf') return [['draf_riset', 'id', t.id]];
  if (t.kind === 'belanja') return [['laporan_belanja', 'id', t.id]];
  if (t.kind === 'catat') return [['pencatatan_data', 'id', t.id]];
  return [
    ['riset_produk', 'riset_produk->>key', t.id],
    ['catatan_harian', 'catatan_harian->>experimentId', t.id],
    ['media', 'media->>experimentId', t.id],
  ];
}
