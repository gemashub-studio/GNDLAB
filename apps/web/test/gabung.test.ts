import { describe, expect, it } from 'vitest';
import { newLpj } from '@/lib/belanja';
import { buildPptx } from '@/lib/officeExport';
import { belanjaGroups, buildGabungReport, reportText } from '@/lib/gabungData';
import type { CatatRecord } from '@/lib/pencatatan';

const rec: CatatRecord = {
  id: 'PD-261021-01',
  item: 'Kelapa tua',
  count: 2,
  createdAt: '2026-10-21T08:00:00.000Z',
  finishedAt: '2026-10-21T10:00:00.000Z',
  rows: [
    { no: 1, beratAwal: '1000', volAir: '300', beratAir: '300', tebalAwal: '10', beratAkhir: '600', tebalAkhir: '8' },
    { no: 2, beratAwal: '1100', volAir: '300', beratAir: '310', tebalAwal: '11', beratAkhir: '650', tebalAkhir: '9' },
  ],
};
const jpg = 'data:image/jpeg;base64,/9j/AA';
const lpj = { ...newLpj('LPJ-202610-01'), proofs: [{ title: 'Toko Kimia', total: '50.000', description: '', receipts: [{ id: 'n', name: 'nota.jpg', dataUrl: jpg }], goods: [{ id: 'b', name: 'b.jpg', dataUrl: jpg, label: 'Kertas pH' }] }] };

describe('Gabungkan data (DEC-126)', () => {
  it('minimal satu data; pencatatan + laporan belanja → bagian berawalan & slide belanja padat', () => {
    expect(() => buildGabungReport({ lpjs: [] }, 'x')).toThrow(/minimal satu/);
    const r = buildGabungReport({ rec, lpjs: [lpj as never] }, 'x');
    expect(r.title).toBe('Gabungan data PD-261021-01');
    expect(r.cover.meta.map(([k]) => k)).toEqual(['Pencatatan', 'Laporan belanja']);
    expect(r.blocks.some((b) => b.heading.startsWith('Pencatatan · '))).toBe(true);
    expect(r.blocks.find((b) => b.belanja)?.belanja?.[0]?.label).toBe('Toko Kimia · Rp50.000');
    expect(belanjaGroups([lpj as never])[0]!.leaves[0]!.label).toBe('Kertas pH');
    // TXT tanpa gambar: tanpa blok khusus PowerPoint
    const t = reportText(r);
    expect(t).toContain('Gabungan data PD-261021-01');
    expect(t).toContain('== PENCATATAN · DATA AWAL ==');
    expect(t).not.toContain('== LAPORAN BELANJA ==');
    // PPTX tersusun (kepala "GnD Lab" + bilah kicker + label tegak)
    const x = new TextDecoder().decode(buildPptx(r));
    expect(x).toContain('GnD Lab');
    expect(x).toContain('SAINS &amp; CATATAN LAB');
    expect(x).toContain('vert="vert270"');
  });
  it('hanya laporan belanja juga bisa', () => {
    const r = buildGabungReport({ lpjs: [lpj as never] }, 'x');
    expect(r.cover.code).toBe('LPJ-202610-01');
    expect(r.cover.meta).toEqual([['Laporan belanja', '1 laporan · 1 nota']]);
  });
});

describe('komponen infografik PPTX (DEC-127)', () => {
  it('ikon vektor: path SVG → DrawingML; ikon judul sesuai kata kunci; panel jalur produk & lingkaran keterangan', async () => {
    const { iconPath, iconFor, ICONS } = await import('@/lib/officeExport');
    expect(iconPath('M10 20 L30 40 C1 2 3 4 5 6 Z')).toBe('<a:path w="10000" h="10000"><a:moveTo><a:pt x="1000" y="2000"/></a:moveTo><a:lnTo><a:pt x="3000" y="4000"/></a:lnTo><a:cubicBezTo><a:pt x="100" y="200"/><a:pt x="300" y="400"/><a:pt x="500" y="600"/></a:cubicBezTo><a:close/></a:path>');
    expect(Object.keys(ICONS)).toEqual(['palm', 'coconut', 'briket', 'flask', 'leaf', 'flame', 'sack', 'drop', 'tree']);
    expect(iconFor('Laporan belanja')).toBe('sack');
    expect(iconFor('Perbandingan berat')).toBe('drop');
    expect(iconFor('Komposisi bahan (versi 2)')).toBe('flask');
    expect(iconFor('Ringkasan')).toBe('palm');
    const x = new TextDecoder().decode(buildPptx(buildGabungReport({ rec, lpjs: [] }, 'x')));
    expect(x).toContain('<a:custGeom>');
    expect(x).toContain('JALUR PRODUK KELAPA');
    expect(x).toContain('Isi laporan = catatan pengguna.');
  });
});
