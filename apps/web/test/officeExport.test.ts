import { describe, expect, it } from 'vitest';
import { buildDocx, buildPptx, crc32, jpegSize, xml, zipStore } from '@/lib/officeExport';
import { buildResearchReport } from '@/lib/researchReport';
import type { DailyEntry, ProtocolVersion } from '@/lib/labStore';

/** Baca daftar nama berkas dari central directory zip (cukup untuk memeriksa struktur). */
function zipNames(b: Uint8Array): string[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const end = b.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const n = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const len = v.getUint16(p + 28, true);
    out.push(new TextDecoder().decode(b.subarray(p + 46, p + 46 + len)));
    p += 46 + len;
  }
  return out;
}

const v1: ProtocolVersion = {
  id: 'KE-P01-v1', key: 'KE-P01', version: 1, product: 'KE', name: 'Kopra oven <bertahap> & "putih"', author: 'Owner', reason: 'versi awal', createdAt: '2026-10-11T01:00:00.000Z',
  ingredients: [{ name: 'Daging kelapa', amount: '2', unit: 'kg' }], steps: [{ text: 'Belah & tiriskan', duration: '15 menit', conditions: '' }], tools: [{ name: 'Oven listrik', amount: '1', unit: 'unit' }, 'Timbangan'],
};
const day = (id: string, finished = false): DailyEntry => ({
  id, experimentId: 'KE-P01', entryDate: '2026-10-12', createdAt: id, protocolId: 'KE-P01-v1', plan: '', actual: 'Oven 60 °C', materials: [], tools: '', conditions: '',
  measurements: [{ name: 'Kadar air', value: '6,1', unit: '%', at: '2026-10-12T08:00', group: '', note: '' }], deviations: '', interpretation: '', nextStep: '', mediaIds: [], ...(finished && { finished }),
});

describe('ekspor laporan riset produk (DEC-052)', () => {
  it('CRC-32 standar & escape XML', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(xml('a<b>&"c"')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });

  it('zip store: berkas & isi utuh', () => {
    const z = zipStore([{ name: 'a.txt', data: new TextEncoder().encode('halo') }, { name: 'dir/b.xml', data: new TextEncoder().encode('<x/>') }]);
    expect(zipNames(z)).toEqual(['a.txt', 'dir/b.xml']);
  });

  it('model laporan: urutan awal → akhir, status selesai dari laporan penutup', () => {
    const r = buildResearchReport('KE-P01', [v1], [day('KE-P01-H01'), day('KE-P01-H02', true)], [], 'x');
    expect(r.blocks.map((b) => b.heading)).toEqual([
      'Identitas riset', 'Ringkasan hasil & grafik', 'Komposisi bahan (versi 1)', 'Alat yang digunakan', 'Urutan hari', 'Riwayat versi', 'Laporan harian',
      '2026-10-12 · KE-P01-H01', '2026-10-12 · KE-P01-H02 · LAPORAN PENUTUP (SELESAI)', 'Penutup',
    ]);
    expect(r.subtitle).toContain('SELESAI');
    expect(r.blocks[3]!.table!.rows).toEqual([['1', 'Oven listrik', '1', 'unit'], ['2', 'Timbangan', '–', '–']]);
    expect(() => buildResearchReport('XX-P09', [v1], [], [])).toThrow(/tidak ditemukan/);
  });

  it('DOCX & PPTX berisi bagian Office wajib; teks di-escape', () => {
    const r = buildResearchReport('KE-P01', [v1], [day('KE-P01-H01')], [], 'x');
    const docx = buildDocx(r);
    expect(zipNames(docx)).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/footer1.xml']);
    const docXml = new TextDecoder().decode(docx);
    expect(docXml).toContain('Kopra oven &lt;bertahap&gt; &amp; &quot;putih&quot;');
    const names = zipNames(buildPptx(r));
    for (const n of ['ppt/presentation.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/theme/theme1.xml', 'ppt/slides/slide1.xml']) expect(names).toContain(n);
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length).toBeGreaterThanOrEqual(r.blocks.length + 2);
  });

  it('ukuran JPEG dibaca dari penanda SOF', () => {
    const sof = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0xe0, 0x03]);
    expect(jpegSize(sof)).toEqual({ w: 480, h: 300 });
  });
});

