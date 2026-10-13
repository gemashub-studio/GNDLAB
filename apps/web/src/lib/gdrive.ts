'use client';

/**
 * Google Drive untuk sinkron GEMA RnD (DEC-065). Masuk lewat jendela resmi Google (Google Identity Services,
 * token akses di memori saja — tidak disimpan). Izin `drive.file`: aplikasi HANYA bisa melihat file yang ia buat
 * sendiri, bukan isi Drive lainnya. Data = satu file JSON (format cadangan lab) di Drive pemilik.
 * Aktif bila NEXT_PUBLIC_GOOGLE_CLIENT_ID diisi atau Client ID ditempel di panel (Client ID OAuth milik owner — bukan rahasia).
 */
import { applySync, exportLabBackup, localSyncState, parseBackup } from './labBackup';
import { planSync, readTombs, syncCount } from './labSync';

export const DRIVE_FILE = 'gemasSTUDIO-lab-sinkron.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const CID_KEY = 'gemas-google-client-id';

/** Client ID dari env build, atau yang ditempel pengguna di aplikasi (disimpan di browser ini). */
export function driveClientId(): string {
  if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  try {
    return localStorage.getItem(CID_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Client ID OAuth Google berbentuk "<angka>-<acak>.apps.googleusercontent.com". */
export const validClientId = (s: string) => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(s.trim());

export function setDriveClientId(id: string): void {
  try {
    if (id) localStorage.setItem(CID_KEY, id.trim());
    else localStorage.removeItem(CID_KEY);
  } catch {
    /* abaikan */
  }
}

interface TokenResponse {
  access_token?: string;
  error?: string;
}
interface Gis {
  accounts: { oauth2: { initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }): { requestAccessToken(o?: { prompt?: string }): void } } };
}

let gisLoading: Promise<Gis> | undefined;
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  return (gisLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google ? res(w.google) : rej(new Error('Layanan login Google tidak termuat.')));
    s.onerror = () => {
      gisLoading = undefined;
      rej(new Error('Tidak bisa memuat login Google — periksa koneksi internet.'));
    };
    document.head.appendChild(s);
  }));
}

let token: { value: string; until: number } | undefined;

async function getToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const id = driveClientId();
  if (!id) throw new Error('Sinkron Google Drive belum diaktifkan (Client ID belum diisi).');
  const gis = await loadGis();
  return new Promise((res, rej) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return rej(new Error(`Login Google gagal${r.error ? ` (${r.error})` : ''}.`));
        token = { value: r.access_token, until: Date.now() + 50 * 60_000 };
        res(r.access_token);
      },
      error_callback: (e) => rej(new Error(e.type === 'popup_closed' ? 'Jendela login Google ditutup.' : 'Login Google dibatalkan atau diblokir browser (izinkan pop-up).')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const t = await getToken();
  const r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${t}` } });
  if (r.status === 401) token = undefined;
  if (!r.ok) throw new Error(`Google Drive menolak (${r.status}). Coba lagi.`);
  return r;
}

async function findFile(): Promise<{ id: string; modifiedTime: string; size?: string } | undefined> {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const r = await api(`${API}?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(id,modifiedTime,size)`);
  return ((await r.json()) as { files: { id: string; modifiedTime: string; size?: string }[] }).files[0];
}

/** Unggah (buat baru / timpa isi file sinkron) — resumable agar file besar (video) tetap aman. */
async function uploadFile(json: string, id?: string): Promise<void> {
  const init = await api(`${UPLOAD}${id ? `/${id}` : ''}?uploadType=resumable`, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' },
    body: JSON.stringify(id ? {} : { name: DRIVE_FILE, mimeType: 'application/json', description: 'Data GEMA RnD Lab (gemasSTUDIO). Jangan diubah manual.' }),
  });
  const loc = init.headers.get('Location');
  if (!loc) throw new Error('Google Drive tidak memberi alamat unggah.');
  const put = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json });
  if (!put.ok) throw new Error(`Unggah ke Google Drive gagal (${put.status}).`);
}

export interface SyncResult {
  pulled: number;
  pushedBytes: number;
  counts: Record<string, number>;
  at: string;
  conflicts: string[];
}

/** Sinkron dua arah: ambil file Drive → gabung ke perangkat ini → unggah gabungan kembali ke Drive. */
export async function syncWithDrive(onStep: (s: string) => void = () => undefined): Promise<SyncResult> {
  onStep('Masuk ke Google…');
  await getToken();
  onStep('Mencari file sinkron di Drive…');
  const file = await findFile();
  let pulled = 0;
  let conflicts: string[] = [];
  if (file) {
    onStep('Mengunduh data dari Drive…');
    const remote = parseBackup(await (await api(`${API}/${file.id}?alt=media`)).text());
    const plan = planSync(remote, await localSyncState(), readTombs());
    pulled = syncCount(plan);
    conflicts = plan.conflicts;
    if (pulled) {
      onStep(`Menggabungkan ${pulled} perubahan ke perangkat ini…`);
      await applySync(plan);
    }
  }
  onStep('Mengunggah data perangkat ini ke Drive…');
  const { json, counts } = await exportLabBackup();
  await uploadFile(json, file?.id);
  const at = new Date().toISOString();
  try {
    localStorage.setItem('gemas-lab-last-sync', at);
  } catch {
    /* abaikan */
  }
  return { pulled, pushedBytes: json.length, counts, at, conflicts };
}

export function lastSync(): string {
  try {
    return localStorage.getItem('gemas-lab-last-sync') ?? '';
  } catch {
    return '';
  }
}
