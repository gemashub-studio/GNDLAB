/**
 * Teks khusus suara asisten (DEC-116) — hanya untuk TTS, teks di layar tidak berubah.
 * Tanda baca dipakai untuk intonasi: koma di antara anak kalimat, "?" untuk pertanyaan, "!" untuk ajakan/aksi/permintaan
 * maaf. Kata "maaf" ditulis "ma ap" agar diucapkan jelas; jawaban "belum paham" memakai kalimat baku owner.
 */
export const NOT_UNDERSTOOD_TTS = 'ma ap, aku masih belum paham, coba ucapkan lagi ya!';

const SATUAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
/** Bilangan bulat → kata bahasa Indonesia: 15 → "lima belas", 1034 → "seribu tiga puluh empat" (DEC-118). */
export function angkaKata(n: number): string {
  const f = (x: number): string => {
    if (x < 12) return x === 0 ? '' : SATUAN[x]!;
    if (x < 20) return `${SATUAN[x - 10]} belas`;
    if (x < 100) return `${SATUAN[Math.floor(x / 10)]} puluh ${f(x % 10)}`;
    if (x < 200) return `seratus ${f(x - 100)}`;
    if (x < 1000) return `${SATUAN[Math.floor(x / 100)]} ratus ${f(x % 100)}`;
    if (x < 2000) return `seribu ${f(x - 1000)}`;
    if (x < 1e6) return `${f(Math.floor(x / 1000))} ribu ${f(x % 1000)}`;
    if (x < 1e9) return `${f(Math.floor(x / 1e6))} juta ${f(x % 1e6)}`;
    if (x < 1e12) return `${f(Math.floor(x / 1e9))} miliar ${f(x % 1e9)}`;
    return `${f(Math.floor(x / 1e12))} triliun ${f(x % 1e12)}`;
  };
  const v = Math.floor(Math.abs(n));
  const w = v === 0 ? 'nol' : f(v).replace(/\s+/g, ' ').trim();
  return n < 0 ? `minus ${w}` : w;
}
const UNIT_KATA: Record<string, string> = { g: 'gram', gr: 'gram', kg: 'kilogram', mg: 'miligram', ml: 'mililiter', l: 'liter', mm: 'milimeter', cm: 'sentimeter', m: 'meter' };
/**
 * Semua angka di teks diucapkan dengan kata (DEC-118): "15" → "lima belas", "1.034" → "seribu tiga puluh empat",
 * "6,5" → "enam koma lima", "25%" → "dua puluh lima persen", "900 g" → "sembilan ratus gram".
 */
export function numbersToWords(text: string): string {
  return text
    .replace(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(\s*%)?(?:\s?(kg|mg|ml|mm|cm|gr|g|l|m)\b)?/gi, (_m, int: string, dec?: string, pct?: string, unit?: string) => {
      let w = angkaKata(Number(int.replace(/\./g, '')));
      if (dec) w += ` koma ${[...dec].map((d) => SATUAN[Number(d)]).join(' ')}`;
      if (pct) w += ' persen';
      if (unit) w += ` ${UNIT_KATA[unit.toLowerCase()] ?? unit}`;
      return w;
    })
    .replace(/\s+/g, ' ');
}

const QUESTION_START = /^(apa|apakah|siapa|kapan|kenapa|mengapa|bagaimana|gimana|berapa|di ?mana|ke ?mana|mau|boleh|bisakah|sudahkah)\b/i;
const INTERJECTION = /^(siap|oke|ok|baik|baiklah|sebentar|tunggu|halo|hai|nah|wah|yuk|ayo|selesai|berhasil|sip)\b(?![,!?])/i;

export function ttsText(text: string): string {
  let t = text.replace(/\s+/g, ' ').replace(/…/g, '.').trim();
  if (!t) return '';
  // jawaban "belum paham / belum mengerti / tidak dikenali" → kalimat baku
  if (/belum (paham|mengerti)|tidak (dikenali|paham|mengerti)/i.test(t)) return NOT_UNDERSTOOD_TTS;
  // angka diucapkan dengan kata, bukan digit (DEC-118)
  t = numbersToWords(t);
  // "maaf" → selalu "ma ap, " (spasi & koma); tanda baca lama sesudahnya dibuang (DEC-117)
  t = t.replace(/\bmaaf\b[\s,.!?;:]*/gi, 'ma ap, ').trim();
  // kata seru / sapaan di awal → beri koma
  t = t.replace(INTERJECTION, (m) => `${m},`);
  const question = QUESTION_START.test(t) || /\?\s*$/.test(t) || /\b(ya|kan|bukan)\s*\?/.test(t);
  // titik di antara kalimat → koma agar alurnya mengalir; tanda baca akhir disusun ulang
  t = t.replace(/[.!?;:]+\s*$/, '').replace(/\.\s+/g, ', ').replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',');
  return `${t}${question ? '?' : '!'}`;
}
