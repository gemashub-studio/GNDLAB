import { describe, expect, it } from 'vitest';
import { cleanWithGroq, filterAnswer, isEnglishSentence, scrubAnswer } from '@/server/labAiFilter';

const RUSAK = `Halo! 👋 Selamat datang. Saya siap membantu Anda dalam riset laboratorium maupun pengembangan produk berbasis kelapa, seperti briket, kopra, cuka air kelapa, dan bio leather. Tunggu, typo:FaMan69® ᴇᴀʀᴘʏ ᴄʜᴀʛᴛᴇʀ

Created by: FaMan69®

You have 9760.keys...

Could you clarify what you'd like to know?

Kopra adalah daging kelapa yang dikeringkan sampai kadar air sekitar 5–6%.`;

describe('saring jawaban Lab AI (DEC-125)', () => {
  it('lapis aturan: kredit, ®, huruf kapital-kecil, "You have … keys", "Could you clarify…" dibuang; isi wajar tetap', () => {
    const s = scrubAnswer(RUSAK);
    expect(s).not.toMatch(/FaMan|Created by|keys|clarify|ᴇᴀʀᴘʏ|typo/i);
    expect(s).toContain('Halo! 👋 Selamat datang.');
    expect(s).toContain('cuka air kelapa, dan bio leather.');
    expect(s).toContain('Kopra adalah daging kelapa yang dikeringkan sampai kadar air sekitar 5–6%.');
    // daftar & paragraf dipertahankan
    expect(scrubAnswer('## Bahan\n1. Arang batok\n2. Tapioka 5%\n\nSelesai.')).toBe('## Bahan\n1. Arang batok\n2. Tapioka 5%\n\nSelesai.');
  });
  it('kalimat bahasa Inggris utuh dibuang, istilah teknis Inggris di kalimat Indonesia tetap', () => {
    expect(isEnglishSentence('Could you clarify what you would like to know?')).toBe(true);
    expect(isEnglishSentence('Karbon aktif (activated carbon) dibuat dari arang batok.')).toBe(false);
    expect(scrubAnswer('Briket dipadatkan dengan perekat tapioka. Let me know if you have any questions about this.')).toBe('Briket dipadatkan dengan perekat tapioka.');
  });
  it('lapis penyunting Groq: dipakai bila wajar; terlalu pendek / gagal → hasil aturan', async () => {
    const asks: string[] = [];
    const reply = (content: string, status = 200) =>
      (async (_u: string, init: RequestInit) => {
        asks.push(JSON.parse(String(init.body)).messages[1].content);
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
      }) as unknown as typeof fetch;
    const raw = 'Biaya produksi dapatlever (leveraged) dari limbah kelapa bisa ditekan dengan memakai batok sebagai bahan baku utama.';
    const bersih = 'Biaya produksi dari limbah kelapa bisa ditekan dengan memakai batok sebagai bahan baku utama.';
    expect(await filterAnswer('biaya briket?', raw, { keys: ['k'], fetcher: reply(bersih) })).toBe(bersih);
    expect(asks[0]).toContain('Pertanyaan pengguna:\nbiaya briket?');
    expect(await cleanWithGroq('q', raw, { keys: ['k'], fetcher: reply('Biaya.') })).toBeUndefined();
    expect(await filterAnswer('q', raw, { keys: ['k'], fetcher: reply('', 500) })).toBe(raw);
    expect(await filterAnswer('q', raw, { keys: [] })).toBe(raw);
  });
});
