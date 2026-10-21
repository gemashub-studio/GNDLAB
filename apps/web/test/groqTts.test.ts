import { describe, expect, it, vi } from 'vitest';
import { groqFetch, groqKeys, shouldFallback } from '@/server/groq';
import { NOT_UNDERSTOOD_TTS, ttsText } from '@/lib/ttsText';

describe('kunci Groq cadangan (DEC-116)', () => {
  it('urutan kunci: GROQ_API_KEY lalu GROQ_API_KEY_2 (kosong / sama dilewati)', () => {
    expect(groqKeys({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b' })).toEqual(['a', 'b']);
    expect(groqKeys({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'a' })).toEqual(['a']);
    expect(groqKeys({ GROQ_API_KEY: '', GROQ_API_KEY_2: 'b' })).toEqual(['b']);
    // DEC-124: kunci 3–5 ikut berurutan
    expect(groqKeys({ GROQ_API_KEY: 'a', GROQ_API_KEY_2: 'b', GROQ_API_KEY_3: 'c', GROQ_API_KEY_4: '', GROQ_API_KEY_5: 'e' })).toEqual(['a', 'b', 'c', 'e']);
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
    // 5 kunci (DEC-124): 1–4 limit / galat → kunci 5 dipakai
    const used: string[] = [];
    const busy = (async (_u: string, init: RequestInit) => {
      const a = (init.headers as Record<string, string>).authorization!;
      used.push(a.slice(7));
      return new Response('{}', { status: a.endsWith('k5') ? 200 : a.endsWith('k3') ? 503 : 429 });
    }) as unknown as typeof fetch;
    expect((await groqFetch('https://x', {}, ['k1', 'k2', 'k3', 'k4', 'k5'], busy)).status).toBe(200);
    expect(used).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
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
    // selalu "ma ap, " (spasi & koma) apa pun tanda bacanya (DEC-117)
    expect(ttsText('Maaf. Data tidak ditemukan.')).toBe('ma ap, Data tidak ditemukan!');
    expect(ttsText('maaf! gagal menyimpan')).toBe('ma ap, gagal menyimpan!');
    expect(ttsText('Sebentar aku proses ya.')).toBe('Sebentar, aku proses ya!');
    expect(ttsText('Buka pencatatan data dan membuat catatan baru.')).toBe('Buka pencatatan data dan membuat catatan baru!');
    expect(ttsText('Siap. Formnya sudah terbuka.')).toBe('Siap, Formnya sudah terbuka!');
    expect(ttsText('Mau aku isi sekarang')).toBe('Mau aku isi sekarang?');
    expect(ttsText('Berapa jumlah itemnya?')).toBe('Berapa jumlah itemnya?');
    expect(ttsText('Sudah!')).toBe('Sudah!');
    // DEC-122: kalimat owner & isi kolom angka diucapkan dengan kata
    expect(ttsText('Jumlah produksi, 113!')).toBe('Jumlah produksi, seratus tiga belas!');
    expect(ttsText('Oke, apalagi?')).toBe('Oke, apalagi?');
    expect(ttsText('Udah!...')).toBe('Udah!');
    expect(ttsText('HAHAHA!! aku ga paham apa yang kamu bilang, tau..')).toBe('HAHAHA!! aku ga paham apa yang kamu bilang, tau!');
    expect(ttsText('Hahaha! Kamu bilang apa?')).toBe('Hahaha! Kamu bilang apa?');
    expect(ttsText('Berikutnya halaman gudang!')).toBe('Berikutnya halaman gudang!');
    expect(ttsText('Membuka halaman…')).toBe('Membuka halaman!');
    expect(ttsText('   ')).toBe('');
  });
});

describe('saring halusinasi Whisper (DEC-117)', () => {
  it('"Terima kasih telah menonton!" & sejenisnya dibuang; perintah asli tetap', async () => {
    const { stripHallucinations, isHallucination } = await import('@/server/voiceTranscribe');
    expect(stripHallucinations('Terima kasih telah menonton!')).toBe('');
    expect(stripHallucinations(' Terima kasih.')).toBe('');
    expect(stripHallucinations('Thanks for watching!')).toBe('');
    expect(stripHallucinations('Jangan lupa like dan subscribe ya.')).toBe('');
    expect(stripHallucinations('Sampai jumpa di video berikutnya.')).toBe('');
    expect(stripHallucinations('Buka halaman gudang. Terima kasih sudah menonton!')).toBe('Buka halaman gudang.');
    expect(stripHallucinations('nomor satu berat awal seribu')).toBe('nomor satu berat awal seribu');
    expect(isHallucination('terima kasih atas bantuannya, buka gudang')).toBe(false);
  });
});


describe('angka di TTS diucapkan dengan kata (DEC-118)', () => {
  it('bulat, ribuan, desimal, persen, satuan', async () => {
    const { angkaKata, numbersToWords } = await import('@/lib/ttsText');
    expect(angkaKata(15)).toBe('lima belas');
    expect(angkaKata(1034)).toBe('seribu tiga puluh empat');
    expect(angkaKata(250)).toBe('dua ratus lima puluh');
    expect(angkaKata(11)).toBe('sebelas');
    expect(angkaKata(2026)).toBe('dua ribu dua puluh enam');
    expect(angkaKata(0)).toBe('nol');
    expect(numbersToWords('Jumlah produksi 15 item')).toBe('Jumlah produksi lima belas item');
    expect(numbersToWords('berat 1.034 g, tebal 6,5 mm')).toBe('berat seribu tiga puluh empat gram, tebal enam koma lima milimeter');
    expect(numbersToWords('naik 25%')).toBe('naik dua puluh lima persen');
    expect(ttsText('Mengisi nomor 2 dengan 1034.')).toBe('Mengisi nomor dua dengan seribu tiga puluh empat!');
    expect(ttsText('Batas pemakaian Groq tercapai (429).')).not.toMatch(/\d/);
  });
});
