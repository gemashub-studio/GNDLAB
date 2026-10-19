import { describe, expect, it } from 'vitest';
import { AKHIR_VOICE_FIELDS, applyVoice, AWAL_VOICE_FIELDS, matchOption, parseNumber, parseVoice, normalize, type VoiceField } from '@/lib/voiceFill';

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
    expect(parseVoice('doa bharatawal seribu tiga ampat neks', awal)).toEqual([{ kind: 'num', value: '2', words: 1 }, { kind: 'fill', field: 'beratAwal', value: '1034' }, { kind: 'next' }]);
    expect(parseVoice('berat awal sembilan ratus lima pulu', awal)).toEqual([{ kind: 'fill', field: 'beratAwal', value: '950' }]);
    expect(parseVoice('halo apa kabar', awal)[0]!.kind).toBe('unknown');
  });
});

describe('pengisian suara: perintah', () => {
  it('nomor urut, isi kolom, next (+ variasi)', () => {
    expect(parseVoice('satu', awal)).toEqual([{ kind: 'num', value: '1', words: 1 }]);
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
    expect(parseVoice('dua. Berat awal seribu tiga empat.', awal)).toEqual([{ kind: 'num', value: '2', words: 1 }, { kind: 'fill', field: 'beratAwal', value: '1034' }]);
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

describe('bilangan tanpa nama kolom (DEC-103)', () => {
  const run = (text: string, cur: { row: number; field: string }, rows: number) => {
    const out: { cur: { row: number; field: string }; fill?: { row: number; field: string; value: string }; error?: string }[] = [];
    let c = cur;
    for (const cmd of parseVoice(text, awal)) {
      const r = applyVoice(cmd, c, awal, rows);
      out.push(r);
      c = r.cur;
    }
    return out;
  };
  it('"Satu, kosong, tiga." pada catatan 1 item → kolom aktif terisi 103 (bukan "Nomor 103 tidak ada")', () => {
    const r = run('Satu, kosong, tiga.', { row: 1, field: 'beratAwal' }, 1);
    expect(r).toEqual([{ cur: { row: 1, field: 'beratAwal' }, fill: { row: 1, field: 'beratAwal', value: '103' } }]);
  });
  it('satu kata & nomornya ada → pilih nomor; lebih dari jumlah nomor / beberapa kata / desimal → isi kolom aktif', () => {
    expect(run('tiga', { row: 1, field: 'beratAwal' }, 5)[0]!.cur).toEqual({ row: 3, field: 'beratAwal' });
    expect(run('sepuluh', { row: 1, field: 'beratAwal' }, 12)[0]!.cur).toEqual({ row: 10, field: 'beratAwal' });
    expect(run('tujuh', { row: 2, field: 'volAir' }, 5)[0]!.fill).toEqual({ row: 2, field: 'volAir', value: '7' });
    expect(run('seribu', { row: 1, field: 'beratAwal' }, 5)[0]!.fill?.value).toBe('1000');
    expect(run('enam koma lima', { row: 1, field: 'tebalAwal' }, 5)[0]!.fill?.value).toBe('6,5');
    expect(run('dua ratus', { row: 1, field: 'beratAwal' }, 300)[0]!.fill?.value).toBe('200');
    // nomor besar tetap bisa dipilih dengan kata "nomor"
    expect(run('nomor dua belas', { row: 1, field: 'beratAwal' }, 20)[0]!.cur.row).toBe(12);
  });
});

describe('satuan ikut terucap (DEC-103)', () => {
  it('"Berat air 500 gram." → berat air 500; satuan mL / mm juga diabaikan', () => {
    expect(parseVoice('Berat air 500 gram.', awal)).toEqual([{ kind: 'fill', field: 'beratAir', value: '500' }]);
    expect(parseVoice('berat awal seribu dua ratus gram next', awal)).toEqual([{ kind: 'fill', field: 'beratAwal', value: '1200' }, { kind: 'next' }]);
    expect(parseVoice('volume air tiga ratus mililiter', awal)).toEqual([{ kind: 'fill', field: 'volAir', value: '300' }]);
    expect(parseVoice('tebal daging sembilan koma lima mm', awal)).toEqual([{ kind: 'fill', field: 'tebalAwal', value: '9,5' }]);
    // satuan lain tidak dikonversi diam-diam
    expect(parseVoice('berat awal satu kilogram', awal)[0]!.kind).toBe('unknown');
  });
});


describe('nama kolom + nilai untuk kolom lain di form (DEC-104)', () => {
  const extra: VoiceField[] = [
    { key: 'x:count', label: 'jumlah kopra', say: ['jumlah kopra', 'jumlah perlakuan kopra'], kind: 'number' },
    { key: 'x:count2', label: 'jumlah kopra kedua', say: ['jumlah kopra kedua'], kind: 'number' },
    { key: 'x:method', label: 'metode kopra', say: ['metode kopra', 'perlakuan kopra'], kind: 'choice', options: [{ value: '', label: '— pilih —' }, { value: 'GreenHouse', label: 'GreenHouse' }, { value: 'Oven Gas', label: 'Oven Gas' }, { value: 'Oven Briket', label: 'Oven Briket' }] },
    { key: 'x:note', label: 'keterangan kopra', say: ['keterangan kopra'], kind: 'text' },
  ];
  const all = [...AKHIR_VOICE_FIELDS, ...extra];
  it('angka, teks bebas, pilihan; kolom kedua dengan "kedua"; digabung dengan kolom per nomor', () => {
    expect(parseVoice('jumlah kopra tiga', all)).toEqual([{ kind: 'fill', field: 'x:count', value: '3' }]);
    expect(parseVoice('jumlah perlakuan kopra lima belas', all)).toEqual([{ kind: 'fill', field: 'x:count', value: '15' }]);
    expect(parseVoice('jumlah kopra kedua dua', all)).toEqual([{ kind: 'fill', field: 'x:count2', value: '2' }]);
    expect(parseVoice('metode kopra oven gas', all)).toEqual([{ kind: 'fill', field: 'x:method', value: 'oven gas' }]);
    expect(parseVoice('keterangan kopra dibalik tiap dua jam', all)).toEqual([{ kind: 'fill', field: 'x:note', value: 'dibalik tiap dua jam' }]);
    expect(parseVoice('berat akhir sembilan ratus jumlah kopra tiga', all)).toEqual([{ kind: 'fill', field: 'beratAkhir', value: '900' }, { kind: 'fill', field: 'x:count', value: '3' }]);
  });
  it('pilihan dropdown dicocokkan dari ucapan', () => {
    const kopra = extra[2]!.options!;
    expect(matchOption('oven gas', kopra)?.value).toBe('Oven Gas');
    expect(matchOption('green house', kopra)?.value).toBe('GreenHouse');
    expect(matchOption('briket', kopra)?.value).toBe('Oven Briket');
    expect(matchOption('mangga', kopra)).toBeUndefined();
    const cuka = [{ value: 'CUKA 1 - GULA 25g', label: 'CUKA 1 - GULA 25g' }, { value: 'CUKA 2 - GULA 75g', label: 'CUKA 2 - GULA 75g' }, { value: 'CUKA 3 - GULA 50', label: 'CUKA 3 - GULA 50' }];
    expect(matchOption('cuka dua', cuka)?.value).toBe('CUKA 2 - GULA 75g');
    expect(matchOption('gula lima puluh', cuka)?.value).toBe('CUKA 3 - GULA 50');
    expect(matchOption('kelapa tua', [{ value: 'Kelapa tua', label: 'Kelapa tua' }, { value: 'Kelapa muda', label: 'Kelapa muda' }])?.value).toBe('Kelapa tua');
  });
});
