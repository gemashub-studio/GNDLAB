import { describe, expect, it } from 'vitest';
import { blankRows, buildCatatReport, perlakuanRanges, type CatatRecord } from '@/lib/pencatatan';
import { buildResearchReport, catatBlocks } from '@/lib/researchReport';
import { buildPptx } from '@/lib/officeExport';
import type { ProtocolVersion } from '@/lib/labStore';

const jpg = 'data:image/jpeg;base64,/9j/AA';
const rec = (n = 30): CatatRecord => ({
  id: 'PD-261019-02',
  item: 'Kelapa tua',
  count: n,
  createdAt: '2026-10-19T08:00:00.000Z',
  finishedAt: '2026-10-19T10:00:00.000Z',
  rows: blankRows(n).map((r) => ({ ...r, beratAwal: '1000', tebalAwal: '10', beratAkhir: '600', tebalAkhir: '8', fotoAwal: jpg, fotoAkhir: jpg })),
  treatments: { kopra: [{ method: 'GreenHouse', count: '15' }, { method: 'Oven Gas', count: '10' }, { method: 'Oven Briket', count: '5' }] },
});

describe('perlakuan di data awal & slide per perlakuan (DEC-101)', () => {
  it('item dibagi berurutan sesuai jumlah produksi', () => {
    const r = perlakuanRanges(rec());
    expect(r.map((x) => [x.label, x.count, x.rows[0]!.no, x.rows.at(-1)!.no])).toEqual([
      ['Green House', 15, 1, 15],
      ['Oven Gas', 10, 16, 25],
      ['Oven Briket', 5, 26, 30],
    ]);
  });
  it('PPTX pencatatan: satu bagian per perlakuan (foto awal atas, akhir bawah), tanpa progres harian/mingguan/bulanan', () => {
    const report = buildCatatReport(rec(), 'x');
    const grids = report.blocks.filter((b) => b.photoPairs);
    expect(grids.map((b) => [b.heading, b.photoPairs!.length])).toEqual([
      ['Perlakuan Green House · 15 item', 15],
      ['Perlakuan Oven Gas · 10 item', 10],
      ['Perlakuan Oven Briket · 5 item', 5],
    ]);
    expect(grids[0]!.photoPairs![0]!.akhir?.image).toBe(jpg);
    expect(report.blocks.some((b) => b.progressColumns)).toBe(false);
    const x = new TextDecoder().decode(buildPptx(report));
    expect(x).toContain('Perlakuan Green House · 15 item · No 1–10');
    expect(x).toContain('Perlakuan Green House · 15 item · No 11–15');
    expect(x).not.toContain('mingguan');
  });
  it('resep dengan data pencatatan: jalur = perlakuan → hanya slide perlakuan itu (15 foto Green House)', () => {
    const v: ProtocolVersion = { id: 'GH-P01-v1', key: 'GH-P01', version: 1, product: 'GH', productName: 'Green House', name: 'Kopra rumah kaca', author: 'Owner', reason: 'awal', createdAt: '2026-10-19T11:00:00.000Z', ingredients: [], steps: [], catatId: 'PD-261019-02' };
    const b = catatBlocks(v, [rec()]);
    expect(b.filter((x) => x.photoPairs).map((x) => [x.heading, x.photoPairs!.length])).toEqual([['Green House · 15 item', 15]]);
    const report = buildResearchReport('GH-P01', [v], [], [], 'x', undefined, [rec()]);
    expect(report.blocks.find((x) => x.heading === 'Data pencatatan')!.lines.join(' ')).toContain('Perlakuan Oven Gas: 10 item (no 16–25)');
    // jalur lain → semua perlakuan
    expect(catatBlocks({ ...v, productName: 'Minyak Kelapa' }, [rec()]).filter((x) => x.photoPairs)).toHaveLength(3);
    expect(catatBlocks({ ...v, catatId: undefined }, [rec()])).toEqual([]);
  });
});
