/**
 * Statistik sampling lapangan & usulan kalibrasi (PRD US-08, CLAUDE_CODE_PROMPT §4):
 * n ≥ 10 → usulan {min = P5, typ = median, max = P95}.
 * Persentil memakai interpolasi linear (metode R-7 / Excel PERCENTILE.INC).
 */
import type { Range } from './range.ts';

export const CALIBRATION_MIN_SAMPLES = 10;

export interface SampleStats {
  n: number;
  mean: number;
  /** Simpangan baku sampel (n − 1); 0 bila n = 1. */
  sd: number;
  min: number;
  max: number;
  p5: number;
  median: number;
  p95: number;
}

/** Persentil p ∈ [0, 1] dari data TERURUT naik. */
export function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) throw new RangeError('Data kosong');
  if (!(p >= 0 && p <= 1)) throw new RangeError('p harus 0–1');
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

export function sampleStats(values: readonly number[]): SampleStats {
  if (!values.length) throw new RangeError('Minimal satu sampel');
  for (const v of values) if (!Number.isFinite(v)) throw new RangeError(`Nilai sampel tidak valid: ${v}`);
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, min: s[0]!, max: s[n - 1]!, p5: percentile(s, 0.05), median: percentile(s, 0.5), p95: percentile(s, 0.95) };
}

/** Usulan rentang kalibrasi; undefined bila sampel belum cukup. */
export function proposeCalibration(values: readonly number[]): (Range & { n: number }) | undefined {
  if (values.length < CALIBRATION_MIN_SAMPLES) return undefined;
  const st = sampleStats(values);
  if (!(st.p5 > 0)) throw new RangeError('Usulan kalibrasi butuh nilai > 0 (IR-01)');
  return { min: st.p5, typ: st.median, max: st.p95, n: st.n };
}

/** Selisih relatif realisasi vs prediksi (PRD §8: target ≤ 10%). */
export const relativeGap = (actual: number, predicted: number) => (predicted > 0 ? (actual - predicted) / predicted : Number.NaN);
export const REALIZATION_TARGET_GAP = 0.1;
