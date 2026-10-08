import { describe, expect, it } from 'vitest';
import {
  evaluateRange,
  MAX_UNCERTAIN_PARAMS,
  OverrideOutOfRangeError,
  overrideParam,
  param,
  point,
  weakestConfidence,
} from '../src/index.ts';

describe('evaluateRange (evaluasi sudut 2^k)', () => {
  it('typ dari nilai typ; min/max dari sudut', () => {
    const out = evaluateRange({ a: { min: 1, typ: 2, max: 3 }, b: { min: 10, typ: 20, max: 40 } }, (v) => ({
      q: v.b / v.a,
    }));
    expect(out.typ.q).toBe(10);
    expect(out.min.q).toBeCloseTo(10 / 3);
    expect(out.max.q).toBe(40);
  });

  it('parameter titik tidak menambah evaluasi', () => {
    let calls = 0;
    evaluateRange({ a: point(1), b: point(2), c: { min: 1, typ: 2, max: 3 } }, (v) => {
      calls++;
      return { s: v.a + v.b + v.c };
    });
    expect(calls).toBe(1 + 2); // typ + 2 sudut
  });

  it(`menolak lebih dari ${MAX_UNCERTAIN_PARAMS} parameter tak pasti`, () => {
    const ranges = Object.fromEntries(
      Array.from({ length: MAX_UNCERTAIN_PARAMS + 1 }, (_, i) => [`p${i}`, { min: 1, typ: 2, max: 3 }]),
    );
    expect(() => evaluateRange(ranges, () => ({ x: 1 }))).toThrow(RangeError);
  });

  it('min ≤ typ ≤ max tetap berlaku untuk fungsi bertangga (floor)', () => {
    const out = evaluateRange({ a: { min: 0.9, typ: 1, max: 1.1 } }, (v) => ({ n: Math.floor(10 / v.a) }));
    expect(out.min.n).toBeLessThanOrEqual(out.typ.n);
    expect(out.typ.n).toBeLessThanOrEqual(out.max.n);
  });

  it('menolak rentang terbalik', () => {
    expect(() => evaluateRange({ a: { min: 3, typ: 2, max: 1 } }, () => ({ x: 1 }))).toThrow(/min ≤ typ ≤ max/);
  });
});

describe('overrideParam (ARD §9)', () => {
  const rho = param('bulk_density', 'kg_m3', { min: 360, typ: 385, max: 410 }, 'C');

  it('nilai tunggal → pasti, bertanda override', () => {
    const p = overrideParam(rho, 400);
    expect(p).toMatchObject({ min: 400, typ: 400, max: 400, source: 'override' });
  });

  it('menerima batas [min·0,5, max·2] persis', () => {
    expect(() => overrideParam(rho, 180)).not.toThrow();
    expect(() => overrideParam(rho, 820)).not.toThrow();
  });

  it('override di luar rentang wajar → OverrideOutOfRangeError', () => {
    expect(() => overrideParam(rho, 179)).toThrow(OverrideOutOfRangeError);
    try {
      overrideParam(rho, 1000);
    } catch (e) {
      expect(e).toBeInstanceOf(OverrideOutOfRangeError);
      expect((e as OverrideOutOfRangeError).code).toBe('OVERRIDE_OUT_OF_RANGE');
      expect((e as OverrideOutOfRangeError).accepted).toEqual({ min: 180, max: 820 });
    }
  });
});

it('weakestConfidence: A < B < C (DEC-008)', () => {
  expect(weakestConfidence(['A', 'C', 'B'])).toBe('C');
  expect(weakestConfidence(['A', 'B'])).toBe('B');
  expect(weakestConfidence([])).toBe('A');
});
