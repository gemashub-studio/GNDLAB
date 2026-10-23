import { describe, expect, it } from 'vitest';
import { CATAT_HINT, LAB_AI_SYSTEM, labGreeting, loadMemory, remember } from '@/lib/labAi';
import { emailSlug } from '@/lib/useAuth';

describe('Tanya Lab AI & username (DEC-087)', () => {
  it('OpenRouter (DEC-123): model gratis + cadangan, OPEN_ROUTER_MODEL dicoba dulu; pesan = system + riwayat + pertanyaan', async () => {
    const { askOpenRouter, cleanHistory, labMessages, orModels, OR_FREE_MODELS } = await import('@/server/labAi');
    expect(LAB_AI_SYSTEM).toContain('briket');
    expect(OR_FREE_MODELS.every((m) => m.endsWith(':free') || m === 'openrouter/free')).toBe(true);
    expect(OR_FREE_MODELS).not.toContain('minimax/minimax-m3.1-flash:free'); // dicabut 2026-10-22 (DEC-139)
    expect(orModels({})).toEqual(OR_FREE_MODELS);
    expect(orModels({ OPEN_ROUTER_MODEL: 'x/y' })[0]).toBe('x/y');
    const hist = cleanHistory([{ role: 'system', content: 'jahat' }, ...Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })), { role: 'user', content: '  ' }]);
    expect(hist).toHaveLength(8);
    expect(hist.map((m) => m.content)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11']);
    expect(labMessages('apa itu kopra?', hist.slice(-2)).map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    let sent: { url: string; body: { model: string; models?: string[]; messages: { role: string; content: string }[] }; auth: string } | undefined;
    const fetcher = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).authorization! };
      return new Response(JSON.stringify({ model: 'google/gemma-4-31b-it:free', choices: [{ message: { content: ' Kopra adalah daging kelapa kering. ' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await askOpenRouter('apa itu kopra?', [{ role: 'user', content: 'halo' }, { role: 'assistant', content: 'hai' }], { env: { OPEN_ROUTER_APIKEY: 'k' }, fetcher });
    expect(out.text).toBe('Kopra adalah daging kelapa kering.');
    expect(sent!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(sent!.auth).toBe('Bearer k');
    expect(sent!.body.model).toBe(OR_FREE_MODELS[0]);
    expect(sent!.body.models).toBeUndefined();
    expect(sent!.body.messages.map((m) => m.content)).toEqual([LAB_AI_SYSTEM, 'halo', 'hai', 'apa itu kopra?']);
    await expect(askOpenRouter('x', [], { env: {} })).rejects.toThrow(/OPEN_ROUTER_APIKEY/);
    const limit = (async () => new Response(JSON.stringify({ error: { message: 'rate' } }), { status: 429 })) as unknown as typeof fetch;
    await expect(askOpenRouter('x', [], { env: { OPEN_ROUTER_APIKEY: 'k' }, fetcher: limit })).rejects.toThrow(/Kuota AI gratis/);
  });
  it('DEC-139: model gagal (404 dicabut / jawaban kosong) → model berikutnya; semua OpenRouter gagal → Groq', async () => {
    const { askOpenRouter, OR_FREE_MODELS, GROQ_FALLBACK_MODELS } = await import('@/server/labAi');
    const tried: string[] = [];
    const or = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model as string;
      tried.push(m);
      if (m === OR_FREE_MODELS[0]) return new Response(JSON.stringify({ error: { message: 'Provider returned error' } }), { status: 404 });
      if (m === OR_FREE_MODELS[1]) return new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 });
      return new Response(JSON.stringify({ model: m, choices: [{ message: { content: 'Briket dari arang batok.' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const a = await askOpenRouter('apa itu briket?', [], { env: { OPEN_ROUTER_APIKEY: 'k' }, fetcher: or });
    expect(a).toEqual({ text: 'Briket dari arang batok.', model: OR_FREE_MODELS[2] });
    expect(tried).toEqual(OR_FREE_MODELS.slice(0, 3));

    const dead = (async () => new Response(JSON.stringify({ error: { message: 'Provider returned error' } }), { status: 404 })) as unknown as typeof fetch;
    const groqSeen: { url: string; model: string; auth: string }[] = [];
    const groq = (async (u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      groqSeen.push({ url: u, model: b.model, auth: (init.headers as Record<string, string>).authorization! });
      // penyunting jawaban (labAiFilter) juga lewat Groq → kembalikan teks yang sama
      if (b.model === GROQ_FALLBACK_MODELS[0]) return new Response(JSON.stringify({ model: b.model, choices: [{ message: { content: 'Jawaban dari Groq.' } }] }), { status: 200 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Jawaban dari Groq.' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const g = await askOpenRouter('apa itu briket?', [], { env: { OPEN_ROUTER_APIKEY: 'k', GROQ_API_KEY: 'g' }, fetcher: dead, groqFetcher: groq });
    expect(g).toEqual({ text: 'Jawaban dari Groq.', model: `groq/${GROQ_FALLBACK_MODELS[0]}` });
    expect(groqSeen[0]).toEqual({ url: 'https://api.groq.com/openai/v1/chat/completions', model: GROQ_FALLBACK_MODELS[0], auth: 'Bearer g' });

    // tanpa kunci Groq & semua model OpenRouter mati → pesan galat terakhir diteruskan
    await expect(askOpenRouter('x', [], { env: { OPEN_ROUTER_APIKEY: 'k' }, fetcher: dead })).rejects.toThrow('AI tidak memberi jawaban (404: Provider returned error).');
    // kunci OpenRouter ditolak (401) → tidak mencoba model lain, langsung Groq
    const n: string[] = [];
    const denied = (async (_u: string, init: RequestInit) => (n.push(JSON.parse(String(init.body)).model), new Response('{}', { status: 401 }))) as unknown as typeof fetch;
    expect((await askOpenRouter('x', [], { env: { OPEN_ROUTER_APIKEY: 'k', GROQ_API_KEY: 'g' }, fetcher: denied, groqFetcher: groq })).model).toBe(`groq/${GROQ_FALLBACK_MODELS[0]}`);
    expect(n).toHaveLength(1);
  });
  it('memori: maks. 8 pesan terakhir disimpan di perangkat', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    let m = loadMemory();
    expect(m).toEqual([]);
    for (let i = 0; i < 6; i++) m = remember(m, `q${i}`, `a${i}`);
    expect(loadMemory()).toHaveLength(8);
    expect(loadMemory()[0]).toEqual({ role: 'user', content: 'q2' });
    expect(loadMemory().at(-1)).toEqual({ role: 'assistant', content: 'a5' });
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  it('sambutan & pesan otomatis pencatatan', () => {
    expect(labGreeting('masciosa', new Date(2026, 9, 16, 8))).toMatch(/^Selamat pagi, masciosa! Selamat datang di GnD Lab/);
    expect(labGreeting(undefined, new Date(2026, 9, 16, 20))).toMatch(/^Selamat malam! /);
    expect(CATAT_HINT).toBe('kamu mau buat pencatatan data baru? aku bisa bantu kapan pun kamu mau!');
  });
  it('username = slug email', () => {
    expect(emailSlug('masciosa@gmail.com')).toBe('masciosa');
    expect(emailSlug('Budi.Santoso+lab@x.co')).toBe('budi-santoso-lab');
    expect(emailSlug('@x.com')).toBe('pengguna');
  });
});

describe('jawaban AI sebagai kartu & email pengingat (DEC-093)', () => {
  it('maks. 2 paragraf per kartu; paragraf sangat panjang dipecah per kalimat', async () => {
    const { answerCards } = await import('@/lib/labAi');
    expect(answerCards('A1.\n\nB2.\n\nC3.\n\nD4.\n\nE5.')).toEqual([['A1.', 'B2.'], ['C3.', 'D4.'], ['E5.']]);
    expect(answerCards('Satu paragraf saja.')).toEqual([['Satu paragraf saja.']]);
    const long = Array.from({ length: 12 }, (_, i) => `Kalimat nomor ${i + 1} tentang briket kelapa yang cukup panjang.`).join(' ');
    const cards = answerCards(long, 2, 200);
    expect(cards.flat().every((p) => p.length <= 260)).toBe(true);
    expect(cards.every((c) => c.length <= 2)).toBe(true);
    expect(cards.flat().join(' ').replace(/\s+/g, ' ')).toBe(long);
  });
  it('email pengingat berisi daftar pencatatan belum lengkap & tautan', async () => {
    const { reminderEmail } = await import('@/server/labAuthCore');
    const m = reminderEmail({ username: 'dimas', items: [{ id: 'PD-261017-01', item: 'Kelapa tua', count: 12, createdAt: 'x', draft: true }, { id: 'PD-261017-02', item: 'Sekam', count: 3, createdAt: 'y', draft: false }], logoUrl: 'https://x/email-logo.png', siteUrl: 'https://x/lab?t=bahan' });
    expect(m.subject).toBe('Pengingat GnD Lab: 2 pencatatan data belum lengkap');
    expect(m.html).toContain('PD-261017-01');
    expect(m.html).toContain('data akhir sebagian');
    expect(m.html).toContain('menunggu data akhir');
    expect(m.html).toContain('href="https://x/lab?t=bahan"');
    expect(m.text).toContain('Sekam · 3 item');
  });
});

describe('kolom tanya PromptBar (DEC-094)', () => {
  it('@topik → konteks, /perintah → instruksi, tingkat jawaban → panjang; teks pengguna tetap utuh', async () => {
    const { buildLabPrompt } = await import('@/lib/labAi');
    expect(buildLabPrompt('berapa suhu oven yang aman?')).toBe('berapa suhu oven yang aman?');
    expect(buildLabPrompt('@Kopra berapa suhu oven?', 'Singkat')).toBe('Topik: Kopra.\nJawab singkat, maksimal 3 kalimat.\nKopra berapa suhu oven?');
    expect(buildLabPrompt('/langkah membuat @Bio leather', 'Sedang')).toBe('Topik: Bio leather.\nJawab dalam bentuk langkah-langkah bernomor.\nmembuat Bio leather');
    expect(buildLabPrompt('/bandingkan oven gas dan greenhouse', 'Mendalam')).toContain('Bandingkan pilihan yang disebut');
    expect(buildLabPrompt('/bandingkan oven gas dan greenhouse', 'Mendalam')).toContain('Jawab mendalam');
    // email/teks bukan perintah tidak diubah
    expect(buildLabPrompt('kirim ke a@kopra.id dan path a/langkah')).toBe('kirim ke a@kopra.id dan path a/langkah');
  });
});

describe('Lab AI mode Mendalam (DEC-096)', () => {
  it('prompt meminta pertanyaan penutup ramah + emoji acak', async () => {
    const { buildLabPrompt, FRIENDLY_EMOJI } = await import('@/lib/labAi');
    const p = buildLabPrompt('kadar air kopra?', 'Mendalam', () => 0);
    expect(p).toContain('Selalu akhiri jawaban dengan satu pertanyaan lanjutan yang ramah');
    expect(p).toContain(FRIENDLY_EMOJI[0]!);
    expect(buildLabPrompt('kadar air kopra?', 'Sedang')).not.toContain('pertanyaan lanjutan');
  });
  it('maks. 4 paragraf per kartu', async () => {
    const { answerCards } = await import('@/lib/labAi');
    const text = Array.from({ length: 6 }, (_, i) => `Paragraf ${i + 1}.`).join('\n\n');
    expect(answerCards(text, 4).map((c) => c.length)).toEqual([4, 2]);
  });
});
