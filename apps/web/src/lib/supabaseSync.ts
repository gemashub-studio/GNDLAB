/**
 * Sinkron otomatis GnD Lab ↔ Supabase (DEC-085).
 * Alur: ambil perubahan server (sejak sinkron terakhir) → gabung ke perangkat (planSync/applySync, sama dengan Drive)
 * → unggah catatan lokal yang belum ada / lebih baru → terapkan nisan penghapusan di server.
 * Foto/video disimpan di bucket privat "lab-blobs" dengan nama = SHA-256 isinya.
 */
import { bahanDb } from './bahanBaku';
import { belanjaDb } from './belanja';
import { draftToJson, localSyncState, mediaToJson, applySync } from './labBackup';
import { backupFromDocs, docKey, docToRow, extractBlobs, KIND_OF, pullFilter, pushPlan, RND_COLS, rndTombTargets, restoreBlobs, rowToDoc, type DocKind, type DocMeta, type LabDoc, type RemoteMeta, type RndMenu, type RndRow } from './labDocs';
import { catatRev, planSync, readTombs, syncCount, type Tomb } from './labSync';
import { labDb } from './labStore';
import { catatDb } from './pencatatan';
import { getSupabase } from './supabase';

const BUCKET = 'lab-blobs';
const PAGE = 500;
// tabel bersama rnd_data (DEC-090) — kunci baru agar perangkat menarik ulang semuanya dari tabel baru
const LAST_PULL = 'gemas-sb-last-pull-rnd';
const TABLE = 'rnd_data';
const KNOWN_BLOBS = 'gemas-sb-blobs';

export interface SyncOutcome {
  pulled: number;
  pushed: number;
  conflicts: string[];
  at: string;
}

// ------------------------------------------------------------------ status (untuk UI)

export interface SyncStatus {
  phase: 'off' | 'signed-out' | 'not-member' | 'idle' | 'syncing' | 'error';
  email?: string;
  last?: string;
  message?: string;
  lastOutcome?: SyncOutcome;
}

let status: SyncStatus = { phase: 'off' };
const listeners = new Set<(s: SyncStatus) => void>();
const setStatus = (p: Partial<SyncStatus>) => {
  status = { ...status, ...p };
  for (const l of listeners) l(status);
};
export const getSyncStatus = () => status;
export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* penyimpanan browser tak tersedia */
    }
  },
};

// ------------------------------------------------------------------ data lokal

/** (jenis, id, versi) semua catatan di perangkat — ringan (tanpa mengubah foto ke base64). */
async function localMeta(): Promise<DocMeta[]> {
  const d = await labDb();
  const out: DocMeta[] = [];
  const add = (kind: DocKind, id: string, rev: string | undefined) => out.push({ kind, id, rev: rev ?? '' });
  for (const x of await d.getAll('experiments')) add('experiment', x.id, x.createdAt);
  for (const x of await d.getAll('entries')) add('entry', x.id, x.createdAt);
  for (const x of await d.getAll('protocols')) add('protocol', x.id, x.createdAt);
  for (const x of await d.getAll('media')) add('media', x.id, x.createdAt);
  for (const x of await d.getAll('drafts')) add('draft', x.id, x.updatedAt);
  for (const x of await (await belanjaDb()).getAll('reports')) add('belanja', x.id, x.updatedAt);
  for (const x of await (await bahanDb()).getAll('items')) add('bahan', x.id, x.createdAt);
  for (const x of await (await catatDb()).getAll('records')) add('catat', x.id, catatRev(x));
  for (const t of readTombs()) add('tomb', `${t.kind}|${t.id}`, t.at);
  return out;
}

