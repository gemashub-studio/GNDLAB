/**
 * Tanya Lab AI lewat OpenRouter (DEC-123 → DEC-139): model gratis dicoba SATU PER SATU sesuai urutan (galat/limit/model
 * dicabut → model berikutnya); bila semua gagal, cadangan terakhir = Groq (kunci GROQ_API_KEY… yang sudah dipakai suara).
 * Kunci OPEN_ROUTER_APIKEY hanya dibaca di server. OPEN_ROUTER_MODEL (opsional) = model pilihan owner, dicoba paling dulu.
 * Riwayat singkat percakapan (pesan-pesan terakhir) ikut dikirim agar AI ingat konteks.
 */
import { LAB_AI_SYSTEM, MAX_PROMPT } from '@/lib/labAi';
import { groqFetch, groqKeys } from './groq';
import { filterAnswer } from './labAiFilter';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
/**
 * Model gratis OpenRouter (dicek 2026-10-23; `minimax/minimax-m3.1-flash:free` dicabut 22 Okt → penyebab 404
 * "Provider returned error"); urutan = prioritas. `openrouter/free` = router OpenRouter ke model gratis mana pun yang tersedia.
 */
export const OR_FREE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-31b-it:free',
  'thinkingmachines/inkling-small:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'openrouter/free',
];
/** Cadangan terakhir bila semua model OpenRouter gagal. */
export const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
/** Batas waktu satu percobaan model (detik total dibatasi `timeoutMs`). */
const ATTEMPT_MS = 20_000;
export const HISTORY_MAX = 8;
const HISTORY_CHARS = 1500;

export class LabAiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export function orModels(env: Record<string, string | undefined> = process.env): string[] {
  const pick = env.OPEN_ROUTER_MODEL?.trim();
  return pick ? [pick, ...OR_FREE_MODELS.filter((m) => m !== pick)] : OR_FREE_MODELS;
}

/** Bersihkan riwayat kiriman klien: hanya peran user/assistant, teks dipotong, maks. HISTORY_MAX pesan terakhir. */
export function cleanHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is ChatTurn => !!m && typeof m === 'object' && ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') && typeof (m as ChatTurn).content === 'string' && !!(m as ChatTurn).content.trim())
    .slice(-HISTORY_MAX)
    .map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }));
}

export function labMessages(prompt: string, history: readonly ChatTurn[], system = LAB_AI_SYSTEM) {
  return [{ role: 'system' as const, content: system }, ...history, { role: 'user' as const, content: prompt.slice(0, MAX_PROMPT) }];
}

type Completion = { model?: string; choices?: { message?: { content?: unknown } }[]; error?: { message?: string } };
type Attempt = { ok: true; text: string; model: string } | { ok: false; status: number; msg: string };

/** Satu permintaan chat (format OpenAI) dengan batas waktu sendiri; tidak pernah melempar galat. */
async function tryChat(send: (signal: AbortSignal) => Promise<Response>, model: string, ms: number): Promise<Attempt> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await send(ctl.signal);
    const j = (await res.json().catch(() => ({}))) as Completion;
    const text = typeof j.choices?.[0]?.message?.content === 'string' ? j.choices[0].message.content.trim() : '';
    if (res.ok && text) return { ok: true, text, model: j.model ?? model };
    return { ok: false, status: res.ok ? 502 : res.status, msg: j.error?.message ?? (res.ok ? 'jawaban kosong' : '') };
  } catch (e) {
    return { ok: false, status: e instanceof DOMException && e.name === 'AbortError' ? 504 : 502, msg: e instanceof DOMException && e.name === 'AbortError' ? 'terlalu lama' : 'tidak bisa dihubungi' };
  } finally {
    clearTimeout(t);
  }
}

export async function askOpenRouter(
  prompt: string,
  history: readonly ChatTurn[] = [],
  o: { system?: string; env?: Record<string, string | undefined>; fetcher?: typeof fetch; groqFetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ text: string; model: string }> {
  const env = o.env ?? process.env;
  const key = env.OPEN_ROUTER_APIKEY?.trim();
  const gKeys = groqKeys(env);
  if (!key && !gKeys.length) throw new LabAiError(503, 'Kunci OpenRouter (OPEN_ROUTER_APIKEY) belum diisi.');
  const q = prompt.trim();
  if (!q) throw new LabAiError(400, 'Tulis pertanyaan dulu.');
  const messages = labMessages(q, history, o.system);
  const deadline = Date.now() + (o.timeoutMs ?? 45_000);
  const left = () => Math.min(ATTEMPT_MS, deadline - Date.now());
  const fails: Attempt[] = [];
  let hit: { text: string; model: string } | undefined;

  // 1. OpenRouter: model gratis satu per satu
  if (key) {
    for (const model of orModels(env)) {
      if (left() < 2_000) break;
      const r = await tryChat(
        (signal) =>
          (o.fetcher ?? fetch)(OPENROUTER_URL, {
            method: 'POST',
            signal,
            headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'GnD Lab' },
            // penalaran disembunyikan & dibuat ringan agar kuota token terpakai untuk jawaban
            body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 3000, reasoning: { effort: 'low', exclude: true } }),
          }),
        model,
        left(),
      );
      if (r.ok) {
        hit = r;
        break;
      }
      fails.push(r);
      console.warn(`[lab-ai] ${model} gagal (${r.status}${r.msg ? `: ${r.msg.slice(0, 120)}` : ''}) → model berikutnya`);
      if (r.status === 401) break; // kunci OpenRouter ditolak → langsung ke Groq
    }
  }
  // 2. cadangan terakhir: Groq
  if (!hit && gKeys.length) {
    for (const model of GROQ_FALLBACK_MODELS) {
      if (left() < 2_000) break;
      const r = await tryChat(
        (signal) =>
          groqFetch(GROQ_CHAT_URL, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 3000, reasoning_effort: 'low' }) }, gKeys, o.groqFetcher ?? fetch),
        model,
        left(),
      );
      if (r.ok) {
        hit = { text: r.text, model: `groq/${r.model}` };
        break;
      }
      fails.push(r);
      console.warn(`[lab-ai] groq ${model} gagal (${r.status}) → cadangan berikutnya`);
    }
  }
  if (!hit) {
    const last = fails.at(-1) as Extract<Attempt, { ok: false }> | undefined;
    if (!last || last.status === 504) throw new LabAiError(504, 'AI terlalu lama menjawab. Coba lagi.');
    if (fails.some((f) => !f.ok && f.status === 429)) throw new LabAiError(429, 'Kuota AI gratis sedang penuh. Coba lagi sebentar lagi.');
    throw new LabAiError(502, `AI tidak memberi jawaban (${last.status}${last.msg ? `: ${last.msg.slice(0, 160)}` : ''}).`);
  }
  // saring kata/kalimat melantur dari model gratis (DEC-125)
  return { text: await filterAnswer(q, hit.text, { keys: gKeys, fetcher: o.groqFetcher }), model: hit.model };
}
