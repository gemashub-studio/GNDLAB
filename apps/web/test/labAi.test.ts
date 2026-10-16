import { describe, expect, it } from 'vitest';
import { aiText, CATAT_HINT, LAB_AI_SYSTEM, labAiUrl, labGreeting } from '@/lib/labAi';
import { emailSlug } from '@/lib/useAuth';

describe('Tanya Lab AI & username (DEC-087)', () => {
  it('URL GET: prompt = ketikan pengguna, system = peneliti lab briket & olahan kelapa, temperature 0.7', () => {
    const u = new URL(labAiUrl('Berapa kadar air kopra ideal?'));
    expect(u.origin + u.pathname).toBe('https://api.siputzx.my.id/api/ai/glm47flash');
    expect(u.searchParams.get('prompt')).toBe('Berapa kadar air kopra ideal?');
    expect(u.searchParams.get('system')).toBe('kamu adalah peneliti laboratorium dan ahli dengan produk briket dan olahan kelapa lainnya.');
    expect(LAB_AI_SYSTEM).toContain('briket');
    expect(u.searchParams.get('temperature')).toBe('0.7');
  });
  it('jawaban dibaca dari berbagai bentuk respons; status false = tidak ada jawaban', () => {
    expect(aiText({ status: true, data: 'Halo!' })).toBe('Halo!');
    expect(aiText({ status: true, data: { response: 'Saya peneliti.' } })).toBe('Saya peneliti.');
    expect(aiText({ result: { content: 'isi' } })).toBe('isi');
    expect(aiText({ choices: [{ message: { content: 'x' } }] })).toBe('x');
    expect(aiText({ code: 503, error: 'All nodes failed', status: false })).toBeUndefined();
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
