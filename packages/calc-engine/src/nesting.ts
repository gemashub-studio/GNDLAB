/**
 * Tumpukan bersarang arang belah 2 (calculation_spec §3.4).
 */
import { floorDiv } from './grid.ts';
import { evaluateRange, type Param } from './range.ts';
import { buildTrace, combinedConfidence, dedupeWarnings, type CalcOutput } from './trace.ts';
import type { Binding } from './types.ts';
import type { Kg, Meters } from './units.ts';
import { commodityWarnings, lowConfidenceWarnings, warning, type WarningContext } from './warnings.ts';

/** n = ⌊(h_avail − h_cup) / pitch⌋ + 1; 0 bila satu cup pun tidak muat. */
export function nestedColumnCount(hAvailM: number, hCupM: number, pitchM: number): number {
  if (!(hCupM > 0) || !(pitchM > 0)) throw new RangeError('h_cup dan pitch harus > 0');
  if (hAvailM < hCupM) return 0;
  return floorDiv(hAvailM - hCupM, pitchM) + 1;
}

export interface NestedInput {
  space: { L: Meters; W: Meters; H: Meters; payloadKg?: Kg };
  rimDiameter: Param;
  cupHeight: Param;
  pitch: Param;
  unitMass?: Param;
  context?: WarningContext;
  datasetVersion?: string;
}

export type NestedResult = { perColumn: number; columns: number; pieces: number; massKg: number };

/** Kapasitas susun bersarang dalam grid kolom persegi: ⌊L/d⌋·⌊W/d⌋ kolom. */
export function nestedCapacity(i: NestedInput): CalcOutput<NestedResult> {
  const payload = i.space.payloadKg ?? Number.POSITIVE_INFINITY;
  const used = [i.rimDiameter, i.cupHeight, i.pitch, ...(i.unitMass ? [i.unitMass] : [])];
  const unit = i.unitMass ?? { min: 0, typ: 0, max: 0 };

  const result = evaluateRange({ d: i.rimDiameter, hc: i.cupHeight, p: i.pitch, m: unit }, (v): NestedResult => {
    const perColumn = nestedColumnCount(i.space.H, v.hc, v.p);
    const columns = floorDiv(i.space.L, v.d) * floorDiv(i.space.W, v.d);
    const geom = perColumn * columns;
    const byWeight = v.m > 0 ? Math.floor(payload / v.m) : Number.POSITIVE_INFINITY;
    const pieces = Math.min(geom, byWeight);
    return { perColumn, columns, pieces, massKg: pieces * v.m };
  });

  const typGeom = result.typ.perColumn * result.typ.columns;
  const binding: Binding = typGeom === 0 ? 'NONE' : result.typ.pieces < typGeom ? 'WEIGHT' : 'VOLUME';
  const warnings = [
    ...(typGeom === 0 ? [warning('ITEM_EXCEEDS_CONTAINER')] : []),
    ...(binding === 'WEIGHT' ? [warning('WEIGHT_LIMITED')] : []),
    ...lowConfidenceWarnings(used),
    ...commodityWarnings(i.context),
  ];
  return {
    result,
    binding,
    confidence: combinedConfidence(used),
    warnings: dedupeWarnings(warnings),
    trace: buildTrace(used, i.datasetVersion),
  };
}
