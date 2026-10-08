/**
 * Koreksi kadar air basis basah (calculation_spec §5): M₂ = M₁ · (1 − w₁) / (1 − w₂).
 */
import { evaluateRange, type Range } from './range.ts';

export class InvalidMoistureError extends Error {
  readonly code = 'INVALID_MOISTURE' as const;
  constructor(readonly value: number) {
    super(`Kadar air harus 0 ≤ w < 1 (fraksi), didapat ${value}`);
    this.name = 'InvalidMoistureError';
  }
}

function assertMoisture(w: number): void {
  if (!(w >= 0 && w < 1)) throw new InvalidMoistureError(w);
}

export function correctMoisture(massKg: number, w1: number, w2: number): number {
  if (!(massKg >= 0)) throw new RangeError(`Massa harus ≥ 0, didapat ${massKg}`);
  assertMoisture(w1);
  assertMoisture(w2);
  return (massKg * (1 - w1)) / (1 - w2);
}

/** Versi rentang: massa & kadar air awal bisa tak pasti; target kadar air biasanya pasti. */
export function correctMoistureRange(mass: Range, w1: Range, w2: Range): Range {
  for (const r of [w1, w2]) [r.min, r.typ, r.max].forEach(assertMoisture);
  const out = evaluateRange({ mass, w1, w2 }, (v) => ({ massKg: correctMoisture(v.mass, v.w1, v.w2) }));
  return { min: out.min.massKg, typ: out.typ.massKg, max: out.max.massKg };
}
