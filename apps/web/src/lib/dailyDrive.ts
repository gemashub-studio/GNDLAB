/**
 * Daily Report R&D — "Pencatatan harian by Drive" (DEC-144): tautan Google Drive (file, folder, Docs/Sheets/Slides)
 * + tanggal otomatis saat Upload. Tersimpan di perangkat (IndexedDB `gemas-daily-drive`) dan ikut sinkron Supabase
 * (rnd_data menu "daily_report"). Pratinjau = iframe versi /preview dari Google (file harus dibagikan "siapa saja
 * yang memiliki link" agar tampil untuk anggota lain).
 */
import { openDB, type DBSchema } from 'idb';
import { deviceTag } from './device';

export interface DailyDriveItem {
  /** DR-YYMMDD-NN (+ kode perangkat bila sinkron aktif). */
  id: string;
  /** Tautan Drive seperti yang ditempel pengguna. */
  url: string;
  /** Tanggal upload (ISO) — otomatis, bukan isian manual. */
  createdAt: string;
}

const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const DOC_KINDS = new Set(['document', 'spreadsheets', 'presentation', 'forms', 'drawings']);

/**
 * Tautan Drive → alamat pratinjau yang boleh disematkan (iframe), atau undefined bila bukan tautan Drive yang dikenali.
 * file/d/<id>/view · open?id=<id> · uc?id=<id> → file/d/<id>/preview; folders/<id> → embeddedfolderview;
 * docs.google.com/<jenis>/d/<id>/edit → …/preview.
 */
export function driveEmbedUrl(raw: string): string | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== 'https:' || !DRIVE_HOSTS.has(u.hostname)) return undefined;
  const parts = u.pathname.split('/').filter(Boolean);
  const okId = (s: string | null | undefined): s is string => !!s && /^[\w-]{10,}$/.test(s);
  if (u.hostname === 'drive.google.com') {
    const f = parts.indexOf('folders');
    if (f >= 0 && okId(parts[f + 1])) return `https://drive.google.com/embeddedfolderview?id=${parts[f + 1]}#grid`;
    const d = parts.indexOf('d');
    if (parts[0] === 'file' && okId(parts[d + 1])) return `https://drive.google.com/file/d/${parts[d + 1]}/preview`;
    const q = u.searchParams.get('id');
    if ((parts[0] === 'open' || parts[0] === 'uc') && okId(q)) return `https://drive.google.com/file/d/${q}/preview`;
    return undefined;
  }
  // docs.google.com/<jenis>/d/<id>/… (juga /u/0/<jenis>/d/<id> dan /<jenis>/u/0/d/<id>)
  const k = parts.findIndex((p) => DOC_KINDS.has(p));
  const d = k >= 0 ? parts.indexOf('d', k + 1) : -1;
  if (d >= 0 && okId(parts[d + 1])) return `https://docs.google.com/${parts[k]}/d/${parts[d + 1]}/preview`;
  return undefined;
}

export const dailyDriveError = (url: string): string | undefined =>
  !url.trim() ? 'Tempel tautan Google Drive dulu.' : driveEmbedUrl(url) ? undefined : 'Tautan belum dikenali. Pakai tautan Google Drive (file/folder) atau Google Docs/Sheets/Slides.';

interface DailyDb extends DBSchema {
  items: { key: string; value: DailyDriveItem };
}
let dbp: ReturnType<typeof openDB<DailyDb>> | undefined;
export function dailyDriveDb() {
  dbp ??= openDB<DailyDb>('gemas-daily-drive', 1, {
    upgrade(db) {
      db.createObjectStore('items', { keyPath: 'id' });
    },
  });
  return dbp;
}

/** Terbaru di atas; waktu sama → nomor urut lebih besar dulu. */
export const sortDaily = (list: readonly DailyDriveItem[]) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

export async function listDailyDrive(): Promise<DailyDriveItem[]> {
  return sortDaily(await (await dailyDriveDb()).getAll('items'));
}

export function nextDailyId(existing: readonly string[], now = new Date(), tag = deviceTag()): string {
  const p = `DR-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const n = existing.filter((x) => x.startsWith(p)).map((x) => parseInt(x.slice(p.length), 10) || 0);
  return `${p}${String(Math.max(0, ...n) + 1).padStart(2, '0')}${tag}`;
}

/** Simpan tautan dengan tanggal SEKARANG (otomatis). */
export async function addDailyDrive(url: string, now = new Date()): Promise<DailyDriveItem> {
  const bad = dailyDriveError(url);
  if (bad) throw new Error(bad);
  const d = await dailyDriveDb();
  const item: DailyDriveItem = { id: nextDailyId((await d.getAllKeys('items')).map(String), now), url: url.trim(), createdAt: now.toISOString() };
  await d.add('items', item);
  return item;
}

/** Tanggal tampil, mis. "Kamis, 6 November 2026 · 09.41". */
export const dailyDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};
