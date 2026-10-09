import { describe, expect, it } from 'vitest';
import { CALIBRATION_MIN_SAMPLES, percentile, proposeCalibration, relativeGap, sampleStats } from '../src/index.ts';

describe('sampleStats', () => {
  it('1..10: mean 5,5, SD sampel, persentil R-7', () => {
    const s = sampleStats([10, 1, 9, 2, 8, 3, 7, 4, 6, 5]);
    expect(s).toMatchObject({ n: 10, mean: 5.5, min: 1, max: 10, median: 5.5 });
    expect(s.sd).toBeCloseTo(3.02765, 5); // = STDEV.S
    expect(s.p5).toBeCloseTo(1.45, 10); // = PERCENTILE.INC(…, 0.05)
    expect(s.p95).toBeCloseTo(9.55, 10);
  });
  it('satu sampel → SD 0', () => {
    expect(sampleStats([3]).sd).toBe(0);
  });
  it('kosong / NaN ditolak', () => {
    expect(() => sampleStats([])).toThrow();
    expect(() => sampleStats([1, Number.NaN])).toThrow();
  });
  it('percentile batas', () => {
    expect(percentile([1, 2, 3], 0)).toBe(1);
    expect(percentile([1, 2, 3], 1)).toBe(3);
    expect(() => percentile([1], 2)).toThrow();
  });
});

describe('proposeCalibration (n ≥ 10)', () => {
  it(`n < ${CALIBRATION_MIN_SAMPLES} → belum ada usulan`, () => {
    expect(proposeCalibration([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeUndefined();
  });
  it('n = 10 → {P5, median, P95}', () => {
    const p = proposeCalibration([0.55, 0.6, 0.58, 0.62, 0.57, 0.61, 0.59, 0.6, 0.63, 0.56])!;
    expect(p.n).toBe(10);
    expect(p.min).toBeLessThanOrEqual(p.typ);
    expect(p.typ).toBeLessThanOrEqual(p.max);
    expect(p.typ).toBeCloseTo(0.595, 10);
  });
});

it('relativeGap: realisasi 21.000 vs prediksi 22.229 ≈ −5,5%', () => {
  expect(relativeGap(21000, 22229)).toBeCloseTo(-0.0553, 4);
  expect(Number.isNaN(relativeGap(1, 0))).toBe(true);
});
