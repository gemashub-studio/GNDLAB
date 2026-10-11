/**
 * Formula R&D kopra (KORA-SOP-KPR-01; Rencana R&D Ronde 1; ADR-009).
 * Neraca massa butir → kopra memakai `processChain` (ADR-007); modul ini menambah bagian R&D:
 * rendemen dari daging, grade dari KA, alarm KA 24/48 jam, aturan 4 jam (dosis sulfur TIDAK dihitung — DEC-048),
 * kapasitas greenhouse, dan desain perlakuan × ulangan.
 */
import { evaluateRange, type Param } from './range.ts';
import { assertNonNegative, assertPct, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { warning, type CalcWarning } from './warnings.ts';

export interface CopraFromNutsInput {
  nuts: number;
  meatPerNutKg: Param;
  /** KA daging segar (%). */
  meatMoisturePct: Param;
  /** KA kopra target (%). */
  targetMoisturePct: number;
  waterPerNutL: Param;
  datasetVersion?: string;
}

export interface CopraFromNutsResult extends Record<string, number> {
  meatKg: number;
  copraKg: number;
  copraPer1000Nuts: number;
  /** Rendemen kopra dari daging segar (fraksi). */
  copraPerMeat: number;
  waterL: number;
}

/** kopra = daging · (1 − w0) / (1 − w1)  (calc_spec §5). */
export function copraFromNuts(i: CopraFromNutsInput): FormulaOutput<CopraFromNutsResult> {
  assertPositive(i.nuts, 'jumlah butir');
  assertPct(i.targetMoisturePct, 'KA target');
  const result = evaluateRange({ meat: i.meatPerNutKg, w0: i.meatMoisturePct, water: i.waterPerNutL }, (v) => {
    const meatKg = i.nuts * v.meat;
    const copraPerMeat = (1 - v.w0 / 100) / (1 - i.targetMoisturePct / 100);
    const copraKg = meatKg * copraPerMeat;
    return { meatKg, copraKg, copraPer1000Nuts: (copraKg / i.nuts) * 1000, copraPerMeat, waterL: i.nuts * v.water };
  });
  return formulaOutput(result, [i.meatPerNutKg, i.meatMoisturePct, i.waterPerNutL], [], i.datasetVersion);
}

export interface CopraGrade {
  id: string;
  nameId: string;
  moistureMaxPct: number;
}

export type GradeDecision =
  | { kind: 'grade'; id: string; nameId: string }
  | { kind: 're_dry' }
  | { kind: 'too_dry'; id: string; nameId: string };

/** Grade dari KA rata-rata (grade diurut dari paling ketat). Di bawah batas rapuh → `too_dry`. */
export function gradeForMoisture(moisturePct: number, grades: readonly CopraGrade[], minPct: number): GradeDecision {
  assertNonNegative(moisturePct, 'KA');
  const sorted = [...grades].sort((a, b) => a.moistureMaxPct - b.moistureMaxPct);
  const g = sorted.find((x) => moisturePct <= x.moistureMaxPct);
  if (!g) return { kind: 're_dry' };
  return moisturePct < minPct ? { kind: 'too_dry', id: g.id, nameId: g.nameId } : { kind: 'grade', id: g.id, nameId: g.nameId };
}

export interface DryingCheckInput {
  /** Jam sejak masuk pengering. */
  hours: number;
  moisturePct: number;
  alarm24MaxPct: number;
  alarm48MaxPct: number;
}

/** Alarm dini kurva KA (FAO HACCP): ≤35% di 24 jam, ≤20% di 48 jam. */
export function dryingCheck(i: DryingCheckInput): { onTrack: boolean; limitPct?: number; warnings: CalcWarning[] } {
  const limit = i.hours >= 48 ? i.alarm48MaxPct : i.hours >= 24 ? i.alarm24MaxPct : undefined;
  if (limit === undefined) return { onTrack: true, warnings: [] };
  const onTrack = i.moisturePct <= limit;
  return { onTrack, limitPct: limit, warnings: onTrack ? [] : [warning('DRYING_BEHIND_SCHEDULE', `${i.moisturePct}% > ${limit}% @${i.hours} jam`)] };
}

/** Aturan 4 jam: jeda belah → pengering. */
export function splitDelayCheck(delayH: number, maxH: number): { ok: boolean; warnings: CalcWarning[] } {
  assertNonNegative(delayH, 'jeda');
  const ok = delayH <= maxH;
  return { ok, warnings: ok ? [] : [warning('SPLIT_DELAY_EXCEEDED', `${delayH} jam`)] };
}

/** Kapasitas greenhouse (butir) = luas rak · belahan/m² ÷ 2. */
export function greenhouseCapacityNuts(rackAreaM2: Param, halvesPerM2: Param): { min: number; typ: number; max: number } {
  const r = evaluateRange({ a: rackAreaM2, h: halvesPerM2 }, (v) => ({ nuts: Math.floor((v.a * v.h) / 2) }));
  return { min: r.min.nuts, typ: r.typ.nuts, max: r.max.nuts };
}

export interface TrialDesignInput {
  treatments: number;
  replicates: number;
  nutsPerReplicate: number;
  availableKg: number;
  kgPerNut: number;
  /** Cadangan minimum butir (Tracker R&D: ≥5). */
  reserveMin: number;
}

export interface TrialDesign {
  nutsAvailable: number;
  nutsNeeded: number;
  reserve: number;
  status: 'ok' | 'reserve_thin' | 'short';
}

/** Desain perlakuan × ulangan (Tracker R&D Ronde 1, sheet Input). */
export function trialDesign(i: TrialDesignInput): TrialDesign {
  for (const [k, v] of Object.entries({ treatments: i.treatments, replicates: i.replicates, nutsPerReplicate: i.nutsPerReplicate })) {
    if (!Number.isInteger(v) || v < 1) throw new RangeError(`${k} harus bilangan bulat ≥ 1`);
  }
  assertPositive(i.availableKg, 'berat kelapa');
  assertPositive(i.kgPerNut, 'berat per butir');
  const nutsAvailable = Math.floor(i.availableKg / i.kgPerNut);
  const nutsNeeded = i.treatments * i.replicates * i.nutsPerReplicate;
  const reserve = nutsAvailable - nutsNeeded;
  return { nutsAvailable, nutsNeeded, reserve, status: reserve < 0 ? 'short' : reserve < i.reserveMin ? 'reserve_thin' : 'ok' };
}
