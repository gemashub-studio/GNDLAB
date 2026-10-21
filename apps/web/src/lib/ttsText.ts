/**
 * Teks khusus suara asisten (DEC-116) — hanya untuk TTS, teks di layar tidak berubah.
 * Tanda baca dipakai untuk intonasi: koma di antara anak kalimat, "?" untuk pertanyaan, "!" untuk ajakan/aksi/permintaan
 * maaf. Kata "maaf" ditulis "ma ap" agar diucapkan jelas; jawaban "belum paham" memakai kalimat baku owner.
 */
export const NOT_UNDERSTOOD_TTS = 'ma ap, aku masih belum paham, coba ucapkan lagi ya!';

const QUESTION_START = /^(apa|apakah|siapa|kapan|kenapa|mengapa|bagaimana|gimana|berapa|di ?mana|ke ?mana|mau|boleh|bisakah|sudah(kah)?)\b/i;
const INTERJECTION = /^(siap|oke|ok|baik|baiklah|sebentar|tunggu|halo|hai|nah|wah|yuk|ayo|selesai|berhasil|sip)\b(?![,!?])/i;

export function ttsText(text: string): string {
  let t = text.replace(/\s+/g, ' ').replace(/…/g, '.').trim();
  if (!t) return '';
  // jawaban "belum paham / belum mengerti / tidak dikenali" → kalimat baku
  if (/belum (paham|mengerti)|tidak (dikenali|paham|mengerti)/i.test(t)) return NOT_UNDERSTOOD_TTS;
  // "maaf" → "ma ap" (diikuti koma bila belum ada tanda baca)
  t = t.replace(/\bmaaf\b(?!\s*[,.!?])/gi, 'ma ap,').replace(/\bmaaf\b/gi, 'ma ap');
  // kata seru / sapaan di awal → beri koma
  t = t.replace(INTERJECTION, (m) => `${m},`);
  const question = QUESTION_START.test(t) || /\?\s*$/.test(t) || /\b(ya|kan|bukan)\s*\?/.test(t);
  // titik di antara kalimat → koma agar alurnya mengalir; tanda baca akhir disusun ulang
  t = t.replace(/[.!?;:]+\s*$/, '').replace(/\.\s+/g, ', ').replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',');
  return `${t}${question ? '?' : '!'}`;
}
