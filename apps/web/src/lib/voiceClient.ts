/**
 * Mesin suara di browser (DEC-099, dipisah DEC-111): mikrofon → potongan rekaman per ucapan (dipotong saat diam) →
 * transkripsi Groq Whisper lewat server. Dipakai kotak suara form pencatatan dan asisten suara kelapa.
 */
import { getSupabase } from './supabase';
import { loadClip, saveClip, ttsKey } from './ttsStore';

/** Token sesi Supabase untuk API server (kosong bila Supabase tidak diatur). */
export async function authHeader(): Promise<Record<string, string>> {
  const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Satu potongan rekaman → teks (Groq Whisper large-v3, bahasa Indonesia). */
export async function transcribe(blob: Blob): Promise<string> {
  const res = await fetch('/api/voice-transcribe', { method: 'POST', body: blob, headers: { 'content-type': blob.type || 'application/octet-stream', ...(await authHeader()) } });
  const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(j.error ?? `Transkripsi gagal (${res.status}).`);
  return j.text ?? '';
}

export interface SegmenterOptions {
  /** Satu ucapan selesai (rekaman sampai jeda diam). */
  onSegment: (blob: Blob) => void;
  /** Level suara 0–1 untuk indikator. */
  onLevel?: (level: number) => void;
  /** Mulai / berhenti bicara (untuk animasi). */
  onSpeaking?: (speaking: boolean) => void;
  /** Lama diam yang dianggap ucapan selesai (ms). */
  silenceMs?: number;
  maxSegmentMs?: number;
  /** Selama true (mis. asisten sedang berbicara), suara diabaikan & rekaman dibuang — agar suara TTS tidak jadi perintah. */
  isMuted?: () => boolean;
}

/**
 * Dengarkan mikrofon terus; tiap ucapan dipotong saat diam `silenceMs` lalu diserahkan ke `onSegment`.
 * Ambang suara menyesuaikan kebisingan ruangan. Kembalikan fungsi berhenti.
 */
export async function startSegmenter({ onSegment, onLevel, onSpeaking, silenceMs = 850, maxSegmentMs = 25_000, isMuted }: SegmenterOptions): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Browser ini tidak mendukung rekam suara.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new Error('Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser lalu coba lagi.');
  }
  const ctx = new AudioContext();
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m));
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let speech = false;
  let lastVoice = 0;
  let segStart = 0;
  let noise = 0.01;
  let alive = true;
  const IDLE_RESTART_MS = 8000;
  const newSeg = () => {
    chunks = [];
    speech = false;
    segStart = performance.now();
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const mine = chunks;
    rec.ondataavailable = (e) => e.data.size && mine.push(e.data);
    rec.start();
  };
  const endSeg = (keep: boolean) => {
    const r = rec;
    const mine = chunks;
    if (!r) return;
    if (speech) onSpeaking?.(false);
    r.onstop = () => {
      if (keep && mine.length) onSegment(new Blob(mine, { type: r.mimeType || mime || 'audio/webm' }));
    };
    r.stop();
    rec = null;
    if (alive) newSeg();
  };
  newSeg();
  const timer = window.setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const thr = Math.max(0.015, noise * 3);
    const now = performance.now();
    if (isMuted?.()) {
      // asisten berbicara: buang rekaman yang sedang berjalan, jangan anggap sebagai ucapan
      onLevel?.(0);
      if (speech || now - segStart > 1000) endSeg(false);
      return;
    }
    onLevel?.(Math.min(1, rms / 0.12));
    if (rms > thr) {
      if (!speech) onSpeaking?.(true);
      speech = true;
      lastVoice = now;
    } else if (!speech) noise = noise * 0.95 + rms * 0.05;
    if (speech && (now - lastVoice > silenceMs || now - segStart > maxSegmentMs)) endSeg(true);
    else if (!speech && now - segStart > IDLE_RESTART_MS) endSeg(false);
  }, 50);
  return () => {
    alive = false;
    window.clearInterval(timer);
    endSeg(speech);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    onLevel?.(0);
  };
}

/** Event global: teks perintah pengisian dari asisten suara → kotak suara form yang sedang terbuka (DEC-111). */
export const VOICE_FORM_EVENT = 'gnd-voice-form';
/** Kolom yang diisi form lewat perintah asisten (detail.done), untuk respons "<kolom>, <nilai>!" (DEC-122). */
export interface FilledField {
  label: string;
  value: string;
  num: boolean;
}

