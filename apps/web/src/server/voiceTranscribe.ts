/**
 * Pengisian suara pencatatan (DEC-099, mesin diganti DEC-101): potongan rekaman pendek → Groq Whisper
 * (whisper-large-v3, bahasa Indonesia, endpoint kompatibel OpenAI). Kunci API hanya di server (env GROQ_API_KEY, cadangan GROQ_API_KEY_2 … _5),
 * tidak pernah dikirim ke browser. Prompt Whisper berisi kosakata perintah supaya ejaannya konsisten.
 */
import { groqFetch, groqKeys } from './groq';
import { createClient } from '@supabase/supabase-js';

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const VOICE_MODEL = 'whisper-large-v3';
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
/** Panduan ejaan untuk Whisper (maks. 224 token). */
export const VOICE_PROMPT = 'Pencatatan data lab kelapa. Perintah: satu, dua, tiga, nomor, berat awal, berat akhir, berat air, volume air, tebal daging, tebal akhir, seribu tiga empat, koma, next.';

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

/** Hanya pengguna GnD Lab yang masuk (token Supabase) yang boleh memakai kuota Groq. */
export async function requireLabUser(authHeader: string | null): Promise<void> {
  const e = sbEnv();
  if (!e.url || !e.service) return; // pengembangan lokal tanpa Supabase
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) throw new VoiceError(401, 'Masuk dulu untuk memakai pengisian suara.');
  const db = createClient(e.url, e.service, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new VoiceError(401, 'Sesi masuk tidak valid. Masuk ulang lalu coba lagi.');
}

/**
 * Kalimat "halusinasi" Whisper (DEC-117): muncul saat rekaman hanya berisi hening/derau (bawaan data latih video),
 * mis. "Terima kasih telah menonton!". Kalimat seperti ini dibuang dari hasil transkripsi — bukan ucapan pengguna.
 */
const HALLUCINATIONS = [
  /^terima ?kasih( banyak)?$/,
  /^terima ?kasih (telah|sudah|udah|untuk|karena|atas)( telah| sudah)? (menonton|menyaksikan|mendengarkan|perhatian(nya)?|waktunya|kunjungan(nya)?)( video ini)?( semuanya)?$/,
  /^(thank you|thanks)( so much| very much)?( for watching| for listening)?$/,
  /^(jangan lupa )?(like|subscribe|like dan subscribe|like share (and|dan) subscribe)\b/,
  /^sampai (jumpa|bertemu)( lagi)?( di (video|episode|kesempatan) (berikutnya|selanjutnya))?$/,
  /^(subtitle|subtitles|teks|terjemahan|diterjemahkan|disadur)( oleh| by)\b/,
  /^(selamat menonton|nantikan video (berikutnya|selanjutnya)|see you( next time)?|bye)$/,
];
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export const isHallucination = (sentence: string) => {
  const n = norm(sentence);
  return !!n && HALLUCINATIONS.some((re) => re.test(n));
};
/** Buang kalimat halusinasi (utuh atau yang menempel di akhir/awal perintah asli). */
export function stripHallucinations(text: string): string {
  const parts = text.match(/[^.!?]+[.!?]*/g) ?? [];
  return parts
    .filter((p) => !isHallucination(p))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
/** Segmen yang hampir pasti tanpa ucapan (peluang "tanpa suara" tinggi) tidak dipakai. */
export const NO_SPEECH_MAX = 0.6;

/** Ekstensi berkas dari tipe MIME rekaman browser (Groq menebak format dari nama berkas). */
export const audioExt = (mime: string) => (/mp4|m4a|aac/.test(mime) ? 'mp4' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : /mpeg|mp3/.test(mime) ? 'mp3' : 'webm');

export async function transcribeVoice(audio: ArrayBuffer, mime = 'audio/webm'): Promise<string> {
  if (!groqKeys().length) throw new VoiceError(503, 'Pengisian suara belum dikonfigurasi (GROQ_API_KEY belum diisi).');
  if (!audio.byteLength) throw new VoiceError(400, 'Rekaman kosong.');
  if (audio.byteLength > MAX_AUDIO_BYTES) throw new VoiceError(413, 'Rekaman terlalu panjang. Ucapkan per perintah (maks. ±30 detik).');
  const type = mime.split(';')[0] || 'audio/webm';
  const form = new FormData();
  form.append('file', new Blob([audio], { type }), `suara.${audioExt(type)}`);
  form.append('model', VOICE_MODEL);
  form.append('language', 'id');
  form.append('prompt', VOICE_PROMPT);
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await groqFetch(ENDPOINT, { method: 'POST', body: form, signal: ctl.signal });
    const body = (await res.json().catch(() => ({}))) as { text?: string; segments?: { text?: string; no_speech_prob?: number }[]; error?: { message?: string } };
    if (res.status === 429) throw new VoiceError(429, 'Batas pemakaian Groq tercapai (kunci utama & cadangan). Tunggu sebentar lalu coba lagi.');
    if (!res.ok) throw new VoiceError(502, `Transkripsi gagal (${res.status})${body.error?.message ? `: ${body.error.message.slice(0, 160)}` : ''}.`);
    // segmen tanpa ucapan dibuang, lalu kalimat halusinasi Whisper disaring (DEC-117)
    const raw = body.segments?.length ? body.segments.filter((g) => (g.no_speech_prob ?? 0) <= NO_SPEECH_MAX).map((g) => g.text ?? '').join(' ') : (body.text ?? '');
    return stripHallucinations(raw.trim());
  } catch (e) {
    if (e instanceof VoiceError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new VoiceError(504, 'Transkripsi terlalu lama. Coba lagi.');
    throw new VoiceError(502, 'Tidak bisa menghubungi layanan transkripsi.');
  } finally {
    clearTimeout(t);
  }
}
