import { describe, expect, it } from 'vitest';
import { blankRows, buildCatatReport, jalurGroups, perlakuanRanges, type CatatRecord } from '@/lib/pencatatan';
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
    expect(b.filter((x) => x.photoPairs).map((x) => [x.heading, x.photoPairs!.length])).toEqual([['Green House · 15 item (no 1–15)', 15]]);
    const report = buildResearchReport('GH-P01', [v], [], [], 'x', undefined, [rec()]);
    expect(report.blocks.find((x) => x.heading === 'Data pencatatan')!.lines.join(' ')).toContain('Perlakuan Oven Gas: 10 item (no 16–25)');
    // jalur lain → semua perlakuan
    expect(catatBlocks({ ...v, productName: 'Minyak Kelapa' }, [rec()]).filter((x) => x.photoPairs)).toHaveLength(3);
    expect(catatBlocks({ ...v, catatId: undefined }, [rec()])).toEqual([]);
  });
});

describe('kolom jalur produk tambahan & hapus foto di Resep baru (DEC-105)', () => {
  const r40: CatatRecord = { ...rec(40), treatments: { kopra: [{ method: 'GreenHouse', count: '15' }, { method: 'Oven Gas', count: '10' }] } };
  it('tiap kolom jalur → foto nomor dalam rentang perlakuannya (GH 1–15, Oven Gas lanjut 16–25)', () => {
    const g = jalurGroups(r40, ['Green House', 'Oven Gas', 'Cuka 1', 'Green House']);
    expect(g.map((x) => [x.jalur, x.rows[0]!.no, x.rows.at(-1)!.no, x.photos.length])).toEqual([
      ['Green House', 1, 15, 30],
      ['Oven Gas', 16, 25, 20],
    ]);
  });
  it('foto yang dihapus (✕) tidak tampil & tidak ikut PPTX; nomor tanpa foto tersisa dihilangkan', () => {
    const ex = new Set(['1:awal', '1:akhir', '2:akhir']);
    const g = jalurGroups(r40, ['Green House'], ex);
    expect(g[0]!.photos.map((p) => p.key).slice(0, 2)).toEqual(['2:awal', '3:awal']);
    const v: ProtocolVersion = { id: 'GH-P01-v1', key: 'GH-P01', version: 1, product: 'GH', productName: 'Green House', name: 'x', author: 'x', reason: 'x', createdAt: 'x', ingredients: [], steps: [], catatId: r40.id, jalurExtra: ['Oven Gas'], catatExclude: [...ex] };
    const grids = catatBlocks(v, [r40]).filter((x) => x.photoPairs);
    expect(grids.map((x) => [x.heading, x.photoPairs!.length])).toEqual([
      ['Green House · 15 item (no 1–15)', 14],
      ['Oven Gas · 10 item (no 16–25)', 10],
    ]);
    expect(grids[0]!.photoPairs![0]!.no).toBe(2);
    expect(grids[0]!.photoPairs![0]!.akhir?.image).toBeUndefined();
    expect(grids[0]!.photoPairs![0]!.awal.image).toBe(jpg);
  });
});