/**
 * Suara jawaban asisten (DEC-115): teks → WAV dari server (Groq Orpheus, suara Autumn; hening awal dipotong).
 * DEC-139: urutan cari = memori sesi → simpanan perangkat (IndexedDB `gnd-tts`) → Groq; suara baru dari Groq selalu
 * disimpan, jadi kalimat yang sama pada perintah berikutnya tidak memanggil Groq lagi (hemat limit).
 */
const ttsCache = new Map<string, Promise<Blob>>();
export type TtsVoice = 'autumn' | 'austin';
export function ttsAudio(text: string, voice: TtsVoice = 'autumn'): Promise<Blob> {
  const key = text.replace(/\s+/g, ' ').trim();
  const ck = ttsKey(key, voice);
  let p = ttsCache.get(ck);
  if (!p) {
    p = (async () => {
      const saved = await loadClip(ck);
      if (saved) return saved;
      const res = await fetch('/api/voice-tts', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ text: key, voice }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Suara gagal (${res.status}).`);
      const blob = await res.blob();
      void saveClip(ck, blob);
      return blob;
    })();
    p.catch(() => ttsCache.delete(ck));
    // memori sesi hanya untuk frasa pendek yang sering diulang; sisanya diambil dari IndexedDB
    if (key.length <= 60) ttsCache.set(ck, p);
  }
  return p;
}

let current: HTMLAudioElement | null = null;
/** Putar suara teks; selesai saat audio selesai / dihentikan. Satu suara pada satu waktu (yang lama dihentikan). */
export async function speak(text: string, onStart?: () => void, voice?: TtsVoice): Promise<void> {
  if (!text.trim()) return;
  const blob = await ttsAudio(text, voice);
  current?.pause();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  current = audio;
  try {
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.onpause = () => resolve();
      onStart?.();
      audio.play().catch(() => resolve());
    });
  } finally {
    if (current === audio) current = null;
    URL.revokeObjectURL(url);
  }
}
let speakGen = 0;
export const stopSpeaking = () => {
  speakGen++;
  current?.pause();
};

/**
 * Teks panjang (jawaban Lab AI, DEC-125): dipecah per kalimat (≤ 280 karakter, batas TTS 300) lalu diputar berurutan;
 * potongan berikutnya sudah dibuat selagi potongan sekarang diputar. Berhenti bila stopSpeaking dipanggil.
 */
export async function speakLong(text: string, voice?: TtsVoice): Promise<void> {
  const parts = splitTts(text);
  const gen = ++speakGen;
  let next = parts[0] ? ttsAudio(parts[0], voice) : undefined;
  for (let i = 0; i < parts.length && gen === speakGen; i++) {
    const cur = next!;
    next = parts[i + 1] ? ttsAudio(parts[i + 1]!, voice) : undefined;
    next?.catch(() => undefined);
    const blob = await cur;
    if (gen !== speakGen) return;
    current?.pause();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    current = audio;
    try {
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve();
        audio.play().catch(() => resolve());
      });
    } finally {
      if (current === audio) current = null;
      URL.revokeObjectURL(url);
    }
  }
}

/** Putar berkas suara (mis. rekaman owner di public/sounds, DEC-126); selesai saat audio selesai / dihentikan. */
export async function playClip(url: string): Promise<void> {
  const gen = ++speakGen;
  current?.pause();
  const audio = new Audio(url);
  current = audio;
  try {
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.onpause = () => resolve();
      if (gen !== speakGen) return resolve();
      audio.play().catch(() => resolve());
    });
  } finally {
    if (current === audio) current = null;
  }
}

/** Pecah teks per kalimat menjadi potongan ≤ max karakter; kalimat yang terlalu panjang dipecah di koma/spasi. */
export function splitTts(text: string, max = 280): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const sentences = t.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [t];
  const out: string[] = [];
  let cur = '';
  const push = (s: string) => {
    if ((cur + s).trim().length <= max) cur += s;
    else {
      if (cur.trim()) out.push(cur.trim());
      cur = s;
    }
  };
  for (const s of sentences) {
    if (s.trim().length <= max) push(s);
    else for (const piece of s.split(/(?<=,)\s+/)) push(`${piece} `.length > max ? piece.slice(0, max) : `${piece} `);
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

