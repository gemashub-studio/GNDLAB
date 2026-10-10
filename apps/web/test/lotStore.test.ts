import { describe, expect, it } from 'vitest';
import { lotsCsv, type RawLot } from '@/lib/lotStore';

describe('register lot (Fase G)', () => {
  it('CSV memuat kode, kelas asal & ketinggian; teks berkoma dikutip', () => {
    const lots: RawLot[] = [
      { code: 'DT-261010-001', origin: 'DT', date: '2026-10-10', region: 'Manado, Minahasa', supplier: 'Pengepul A', altitudeM: 650, nuts: 5000, note: '' },
      { code: 'DR-261010-001', origin: 'DR', date: '2026-10-10', region: 'Inhil', supplier: '', altitudeM: 20, nuts: 22500, note: 'retak "sedikit"' },
    ];
    const lines = lotsCsv(lots).trim().split('\n');
    expect(lines[0]).toBe('kode_lot,kelas_asal,tanggal,daerah,pemasok,ketinggian_mdpl,butir,catatan');
    expect(lines[1]).toBe('DT-261010-001,DT,2026-10-10,"Manado, Minahasa",Pengepul A,650,5000,');
    expect(lines[2]).toContain('"retak ""sedikit"""');
  });
});
