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
  it('instruksi memuat daftar halaman/tombol, form terbuka & larangan hapus', () => {
    const s = systemPrompt({ ...ctx, form: 'Buat catatan awal', formFields: ['berat awal', 'jumlah produksi'] });
    expect(s).toContain('"href":"/gudang"');
    expect(s).toContain('FORM TERBUKA: Buat catatan awal');
    expect(s).toContain('Jangan pernah menghapus data');
    expect(s).toContain('nomor <angka dalam kata>');
  });
});

describe('teks sukses asisten (DEC-118)', () => {
  it('"Sudah!" bergantian dengan "Berikutnya <tujuan>!"; tanpa tujuan selalu "Sudah!"', async () => {
    const { successText, IDLE_CLOSE_MS } = await import('@/components/shell/VoiceAssistant');
    expect(successText(0, 'halaman Gudang')).toBe('Sudah!');
    expect(successText(1, 'halaman Gudang')).toBe('Berikutnya halaman gudang!');
    expect(successText(3, 'halaman GnD Lab · Pencatatan Data')).toBe('Berikutnya halaman pencatatan data!');
    expect(successText(1, undefined)).toBe('Sudah!');
    expect(IDLE_CLOSE_MS).toBe(600_000);
  });
});
