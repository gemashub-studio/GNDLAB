import { describe, expect, it } from 'vitest';
import { missingSulfurFields, nextSulfurId, sulfurCsv, type SulfurRecord } from '@/lib/sulfurLog';

describe('log perlakuan sulfur (DEC-048)', () => {
  it('ID per tanggal mulai, lanjut dari ID tertinggi', () => {
    expect(nextSulfurId('2026-10-11T19:00', [])).toBe('S-261011-01');
    expect(nextSulfurId('2026-10-11T19:00', ['S-261011-01', 'S-261011-04', 'S-261012-09'])).toBe('S-261011-05');
    expect(nextSulfurId('', [])).toBeUndefined();
  });

  it('jumlah, satuan & DASAR penentuan wajib diisi pengguna (aplikasi tidak menyarankan dosis)', () => {
    expect(missingSulfurFields({ startedAt: '2026-10-11T19:00', amount: '', unit: 'g', basis: '', form: 'Lainnya' })).toEqual(['jumlah dipakai', 'dasar penentuan jumlah']);
    expect(missingSulfurFields({ startedAt: '2026-10-11T19:00', amount: '500', unit: 'g', basis: 'keputusan owner', form: 'Lainnya' })).toEqual([]);
  });

  it('CSV memuat dasar penentuan & hasil residu; teks berkoma dikutip', () => {
    const r: SulfurRecord = {
      id: 'S-261011-01', startedAt: '2026-10-11T19:00', endedAt: '', lotCode: 'DT-261010-001', load: '1.200 butir', place: 'greenhouse',
      form: 'Belerang dibakar (asap)', amount: '500', unit: 'g', basis: 'keputusan owner, uji 1', operator: '', ppe: '', residueResult: '', residueLab: '', note: '', createdAt: 'x',
    };
    const [head, row] = sulfurCsv([r]).trim().split('\n');
    expect(head).toContain('dasar_penentuan');
    expect(row).toContain('"keputusan owner, uji 1"');
  });
});
