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

export async function askLabAI(prompt: string, timeoutMs = 45_000): Promise<string> {
  const q = prompt.trim();
  if (!q) throw new Error('Tulis pertanyaan dulu.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
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
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('AI terlalu lama menjawab. Coba lagi.');
    if (e instanceof TypeError) throw new Error('Tidak bisa menghubungi layanan AI. Periksa koneksi internet.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Sambutan saat membuka GnD Lab (lokal, tanpa memanggil AI). */
export function labGreeting(username?: string, now = new Date()): string {
  const h = now.getHours();
  const waktu = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
  return `Selamat ${waktu}${username ? `, ${username}` : ''}! Selamat datang di GnD Lab. Aku asisten lab untuk briket, kopra, cuka, bio leather, dan olahan kelapa lainnya — tanya apa saja di sini.`;
}

export const CATAT_HINT = 'kamu mau buat pencatatan data baru? aku bisa bantu kapan pun kamu mau!';
