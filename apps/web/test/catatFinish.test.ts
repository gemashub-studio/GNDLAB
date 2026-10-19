import { describe, expect, it } from 'vitest';
import { canCloseCatat, canStartCatat, openCatat, type CatatRecord } from '@/lib/pencatatan';
import { buildCatatXlsx, catatSheets } from '@/lib/catatXlsx';
import { joinCatat, splitCatat } from '@/lib/labDocs';
import { finishWordOk } from '@/components/lab/FinishDialogs';

const rec = (o: Partial<CatatRecord> = {}): CatatRecord => ({
  id: 'PD-261019-01',
  item: 'Kelapa tua',
  count: 2,
  createdAt: '2026-10-19T08:00:00.000Z',
  finishedAt: '2026-10-19T10:00:00.000Z',
  rows: [
    { no: 1, beratAwal: '1.000', volAir: '300', beratAir: '310', tebalAwal: '10', beratAkhir: '600', tebalAkhir: '8' },
    { no: 2, beratAwal: '1.200', volAir: '', beratAir: '320', tebalAwal: '12', beratAkhir: '700', tebalAkhir: '11' },
  ],
  treatments: { kopra: [{ count: '2', method: 'Oven Gas', note: 'suhu 60' }] },
  ...o,
});

describe('Selesaikan & batas 1 pencatatan aktif (DEC-098)', () => {
  it('catatan baru hanya bila semua catatan sudah diselesaikan', () => {
    expect(canStartCatat([])).toBe(true);
    expect(canStartCatat([rec()])).toBe(false);
    expect(canStartCatat([rec({ finishedAt: undefined })])).toBe(false);
    expect(canStartCatat([rec({ closedAt: '2026-10-19T11:00:00.000Z' })])).toBe(true);
    expect(openCatat([rec({ id: 'a', closedAt: 'x' }), rec({ id: 'b' })]).map((r) => r.id)).toEqual(['b']);
  });
  it('bisa diselesaikan hanya bila data awal & akhir lengkap', () => {
    expect(canCloseCatat(rec())).toBe(true);
    expect(canCloseCatat(rec({ finishedAt: undefined }))).toBe(false);
    expect(canCloseCatat(rec({ closedAt: 'x' }))).toBe(false);
  });
  it('status selesai ikut sinkron Supabase', () => {
    const r = rec({ closedAt: '2026-10-19T11:00:00.000Z' });
    const row = splitCatat(r as unknown as Record<string, unknown>);
    expect((row.data_akhir as { closedAt?: string }).closedAt).toBe(r.closedAt);
    expect((row.data_awal as { closedAt?: string }).closedAt).toBeUndefined();
    expect(joinCatat(row)?.closedAt).toBe(r.closedAt);
  });
  it('kata konfirmasi: Selesai', () => {
    expect(finishWordOk('Selesai')).toBe(true);
    expect(finishWordOk(' selesai ')).toBe(true);
    expect(finishWordOk('selesaikan')).toBe(false);
  });
  it('Excel: 5 sheet — data awal & akhir, perbandingan, tebal daging, perlakuan, kesimpulan', () => {
    const sh = catatSheets(rec());
    expect(sh.map((s) => s.name)).toEqual(['Data awal & akhir', 'Perbandingan', 'Tebal daging', 'Perlakuan', 'Kesimpulan']);
    expect(sh[0]!.rows[4]).toEqual([1, 1000, 300, 310, 10, 600, 8]);
    expect(sh[1]!.rows.some((r) => r[0] === 'Rata-rata')).toBe(true);
    expect(sh[2]!.rows[4]).toEqual([1, 10, 8, -2, -20]);
    expect(sh[3]!.rows[3]).toEqual(['Jumlah perlakuan kopra', 2, 'Oven Gas', 'suhu 60']);
    expect(String(sh[4]!.rows[2]![1])).toMatch(/^Berat/);
    const x = new TextDecoder().decode(buildCatatXlsx(rec()));
    expect(x).toContain('xl/worksheets/sheet5.xml');
    expect(x).toContain('<sheet name="Data awal &amp; akhir"');
  });
});
