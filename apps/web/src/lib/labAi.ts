/**
 * Tanya Lab AI (DEC-087 → DEC-123): pertanyaan dikirim ke /api/lab-ai (OpenRouter, model gratis; kunci di server).
 * Yang dikirim HANYA teks pertanyaan + beberapa pesan terakhir (memori) + system prompt. Jawaban = keluaran AI (belum diverifikasi).
 */
export const LAB_AI_SYSTEM =
  'Kamu adalah peneliti laboratorium dan ahli briket, kopra, cuka air kelapa, bio leather, dan olahan kelapa lainnya. Jawab dalam bahasa Indonesia yang ramah dan jelas. Paragraf pertama selalu jawaban inti yang singkat dan langsung. Tetap pada topik pertanyaan; jangan menulis teks acak, kalimat bahasa Inggris, tanda tangan, atau kredit.';
export const MAX_PROMPT = 2000;

/** Memori percakapan (DEC-123): pesan-pesan terakhir disimpan di perangkat dan ikut dikirim pada pertanyaan berikutnya, juga di percakapan baru. */
export const MEMORY_KEY = 'gnd-labai:memory';
export const MEMORY_MAX = 8;
export type LabTurn = { role: 'user' | 'assistant'; content: string };

export function loadMemory(): LabTurn[] {
  try {
    const v = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as LabTurn[]).filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string').slice(-MEMORY_MAX) : [];
  } catch {
    return [];
  }
}

/** Tambahkan satu tanya-jawab ke memori (teks dipotong agar ringkas), simpan maks. MEMORY_MAX pesan terakhir. */
export function remember(memory: readonly LabTurn[], question: string, answer: string): LabTurn[] {
  const next = [...memory, { role: 'user' as const, content: question.slice(0, 800) }, { role: 'assistant' as const, content: answer.slice(0, 1500) }].slice(-MEMORY_MAX);
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {
    // penyimpanan diblokir → memori hanya untuk sesi ini
  }
  return next;
}

/** Topik (@) dan perintah (/) di kolom tanya, serta tingkat jawaban (DEC-094). */
export const LAB_TOPICS = [
  { key: 'briket', name: 'Briket', description: 'Briket arang batok & tempurung' },
  { key: 'kopra', name: 'Kopra', description: 'Pengeringan daging kelapa' },
  { key: 'cuka', name: 'Cuka', description: 'Fermentasi air kelapa' },
  { key: 'bioleather', name: 'Bio leather', description: 'Selulosa hasil fermentasi' },
  { key: 'pencatatan', name: 'Pencatatan data', description: 'Data awal, akhir & perlakuan' },
] as const;
export const LAB_COMMANDS = [
  { key: 'jelaskan', name: '/jelaskan', description: 'Penjelasan sederhana', instruction: 'Jelaskan dengan bahasa sederhana.' },
  { key: 'langkah', name: '/langkah', description: 'Urutan langkah kerja', instruction: 'Jawab dalam bentuk langkah-langkah bernomor.' },
  { key: 'bandingkan', name: '/bandingkan', description: 'Bandingkan dua pilihan', instruction: 'Bandingkan pilihan yang disebut, sertakan kelebihan dan kekurangannya.' },
  { key: 'ringkas', name: '/ringkas', description: 'Rangkum poin penting', instruction: 'Rangkum poin-poin penting secara singkat.' },
  { key: 'cek', name: '/cek', description: 'Cek kewajaran angka', instruction: 'Periksa apakah angka atau data yang disebut masuk akal dan jelaskan alasannya.' },
] as const;
export const LAB_EFFORTS = ['Singkat', 'Sedang', 'Lengkap', 'Mendalam'];
const EFFORT_HINT: Record<string, string> = {
  Singkat: 'Jawab singkat, maksimal 3 kalimat.',
  Sedang: '',
  Lengkap: 'Jawab lengkap dengan beberapa paragraf.',
  Mendalam: 'Jawab mendalam dan rinci, sertakan alasan dan hal yang perlu diperhatikan.',
};

