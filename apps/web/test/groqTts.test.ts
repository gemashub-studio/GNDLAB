import { describe, expect, it, vi } from 'vitest';
import { groqFetch, groqKeys, shouldFallback } from '@/server/groq';
import { NOT_UNDERSTOOD_TTS, ttsText } from '@/lib/ttsText';

describe('kunci Groq cadangan (DEC-116)', () => {
  it('urutan kunci: GROQ_API_KEY lalu GROQ_API_KEY_2 (kosong / sama dilewati)', () => {
    expect(groqKeys({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b' })).toEqual(['a', 'b']);
    expect(groqKeys({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'a' })).toEqual(['a']);
    expect(groqKeys({ GROQ_API_KEY: '', GROQ_API_KEY_2: 'b' })).toEqual(['b']);
    expect(groqKeys({})).toEqual([]);
    expect([429, 401, 403, 500, 503].every(shouldFallback)).toBe(true);
    expect([200, 400, 413].some(shouldFallback)).toBe(false);
  });
  it('limit habis (429) pada kunci 1 → kunci 2 dipakai; berhasil di kunci 1 → kunci 2 tidak disentuh', async () => {
    const auth: string[] = [];
    const fetcher = vi.fn(async (_u: string, init: RequestInit) => {
      const a = (init.headers as Record<string, string>).authorization!;
      auth.push(a);
      return new Response('{}', { status: a.endsWith('k1') ? 429 : 200 });
    }) as unknown as typeof fetch;
    const res = await groqFetch('https://x', { method: 'POST', headers: { 'content-type': 'application/json' } }, ['k1', 'k2'], fetcher);
    expect(res.status).toBe(200);
    expect(auth).toEqual(['Bearer k1', 'Bearer k2']);
    auth.length = 0;
    const ok = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    expect((await groqFetch('https://x', {}, ['k1', 'k2'], ok)).status).toBe(200);
  });
  it('galat jaringan kunci 1 → kunci 2; semua kunci limit → respons 429 terakhir', async () => {
    let n = 0;
    const flaky = (async () => {
      if (n++ === 0) throw new TypeError('fetch failed');
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    expect((await groqFetch('https://x', {}, ['k1', 'k2'], flaky)).status).toBe(200);
    const limited = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
    expect((await groqFetch('https://x', {}, ['k1', 'k2'], limited)).status).toBe(429);
    await expect(groqFetch('https://x', {}, [], limited)).rejects.toThrow('GROQ_API_KEY');
  });
});

describe('teks khusus TTS: tanda baca & "ma ap" (DEC-116)', () => {
  it('perintah tidak dikenali → kalimat baku owner', () => {
    expect(ttsText('Maaf, aku belum paham. Coba ucapkan lagi ya.')).toBe(NOT_UNDERSTOOD_TTS);
    expect(NOT_UNDERSTOOD_TTS).toBe('ma ap, aku masih belum paham, coba ucapkan lagi ya!');
  });
  it('"maaf" → "ma ap", koma antar-kalimat, akhir "!" / "?"', () => {
    expect(ttsText('Maaf, saya tidak dapat menghapus data.')).toBe('ma ap, saya tidak dapat menghapus data!');
    expect(ttsText('Maaf saya tidak bisa')).toBe('ma ap, saya tidak bisa!');
    expect(ttsText('Sebentar aku proses ya.')).toBe('Sebentar, aku proses ya!');
    expect(ttsText('Buka pencatatan data dan membuat catatan baru.')).toBe('Buka pencatatan data dan membuat catatan baru!');
    expect(ttsText('Siap. Formnya sudah terbuka.')).toBe('Siap, Formnya sudah terbuka!');
    expect(ttsText('Mau aku isi sekarang')).toBe('Mau aku isi sekarang?');
    expect(ttsText('Berapa jumlah itemnya?')).toBe('Berapa jumlah itemnya?');
    expect(ttsText('Membuka halaman…')).toBe('Membuka halaman!');
    expect(ttsText('   ')).toBe('');
  });
});