describe('tanggal riset produk', () => {
  it('Hari ke-N dari tanggal mulai; selesai OTOMATIS = laporan penutup paling awal', async () => {
    const { dayNumber, researchDates } = await import('@/lib/labStore');
    expect(dayNumber('2026-10-11', '2026-10-11')).toBe(1);
    expect(dayNumber('2026-10-11', '2026-10-13')).toBe(3);
    expect(dayNumber('2026-10-11', '2026-10-10')).toBeUndefined();
    expect(dayNumber(undefined, '2026-10-10')).toBeUndefined();
    expect(researchDates('2026-10-11', [day('a'), { ...day('b', true), entryDate: '2026-10-15' }, { ...day('c', true), entryDate: '2026-10-14' }])).toEqual({ start: '2026-10-11', end: '2026-10-14', days: 4 });
    expect(researchDates('2026-10-11', [day('a')])).toEqual({ start: '2026-10-11' });
    const r = buildResearchReport('KE-P01', [{ ...v1, startDate: '2026-10-11', assistants: ['Rina'] }], [day('KE-P01-H01', true)], [], 'x');
    expect(r.blocks[0]!.lines.join(' ')).toContain('Asisten: Rina');
    expect(r.blocks[0]!.lines.join(' ')).toContain('Tanggal selesai: 2026-10-12 (otomatis');
    expect(r.blocks.find((b) => b.heading.startsWith('Hari ke-2 · 2026-10-12'))).toBeDefined();
    expect(r.blocks[4]!.lines[0]).toBe('Hari ke-1: Belah & tiriskan · 15 menit');
  });
});

describe('laporan per versi', () => {
  it('versi terpilih dipakai untuk resep & judul; riwayat hanya sampai versi itu', () => {
    const v2: ProtocolVersion = { ...v1, id: 'KE-P01-v2', version: 2, reason: 'naik suhu', ingredients: [{ name: 'Daging kelapa', amount: '3', unit: 'kg' }], createdAt: '2026-10-12T01:00:00.000Z' };
    const r1 = buildResearchReport('KE-P01', [v1, v2], [], [], 'x', 'KE-P01-v1');
    expect(r1.title).toContain('(versi 1)');
    expect(r1.blocks[2]!.table!.rows[0]).toEqual(['1', 'Daging kelapa', '2', 'kg']);
    expect(r1.blocks.find((b) => b.heading === 'Riwayat versi')!.table!.rows.map((r) => r[0])).toEqual(['KE-P01-v1']);
    const r2 = buildResearchReport('KE-P01', [v1, v2], [], [], 'x');
    expect(r2.title).toContain('(versi 2)');
    expect(() => buildResearchReport('KE-P01', [v1], [], [], 'x', 'KE-P01-v9')).toThrow(/tidak ditemukan/);
  });
});

