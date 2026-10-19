import { describe, expect, it } from 'vitest';
import { reminderDue, SEND_GAP_MS } from '@/server/labReminder';
import { cleanOcr } from '@/lib/photoOcr';

describe('pengingat email tiap 2 hari & OCR (DEC-097)', () => {
  const H = 3_600_000;
  it('email baru dikirim lagi setelah 2 hari (toleransi 30 menit untuk jadwal per jam)', () => {
    const now = Date.parse('2026-10-19T10:00:00Z');
    expect(reminderDue(0, now)).toBe(true);
    expect(reminderDue(now - 1 * H, now)).toBe(false);
    expect(reminderDue(now - 47 * H, now)).toBe(false);
    expect(reminderDue(now - 47.5 * H, now)).toBe(true);
    expect(reminderDue(now - 48 * H, now)).toBe(true);
    expect(SEND_GAP_MS).toBe(47.5 * H);
  });
  it('teks OCR dirapikan', () => {
    expect(cleanOcr('  Kadar air  \n\n\n\n6 persen \n')).toBe('Kadar air\n\n6 persen');
  });
});
