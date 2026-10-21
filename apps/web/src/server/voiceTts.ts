/**
 * Suara jawaban asisten kelapa (DEC-115): teks → Groq TTS (model canopylabs/orpheus-v1-english, suara "autumn", WAV).
 * Keluaran Orpheus diawali hening ±0,5 detik → dipotong (hening di awal saja) sebelum dikirim ke browser.
 * Kunci API sama dengan transkripsi (GROQ_API_KEY, hanya di server).
 */
import { groqFetch, groqKeys } from './groq';
const ENDPOINT = 'https://api.groq.com/openai/v1/audio/speech';
export const TTS_MODEL = 'canopylabs/orpheus-v1-english';
export const TTS_VOICE = 'autumn';
/** Suara yang boleh dipilih: autumn (perintah) & austin (jawaban pertanyaan, DEC-125). */
export const TTS_VOICES = ['autumn', 'austin'] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];
export const pickVoice = (v: unknown): TtsVoice => (TTS_VOICES.includes(v as TtsVoice) ? (v as TtsVoice) : TTS_VOICE);
export const MAX_TTS_CHARS = 300;
const TIMEOUT_MS = 20_000;

export class TtsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Pcm {
  rate: number;
  channels: number;
  bits: number;
  data: Uint8Array;
}

/** Baca WAV PCM (termasuk ukuran data "streaming" 0xFFFFFFFF = sampai akhir berkas). */
export function readWav(buf: Uint8Array): Pcm | undefined {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!);
  if (buf.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return undefined;
  let o = 12;
  let fmt: Omit<Pcm, 'data'> | undefined;
  while (o + 8 <= buf.length) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      if (v.getUint16(o + 8, true) !== 1) return undefined; // hanya PCM
      fmt = { channels: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    } else if (id === 'data') {
      if (!fmt) return undefined;
      const end = size === 0xffffffff || o + 8 + size > buf.length ? buf.length : o + 8 + size;
      return { ...fmt, data: buf.subarray(o + 8, end) };
    }
    if (size === 0xffffffff) return undefined;
    o += 8 + size + (size % 2);
  }
  return undefined;
}

/** Susun WAV PCM 16-bit dengan header lengkap (ukuran pasti). */
export function writeWav(p: Pcm): Uint8Array {
  const out = new Uint8Array(44 + p.data.length);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => (out[o + i] = c.charCodeAt(0)));
  const block = (p.channels * p.bits) / 8;
  str(0, 'RIFF');
  v.setUint32(4, 36 + p.data.length, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, p.channels, true);
  v.setUint32(24, p.rate, true);
  v.setUint32(28, p.rate * block, true);
  v.setUint16(32, block, true);
  v.setUint16(34, p.bits, true);
  str(36, 'data');
  v.setUint32(40, p.data.length, true);
  out.set(p.data, 44);
  return out;
}

/**
 * Buang hening di AWAL suara: cari jendela 10 ms pertama yang cukup keras (RMS > ambang), mundur sedikit (60 ms)
 * agar awal kata tidak terpotong. Suara yang seluruhnya hening / bukan PCM 16-bit dikembalikan apa adanya.
 */
export function trimLeadingSilence(wav: Uint8Array, threshold = 0.02, keepMs = 60): Uint8Array {
  const p = readWav(wav);
  if (!p || p.bits !== 16) return wav;
  const frame = p.channels * 2;
  const total = Math.floor(p.data.length / frame);
  const win = Math.max(1, Math.round(p.rate / 100));
  const v = new DataView(p.data.buffer, p.data.byteOffset, p.data.byteLength);
  const limit = threshold * 32768;
  let start = -1;
  for (let s = 0; s + win <= total && start < 0; s += win) {
    let sum = 0;
    for (let i = s; i < s + win; i++) {
      const x = v.getInt16(i * frame, true);
      sum += x * x;
    }
    if (Math.sqrt(sum / win) > limit) start = s;
  }
  if (start <= 0) return start === 0 ? writeWav(p) : wav;
  const from = Math.max(0, start - Math.round((p.rate * keepMs) / 1000));
  return writeWav({ ...p, data: p.data.subarray(from * frame) });
}

export async function synthesize(text: string, voice: TtsVoice = TTS_VOICE): Promise<Uint8Array> {
  if (!groqKeys().length) throw new TtsError(503, 'Suara asisten belum dikonfigurasi (GROQ_API_KEY belum diisi).');
  const input = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TTS_CHARS);
  if (!input) throw new TtsError(400, 'Teks kosong.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await groqFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: TTS_MODEL, voice, input, response_format: 'wav' }),
      signal: ctl.signal,
    });
    if (res.status === 429) throw new TtsError(429, 'Batas pemakaian Groq tercapai.');
    if (!res.ok) throw new TtsError(502, `Suara gagal dibuat (${res.status}).`);
    return trimLeadingSilence(new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    if (e instanceof TtsError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new TtsError(504, 'Suara terlalu lama dibuat.');
    throw new TtsError(502, 'Tidak bisa menghubungi layanan suara.');
  } finally {
    clearTimeout(t);
  }
}
