/**
 * Rentang {min, typ, max} dan evaluasi sudut 2^k (ADR-003, calculation_spec §2).
 */
import type { Unit } from './units.ts';

export type Range = { min: number; typ: number; max: number };
export type Confidence = 'A' | 'B' | 'C';
export type ParamSource = 'dataset' | 'override';

export interface Param extends Range {
  key: string;
  unit: Unit;
  confidence: Confidence;
  sourceIds: string[];
  /** Default 'dataset'. Override pengguna dianggap pasti bila nilai tunggal. */
  source?: ParamSource;
  /** Catatan asal-usul dari dataset (ditampilkan di Data & Sumber). */
  note?: string;
}

/** Batas jumlah parameter tak pasti (≤ 256 evaluasi). */
export const MAX_UNCERTAIN_PARAMS = 8;
/** Override wajar: [min·0,5, max·2] (ARD §9). */
export const OVERRIDE_LOWER_FACTOR = 0.5;
export const OVERRIDE_UPPER_FACTOR = 2;

export const point = (v: number): Range => ({ min: v, typ: v, max: v });
export const isPoint = (r: Range): boolean => r.min === r.max;

export function assertRange(r: Range, label = 'range'): void {
  const ok = [r.min, r.typ, r.max].every(Number.isFinite) && r.min <= r.typ && r.typ <= r.max;
  if (!ok) throw new RangeError(`${label}: wajib min ≤ typ ≤ max (didapat ${r.min}/${r.typ}/${r.max})`);
}

export function param(
  key: string,
  unit: Unit,
  r: Range | number,
  confidence: Confidence = 'C',
  sourceIds: string[] = [],
): Param {
  const range = typeof r === 'number' ? point(r) : r;
  assertRange(range, key);
  return { key, unit, min: range.min, typ: range.typ, max: range.max, confidence, sourceIds, source: 'dataset' };
}

export class OverrideOutOfRangeError extends Error {
  readonly code = 'OVERRIDE_OUT_OF_RANGE' as const;
  constructor(
    readonly key: string,
    readonly value: Range,
    readonly accepted: { min: number; max: number },
  ) {
    super(
      `Override ${key} di luar rentang wajar: diterima ${accepted.min}–${accepted.max}, didapat ${value.min}–${value.max}`,
    );
    this.name = 'OverrideOutOfRangeError';
  }
}

/** Terapkan override pengguna pada parameter dataset. Nilai tunggal → pasti (min = typ = max). */
export function overrideParam(p: Param, value: number | Range): Param {
  const r = typeof value === 'number' ? point(value) : value;
  assertRange(r, p.key);
  const accepted = { min: p.min * OVERRIDE_LOWER_FACTOR, max: p.max * OVERRIDE_UPPER_FACTOR };
  if (r.min < accepted.min || r.max > accepted.max) throw new OverrideOutOfRangeError(p.key, r, accepted);
  return { ...p, min: r.min, typ: r.typ, max: r.max, source: 'override' };
}

/** Keyakinan gabungan = yang terlemah (DEC-008). */
export function weakestConfidence(list: Confidence[]): Confidence {
  return list.reduce<Confidence>((acc, c) => (c > acc ? c : acc), 'A');
}

/**
 * typ = f(semua typ); min/max = ekstrem f atas seluruh kombinasi sudut parameter tak pasti.
 * Setiap field numerik hasil dievaluasi terpisah. Nilai typ ikut diagregasi sehingga
 * min ≤ typ ≤ max selalu berlaku walau f memakai floor (monoton tak-ketat).
 */
export function evaluateRange<K extends string, T extends Record<string, number>>(
  ranges: Record<K, Range>,
  f: (v: Record<K, number>) => T,
): { min: T; typ: T; max: T } {
  const keys = Object.keys(ranges) as K[];
  for (const k of keys) assertRange(ranges[k], k);

  const typValues = {} as Record<K, number>;
  for (const k of keys) typValues[k] = ranges[k].typ;
  const typ = f(typValues);

  const uncertain = keys.filter((k) => !isPoint(ranges[k]));
  if (uncertain.length > MAX_UNCERTAIN_PARAMS) {
    throw new RangeError(`Terlalu banyak parameter tak pasti (${uncertain.length} > ${MAX_UNCERTAIN_PARAMS})`);
  }

  const min: Record<string, number> = { ...typ };
  const max: Record<string, number> = { ...typ };
  for (let mask = 0; mask < 1 << uncertain.length; mask++) {
    const v = { ...typValues };
    uncertain.forEach((k, i) => {
      v[k] = mask & (1 << i) ? ranges[k].max : ranges[k].min;
    });
    for (const [field, val] of Object.entries(f(v))) {
      if (val < (min[field] ?? Infinity)) min[field] = val;
      if (val > (max[field] ?? -Infinity)) max[field] = val;
    }
  }
  return { min: min as T, typ, max: max as T };
}
