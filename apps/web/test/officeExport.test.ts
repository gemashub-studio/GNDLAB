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
      'Identitas riset', 'Komposisi bahan (versi 1)', 'Alat yang digunakan', 'Urutan hari', 'Riwayat versi', 'Laporan harian',
      '2026-10-12 · KE-P01-H01', '2026-10-12 · KE-P01-H02 · LAPORAN PENUTUP (SELESAI)', 'Penutup',
    ]);
    expect(r.subtitle).toContain('SELESAI');
    expect(r.blocks[2]!.table!.rows).toEqual([['1', 'Oven listrik', '1', 'unit'], ['2', 'Timbangan', '–', '–']]);
    expect(() => buildResearchReport('XX-P09', [v1], [], [])).toThrow(/tidak ditemukan/);
  });

  it('DOCX & PPTX berisi bagian Office wajib; teks di-escape', () => {
    const r = buildResearchReport('KE-P01', [v1], [day('KE-P01-H01')], [], 'x');
    const docx = buildDocx(r);
    expect(zipNames(docx)).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels']);
    const docXml = new TextDecoder().decode(docx);
    expect(docXml).toContain('Kopra oven &lt;bertahap&gt; &amp; &quot;putih&quot;');
    const names = zipNames(buildPptx(r));
    for (const n of ['ppt/presentation.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/theme/theme1.xml', 'ppt/slides/slide1.xml']) expect(names).toContain(n);
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length).toBeGreaterThanOrEqual(r.blocks.length + 1);
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
    expect(r.blocks[3]!.lines[0]).toBe('Hari ke-1: Belah & tiriskan · 15 menit');
  });
});
