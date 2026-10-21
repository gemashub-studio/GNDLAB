/**
 * Tanya Lab AI lewat OpenRouter (DEC-123): model gratis dengan cadangan otomatis (parameter `models` OpenRouter →
 * model berikutnya dipakai bila yang pertama limit/galat). Kunci OPEN_ROUTER_APIKEY hanya dibaca di server.
 * OPEN_ROUTER_MODEL (opsional) = model pilihan owner, dicoba paling dulu.
 * Riwayat singkat percakapan (pesan-pesan terakhir) ikut dikirim agar AI ingat konteks.
 */
import { LAB_AI_SYSTEM, MAX_PROMPT } from '@/lib/labAi';
import { groqKeys } from './groq';
import { filterAnswer } from './labAiFilter';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** Model gratis (daftar OpenRouter per 2026-10-21); urutan = prioritas. */
export const OR_FREE_MODELS = ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'minimax/minimax-m3.1-flash:free'];
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

export async function askOpenRouter(
  prompt: string,
  history: readonly ChatTurn[] = [],
  o: { system?: string; env?: Record<string, string | undefined>; fetcher?: typeof fetch; groqFetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ text: string; model: string }> {
  const env = o.env ?? process.env;
  const key = env.OPEN_ROUTER_APIKEY?.trim();
  if (!key) throw new LabAiError(503, 'Kunci OpenRouter (OPEN_ROUTER_APIKEY) belum diisi.');
  const q = prompt.trim();
  if (!q) throw new LabAiError(400, 'Tulis pertanyaan dulu.');
  const models = orModels(env);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), o.timeoutMs ?? 45_000);
  try {
    const res = await (o.fetcher ?? fetch)(OPENROUTER_URL, {
      method: 'POST',
      signal: ctl.signal,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'GnD Lab' },
      body: JSON.stringify({ model: models[0], models, messages: labMessages(q, history, o.system), temperature: 0.4, max_tokens: 1400 }),
    });
    const j = (await res.json().catch(() => ({}))) as { model?: string; choices?: { message?: { content?: unknown } }[]; error?: { message?: string } };
    const text = typeof j.choices?.[0]?.message?.content === 'string' ? j.choices[0].message.content.trim() : '';
    if (!res.ok || !text) {
      const msg = j.error?.message ?? '';
      if (res.status === 429) throw new LabAiError(429, 'Kuota AI gratis sedang penuh. Coba lagi sebentar lagi.');
      throw new LabAiError(res.status >= 400 ? (res.status >= 500 ? 502 : res.status) : 502, `AI tidak memberi jawaban (${res.status}${msg ? `: ${msg.slice(0, 160)}` : ''}).`);
    }
    // saring kata/kalimat melantur dari model gratis (DEC-125)
    return { text: await filterAnswer(q, text, { keys: groqKeys(env), fetcher: o.groqFetcher }), model: j.model ?? models[0]! };
  } catch (e) {
    if (e instanceof LabAiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new LabAiError(504, 'AI terlalu lama menjawab. Coba lagi.');
    throw new LabAiError(502, 'Layanan AI tidak bisa dihubungi.');
  } finally {
    clearTimeout(t);
  }
}
