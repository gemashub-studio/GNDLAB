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

  it('Word: hanya bukti alokasi — judul ALOKASI, tabel nota | barang, total + terbilang, keterangan', () => {
    const r = { ...newLpj('LPJ-202610-01'), proofs: [{ title: 'Bahan <umum>', total: '427.000', description: 'Kelapa & gula', receipts: [], goods: [] }] };
    const doc = new TextDecoder().decode(buildLpjDocx(r));
    for (const t of ['BUKTI ALOKASI', 'ALOKASI — Bahan &lt;umum&gt;', 'Foto Bukti Bayar / Nota', 'Foto Barang yang Dibeli', 'Rp427.000', 'Empat Ratus Dua Puluh Tujuh Ribu Rupiah', 'Keterangan: Kelapa &amp; gula']) expect(doc).toContain(t);
    expect(doc).not.toContain('Lampiran 1');
  });
});
