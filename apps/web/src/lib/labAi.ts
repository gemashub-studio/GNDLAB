/**
 * Tanya Lab AI (DEC-087): GET ke api.siputzx.my.id (GLM-4.7 Flash) sesuai permintaan owner.
 * Yang dikirim HANYA teks yang diketik pengguna + system prompt di bawah. Jawaban = keluaran AI (belum diverifikasi).
 */
export const LAB_AI_ENDPOINT = 'https://api.siputzx.my.id/api/ai/glm47flash';
export const LAB_AI_SYSTEM = 'kamu adalah peneliti laboratorium dan ahli dengan produk briket dan olahan kelapa lainnya.';
export const MAX_PROMPT = 2000;

export function labAiUrl(prompt: string): string {
  const u = new URL(LAB_AI_ENDPOINT);
  u.searchParams.set('prompt', prompt.slice(0, MAX_PROMPT));
  u.searchParams.set('system', LAB_AI_SYSTEM);
  u.searchParams.set('temperature', '0.7');
  return u.toString();
}

/** Ambil teks jawaban dari berbagai bentuk respons ({data:"…"}, {data:{response|content|message|text}}, {result}, {response}, …). */
export function aiText(j: unknown): string | undefined {
  const pick = (v: unknown, depth = 0): string | undefined => {
    if (typeof v === 'string') return v.trim() || undefined;
    if (!v || typeof v !== 'object' || depth > 3) return undefined;
    const o = v as Record<string, unknown>;
    for (const k of ['response', 'content', 'message', 'text', 'answer', 'result', 'output', 'data', 'reply']) {
      const hit = pick(o[k], depth + 1);
      if (hit) return hit;
    }
    if (Array.isArray(o.choices)) return pick((o.choices[0] as Record<string, unknown> | undefined)?.message, depth + 1) ?? pick(o.choices[0], depth + 1);
    return undefined;
  };
  if (j && typeof j === 'object' && (j as { status?: unknown }).status === false) return undefined;
  return pick(j);
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
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Susun prompt akhir dari ketikan pengguna: topik @… → konteks, /perintah → instruksi, tingkat jawaban → panjang. */
export function buildLabPrompt(text: string, effort = 'Sedang'): string {
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
  body = body.replace(/[ \t]{2,}/g, ' ').trim();
  return [topics.length ? `Topik: ${topics.join(', ')}.` : '', instructions.join(' '), body].filter(Boolean).join('\n');
}

export async function askLabAI(prompt: string, timeoutMs = 45_000, signal?: AbortSignal): Promise<string> {
  const q = prompt.trim();
  if (!q) throw new Error('Tulis pertanyaan dulu.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  // tombol Stop di kolom tanya membatalkan permintaan
  const onStop = () => ctl.abort();
  signal?.addEventListener('abort', onStop);
  try {
    const res = await fetch(labAiUrl(q), { method: 'GET', signal: ctl.signal, cache: 'no-store' });
    const body: unknown = await res.json().catch(() => undefined);
    const text = aiText(body);
    if (!res.ok || !text) {
      const msg = body && typeof body === 'object' ? String((body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message ?? '') : '';
      throw new Error(res.status >= 500 ? `Layanan AI sedang tidak tersedia (${res.status}${msg ? `: ${msg}` : ''}). Coba lagi sebentar lagi.` : `AI tidak memberi jawaban (${res.status}${msg ? `: ${msg}` : ''}).`);
    }
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