describe('jalur perlakuan non-kopra → foto kolom "Perlakuan lainnya (Non Kopra)" per jenis (DEC-109)', () => {
  const png2 = 'data:image/jpeg;base64,/9j/BB';
  const r: CatatRecord = {
    ...rec(4),
    treatments: {
      kopra: [{ method: 'GreenHouse', count: '4' }],
      cuka: [
        { method: 'CUKA 1 - GULA 25g', count: '2', photo: jpg, note: 'botol A' },
        { method: 'CUKA 2 - GULA 75g', count: '1', photo: png2 },
        { method: 'CUKA 1 - GULA 25g', count: '1', photo: png2, note: 'botol C' },
      ],
      bio: [{ method: 'Bio Leather A - Gula 25g', count: '1' }],
    },
  };
  it('dikelompokkan per jenis, tanpa nomor urut; foto bisa dihapus (✕)', () => {
    const g = jalurGroups(r, ['CUKA 1 - GULA 25g', 'CUKA 2 - GULA 75g', 'Bio Leather A - Gula 25g', 'Bio Leather B - Gula 50g']);
    expect(g.map((x) => [x.jalur, x.treatment?.title, x.photos.map((p) => p.label)])).toEqual([
      ['CUKA 1 - GULA 25g', 'Perlakuan cuka', ['CUKA 1 - GULA 25g · jumlah 2', 'CUKA 1 - GULA 25g · jumlah 1']],
      ['CUKA 2 - GULA 75g', 'Perlakuan cuka', ['CUKA 2 - GULA 75g · jumlah 1']],
      ['Bio Leather A - Gula 25g', 'Perlakuan bio leather', []],
    ]);
    expect(g[0]!.photos.map((p) => [p.key, p.no, p.kind, p.note])).toEqual([
      ['tr:cuka:0', 0, 'perlakuan', 'botol A'],
      ['tr:cuka:2', 0, 'perlakuan', 'botol C'],
    ]);
    expect(jalurGroups(r, ['CUKA 1 - GULA 25g'], new Set(['tr:cuka:0']))[0]!.photos.map((p) => p.key)).toEqual(['tr:cuka:2']);
  });
  it('PPTX riset: kartu foto per jenis perlakuan; ringkasan data pencatatan memuat jenis & keterangan', () => {
    const v: ProtocolVersion = { id: 'C1-P01-v1', key: 'C1-P01', version: 1, product: 'CG', productName: 'CUKA 1 - GULA 25g', name: 'Cuka', author: 'x', reason: 'x', createdAt: 'x', ingredients: [], steps: [], catatId: r.id, jalurExtra: ['Green House'] };
    const b = catatBlocks(v, [r]);
    const cards = b.find((x) => x.photoCards)!;
    expect(cards.heading).toBe('CUKA 1 - GULA 25g · Perlakuan cuka');
    expect(cards.photoCards!.map((c) => c.lines)).toEqual([['CUKA 1 - GULA 25g · jumlah 2', 'botol A'], ['CUKA 1 - GULA 25g · jumlah 1', 'botol C']]);
    expect(b.find((x) => x.photoPairs)!.heading).toBe('Green House · 4 item (no 1–4)');
    expect(b.find((x) => x.heading === 'Data pencatatan')!.lines.join(' | ')).toContain('Perlakuan cuka: CUKA 1 - GULA 25g · jumlah 2 · botol A');
    const x = new TextDecoder().decode(buildPptx(buildResearchReport('C1-P01', [v], [], [], 'x', undefined, [r])));
    expect(x).toContain('CUKA 1 - GULA 25g · Perlakuan cuka');
  });
});

describe('perlakuan bio leather baru (DEC-110)', () => {
  it('Rumput, Bunga, Kunyit ada di pilihan perlakuan non-kopra beserta keterangannya', async () => {
    const { TREATMENT_GROUPS, TREATMENT_INFO } = await import('@/lib/pencatatan');
    const bio = TREATMENT_GROUPS.find((g) => g.key === 'bio')!;
    expect(bio.methods).toEqual(expect.arrayContaining(['Bio Leather Rumput', 'Bio Leather Bunga', 'Bio Leather Kunyit']));
    expect(TREATMENT_INFO.bio.methods['Bio Leather Rumput']).toBe('rumput 132 g, air kelapa 500 g');
    expect(TREATMENT_INFO.bio.methods['Bio Leather Bunga']).toBe('bunga 74 g, air kelapa 500 g');
    expect(TREATMENT_INFO.bio.methods['Bio Leather Kunyit']).toBe('kunyit 212 gram, air kelapa 500 ml');
    const r: CatatRecord = { ...rec(2), treatments: { bio: [{ method: 'Bio Leather Kunyit', count: '1', photo: jpg }] } };
    expect(jalurGroups(r, ['Bio Leather Kunyit'])[0]!.photos[0]!.label).toBe('Bio Leather Kunyit · jumlah 1');
  });
});


