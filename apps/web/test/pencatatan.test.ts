import { describe, expect, it } from 'vitest';
import { awalColumns, blankRows, buildCatatReport, compareRecord, compareTable, conclusions, missingAkhir, missingAwal, nextCatatId, type CatatRecord } from '@/lib/pencatatan';
import { buildDocx, buildPptx } from '@/lib/officeExport';

const rec = (finished = true): CatatRecord => ({
  id: 'PD-261015-01',
  item: 'Kelapa tua',
  count: 3,
  createdAt: '2026-10-15T08:00:00.000Z',
  ...(finished && { finishedAt: '2026-10-17T08:00:00.000Z' }),
  rows: [
    { no: 1, beratAwal: '1.000', volAir: '300', beratAir: '310', tebalAwal: '10', ...(finished && { beratAkhir: '900', tebalAkhir: '8' }) },
    { no: 2, beratAwal: '1.200', volAir: '', beratAir: '', tebalAwal: '12', ...(finished && { beratAkhir: '1.140', tebalAkhir: '11,4' }) },
    { no: 3, beratAwal: '800', volAir: '', beratAir: '', tebalAwal: '9', ...(finished && { beratAkhir: '600', tebalAkhir: '9' }) },
  ],
});

describe('pencatatan data awal & akhir (DEC-074)', () => {
  it('baris sebanyak jumlah, kolom per item, kolom wajib', () => {
    expect(blankRows(50)).toHaveLength(50);
    expect(blankRows(3).map((r) => r.no)).toEqual([1, 2, 3]);
    expect(awalColumns('Kelapa muda').map(([k]) => k)).toEqual(['beratAwal', 'volAir', 'beratAir', 'tebalAwal']);
    expect(awalColumns('Sekam').map(([k]) => k)).toEqual(['beratAwal']);
    const rows = blankRows(3);
    rows[0]!.beratAwal = '1';
    expect(missingAwal('Sekam', rows)).toEqual([2, 3]);
    expect(missingAwal('Kelapa tua', rows)).toEqual([1, 2, 3]);
    expect(missingAkhir('Kelapa tua', rec(false).rows)).toEqual([1, 2, 3]);
    expect(missingAkhir('Kelapa tua', rec().rows)).toEqual([]);
  });

  it('perbandingan: selisih, persen, rata-rata; kesimpulan deskriptif', () => {
    // rumus owner (DEC-083): selisih berat = berat awal − berat air − berat akhir; % terhadap (awal − air)
    const full: CatatRecord = { ...rec(), rows: rec().rows.map((r, i) => ({ ...r, beratAir: ['310', '160', '100'][i]! })) };
    const [berat, tebal] = compareRecord(full);
    expect(berat!.formula).toBe('awal-air-akhir');
    // 1000−310−900 = −210 ; 1200−160−1140 = −100 ; 800−100−600 = 100
    expect(berat!.rows.map((r) => [r.basis, r.selisih, Number(r.pct!.toFixed(2))])).toEqual([[690, -210, -30.43], [1040, -100, -9.62], [700, 100, 14.29]]);
    expect(berat!.meanSelisih).toBeCloseTo(-70);
    expect(berat!.meanBasis).toBeCloseTo(810);
    expect(berat!.noAir).toEqual([]);
    expect(compareTable(berat!).head).toEqual(['No', 'Berat awal (g)', 'Berat air (g)', 'Awal − air (g)', 'Berat akhir (g)', 'Selisih (g)', 'Selisih (%)']);
    expect(compareTable(berat!).rows[0]).toEqual(['1', '1000', '310', '690', '900', '-210', '-30,4%']);
    expect(compareTable(berat!).rows.at(-1)![0]).toBe('Rata-rata');
    // tebal tetap akhir − awal
    expect(tebal!.formula).toBe('akhir-awal');
    expect(tebal!.rows[2]!.pct).toBe(0);
    const c = conclusions(full);
    expect(c[0]).toContain('Berat (berat awal − berat air − berat akhir): selisih rata-rata -70 g');
    expect(c[1]).toContain('Tebal daging rata-rata turun');
    // berat air kosong → nomor itu tidak dihitung (tidak dianggap 0)
    const partial = compareRecord(rec())[0]!;
    expect(partial.n).toBe(1);
    expect(partial.noAir).toEqual([2, 3]);
    expect(conclusions(rec())[0]).toContain('Nomor 2, 3 belum dihitung karena berat air kosong');
    // item tanpa kolom berat air (mis. sekam) tetap akhir − awal
    expect(compareRecord({ ...rec(), item: 'Sekam' })[0]!.formula).toBe('akhir-awal');
    expect(conclusions(rec(false))[0]).toContain('Data akhir belum dicatat');
  });

  it('laporan: data awal, akhir, perbandingan (+grafik), kesimpulan → PDF/Word/PPTX', () => {
    const r = buildCatatReport({ ...rec(), rows: rec().rows.map((x, i) => ({ ...x, beratAir: ['310', '160', '100'][i]! })) }, 'x');
    expect(r.blocks.map((b) => b.heading)).toEqual(['Data awal', 'Data akhir', 'Perbandingan berat', 'Perbandingan tebal daging', 'Kesimpulan']);
    expect(r.blocks[2]!.charts).toHaveLength(1);
    expect(r.blocks[2]!.lines[0]).toContain('berat awal − berat air − berat akhir');
    expect(r.blocks[2]!.table!.rows[0]).toEqual(['1', '1000', '310', '690', '900', '-210', '-30,4%']);
    expect(buildCatatReport(rec(false), 'x').blocks.map((b) => b.heading)).toEqual(['Data awal', 'Kesimpulan']);
    expect(buildDocx(r).length).toBeGreaterThan(100);
    expect(buildPptx(r).length).toBeGreaterThan(100);
  });

  it('foto per nomor ikut di galeri laporan data awal & akhir (DEC-075)', () => {
    const r0 = rec();
    r0.rows[0]!.fotoAwal = 'data:image/jpeg;base64,/9j/AA';
    r0.rows[2]!.fotoAkhir = 'data:image/jpeg;base64,/9j/BB';
    const r = buildCatatReport(r0, 'x');
    expect(r.blocks[0]!.images.map((i) => i.caption)).toEqual(['No 1 · data awal']);
    expect(r.blocks[1]!.images.map((i) => [i.caption, i.name])).toEqual([['No 3 · data akhir', 'PD-261015-01-003-akhir.jpg']]);
    expect(buildDocx(r).length).toBeGreaterThan(100);
    // PPTX ikut memuat foto data awal & akhir (slide foto)
    const pptx = new TextDecoder().decode(buildPptx(r));
    expect(pptx).toContain('ppt/media/image1.jpeg');
    expect(pptx).toContain('ppt/media/image2.jpeg');
    // grid: judul blok, label DATA AWAL / DATA AKHIR, data di bawah foto; akhir tanpa volume/berat air
    expect(pptx).toContain('Foto data awal &amp; akhir · No 1–3');
    expect(pptx).toContain('DATA AWAL');
    expect(pptx).toContain('DATA AKHIR');
    expect(pptx).toContain('Vol. air 300 mL');
    expect(pptx).toContain('tanpa foto');
    expect(pptx).not.toContain('— foto/video');
    expect(r.blocks.find((b) => b.photoPairs)!.photoPairs![2]!.akhir!.lines).toEqual(['Berat 600 g', 'Tebal 9 mm']);
    expect(r.blocks.find((b) => b.photoPairs)!.pptxOnly).toBe(true);
  });

  it('Simpan dulu: data akhir sementara ikut laporan & unduhan, status tetap menunggu (DEC-082)', () => {
    const base0 = rec(false);
    const draft: CatatRecord = { ...base0, akhirSavedAt: '2026-10-16T09:30:00.000Z', rows: base0.rows.map((r) => (r.no === 1 ? { ...r, beratAkhir: '900', tebalAkhir: '8' } : r)) };
    const r = buildCatatReport(draft, 'x');
    expect(r.subtitle).toContain('tersimpan sementara');
    expect(r.cover!.done).toBe(false);
    const akhir = r.blocks.find((b) => b.heading.startsWith('Data akhir'))!;
    expect(akhir.heading).toBe('Data akhir (sementara, belum lengkap)');
    expect(akhir.lines).toContain('Terisi: 1 dari 3 nomor');
    expect(akhir.table!.rows[0]).toEqual(['1', '900', '8']);
    expect(akhir.table!.rows[1]).toEqual(['2', '–', '–']);
    expect(conclusions(draft)[0]).toContain('1 dari 3 nomor terisi');
    expect(new TextDecoder().decode(buildDocx(r))).toContain('Data akhir (sementara, belum lengkap)');
    expect(new TextDecoder().decode(buildPptx(r))).toContain('sementara');
    // tanpa data akhir sama sekali: tetap seperti sebelumnya
    expect(buildCatatReport(rec(false), 'x').blocks.some((b) => b.heading.startsWith('Data akhir'))).toBe(false);
  });

  it('perlakuan: bagian sendiri di PDF/Word; di PPTX di bawah data akhir + slide penjelasan (DEC-079/087)', async () => {
    const { treatmentRows, TREATMENT_GROUPS } = await import('@/lib/pencatatan');
    expect(TREATMENT_GROUPS.map((g) => g.title)).toEqual(['Jumlah perlakuan kopra', 'Jumlah perlakuan bibit bio leather', 'Jumlah perlakuan cuka', 'Jumlah perlakuan bio leather']);
    expect(TREATMENT_GROUPS[0].methods).toEqual(['GreenHouse', 'Oven Gas', 'Oven Briket']);
    const r0 = { ...rec(), treatments: { kopra: [{ count: '3', method: 'Oven Gas' }, { count: '1', method: 'Oven Briket' }], bio: { count: '', method: 'Bio Leather B - Gula 50g' }, cuka: { count: '', method: '' } } };
    expect(treatmentRows(r0.treatments)).toEqual([['Jumlah perlakuan kopra', '3', 'Oven Gas'], ['Jumlah perlakuan kopra', '1', 'Oven Briket'], ['Jumlah perlakuan bio leather', '–', 'Bio Leather B - Gula 50g']]);
    const r = buildCatatReport(r0, 'x');
    const heads = r.blocks.map((b) => b.heading);
    expect(heads.slice(-2)).toEqual(['Perlakuan', 'Kesimpulan']);
    expect(r.blocks.find((b) => b.heading === 'Perlakuan')!.pptxSkip).toBe(true);
    const docx = new TextDecoder().decode(buildDocx(r));
    expect(docx).toContain('Perlakuan/metode');
    const pptx = new TextDecoder().decode(buildPptx(r));
    // PPTX (DEC-087): tabel perlakuan tepat di bawah tabel data akhir (bukan di Kesimpulan)
    const slides = pptx.split('<p:sld ').slice(1);
    const akhir = slides.find((x) => x.includes('>Data akhir<'))!;
    expect(akhir).toContain('PERLAKUAN');
    expect(akhir).toContain('Oven Gas');
    expect(akhir.indexOf('Berat akhir (g)')).toBeLessThan(akhir.indexOf('Perlakuan/metode'));
    expect(slides.find((x) => x.includes('>Kesimpulan<'))).not.toContain('Perlakuan/metode');
    // satu slide penjelasan semua perlakuan yang tersedia
    const info = slides.filter((x) => x.includes('Penjelasan perlakuan'));
    expect(info).toHaveLength(1);
    for (const m of ['GreenHouse', 'Oven Briket', 'A - PH 40', 'CUKA 3 - GULA 50', 'Bio Leather B - Gula 50g']) expect(info[0]).toContain(m);
    expect(info[0]).toContain('bukan protokol');
  });

  it('PPTX: perbandingan = grafik garis native + penjelasan di bawahnya + tabel (DEC-087)', async () => {
    const { statConclusion, compareRecord } = await import('@/lib/pencatatan');
    const r = buildCatatReport(rec(), 'x');
    const tebal = r.blocks.find((b) => b.heading === 'Perbandingan tebal daging')!;
    expect(tebal.nativeChart).toBe(true);
    expect(tebal.chartCaption).toContain('Garis hijau = tebal daging awal');
    expect(tebal.chartCaption).toContain(statConclusion(rec(), compareRecord(rec())[1]!));
    const slides = new TextDecoder().decode(buildPptx(r)).split('<p:sld ').slice(1);
    const sl = slides.find((x) => x.includes('>Perbandingan tebal daging<'))!;
    // garis seri (konektor) + legenda Awal/Akhir; tanpa gambar PNG; penjelasan sebelum tabel
    expect((sl.match(/<p:cxnSp>/g) ?? []).length).toBeGreaterThan(6);
    expect(sl).toContain('>Awal<');
    expect(sl).toContain('>Akhir<');
    expect(sl).not.toContain('grafik tidak tersedia');
    expect(sl.indexOf('Garis hijau')).toBeLessThan(sl.indexOf('<a:tbl>'));
  });

  it('kode PD-YYMMDD-NN', () => {
    expect(nextCatatId(['PD-261015-01', 'PD-261015-04'], new Date(2026, 9, 15), '')).toBe('PD-261015-05');
  });
});

