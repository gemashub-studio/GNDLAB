/**
 * Asisten suara kelapa (DEC-111): teks ucapan pengguna + konteks layar → rencana aksi (Groq, model gpt-oss-20b, mode JSON).
 * Aksi yang diizinkan HANYA: buka halaman dari daftar, klik tombol dari daftar yang dikirim browser (tanpa tombol hapus/keluar),
 * dan isi form yang sedang terbuka (teks perintah diteruskan ke pengurai suara form). Semua target divalidasi ulang di sini.
 */
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const ASSISTANT_MODEL = 'openai/gpt-oss-20b';
const TIMEOUT_MS = 20_000;

export interface AssistantContext {
  path: string;
  pages: { href: string; label: string }[];
  buttons: { id: string; text: string }[];
  /** Ada form pencatatan terbuka yang bisa diisi suara (judulnya). */
  form?: string;
  /** Nama kolom form yang bisa disebut. */
  formFields?: string[];
}

export type AssistantAction = { type: 'navigate'; target: string } | { type: 'click'; target: string } | { type: 'fill'; text: string };

export interface AssistantPlan {
  actions: AssistantAction[];
  reply: string;
}

export class AssistantError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function systemPrompt(ctx: AssistantContext): string {
  return [
    'Kamu asisten suara aplikasi GnD Lab (pencatatan data lab kelapa). Pengguna berbicara bahasa Indonesia santai.',
    'Ubah ucapan pengguna menjadi aksi aplikasi. Balas HANYA JSON: {"actions":[...],"reply":"..."}.',
    'Jenis aksi:',
    '- {"type":"navigate","target":"<href dari DAFTAR HALAMAN>"} untuk membuka halaman/menu.',
    '- {"type":"click","target":"<id dari DAFTAR TOMBOL>"} untuk menekan tombol / membuka form. Hanya id yang ada di daftar.',
    '- {"type":"fill","text":"<perintah isian>"} untuk mengisi form yang SEDANG TERBUKA. Format: "nomor <angka dalam kata>" untuk memilih nomor item (JANGAN pakai kata "item"), lalu "<nama kolom> <nilai>"; "next" untuk kolom berikutnya.',
    'Boleh beberapa aksi berurutan (mis. buka halaman lalu klik tombol). Bila halaman tujuan belum terbuka, navigate dulu lalu click; tombol di halaman tujuan biasanya: catat-new (+ Buat catatan baru), catat-akhir (Buat pencatatan data akhir), proto-new (+ Resep baru), lpj-new (laporan belanja baru).',
    'Untuk fill: masukkan SEMUA nilai yang diucapkan, satu pasangan "<nama kolom> <nilai>" per kolom, nama kolom persis dari daftar kolom form. Contoh:',
    '  "jumlah itemnya lima, perlakuannya green house sebanyak lima" → {"type":"fill","text":"jumlah item lima perlakuan green house jumlah produksi lima"} (kata "sebanyak/jumlahnya" setelah perlakuan = jumlah produksi)',
    '  "nomor dua berat awalnya seribu tiga puluh empat, tebalnya sepuluh" → {"type":"fill","text":"nomor dua berat awal seribu tiga puluh empat tebal daging sepuluh"}',
    '  "lanjut ke kolom berikutnya" → {"type":"fill","text":"next"}',
    '  "isi kolom perlakuan dengan oven gas" → {"type":"fill","text":"isi kolom perlakuan dengan oven gas"} (dropdown dipilih otomatis)',
    'Jangan pernah menghapus data atau keluar akun. Bila permintaan tidak jelas / tidak bisa, actions = [] dan jelaskan singkat di reply.',
    'reply = satu kalimat pendek ramah dalam bahasa Indonesia tentang apa yang dilakukan.',
    `HALAMAN SAAT INI: ${ctx.path}`,
    `DAFTAR HALAMAN: ${JSON.stringify(ctx.pages)}`,
    `DAFTAR TOMBOL (di layar sekarang): ${JSON.stringify(ctx.buttons)}`,
    ctx.form ? `FORM TERBUKA: ${ctx.form}. Kolom yang bisa disebut: ${JSON.stringify(ctx.formFields ?? [])}` : 'FORM TERBUKA: tidak ada (aksi fill tidak bisa dipakai kecuali setelah click membuka form).',
  ].join('\n');
}

/** Saring rencana dari model: hanya target yang ada di konteks (atau tombol halaman lab yang dikenal setelah navigate). */
export function sanitizePlan(raw: unknown, ctx: AssistantContext): AssistantPlan {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { actions?: unknown; reply?: unknown };
  const pages = new Set(ctx.pages.map((p) => p.href));
  const buttons = new Set(ctx.buttons.map((b) => b.id));
  const KNOWN = new Set(['catat-new', 'catat-akhir', 'proto-new', 'lpj-new']);
  const DANGER = /hapus|delete|del-|logout|keluar|sign-?out|remove|finish-ok|confirm-ok/i;
  const actions: AssistantAction[] = [];
  let navigated = false;
  for (const a of Array.isArray(o.actions) ? o.actions.slice(0, 6) : []) {
    const x = (a && typeof a === 'object' ? a : {}) as { type?: unknown; target?: unknown; text?: unknown };
    if (x.type === 'navigate' && typeof x.target === 'string' && pages.has(x.target)) {
      actions.push({ type: 'navigate', target: x.target });
      navigated = true;
    } else if (x.type === 'click' && typeof x.target === 'string' && !DANGER.test(x.target) && (buttons.has(x.target) || (navigated && KNOWN.has(x.target)))) {
      actions.push({ type: 'click', target: x.target });
    } else if (x.type === 'fill' && typeof x.text === 'string' && x.text.trim()) {
      actions.push({ type: 'fill', text: clip(x.text.trim(), 300) });
    }
  }
  const reply = typeof o.reply === 'string' && o.reply.trim() ? clip(o.reply.trim(), 200) : actions.length ? 'Siap, aku kerjakan.' : 'Maaf, aku belum paham. Coba ucapkan lagi ya.';
  return { actions, reply };
}

export async function planVoiceCommand(text: string, ctx: AssistantContext): Promise<AssistantPlan> {
  const key = process.env.GROQ_API_KEY ?? '';
  if (!key) throw new AssistantError(503, 'Asisten suara belum dikonfigurasi (GROQ_API_KEY belum diisi).');
  const q = text.trim().slice(0, 500);
  if (!q) return { actions: [], reply: 'Aku belum mendengar apa-apa.' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(ctx) },
          { role: 'user', content: q },
        ],
      }),
      signal: ctl.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (res.status === 429) throw new AssistantError(429, 'Batas pemakaian Groq tercapai. Tunggu sebentar lalu coba lagi.');
    if (!res.ok) throw new AssistantError(502, `Asisten gagal (${res.status})${body.error?.message ? `: ${clip(body.error.message, 160)}` : ''}.`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '{}');
    } catch {
      parsed = {};
    }
    return sanitizePlan(parsed, ctx);
  } catch (e) {
    if (e instanceof AssistantError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new AssistantError(504, 'Asisten terlalu lama menjawab. Coba lagi.');
    throw new AssistantError(502, 'Tidak bisa menghubungi layanan asisten.');
  } finally {
    clearTimeout(t);
  }
}
