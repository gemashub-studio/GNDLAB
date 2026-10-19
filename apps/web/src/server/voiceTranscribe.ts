/**
 * Pengisian suara pencatatan (DEC-099): potongan rekaman pendek → AssemblyAI (pre-recorded, model Universal-2 —
 * satu-satunya model AssemblyAI yang mendukung bahasa Indonesia, sekaligus yang termurah; terpakai dari kredit gratis
 * akun). Kunci API hanya di server (env ASSEMBLYAI_API_KEY), tidak pernah dikirim ke browser.
 */
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://api.assemblyai.com';
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const POLL_MS = 600;
const TIMEOUT_MS = 45_000;

/** Kata kunci agar perintah & angka lebih tepat dikenali (maks. 200 untuk Universal-2). */
export const VOICE_KEYTERMS = ['berat awal', 'berat akhir', 'berat air', 'volume air', 'tebal awal', 'tebal akhir', 'tebal daging', 'nomor', 'next', 'kosong', 'koma', 'seribu', 'ratus', 'puluh', 'belas'];

export class VoiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const sbEnv = () => ({
  url: (process.env.PROJECT_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  service: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
});

/** Hanya pengguna GnD Lab yang masuk (token Supabase) yang boleh memakai kredit AssemblyAI. */
export async function requireLabUser(authHeader: string | null): Promise<void> {
  const e = sbEnv();
  if (!e.url || !e.service) return; // pengembangan lokal tanpa Supabase
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) throw new VoiceError(401, 'Masuk dulu untuk memakai pengisian suara.');
  const db = createClient(e.url, e.service, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new VoiceError(401, 'Sesi masuk tidak valid. Masuk ulang lalu coba lagi.');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function transcribeVoice(audio: ArrayBuffer): Promise<string> {
  const key = process.env.ASSEMBLYAI_API_KEY ?? '';
  if (!key) throw new VoiceError(503, 'Pengisian suara belum dikonfigurasi (ASSEMBLYAI_API_KEY belum diisi).');
  if (!audio.byteLength) throw new VoiceError(400, 'Rekaman kosong.');
  if (audio.byteLength > MAX_AUDIO_BYTES) throw new VoiceError(413, 'Rekaman terlalu panjang. Ucapkan per perintah (maks. ±30 detik).');
  const headers = { authorization: key };

  const up = await fetch(`${BASE}/v2/upload`, { method: 'POST', headers: { ...headers, 'content-type': 'application/octet-stream' }, body: audio });
  if (!up.ok) throw new VoiceError(502, `Unggah suara gagal (${up.status}).`);
  const { upload_url } = (await up.json()) as { upload_url: string };

  const sub = await fetch(`${BASE}/v2/transcript`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, speech_models: ['universal-2'], language_code: 'id', punctuate: false, format_text: false, keyterms_prompt: VOICE_KEYTERMS }),
  });
  if (!sub.ok) throw new VoiceError(502, `Transkripsi gagal dimulai (${sub.status}): ${(await sub.text().catch(() => '')).slice(0, 160)}`);
  const { id } = (await sub.json()) as { id: string };

  const end = Date.now() + TIMEOUT_MS;
  while (Date.now() < end) {
    await sleep(POLL_MS);
    const r = await fetch(`${BASE}/v2/transcript/${id}`, { headers });
    if (!r.ok) continue;
    const t = (await r.json()) as { status: string; text?: string | null; error?: string };
    if (t.status === 'completed') return (t.text ?? '').trim();
    if (t.status === 'error') throw new VoiceError(502, `Transkripsi gagal: ${t.error ?? 'tidak diketahui'}`);
  }
  throw new VoiceError(504, 'Transkripsi terlalu lama. Coba lagi.');
}