describe('progres harian & PPTX padat (DEC-086)', () => {
  const JPG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 10, 0, 20, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]).toString('base64')}`;
  const withAir = (): CatatRecord => ({ ...rec(), rows: rec().rows.map((x, i) => ({ ...x, beratAir: ['310', '160', '100'][i]! })) });
  const prog = (n: number, stage: 'harian' | 'mingguan' | 'bulanan', day0 = 1) =>
    Array.from({ length: n }, (_, i) => ({ id: `PR-${stage}-${i}`, date: `2026-10-${String(day0 + i).padStart(2, '0')}`, title: `Foto ${stage} ${i + 1}`, temp: '28', note: i ? '' : 'mulai kering', stage, photo: JPG, at: `2026-10-${String(day0 + i).padStart(2, '0')}T08:00:00.000Z` }));

  it('usulan tahap dari jarak hari ke foto pertama', async () => {
    const { suggestStage } = await import('@/lib/pencatatan');
    expect(suggestStage(undefined, '2026-10-16')).toBe('harian');
    const first = prog(1, 'harian');
    expect(suggestStage(first, '2026-10-07')).toBe('harian');
    expect(suggestStage(first, '2026-10-08')).toBe('mingguan');
    expect(suggestStage(first, '2026-10-31')).toBe('bulanan');
  });

  it('laporan tidak lagi memuat progres harian/mingguan/bulanan (DEC-101)', () => {
    const r = buildCatatReport({ ...withAir(), progress: [...prog(6, 'harian'), ...prog(2, 'mingguan', 10), ...prog(1, 'bulanan', 20)] }, 'x');
    expect(r.blocks.some((b) => /progres/i.test(b.heading) || b.progressColumns)).toBe(false);
    expect(new TextDecoder().decode(buildPptx(r))).not.toContain('MINGGUAN · ');
  });

  it('PPTX: tabel perbandingan tebal daging satu slide dengan grafiknya (di bawah grafik)', () => {
    const r = buildCatatReport(withAir(), 'x');
    const slides = new TextDecoder().decode(buildPptx(r)).split('<p:sld ').slice(1);
    const tebal = slides.filter((x) => x.includes('Perbandingan tebal daging'));
    expect(tebal).toHaveLength(1);
    expect(tebal[0]).toContain('<a:tbl>');
    // grafik/teks lebih dulu (y lebih kecil) daripada tabel
    const tblY = Number(/<p:graphicFrame>[\s\S]*?<a:off x="\d+" y="(\d+)"/.exec(tebal[0]!)![1]);
    expect(tblY).toBeGreaterThan(1150000);
  });
});

describe('perlakuan: foto & keterangan (DEC-089)', () => {
  const JPG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 40, 0, 30, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]).toString('base64')}`;
  it('kolom keterangan di tabel; foto ikut PDF/Word & slide foto perlakuan di PPTX', async () => {
    const { treatmentItems } = await import('@/lib/pencatatan');
    const t = { kopra: [{ count: '3', method: 'Oven Gas', note: 'suhu 60 °C', photo: JPG }, { count: '', method: '', note: 'kontrol tanpa oven' }] };
    expect(treatmentItems(t).map((i) => [i.method, i.note, !!i.photo])).toEqual([['Oven Gas', 'suhu 60 °C', true], ['–', 'kontrol tanpa oven', false]]);
    const r = buildCatatReport({ ...rec(), treatments: t }, 'x');
    const pr = r.blocks.find((b) => b.heading === 'Perlakuan')!;
    expect(pr.table!.head).toEqual(['Perlakuan', 'Jumlah', 'Perlakuan/metode', 'Keterangan']);
    expect(pr.table!.rows[0]).toEqual(['Jumlah perlakuan kopra', '3', 'Oven Gas', 'suhu 60 °C']);
    expect(pr.images).toHaveLength(1);
    const cards = r.blocks.find((b) => b.heading === 'Foto perlakuan')!;
    expect(cards.pptxOnly).toBe(true);
    expect(cards.photoCards![0]!.lines).toEqual(['Perlakuan kopra', 'Oven Gas', 'Jumlah: 3', 'suhu 60 °C']);
    const slides = new TextDecoder().decode(buildPptx(r)).split('<p:sld ').slice(1);
    const fs = slides.find((x) => x.includes('>Foto perlakuan<'))!;
    expect(fs).toContain('<p:pic>');
    expect(fs).toContain('suhu 60 °C');
    expect(slides.find((x) => x.includes('>Data akhir<'))).toContain('Keterangan');
  });
});
