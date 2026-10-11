import { describe, expect, it } from 'vitest';
import { allocationTotal, blankItem, daysInclusive, itemTotal, newLpj, nextLpjId, parseRp, realizationTotal, subtotals, tanggalPanjang, terbilang, usedPrice } from '@/lib/belanja';
import { buildLpjDocx } from '@/lib/belanjaDocx';

describe('laporan belanja / LPJ (DEC-059)', () => {
  it('terbilang rupiah', () => {
    expect(terbilang(5876200)).toBe('Lima Juta Delapan Ratus Tujuh Puluh Enam Ribu Dua Ratus Rupiah');
    expect(terbilang(0)).toBe('Nol Rupiah');
    expect(terbilang(11)).toBe('Sebelas Rupiah');
    expect(terbilang(1100)).toBe('Seribu Seratus Rupiah');
    expect(terbilang(115000)).toBe('Seratus Lima Belas Ribu Rupiah');
    expect(terbilang(2000000000)).toBe('Dua Miliar Rupiah');
  });

  it('angka isian rupiah & tanggal', () => {
    expect(parseRp('Rp 1.250.000')).toBe(1250000);
    expect(parseRp('18000')).toBe(18000);
    expect(parseRp('10.000,00')).toBe(10000);
    expect(parseRp('')).toBe(0);
    expect(daysInclusive('2026-10-12', '2026-10-18')).toBe(7);
    expect(daysInclusive('2026-10-26', '2026-10-26')).toBe(1);
    expect(daysInclusive('2026-10-26', '')).toBeUndefined();
    expect(tanggalPanjang('2026-10-08')).toBe('8 Oktober 2026');
  });

  it('faktor 1 = harga dasar + batas atas %; jumlah = jumlah beli × harga dipakai (contoh owner)', () => {
    const gula = { ...blankItem('Umum'), name: 'Gula pasir', qty: '1', unit: 'kg', basePrice: '18.000', factor: 1 as const };
    const kelapa = { ...blankItem('Umum'), name: 'Kelapa', qty: '40', unit: 'kg', basePrice: '10.000', factor: 0 as const };
    const baki = { ...blankItem('Kopra'), name: 'Natrium bisulfit', qty: '1', unit: 'pak', basePrice: '50.000', factor: 1 as const };
    expect(usedPrice(gula, '50')).toBe(27000);
    expect(itemTotal(kelapa, '50')).toBe(400000);
    const sec = { title: 'Bahan', intro: '', note: '', items: [kelapa, gula, baki] };
    expect(subtotals(sec, '50')).toEqual([['Umum', 427000], ['Kopra', 75000]]);
    const r = { ...newLpj('LPJ-202610-01'), sections: [sec], proofs: [{ title: 'a', total: '100.000', description: '', receipts: [], goods: [] }, { title: 'b', total: 'Rp 27.000', description: '', receipts: [], goods: [] }] };
    expect(allocationTotal(r)).toBe(502000);
    expect(realizationTotal(r)).toBe(127000);
  });

  it('ID berurutan per bulan', () => {
    const d = new Date(2026, 9, 11);
    expect(nextLpjId([], d)).toBe('LPJ-202610-01');
    expect(nextLpjId(['LPJ-202610-01', 'LPJ-202610-07', 'LPJ-202609-09'], d)).toBe('LPJ-202610-08');
  });

  it('Word: bagian surat, lampiran 1 & 2, teks di-escape', () => {
    const r = { ...newLpj('LPJ-202610-01'), refNo: 'KPA/001', budget: '5.876.200', purpose: 'R&D <Kopra>', timeline: [{ activity: 'Pengadaan', start: '2026-10-12', end: '2026-10-18' }] };
    const doc = new TextDecoder().decode(buildLpjDocx(r));
    for (const t of ['LEMBAR PERTANGGUNGJAWABAN', 'Lima Juta Delapan Ratus Tujuh Puluh Enam Ribu Dua Ratus Rupiah', 'Lampiran 1 Rincian alokasi anggaran', 'Lampiran 2 Timeline dan output R&amp;D', 'R&amp;D &lt;Kopra&gt;', '12/10/2026']) expect(doc).toContain(t);
  });
});
