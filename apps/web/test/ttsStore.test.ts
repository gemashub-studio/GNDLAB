import { describe, expect, it } from 'vitest';
import { evictions, ttsKey, TTS_MAX_BYTES, TTS_MAX_CLIPS } from '@/lib/ttsStore';

describe('simpanan suara TTS (DEC-139)', () => {
  it('kunci = suara + teks dengan spasi dirapikan', () => {
    expect(ttsKey('  Siap,   aku buka  ', 'autumn')).toBe('autumn|Siap, aku buka');
    expect(ttsKey('Siap', 'austin')).not.toBe(ttsKey('Siap', 'autumn'));
  });
  it('buang yang paling lama tidak dipakai sampai jumlah & ukuran di bawah batas', () => {
    const clips = [
      { key: 'c', size: 10, usedAt: 3 },
      { key: 'a', size: 10, usedAt: 1 },
      { key: 'b', size: 10, usedAt: 2 },
    ];
    expect(evictions(clips, 3, 100)).toEqual([]);
    expect(evictions(clips, 2, 100)).toEqual(['a']);
    expect(evictions(clips, 3, 15)).toEqual(['a', 'b']);
    expect(TTS_MAX_CLIPS).toBeGreaterThanOrEqual(100);
    expect(TTS_MAX_BYTES).toBeGreaterThanOrEqual(10 * 1024 * 1024);
  });
});
