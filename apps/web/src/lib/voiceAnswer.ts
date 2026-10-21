/**
 * Jawaban pertanyaan lewat asisten kelapa (DEC-123): pertanyaan → Lab AI → paragraf pertama jawaban + satu pertanyaan
 * lanjutan → layar & TTS. Untuk TTS, setiap koma di jawaban Lab AI diberi tanda seru ("padat!, lebih mudah") agar
 * intonasinya hidup; pertanyaan lanjutan tetap berintonasi tanya.
 */
import { numbersToWords } from './ttsText';

/** Instruksi tambahan untuk Lab AI saat ditanya lewat suara. */
export const VOICE_ASK_HINT =
  'Jawab untuk dibacakan dengan suara: paragraf pertama 2–3 kalimat berisi jawaban inti (tanpa daftar, tanpa judul, tanpa format markdown), lalu akhiri jawaban dengan satu pertanyaan lanjutan singkat untuk pengguna.';

export const FOLLOW_UPS = ['Mau aku jelaskan lebih lanjut?', 'Ada lagi yang mau kamu tanyakan?', 'Mau tahu cara membuatnya juga?', 'Mau aku bantu catat datanya sekalian?'] as const;

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/** Buang format markdown & emoji dari satu blok teks. */
export function plain(t: string): string {
  return t
    .replace(EMOJI, '')
    .replace(/\*\*|__|`+/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,!?])/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Paragraf pertama yang berisi kalimat (judul pendek tanpa titik dilewati), maks. ±520 karakter dipotong di akhir kalimat. */
export function firstParagraph(answer: string, max = 520): string {
  const blocks = answer.replace(/\r/g, '').split(/\n\s*\n/).map(plain).filter(Boolean);
  const pick = blocks.find((b) => /[.!?]/.test(b) && b.length > 30) ?? blocks[0] ?? '';
  if (pick.length <= max) return pick;
  const cut = pick.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

/** Pertanyaan lanjutan: kalimat tanya terakhir dari jawaban AI (di luar paragraf pertama), atau kalimat bawaan bergiliran. */
export function followUp(answer: string, first: string, turn = 0): string {
  const lines = answer.replace(/\r/g, '').split(/\n+/).map(plain).filter((l) => l && !first.includes(l));
  for (const l of lines.reverse()) {
    const q = l.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()).reverse().find((x) => x.endsWith('?') && x.length > 8 && x.length < 160);
    if (q) return q;
  }
  return FOLLOW_UPS[turn % FOLLOW_UPS.length]!;
}

/** Teks layar: paragraf pertama + pertanyaan lanjutan. */
export function voiceAnswer(answer: string, turn = 0): { first: string; question: string; text: string } {
  const first = firstParagraph(answer);
  const question = followUp(answer, first, turn);
  return { first, question, text: `${first} ${question}`.trim() };
}

/** Teks TTS: angka → kata, "maaf" → "ma ap", setiap koma jawaban diberi tanda seru; pertanyaan lanjutan apa adanya. */
export function answerTts(first: string, question: string): string {
  const say = (t: string) => numbersToWords(t).replace(/\bmaaf\b[\s,.!?;:]*/gi, 'ma ap, ');
  const body = say(first)
    .replace(/…/g, '.')
    .replace(/\s*,\s*/g, '!, ')
    .replace(/!+,/g, '!,');
  return `${body} ${say(question)}`.replace(/\s{2,}/g, ' ').trim();
}

/** Ucapan yang jelas-jelas pertanyaan pengetahuan (cadangan bila perencana tidak memberi aksi). */
export function looksLikeQuestion(t: string): boolean {
  return /^(apa itu|apa yang dimaksud|apa bedanya|apa fungsi|apa manfaat|kenapa|mengapa|bagaimana cara|gimana cara|jelaskan|ceritakan)\b/i.test(t.trim()) || /^(apa|kenapa|mengapa|bagaimana|gimana|berapa)\b.*\?\s*$/i.test(t.trim());
}