/** Emoji ramah untuk pertanyaan penutup jawaban mode Mendalam (DEC-096). */
export const FRIENDLY_EMOJI = ['😊', '🌱', '🥥', '🔥', '✨', '🙌', '🧪', '💡', '👍', '🌿', '😄', '🤝'];
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Susun prompt akhir dari ketikan pengguna: topik @… → konteks, /perintah → instruksi, tingkat jawaban → panjang. */
export function buildLabPrompt(text: string, effort = 'Sedang', rand: () => number = Math.random): string {
  let body = text.trim();
  const topics: string[] = [];
  for (const t of LAB_TOPICS) {
    // hanya @topik di awal teks / setelah spasi (bukan alamat email seperti a@kopra.id)
    const re = new RegExp(`(^|\\s)@${escRe(t.name).replace(/\s+/g, '\\s+')}(?![\\w])`, 'gi');
    if (re.test(body)) {
      topics.push(t.name);
      body = body.replace(re, `$1${t.name}`);
    }
  }
  const instructions: string[] = [];
  for (const c of LAB_COMMANDS) {
    const re = new RegExp(`(^|\\s)${escRe(c.name)}(?=\\s|$)`, 'gi');
    if (re.test(body)) {
      instructions.push(c.instruction);
      body = body.replace(re, ' ');
    }
  }
  const hint = EFFORT_HINT[effort] ?? '';
  if (hint) instructions.push(hint);
  // mode Mendalam: selalu akhiri dengan satu pertanyaan lanjutan yang ramah + emoji acak (DEC-096)
  if (effort === 'Mendalam') instructions.push(`Selalu akhiri jawaban dengan satu pertanyaan lanjutan yang ramah untuk pengguna, ditutup emoji ${FRIENDLY_EMOJI[Math.floor(rand() * FRIENDLY_EMOJI.length)]}.`);
  body = body.replace(/[ \t]{2,}/g, ' ').trim();
  return [topics.length ? `Topik: ${topics.join(', ')}.` : '', instructions.join(' '), body].filter(Boolean).join('\n');
}

/** Tambahkan teks hasil scan foto (OCR) ke prompt, dibatasi agar tetap di bawah batas panjang (DEC-095). */
export function withOcrText(prompt: string, texts: readonly string[]): string {
  if (!texts.length) return prompt;
  const room = Math.max(200, MAX_PROMPT - prompt.length - 40);
  const joined = texts.map((t, i) => (texts.length > 1 ? `[Foto ${i + 1}]\n${t}` : t)).join('\n\n').slice(0, room);
  return `${prompt}\n\nTeks hasil scan foto:\n${joined}`;
}

export async function askLabAI(prompt: string, timeoutMs = 60_000, signal?: AbortSignal, o: { memory?: boolean } = {}): Promise<string> {
  const q = prompt.trim();
  if (!q) throw new Error('Tulis pertanyaan dulu.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  // tombol Stop di kolom tanya membatalkan permintaan
  const onStop = () => ctl.abort();
  signal?.addEventListener('abort', onStop);
  const useMemory = o.memory !== false;
  const history = useMemory ? loadMemory() : [];
  try {
    const { authHeader } = await import('./voiceClient');
    const res = await fetch('/api/lab-ai', { method: 'POST', signal: ctl.signal, cache: 'no-store', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ prompt: q.slice(0, MAX_PROMPT), history }) });
    const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    const text = j.text?.trim();
    if (!res.ok || !text) throw new Error(j.error ?? (res.status >= 500 ? `Layanan AI sedang tidak tersedia (${res.status}). Coba lagi sebentar lagi.` : `AI tidak memberi jawaban (${res.status}).`));
    if (useMemory) remember(history, q, text);
    return text;
  } catch (e) {
    if (signal?.aborted) throw new Error('Dihentikan.');
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('AI terlalu lama menjawab. Coba lagi.');
    if (e instanceof TypeError) throw new Error('Tidak bisa menghubungi layanan AI. Periksa koneksi internet.');
    throw e;
  } finally {
    clearTimeout(t);
    signal?.removeEventListener('abort', onStop);
  }
}

/** Sambutan saat membuka GnD Lab (lokal, tanpa memanggil AI). */
export function labGreeting(username?: string, now = new Date()): string {
  const h = now.getHours();
  const waktu = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
  return `Selamat ${waktu}${username ? `, ${username}` : ''}! Selamat datang di GnD Lab. Aku asisten lab untuk briket, kopra, cuka, bio leather, dan olahan kelapa lainnya — tanya apa saja di sini.`;
}

export const CATAT_HINT = 'kamu mau buat pencatatan data baru? aku bisa bantu kapan pun kamu mau!';

/**
 * Pecah jawaban AI menjadi kartu berisi maks. `perCard` paragraf (DEC-093). Paragraf = blok teks dipisah baris kosong;
 * blok yang sangat panjang dipecah per kalimat (±`maxChars` karakter) agar satu kartu tidak terlalu panjang.
 */
export function answerCards(text: string, perCard = 2, maxChars = 420): string[][] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const paras: string[] = [];
  for (const b of blocks) {
    if (b.length <= maxChars || b.includes('\n')) {
      paras.push(b);
      continue;
    }
    // pecah per kalimat
    let cur = '';
    for (const s of b.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [b]) {
      if (cur && (cur + s).length > maxChars) {
        paras.push(cur.trim());
        cur = '';
      }
      cur += s;
    }
    if (cur.trim()) paras.push(cur.trim());
  }
  const cards: string[][] = [];
  for (let i = 0; i < paras.length; i += perCard) cards.push(paras.slice(i, i + perCard));
  return cards.length ? cards : [[text.trim()]];
}
