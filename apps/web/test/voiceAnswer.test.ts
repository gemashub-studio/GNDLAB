import { describe, expect, it } from 'vitest';
import { answerTts, FOLLOW_UPS, firstParagraph, followUp, looksLikeQuestion, voiceAnswer } from '@/lib/voiceAnswer';

const BRIKET = `**Briket** adalah bahan bakar padat yang dibuat dengan memadatkan serbuk arang (atau biomassa lain) menjadi bentuk seragam, misalnya kubus, silinder, atau heksagonal berlubang. Tujuannya supaya bahan bakar itu lebih padat, lebih mudah disimpan dan dikirim, dan nyalanya lebih stabil daripada arang curah.

## Bahan
- Arang batok
- Perekat tapioka 5%

Mau tahu cara membuat briket sendiri? 🔥`;

describe('pertanyaan lewat asisten kelapa → Lab AI → TTS (DEC-123)', () => {
  it('paragraf pertama tanpa markdown + pertanyaan lanjutan dari jawaban', () => {
    const a = voiceAnswer(BRIKET);
    expect(a.first).toBe('Briket adalah bahan bakar padat yang dibuat dengan memadatkan serbuk arang (atau biomassa lain) menjadi bentuk seragam, misalnya kubus, silinder, atau heksagonal berlubang. Tujuannya supaya bahan bakar itu lebih padat, lebih mudah disimpan dan dikirim, dan nyalanya lebih stabil daripada arang curah.');
    expect(a.question).toBe('Mau tahu cara membuat briket sendiri?');
    expect(a.text).toBe(`${a.first} ${a.question}`);
  });
  it('tanpa pertanyaan di jawaban → pertanyaan bawaan bergiliran; judul pendek dilewati; paragraf panjang dipotong di akhir kalimat', () => {
    expect(followUp('Kopra adalah daging kelapa kering.', 'Kopra adalah daging kelapa kering.', 1)).toBe(FOLLOW_UPS[1]);
    expect(firstParagraph('# Kopra\n\nKopra adalah daging kelapa yang dikeringkan.')).toBe('Kopra adalah daging kelapa yang dikeringkan.');
    const long = Array.from({ length: 20 }, (_, i) => `Kalimat nomor ${i} cukup panjang untuk diuji.`).join(' ');
    const f = firstParagraph(long);
    expect(f.length).toBeLessThanOrEqual(520);
    expect(f.endsWith('.')).toBe(true);
  });
  it('TTS: setiap koma jawaban diberi tanda seru, angka jadi kata, pertanyaan tetap', () => {
    const a = voiceAnswer(BRIKET);
    const t = answerTts(a.first, a.question);
    expect(t).toContain('bentuk seragam!, misalnya kubus!, silinder!, atau heksagonal berlubang.');
    expect(t.endsWith('Mau tahu cara membuat briket sendiri?')).toBe(true);
    expect(answerTts('Kadar air kopra 5%, maksimal.', 'Ada lagi?')).toBe('Kadar air kopra lima persen!, maksimal. Ada lagi?');
  });
  it('deteksi pertanyaan cadangan', () => {
    expect(looksLikeQuestion('apa itu kopra')).toBe(true);
    expect(looksLikeQuestion('Kenapa briket retak?')).toBe(true);
    expect(looksLikeQuestion('buka halaman gudang')).toBe(false);
    expect(looksLikeQuestion('bagaimana cara membuat cuka')).toBe(true);
  });
});

describe('suara jawaban: Austin & potongan TTS (DEC-125)', () => {
  it('teks panjang dipecah per kalimat ≤ 280 karakter tanpa kehilangan isi', async () => {
    const { splitTts } = await import('@/lib/voiceClient');
    const long = Array.from({ length: 9 }, (_, i) => `Kalimat ke ${i} menjelaskan proses pengeringan kopra dengan rinci!, sampai kering.`).join(' ') + ' Mau tahu lebih lanjut?';
    const parts = splitTts(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 280)).toBe(true);
    expect(parts.join(' ')).toBe(long);
    expect(parts.at(-1)!.endsWith('Mau tahu lebih lanjut?')).toBe(true);
    expect(splitTts('')).toEqual([]);
  });
  it('server hanya menerima suara autumn / austin', async () => {
    const { pickVoice } = await import('@/server/voiceTts');
    expect(pickVoice('austin')).toBe('austin');
    expect(pickVoice('troy')).toBe('autumn');
    expect(pickVoice(undefined)).toBe('autumn');
  });
});
