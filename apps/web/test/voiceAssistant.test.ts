import { describe, expect, it } from 'vitest';
import { sanitizePlan, systemPrompt, type AssistantContext } from '@/server/voiceAssistant';

const ctx: AssistantContext = {
  path: '/',
  pages: [{ href: '/gudang', label: 'Gudang' }, { href: '/lab?t=bahan', label: 'GnD Lab · Pencatatan Data' }],
  buttons: [{ id: 'nav-menu', text: 'Menu' }],
};

describe('asisten suara kelapa: penyaring rencana (DEC-111)', () => {
  it('hanya halaman & tombol dari daftar; tombol halaman lab dikenal boleh setelah navigate', () => {
    const p = sanitizePlan(
      {
        actions: [
          { type: 'navigate', target: '/lab?t=bahan' },
          { type: 'click', target: 'catat-new' },
          { type: 'navigate', target: 'https://contoh.com' },
          { type: 'click', target: 'tidak-ada' },
          { type: 'fill', text: 'nomor satu berat awal seribu' },
        ],
        reply: 'Siap!',
      },
      ctx,
    );
    expect(p).toEqual({ actions: [{ type: 'navigate', target: '/lab?t=bahan' }, { type: 'click', target: 'catat-new' }, { type: 'fill', text: 'nomor satu berat awal seribu' }], reply: 'Siap!' });
  });
  it('tombol hapus / keluar / konfirmasi berbahaya selalu ditolak', () => {
    const danger = { ...ctx, buttons: [{ id: 'catat-select-delete', text: 'Hapus' }, { id: 'auth-logout', text: 'Keluar' }, { id: 'confirm-ok', text: 'OK' }] };
    const p = sanitizePlan({ actions: danger.buttons.map((b) => ({ type: 'click', target: b.id })) }, danger);
    expect(p.actions).toEqual([]);
    expect(p.reply).toContain('belum paham');
  });
  it('tombol lab dikenal tanpa navigate lebih dulu & keluaran rusak → aman', () => {
    expect(sanitizePlan({ actions: [{ type: 'click', target: 'catat-new' }] }, ctx).actions).toEqual([]);
    expect(sanitizePlan('bukan json', ctx).actions).toEqual([]);
    expect(sanitizePlan({ actions: Array.from({ length: 10 }, () => ({ type: 'navigate', target: '/gudang' })) }, ctx).actions).toHaveLength(6);
  });
  it('pertanyaan pengetahuan → satu aksi ask (DEC-123)', () => {
    expect(sanitizePlan({ actions: [{ type: 'ask', text: 'apa itu kopra?' }, { type: 'navigate', target: '/gudang' }], reply: 'Aku carikan.' }, ctx)).toEqual({ actions: [{ type: 'ask', text: 'apa itu kopra?' }], reply: 'Aku carikan.' });
    expect(sanitizePlan({ actions: [{ type: 'ask', text: '  ' }] }, ctx).actions).toEqual([]);
    expect(systemPrompt(ctx)).toContain('"type":"ask"');
  });
  it('instruksi memuat daftar halaman/tombol, form terbuka & larangan hapus', () => {
    const s = systemPrompt({ ...ctx, form: 'Buat catatan awal', formFields: ['berat awal', 'jumlah produksi'] });
    expect(s).toContain('"href":"/gudang"');
    expect(s).toContain('FORM TERBUKA: Buat catatan awal');
    expect(s).toContain('Jangan pernah menghapus data');
    expect(s).toContain('nomor <angka dalam kata>');
  });
});

describe('teks sukses & gagal asisten (DEC-118, DEC-122)', () => {
  it('kalimat owner bergiliran; tujuan → "Berikutnya <tujuan>!"; isi angka → "<kolom>, <nilai>!"; gagal → menu ga ada / ga paham', async () => {
    const { successText, failText, MENU_MISSING, SUCCESS_LINES, IDLE_CLOSE_MS } = await import('@/components/shell/VoiceAssistant');
    expect(SUCCESS_LINES).toEqual(['Oke, apalagi?', 'Udah!...', 'Oke, udah...', 'Apalagi?', 'Sudah! Apalagi yang bisa aku bantu?']);
    expect(successText(0, 'halaman Gudang')).toBe('Oke, apalagi?');
    expect(successText(1, 'halaman Gudang')).toBe('Berikutnya halaman gudang!');
    expect(successText(2, 'halaman Gudang')).toBe('Udah!...');
    expect(successText(3, 'halaman GnD Lab · Pencatatan Data')).toBe('Berikutnya halaman pencatatan data!');
    expect([0, 1, 2, 3, 4, 5].map((i) => successText(i))).toEqual([...SUCCESS_LINES, SUCCESS_LINES[0]]);
    expect(successText(1, 'x', [{ label: 'Jumlah produksi', value: '113', num: true }])).toBe('Jumlah produksi, 113!');
    expect(successText(0, undefined, [{ label: 'Berat awal', value: '1034', num: true }, { label: 'Tebal daging', value: '10', num: true }])).toBe('Berat awal, 1034, Tebal daging, 10!');
    expect(successText(0, undefined, [{ label: 'Perlakuan', value: 'Oven Gas', num: false }])).toBe('Oke, apalagi?');
    expect(failText(0, 'Menu resep tidak ada di aplikasi ini.')).toBe(MENU_MISSING);
    expect(MENU_MISSING).toBe('Menu itu ga ada, katakan menu yang tersedia!');
    expect(failText(0, 'Maaf, aku belum paham. Coba ucapkan lagi ya.')).toBe('Hahaha! Kamu bilang apa?');
    expect(failText(1, 'Maaf, aku belum paham.')).toBe('Aku ga paham, katakan sesuatu tentang website ini!!!');
    expect(failText(2, 'Maaf, aku belum paham.')).toBe('HAHAHA!! aku ga paham apa yang kamu bilang, tau..');
    expect(failText(3, 'x')).toBe('Hahaha! Kamu bilang apa?');
    expect(IDLE_CLOSE_MS).toBe(600_000);
  });
});
