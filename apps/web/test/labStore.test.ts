import { describe, expect, it } from 'vitest';
import { labBackupJson, nextExperimentId } from '@/lib/labStore';

describe('buku catatan GEMA RnD', () => {
  it('ID eksperimen = produk-TahunBulan-urut, lanjut dari ID tertinggi', () => {
    expect(nextExperimentId('KE', '2026-10-11', [])).toBe('KE-2610-001');
    expect(nextExperimentId('KE', '2026-10-11', ['KE-2610-001', 'KE-2610-003', 'CK-2610-007', 'KE-2609-009'])).toBe('KE-2610-004');
    expect(nextExperimentId('BR', '2026-11-02', ['BR-2610-002'])).toBe('BR-2611-001');
  });

  it('tanggal tak valid atau urutan penuh → tanpa ID', () => {
    expect(nextExperimentId('AR', '', [])).toBeUndefined();
    expect(nextExperimentId('AR', '2026-10-11', ['AR-2610-999'])).toBeUndefined();
  });

  it('cadangan JSON memuat format, versi & semua eksperimen', () => {
    const json = JSON.parse(labBackupJson([], '2026-10-11T00:00:00.000Z'));
    expect(json).toEqual({ format: 'gemas-lab', version: 1, exportedAt: '2026-10-11T00:00:00.000Z', experiments: [] });
  });
});
