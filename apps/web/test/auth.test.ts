import { describe, expect, it } from 'vitest';
import { allowLoginEmail } from '@/server/auth';

describe('batas permintaan tautan masuk', () => {
  it('maks 3 per 15 menit per email (tidak peka huruf besar), pulih setelah jendela lewat', () => {
    const t0 = 1_000_000;
    const e = `spam-${t0}@gemas.test`;
    expect([1, 2, 3].map((i) => allowLoginEmail(e, t0 + i))).toEqual([true, true, true]);
    expect(allowLoginEmail(e.toUpperCase(), t0 + 10)).toBe(false);
    expect(allowLoginEmail('lain@gemas.test', t0 + 10)).toBe(true);
    expect(allowLoginEmail(e, t0 + 15 * 60 * 1000 + 5)).toBe(true);
  });
});