describe('grafik laporan (DEC-058)', () => {
  const m = (name: string, value: string, at: string, group = '') => ({ name, value, unit: '%', at, group, note: '' });
  const e = (id: string, date: string, ms: ReturnType<typeof m>[]): DailyEntry => ({ ...day(id), entryDate: date, measurements: ms });

  it('garis per Hari ke-N, nilai terakhir per hari, hari kosong = null; batang bila ≥ 2 kelompok', async () => {
    const { researchCharts } = await import('@/lib/reportCharts');
    const days = [
      e('a', '2026-10-11', [m('Kadar air', '50', '2026-10-11T08:00', 'A'), m('Kadar air', '48', '2026-10-11T16:00', 'A'), m('Kadar air', '51', '2026-10-11T08:00', 'B')]),
      e('b', '2026-10-13', [m('Kadar air', '20', '2026-10-13T08:00', 'A')]),
    ];
    const { charts, summary, insufficient } = researchCharts('2026-10-11', days);
    expect(insufficient).toEqual([]);
    const line = charts.find((c) => c.kind === 'line')!;
    expect(line.x).toEqual(['Hari 1', 'Hari 3']);
    expect(line.series.map((s) => [s.name, s.values])).toEqual([['A', [48, 20]], ['B', [51, null]]]);
    const bar = charts.find((c) => c.kind === 'bar')!;
    expect(bar.series[0]!.values).toEqual([20, 51]);
    expect(summary.find((s) => s.group === 'A')).toMatchObject({ n: 3, first: 50, last: 20, min: 20, max: 50, firstAt: 'Hari 1', lastAt: 'Hari 3' });
  });

  it('data kurang → tidak ada grafik, ditulis "data belum cukup"; nilai bukan angka dihitung', async () => {
    const { researchCharts } = await import('@/lib/reportCharts');
    const r = researchCharts(undefined, [e('a', '2026-10-11', [m('Warna', 'putih', '2026-10-11T08:00'), m('pH', '4,2', '2026-10-11T08:00')])]);
    expect(r.charts).toEqual([]);
    expect(r.insufficient.join(' ')).toContain('pH (%): data belum cukup');
  });

  it('chartSvg: SVG valid, angka format Indonesia, teks di-escape; garis putus di hari kosong', async () => {
    const { chartSvg, chartLayout, niceTicks } = await import('@/lib/reportCharts');
    const spec = { id: 'x', title: 't', unit: '%', kind: 'line' as const, x: ['H1', 'H2', 'H3', 'H4'], xTitle: 'Hari <ke>', note: '', series: [{ name: 'A&B', color: '#1FA88F', values: [1.5, 2, null, 3] }] };
    const svg = chartSvg(spec);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('A&amp;B');
    expect(svg).toContain('Hari &lt;ke&gt;');
    expect(svg).toContain('>1,5<');
    expect(chartLayout(spec).filter((p) => p.t === 'poly')).toHaveLength(1);
    expect(niceTicks(0, 9.3)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('laporan: KPI, sampul, blok ringkasan; DOCX/PPTX menanam PNG grafik', () => {
    const days = [e('KE-P01-H01', '2026-10-11', [m('Kadar air', '50', '2026-10-11T08:00')]), e('KE-P01-H02', '2026-10-12', [m('Kadar air', '30', '2026-10-12T08:00')])];
    const r = buildResearchReport('KE-P01', [{ ...v1, startDate: '2026-10-11' }], days, [], 'x');
    expect(r.kpis.find((k) => k.label === 'Grafik')!.value).toBe('1');
    expect(r.cover.meta[0]).toEqual(['Kode', 'KE-P01']);
    const ring = r.blocks[1]!;
    expect(ring.table!.rows[0]).toEqual(['Kadar air (%)', 'semua', '2', '50 (Hari 1)', '30 (Hari 2)', '30', '50']);
    const png = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), w: 1280, h: 600 };
    const charts = new Map([[ring.charts![0]!.id, png]]);
    expect(zipNames(buildDocx(r, charts))).toContain('word/media/image1.png');
    expect(zipNames(buildPptx(r, charts)).some((n) => /^ppt\/media\/image\d+\.png$/.test(n))).toBe(true);
  });
});

describe('laporan harian per hari (DEC-072)', () => {
  it('satu hari: identitas, kegiatan resep hari itu, isi laporan hari itu saja, lanjut hari berikutnya; ekspor 3 format', async () => {
    const { buildDailyResearchReport } = await import('@/lib/researchReport');
    const v = { ...v1, startDate: '2026-10-11', steps: [{ text: 'Belah', duration: '', conditions: '' }, { text: 'Oven 60 °C', duration: '8 jam', conditions: '' }, { text: 'Kemas', duration: '', conditions: '' }] };
    const d1 = { ...day('KE-P01-H01'), entryDate: '2026-10-12', nextStep: 'Cek kadar air' };
    const d2 = { ...day('KE-P01-H02'), entryDate: '2026-10-13', actual: 'hari lain' };
    const r = buildDailyResearchReport('KE-P01', [v], [d1, d2], [], 'KE-P01-H01', 'x');
    expect(r.title).toBe('Laporan harian Hari ke-2 — ' + v.name);
    const heads = r.blocks.map((b) => b.heading);
    expect(heads).toContain('Kegiatan resep Hari ke-2');
    expect(heads.find((h) => h.startsWith('Laporan Hari ke-2'))).toBeDefined();
    expect(r.blocks.find((b) => b.heading === 'Kegiatan resep Hari ke-2')!.lines[0]).toBe('Hari ke-2: Oven 60 °C · 8 jam');
    const next = r.blocks.find((b) => b.heading === 'Lanjut ke hari berikutnya')!;
    expect(next.lines).toEqual(['Langkah berikutnya (isian): Cek kadar air', 'Kegiatan resep Hari ke-3: Kemas']);
    expect(JSON.stringify(r)).not.toContain('hari lain');
    expect(r.cover.meta[0]).toEqual(['Laporan', 'Hari ke-2 · 2026-10-12']);
    expect(buildDocx(r).length).toBeGreaterThan(100);
    expect(buildPptx(r).length).toBeGreaterThan(100);
    expect(() => buildDailyResearchReport('KE-P01', [v], [d1], [], 'KE-P01-H09')).toThrow(/tidak ditemukan/);
  });
});

describe('laporan dengan video (DEC-073)', () => {
  const vidMedia = { id: 'KE-P01-v1-I1-M01', experimentId: 'KE-P01', entryId: 'KE-P01-v1', name: 'rekam.mp4', type: 'video/mp4', size: 4, caption: 'aduk', createdAt: 'x', thumb: 'data:image/jpeg;base64,/9j/', blob: new Blob([new Uint8Array([0, 0, 0, 24])]) };
  const fotoMedia = { ...vidMedia, id: 'KE-P01-v1-I1-M02', name: 'foto.jpg', type: 'image/jpeg', caption: 'daging' };
  const v = { ...v1, ingredients: [{ name: 'Daging kelapa', amount: '2', unit: 'kg', mediaIds: [vidMedia.id, fotoMedia.id] }] };

  it('HTML: video diputar (<video controls> + data URL asli), foto asli, grafik SVG, teks di-escape', async () => {
    const { buildReportHtml } = await import('@/lib/reportHtml');
    const r = buildResearchReport('KE-P01', [v], [day('KE-P01-H01'), { ...day('KE-P01-H02'), entryDate: '2026-10-13' }], [vidMedia, fotoMedia], 'x');
    const fake = async (m: { type: string }) => `data:${m.type};base64,QUJD`;
    const { html, videos } = await buildReportHtml(r, [vidMedia, fotoMedia], fake);
    expect(videos).toBe(1);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<video controls playsinline preload="metadata" poster="data:image/jpeg;base64,/9j/" src="data:video/mp4;base64,QUJD">');
    expect(html).toContain('<img src="data:image/jpeg;base64,QUJD"');
    expect(html).toContain('Kopra oven &lt;bertahap&gt; &amp; &quot;putih&quot;');
    expect(html).toContain('<meta name="viewport"');
  });

  it('PowerPoint: video asli tertanam (videoFile + p14:media + urutan klik), tanpa video tetap gambar', async () => {
    const r = buildResearchReport('KE-P01', [v], [], [vidMedia, fotoMedia], 'x');
    const vids = new Map([[vidMedia.id, { bytes: new Uint8Array([1, 2, 3]), ext: 'mp4', mime: 'video/mp4' }]]);
    const zip = buildPptx(r, new Map(), vids);
    expect(zipNames(zip)).toContain('ppt/media/media1.mp4');
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('<a:videoFile r:link="rIdV1"/>');
    expect(text).toContain('{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}');
    expect(text).toContain('cmd="togglePause"');
    expect(text).toContain('<Default Extension="mp4" ContentType="video/mp4"/>');
    expect(zipNames(buildPptx(r)).some((n) => n.includes('media1.mp4'))).toBe(false);
  });
});
