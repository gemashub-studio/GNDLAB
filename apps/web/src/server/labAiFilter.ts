/**
 * Saring jawaban Lab AI (DEC-125). Model gratis OpenRouter kadang "melantur": kalimat bahasa Inggris acak
 * ("Could you clarify…", "You have 9760.keys…"), kredit/tanda tangan ("Created by: FaMan69®"), huruf kapital-kecil
 * Unicode ("ᴇᴀʀᴘʏ"), atau sisipan kata asing tak bermakna di tengah kalimat. Dua lapis:
 *   1. scrubAnswer — aturan cepat: buang kalimat/baris sampah yang jelas.
 *   2. cleanWithGroq — penyunting (Groq gpt-oss-20b) membuang kata/frasa aneh di luar konteks pertanyaan TANPA
 *      menambah informasi / mengubah angka. Gagal / hasil mencurigakan → pakai hasil lapis 1.
 */
import { groqFetch, groqKeys } from './groq';

const JUNK: RegExp[] = [
  /\byou have \d[\d.,]*\s*\.?\s*keys?\b/i,
  /\.keys\b/i,
  /\bcould you (please )?clarify\b/i,
  /\bcreated by\s*:/i,
  /\bpowered by\b/i,
  /[®™©]/,
  /\btunggu,?\s*typo\b/i,
  /[ᴀ-ᵿɐ-ʯ]{2,}/,
  /\b(as an ai( language model)?|i'?m sorry|i cannot|let me know|feel free to ask)\b/i,
  /\b(what you'?d like to know|how can i help)\b/i,
];
/** Potongan sampah yang dibuang sampai akhir baris (sebelum dipecah per kalimat, karena bisa memuat titik). */
const STRIP: RegExp[] = [
  /\byou have \d[\d.,]*\s*\.?\s*keys?\b[^\n]*/gi,
  /\bcreated by\s*:[^\n]*/gi,
  /\btunggu,?\s*typo\b[^\n]*/gi,
  /\S*[®™©][^\n]*/g,
  /[^\s.!?]*[ᴀ-ᵿɐ-ʯ]{2,}[^\n]*/g,
];
const EN = new Set('the you your what would like know have has could should please sorry wait here there which this that with for and of to is are was were be been it its i me my we our they them can will just about how if or not do does did an a so'.split(' '));
const ID = new Set('yang dan di ke dari untuk dengan adalah ini itu atau pada dalam juga agar karena bisa akan tidak ada lebih serta oleh sebagai bila jika saat kamu anda kita kami'.split(' '));

/** Kalimat (hampir) seluruhnya bahasa Inggris, tanpa kata penghubung Indonesia. */
export function isEnglishSentence(s: string): boolean {
  const w = s.toLowerCase().match(/[a-z']+/g) ?? [];
  const en = w.filter((x) => EN.has(x)).length;
  const id = w.filter((x) => ID.has(x)).length;
  return en >= 3 && id === 0;
}

const isJunk = (s: string) => JUNK.some((r) => r.test(s)) || isEnglishSentence(s);

/** Lapis 1: buang baris & kalimat sampah; struktur paragraf/daftar dipertahankan. */
export function scrubAnswer(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (const raw of lines) {
    const line = STRIP.reduce((t, r) => t.replace(r, ''), raw);
    if (!line.trim()) {
      if (!raw.trim()) out.push('');
      continue;
    }
    // per kalimat (tanda baca akhir dipertahankan); awalan daftar/judul ikut kalimat pertama
    const parts = line.match(/[^.!?…]+(?:[.!?…]+|$)\s*/g) ?? [line];
    const keep = parts.filter((p) => !isJunk(p));
    const joined = keep.join('').replace(/\s+$/, '');
    if (joined.trim() && !/^[\s\-*•#>\d.)]*$/.test(joined)) out.push(joined);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const CLEAN_MODEL = 'openai/gpt-oss-20b';
const CLEAN_SYSTEM = [
  'Kamu penyunting jawaban AI berbahasa Indonesia untuk aplikasi lab olahan kelapa.',
  'Tugas: bersihkan jawaban dari kata, frasa, atau kalimat yang aneh, acak, tidak bermakna, salah ketik parah, sisipan bahasa Inggris yang tidak perlu (mis. "dapatlever (leveraged)", "dan-processing lethally injurious?"), tanda tangan/kredit (mis. "Created by …"), atau di luar konteks pertanyaan.',
  'Rapikan kalimat yang terpotong agar wajar. JANGAN menambah informasi baru, JANGAN mengubah angka, satuan, atau istilah teknis yang benar.',
  'Pertahankan format (paragraf, daftar bernomor/berpoin, huruf tebal markdown, emoji yang wajar). Balas HANYA teks jawaban yang sudah bersih, tanpa komentar.',
].join(' ');

/** Lapis 2: penyunting Groq. Mengembalikan undefined bila gagal / hasilnya mencurigakan (terlalu pendek). */
export async function cleanWithGroq(question: string, answer: string, o: { fetcher?: typeof fetch; keys?: string[]; timeoutMs?: number } = {}): Promise<string | undefined> {
  const keys = o.keys ?? groqKeys();
  if (!keys.length || !answer.trim()) return undefined;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), o.timeoutMs ?? 12_000);
  try {
    const res = await groqFetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: CLEAN_MODEL,
          temperature: 0,
          reasoning_effort: 'low',
          max_tokens: 3000,
          messages: [
            { role: 'system', content: CLEAN_SYSTEM },
            { role: 'user', content: `Pertanyaan pengguna:\n${question.slice(0, 1200)}\n\nJawaban yang harus dibersihkan:\n${answer.slice(0, 6000)}` },
          ],
        }),
      },
      keys,
      o.fetcher,
    );
    if (!res.ok) return undefined;
    const j = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: unknown } }[] };
    const out = typeof j.choices?.[0]?.message?.content === 'string' ? j.choices[0].message.content.trim() : '';
    // pengaman: penyunting tidak boleh memangkas lebih dari separuh isi
    if (!out || out.length < answer.length * 0.5) return undefined;
    return out;
  } catch {
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

/** Saring lengkap: aturan → penyunting → aturan sekali lagi (jaga-jaga). */
export async function filterAnswer(question: string, answer: string, o: Parameters<typeof cleanWithGroq>[2] = {}): Promise<string> {
  const first = scrubAnswer(answer) || answer.trim();
  const edited = await cleanWithGroq(question, first, o);
  return (edited ? scrubAnswer(edited) : '') || first;
}
