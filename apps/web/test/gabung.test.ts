import { describe, expect, it } from 'vitest';
import { belanjaGroups, buildGabungReport, reportText } from '@/lib/gabungData';
import { newLpj } from '@/lib/belanja';
import { answerCards, buildLabPrompt, FRIENDLY_EMOJI } from '@/lib/labAi';
import { buildDocx, buildPptx } from '@/lib/officeExport';
import { buildResearchReport } from '@/lib/researchReport';
import type { CatatRecord } from '@/lib/pencatatan';
import type { ProgresItem } from '@/lib/progresPerlakuan';
import type { ProtocolVersion } from '@/lib/labStore';

const jpg = 'data:image/jpeg;base64,/9j/AA';
const rec: CatatRecord = {
  id: 'PD-261015-01',
  item: 'Kelapa tua',
  count: 2,
  createdAt: '2026-10-15T08:00:00.000Z',
  finishedAt: '2026-10-17T08:00:00.000Z',
  rows: [
    { no: 1, beratAwal: '1.000', volAir: '300', beratAir: '310', tebalAwal: '10', beratAkhir: '900', tebalAkhir: '8' },
    { no: 2, beratAwal: '1.200', volAir: '', beratAir: '', tebalAwal: '12', beratAkhir: '1.140', tebalAkhir: '11' },
  ],
};
const proto: ProtocolVersion = {
  id: 'KE-P01-v1', key: 'KE-P01', version: 1, product: 'KE', name: 'Kopra oven', author: 'Owner', reason: 'awal', createdAt: '2026-10-11T01:00:00.000Z',
  ingredients: [{ name: 'Daging kelapa', amount: '2', unit: 'kg' }], steps: [{ text: 'Belah', duration: '15 menit', conditions: '' }],
};
const progres: ProgresItem[] = [
  { id: 'PP-261017-01', treatment: 'GreenHouse', group: 'Perlakuan kopra', category: 'harian', qty: '25', at: '2026-10-17T09:00', photo: jpg, createdAt: 'x' },
  { id: 'PP-261017-02', treatment: 'Oven Gas', group: 'Perlakuan kopra', category: 'bulanan', qty: '7', at: '2026-10-17T10:00', photo: jpg, createdAt: 'x' },
];
const ph = (id: string, label?: string) => ({ id, name: `${id}.jpg`, dataUrl: jpg, ...(label && { label }) });
const lpj = {
  ...newLpj('LPJ-202610-03'),
  proofs: [
    { title: 'Toko Kimia', total: '427.000', description: '', receipts: [ph('n1')], goods: Array.from({ length: 10 }, (_, i) => ph(`b${i}`, `Barang ${i + 1}`)) },
    { title: 'Toko Tani', total: '', description: '', receipts: [ph('n2')], goods: [ph('c1', 'Pupuk')] },
  ],
};

describe('Gabungkan data (DEC-096)', () => {
  const riset = buildResearchReport('KE-P01', [proto], [], [], 'x');
  const r = buildGabungReport({ rec, riset, progres, lpjs: [lpj] }, 'x');

  it('laporan = pencatatan + riset + progres + laporan belanja', () => {
    const heads = r.blocks.map((b) => b.heading);
    expect(heads[0]).toBe('Pencatatan · Data awal');
    expect(heads.some((h) => h.startsWith('Riset · '))).toBe(true);
    expect(heads).toContain('Progres perlakuan');
    expect(heads).toContain('Laporan belanja');
    expect(heads).toContain('Laporan belanja · Toko Kimia');
    expect(r.cover.meta.map(([k]) => k)).toEqual(['Pencatatan', 'Riset produk', 'Progres perlakuan', 'Laporan belanja']);
  });

  it('kelompok belanja: nota selalu bersama barangnya', () => {
    const g = belanjaGroups([lpj]);
    expect(g.map((x) => x.label)).toEqual(['Toko Kimia · Rp427.000', 'Toko Tani']);
    expect(g[0]!.roots).toHaveLength(1);
    expect(g[0]!.leaves).toHaveLength(10);
  });

  it('PPTX: slide Laporan belanja padat; >8 barang → kelompok lanjutan mengulang nota', () => {
    const x = new TextDecoder().decode(buildPptx(r));
    expect(x).toContain('Laporan belanja');
    expect(x).toContain('Toko Kimia · Rp427.000 (lanjutan)');
    expect(x).toContain('NOTA / BUKTI BAYAR');
    expect(x).toContain('Barang 10');
    expect(x).toContain('Pupuk');
  });

  it('Word: bagian laporan belanja per toko (nota lalu barang), tanpa blok khusus PPTX', () => {
    const x = new TextDecoder().decode(buildDocx(r));
    expect(x).toContain('Laporan belanja · Toko Kimia');
    expect(x).toContain('Progres perlakuan');
  });

  it('TXT tanpa gambar: tabel progres & catatan foto tidak disertakan', () => {
    const t = reportText(r);
    expect(t).toContain('== PROGRES PERLAKUAN ==');
    expect(t).toContain('PP-261017-01 | Harian | Green House | 25');
    expect(t).not.toContain('data:image');
    expect(t).toMatch(/foto\/video tidak disertakan di TXT/);
  });
});

describe('Lab AI mode Mendalam (DEC-096)', () => {
  it('prompt meminta pertanyaan penutup ramah + emoji acak', () => {
    const p = buildLabPrompt('kadar air kopra?', 'Mendalam', () => 0);
    expect(p).toContain('Selalu akhiri jawaban dengan satu pertanyaan lanjutan yang ramah');
    expect(p).toContain(FRIENDLY_EMOJI[0]!);
    expect(buildLabPrompt('kadar air kopra?', 'Sedang')).not.toContain('pertanyaan lanjutan');
  });
  it('maks. 4 paragraf per kartu', () => {
    const text = Array.from({ length: 6 }, (_, i) => `Paragraf ${i + 1}.`).join('\n\n');
    expect(answerCards(text, 4).map((c) => c.length)).toEqual([4, 2]);
  });
});
