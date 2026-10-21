import { describe, expect, it } from 'vitest';
import { readWav, trimLeadingSilence, writeWav } from '@/server/voiceTts';

/** WAV 24 kHz mono 16-bit: `silent` detik hening lalu `loud` detik nada; header data "streaming" seperti keluaran Groq. */
function wav(silent: number, loud: number, streaming = true): Uint8Array {
  const rate = 24000;
  const n = Math.round((silent + loud) * rate);
  const pcm = new Uint8Array(n * 2);
  const v = new DataView(pcm.buffer);
  for (let i = Math.round(silent * rate); i < n; i++) v.setInt16(i * 2, Math.round(Math.sin(i / 8) * 12000), true);
  const w = writeWav({ rate, channels: 1, bits: 16, data: pcm });
  if (streaming) new DataView(w.buffer).setUint32(40, 0xffffffff, true);
  return w;
}
const secs = (w: Uint8Array) => {
  const p = readWav(w)!;
  return p.data.length / 2 / p.rate;
};

describe('TTS asisten: potong hening di awal suara (DEC-115)', () => {
  it('hening 0,57 dtk di awal dibuang (sisa 60 ms), suara di akhir tetap utuh; header ukuran diperbaiki', () => {
    const out = trimLeadingSilence(wav(0.57, 1.2));
    expect(secs(out)).toBeCloseTo(1.2 + 0.06, 1);
    expect(new DataView(out.buffer).getUint32(40, true)).toBe(out.length - 44);
    expect(secs(wav(0.57, 1.2))).toBeCloseTo(1.77, 2);
  });
  it('tanpa hening di awal / seluruhnya hening / bukan WAV → tidak dipotong', () => {
    expect(secs(trimLeadingSilence(wav(0, 1)))).toBeCloseTo(1, 2);
    const silent = wav(1, 0, false);
    expect(trimLeadingSilence(silent)).toBe(silent);
    const junk = new Uint8Array([1, 2, 3]);
    expect(trimLeadingSilence(junk)).toBe(junk);
  });
});