describe('Resep baru disederhanakan & bahan/alat di pencatatan (DEC-142)', () => {
  const withBio: CatatRecord = { ...rec(30), treatments: { kopra: [{ method: 'GreenHouse', count: '15' }], bio: [{ method: 'Bio Leather Rumput', count: '2', photo: jpg }, { method: '', count: '' }] } };
  it('catatJalurs: perlakuan kopra lalu non-kopra yang terisi (nama tampil, tanpa duplikat)', async () => {
    const { catatJalurs } = await import('@/lib/pencatatan');
    expect(catatJalurs(withBio)).toEqual(['Green House', 'Bio Leather Rumput']);
    expect(catatJalurs({ rows: [], treatments: undefined })).toEqual([]);
  });
  it('bahan & alat: baris kosong dibuang, ikut laporan pencatatan (tabel + foto PPTX)', async () => {
    const { withExtras, extrasOf, bahanAlatBlocks } = await import('@/lib/pencatatan');
    const r = withExtras(rec(3), { bahan: [{ name: ' Gula ', amount: '50', unit: 'g', photo: jpg }, { name: '', amount: '', unit: '' }], alat: [{ name: 'Panci', amount: '1', unit: 'buah' }] });
    expect(r.bahan).toEqual([{ name: 'Gula', amount: '50', unit: 'g', photo: jpg }]);
    expect(r.alat).toEqual([{ name: 'Panci', amount: '1', unit: 'buah' }]);
    expect(withExtras(r, { bahan: [], alat: [] }).bahan).toBeUndefined();
    expect(extrasOf(undefined).bahan).toHaveLength(1);
    const blocks = bahanAlatBlocks(r);
    expect(blocks[0]!.table!.rows).toEqual([['Bahan', 'Gula', '50', 'g'], ['Alat', 'Panci', '1', 'buah']]);
    expect(blocks[1]!.photoCards).toHaveLength(1);
    const pptx = new TextDecoder().decode(buildPptx(buildCatatReport(r, 'x')));
    expect(pptx).toContain('Bahan &amp; alat');
    expect(pptx).toContain('Panci');
  });
  it('resep: tanggal mulai produksi per jalur di identitas; Catatan Laporan = slide PPTX terakhir "Laporan"', async () => {
    const { jalurStartLines } = await import('@/lib/labStore');
    const v: ProtocolVersion = {
      id: 'GH-P01-v1', key: 'GH-P01', version: 1, product: 'GH', productName: 'Green House', name: 'Progres', author: 'Owner', reason: 'awal', createdAt: '2026-10-26T11:00:00.000Z', ingredients: [], steps: [],
      catatId: withBio.id, jalurExtra: ['Bio Leather Rumput'], jalurStart: ['2026-10-20', '2026-10-22'], reportNote: 'Paragraf pertama laporan.\n\nParagraf kedua: hasil fermentasi baik.',
    };
    expect(jalurStartLines(v)).toEqual(['Tanggal mulai produksi: Green House 2026-10-20 · Bio Leather Rumput 2026-10-22']);
    const report = buildResearchReport('GH-P01', [v], [], [], 'x', undefined, [withBio]);
    const last = report.blocks.at(-1)!;
    expect(last.heading).toBe('Laporan');
    expect(last.lines).toEqual(['Paragraf pertama laporan.', 'Paragraf kedua: hasil fermentasi baik.']);
    const slides = new TextDecoder().decode(buildPptx(report)).split('<p:sld ').slice(1);
    const lap = slides.at(-1)!;
    expect(lap).toContain('>Laporan<');
    expect(lap).toContain('Paragraf kedua: hasil fermentasi baik.');
    // slide "Laporan" berdiri sendiri (tidak ditumpuk dengan Penutup)
    expect(lap).not.toContain('Riset belum ditandai selesai');
    expect(buildResearchReport('GH-P01', [{ ...v, reportNote: '  ' }], [], [], 'x', undefined, [withBio]).blocks.some((b) => b.heading === 'Laporan')).toBe(false);
  });
});
