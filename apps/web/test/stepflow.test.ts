import { describe, expect, it } from 'vitest';
import { guessPicto, PICTO_NAMES } from '@/lib/picto';

describe('ilustrasi langkah (StepFlow)', () => {
  it('kata kunci langkah → piktogram yang sesuai; K3 diprioritaskan', () => {
    expect(guessPicto('Titrasi tiap tarikan')).toBe('burette');
    expect(guessPicto('Taburkan belerang sesuai dosis')).toBe('smoke');
    expect(guessPicto('Ayak rotari 2× (kasar → halus)')).toBe('sieve');
    expect(guessPicto('Jemur di para-para 5–7 hari')).toBe('sun');
    expect(guessPicto('K3: respirator gas, jangan di dekat api')).toBe('shield');
    expect(guessPicto('kalimat tanpa kata kunci')).toBe('check');
    expect(guessPicto('Media')).toBe('vessel');
    expect(guessPicto('Panen & pemurnian')).toBe('soak');
    expect(guessPicto('Jadi kulit')).toBe('sheet');
  });

  it('semua piktogram yang bisa ditebak tersedia', () => {
    for (const t of ['karung', 'truk', 'palet', 'oven', 'drum', 'lilin', 'rendam', 'cetak', 'aduk']) expect(PICTO_NAMES).toContain(guessPicto(t));
  });
});