/** Isi lengkap satu catatan lokal (media/draf diubah ke base64). */
async function loadLocal(m: DocMeta): Promise<unknown> {
  const d = await labDb();
  switch (m.kind) {
    case 'experiment':
      return d.get('experiments', m.id);
    case 'entry':
      return d.get('entries', m.id);
    case 'protocol':
      return d.get('protocols', m.id);
    case 'media': {
      const x = await d.get('media', m.id);
      return x && mediaToJson(x);
    }
    case 'draft': {
      const x = await d.get('drafts', m.id);
      return x && draftToJson(x);
    }
    case 'belanja':
      return (await belanjaDb()).get('reports', m.id);
    case 'bahan':
      return (await bahanDb()).get('items', m.id);
    case 'catat':
      return (await catatDb()).get('records', m.id);
    case 'tomb':
      return readTombs().find((t) => `${t.kind}|${t.id}` === m.id);
  }
}

// ------------------------------------------------------------------ berkas (Storage)

const b64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const blobToB64 = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function knownBlobs(): Set<string> {
  try {
    return new Set(JSON.parse(ls.get(KNOWN_BLOBS) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

// ------------------------------------------------------------------ sinkron

let running: Promise<SyncOutcome> | null = null;

/** Sinkron sekarang (bila sedang berjalan, menunggu yang sama). */
export function syncNow(): Promise<SyncOutcome> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<SyncOutcome> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum diatur.');
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) throw new Error('Belum masuk. Masukkan email untuk menerima link masuk.');
  setStatus({ phase: 'syncing', message: 'Menyinkronkan…' });
  try {
    const known = knownBlobs();
    const put = async (mime: string, b64: string) => {
      const bytes = b64ToBytes(b64);
      const path = await sha256(bytes);
      if (!known.has(path)) {
        const { error } = await sb.storage.from(BUCKET).upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: false });
        if (error && !/exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) throw new Error(`Unggah foto/video gagal: ${error.message}`);
        known.add(path);
      }
      return path;
    };
    const cache = new Map<string, string>();
    const get = async (path: string) => {
      const hit = cache.get(path);
      if (hit !== undefined) return hit;
      const { data, error } = await sb.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error(`Unduh foto/video gagal: ${error?.message ?? path}`);
      const b64 = await blobToB64(data);
      cache.set(path, b64);
      known.add(path);
      return b64;
    };

    // 1) ambil perubahan dari server
    const since = ls.get(LAST_PULL);
    const sinceAt = since ? new Date(new Date(since).getTime() - 5 * 60_000).toISOString() : '';
    type Row = RndRow & { kind: DocKind; updated_at: string };
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = sb.from(TABLE).select(`menu,id,rev,deleted,updated_at,${RND_COLS.join(',')}`).order('updated_at', { ascending: true }).range(from, from + PAGE - 1);
      if (sinceAt) q = q.gte('updated_at', sinceAt);
      const { data, error } = await q;
      if (error) throw new Error(`Ambil data gagal: ${error.message}`);
      for (const r of (data ?? []) as unknown as (RndRow & { updated_at: string })[]) if (KIND_OF[r.menu]) rows.push({ ...r, kind: KIND_OF[r.menu] });
      if (!data || data.length < PAGE) break;
    }
    const localRev = new Map((await localMeta()).map((m) => [docKey(m.kind, m.id), m.rev] as const));
    const fresh = pullFilter(rows, localRev);
    const docs: LabDoc[] = [];
    for (const r of fresh) {
      const d = rowToDoc(r);
      if (d) docs.push({ ...d, data: await restoreBlobs(d.data, get) });
    }
    const remote = backupFromDocs(docs);
    const plan = planSync(remote, await localSyncState(), readTombs());
    const pulled = syncCount(plan);
    if (pulled || (remote.deleted ?? []).length) await applySync(plan);
    const maxAt = rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), since);

    // 2) unggah yang belum ada / lebih baru
    const index = new Map<string, RemoteMeta>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(TABLE).select('menu,id,rev,deleted').range(from, from + 999);
      if (error) throw new Error(`Baca indeks gagal: ${error.message}`);
      for (const r of (data ?? []) as { menu: RndMenu; id: string; rev: string; deleted: boolean }[]) if (KIND_OF[r.menu]) index.set(docKey(KIND_OF[r.menu], r.id), { rev: r.rev, deleted: r.deleted });
      if (!data || data.length < 1000) break;
    }
    const todo = pushPlan(await localMeta(), index);
    let pushed = 0;
    for (let i = 0; i < todo.length; i += 10) {
      const docs: LabDoc[] = [];
      for (const m of todo.slice(i, i + 10)) {
        const raw = await loadLocal(m);
        if (raw === undefined) continue;
        docs.push({ kind: m.kind, id: m.id, rev: m.rev, data: await extractBlobs(raw, put) });
      }
      if (!docs.length) continue;
      setStatus({ message: `Mengunggah ${Math.min(i + 10, todo.length)} dari ${todo.length} catatan…` });
      const { error } = await sb.from(TABLE).upsert(docs.map(docToRow), { onConflict: 'menu,id' });
      if (error) throw new Error(`Unggah data gagal: ${error.message}`);
      pushed += docs.length;
      // nisan baru → kosongkan isi catatan yang dihapus di server
      const empty = Object.fromEntries(RND_COLS.map((c) => [c, null]));
      for (const d of docs.filter((x) => x.kind === 'tomb')) {
        for (const [menu, col, val] of rndTombTargets(d.data as Tomb)) {
          const { error: e2 } = await sb.from(TABLE).update({ ...empty, deleted: true }).eq('menu', menu).eq(col, val);
          if (e2) throw new Error(`Hapus di server gagal: ${e2.message}`);
        }
      }
    }
    ls.set(KNOWN_BLOBS, JSON.stringify([...known]));
    if (maxAt) ls.set(LAST_PULL, maxAt);
    const at = new Date().toISOString();
    const outcome: SyncOutcome = { pulled, pushed, conflicts: plan.conflicts, at };
    ls.set('gemas-sb-last-sync', at);
    setStatus({ phase: 'idle', last: at, lastOutcome: outcome, message: `Sinkron selesai: ${pulled} masuk, ${pushed} terkirim.${plan.conflicts.length ? ` ${plan.conflicts.length} ID bentrok tidak digabung: ${plan.conflicts.join(', ')}` : ''}` });
    return outcome;
  } catch (e) {
    setStatus({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

// ------------------------------------------------------------------ login & sinkron otomatis

/** Kirim link masuk ke email (Supabase Auth). */
export async function sendLoginLink(email: string, path = '/lab'): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum diatur.');
  const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}${path}`, shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
  setStatus({ phase: 'signed-out', email: undefined, message: undefined });
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Minta sinkron sebentar lagi (dipanggil setelah data lokal berubah). */
export function requestSync(delayMs = 3000): void {
  if (status.phase !== 'idle' && status.phase !== 'error') return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow().catch(() => undefined), delayMs);
}

/**
 * Mulai sinkron otomatis: saat dibuka, saat kembali ke tab, saat online lagi, tiap 2 menit, dan setelah login.
 * `onPulled` dipanggil bila ada data baru dari perangkat lain (untuk memuat ulang tampilan).
 */
export function startAutoSync(onPulled: () => void): () => void {
  const sb = getSupabase();
  if (!sb) {
    setStatus({ phase: 'off' });
    return () => undefined;
  }
  let alive = true;
  const go = async () => {
    if (!alive || document.hidden) return;
    const { data } = await sb.auth.getSession();
    const email = data.session?.user.email ?? undefined;
    if (!email) return setStatus({ phase: 'signed-out', email: undefined });
    // DEC-090: semua pengguna yang login berbagi data GnD Lab (tanpa daftar anggota)
    if (status.phase !== 'syncing') setStatus({ phase: 'idle', email, last: status.last ?? (ls.get('gemas-sb-last-sync') || undefined) });
    try {
      const r = await syncNow();
      if (r.pulled) onPulled();
    } catch {
      /* status sudah berisi pesan galat */
    }
  };
  const onVis = () => !document.hidden && void go();
  const { data: sub } = sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') void go();
  });
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('online', onVis);
  const iv = setInterval(() => void go(), 120_000);
  void go();
  return () => {
    alive = false;
    sub.subscription.unsubscribe();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('online', onVis);
    clearInterval(iv);
  };
}
