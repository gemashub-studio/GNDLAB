import { describe, expect, it } from 'vitest';
import { AKHIR_VOICE_FIELDS, applyVoice, AWAL_VOICE_FIELDS, parseNumber, parseVoice, normalize } from '@/lib/voiceFill';

const awal = Object.values(AWAL_VOICE_FIELDS);
const num = (s: string) => parseNumber(normalize(s));

describe('pengisian suara: bilangan (DEC-099)', () => {
  it('deret satuan digabung per digit', () => {
    expect(num('satu kosong tiga empat')).toBe('1034');
    expect(num('nol lima')).toBe('5');
  });
  it('bilangan bertingkat & campuran', () => {
    expect(num('seribu tiga empat')).toBe('1034');
    expect(num('seribu dua ratus')).toBe('1200');
    expect(num('dua ratus lima puluh')).toBe('250');
    expect(num('tiga puluh empat')).toBe('34');
    expect(num('sebelas')).toBe('11');
    expect(num('dua belas')).toBe('12');
    expect(num('sepuluh')).toBe('10');
    expect(num('dua ribu lima')).toBe('2005');
    expect(num('seratus')).toBe('100');
  });
  it('desimal & angka dari transkrip', () => {
    expect(num('enam koma lima')).toBe('6,5');
    expect(num('sebelas koma empat')).toBe('11,4');
    expect(num('1.034')).toBe('1034');
    expect(num('11,4')).toBe('11,4');
    expect(num('berat')).toBeUndefined();
  });
});

describe('pengisian suara: salah dengar ringan', () => {
  it('kata mirip dicocokkan ke kosakata perintah', () => {
    expect(parseVoice('doa bharatawal seribu tiga ampat neks', awal)).toEqual([{ kind: 'row', no: 2 }, { kind: 'fill', field: 'beratAwal', value: '1034' }, { kind: 'next' }]);
    expect(parseVoice('berat awal sembilan ratus lima pulu', awal)).toEqual([{ kind: 'fill', field: 'beratAwal', value: '950' }]);
    expect(parseVoice('halo apa kabar', awal)[0]!.kind).toBe('unknown');
  });
});

describe('pengisian suara: perintah', () => {
  it('nomor urut, isi kolom, next (+ variasi)', () => {
    expect(parseVoice('satu', awal)).toEqual([{ kind: 'row', no: 1 }]);
    expect(parseVoice('Nomor tiga.', awal)).toEqual([{ kind: 'row', no: 3 }]);
    expect(parseVoice('berat awal satu kosong tiga empat', awal)).toEqual([{ kind: 'fill', field: 'beratAwal', value: '1034' }]);
    expect(parseVoice('Berat awal seribu tiga empat. Next.', awal)).toEqual([{ kind: 'fill', field: 'beratAwal', value: '1034' }, { kind: 'next' }]);
    expect(parseVoice('neks', awal)).toEqual([{ kind: 'next' }]);
    expect(parseVoice('nex', awal)).toEqual([{ kind: 'next' }]);
    expect(parseVoice('tebal daging sepuluh koma lima', awal)).toEqual([{ kind: 'fill', field: 'tebalAwal', value: '10,5' }]);
    expect(parseVoice('isi tiga ratus', awal)).toEqual([{ kind: 'fill', value: '300' }]);
    expect(parseVoice('berat akhir sembilan ratus', AKHIR_VOICE_FIELDS)).toEqual([{ kind: 'fill', field: 'beratAkhir', value: '900' }]);
    expect(parseVoice('halo apa kabar', awal)[0]!.kind).toBe('unknown');
    // satu napas tanpa jeda: nomor + isi kolom, lalu kolom lain
    expect(parseVoice('dua. Berat awal seribu tiga empat.', awal)).toEqual([{ kind: 'row', no: 2 }, { kind: 'fill', field: 'beratAwal', value: '1034' }]);
    expect(parseVoice('nomor tiga berat awal lima ratus berat air dua puluh', awal)).toEqual([{ kind: 'row', no: 3 }, { kind: 'fill', field: 'beratAwal', value: '500' }, { kind: 'fill', field: 'beratAir', value: '20' }]);
  });
  it('posisi aktif: pilih nomor, isi, next pindah kolom lalu ke nomor berikutnya', () => {
    const f = awal;
    let cur = { row: 1, field: 'beratAwal' };
    let r = applyVoice({ kind: 'row', no: 2 }, cur, f, 3);
    expect(r.cur).toEqual({ row: 2, field: 'beratAwal' });
    cur = r.cur;
    r = applyVoice({ kind: 'fill', field: 'beratAwal', value: '1034' }, cur, f, 3);
    expect(r.fill).toEqual({ row: 2, field: 'beratAwal', value: '1034' });
    r = applyVoice({ kind: 'next' }, { row: 2, field: 'tebalAwal' }, f, 3);
    expect(r.cur).toEqual({ row: 3, field: 'beratAwal' });
    expect(applyVoice({ kind: 'row', no: 9 }, cur, f, 3).error).toContain('tidak ada');
    expect(applyVoice({ kind: 'next' }, { row: 3, field: 'tebalAwal' }, f, 3).error).toBe('Sudah di kolom terakhir.');
  });
});
