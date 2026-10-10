/**
 * Formula arang batok (KORA-SOP-ARG-01; ADR-009).
 *   arang = batok · rendemen        batok perlu (target) = arang ÷ rendemen
 *   angkatan = ⌈batok ÷ isi tungku⌉  siklus = bakar + mati hampa (≥ 8 jam, K-01)
 *   waktu total = ⌈angkatan ÷ jumlah tungku⌉ · siklus      asap cair = batok · L/kg (pirolisis)
 */
import { evaluateRange, type Param } from './range.ts';
import { assertNonNegative, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { warning, type CalcWarning } from './warnings.ts';

/** Mati hampa minimal (jam) — CDB India, FAO via SOP KORA D1. */
export const MIN_COOLING_H = 8;

export interface CharcoalPlanInput {
  /** Batok masuk (kg) — atau isi `targetCharcoalKg` untuk hitung mundur. */
  shellKg?: number;
  targetCharcoalKg?: number;
  /** Rendemen (%) — acuan literatur atau data KORA. */
  yieldPct: Param;
  batchShellKg: Param;
  burnH: Param;
  coolingH: Param;
  kilns: number;
  /** Asap cair (L/kg batok); kosong untuk kombi (asap lepas). */
  liquidSmokeLPerKg?: Param;
  /** Acuan literatur (%) untuk peringatan rendemen. */
  referenceYieldMinPct: number;
  datasetVersion?: string;
}

export interface CharcoalPlanResult extends Record<string, number> {
  shellKg: number;
  charcoalKg: number;
  batches: number;
  cycleH: number;
  totalH: number;
  liquidSmokeL: number;
}

export function charcoalPlan(i: CharcoalPlanInput): FormulaOutput<CharcoalPlanResult> {
  if (!Number.isInteger(i.kilns) || i.kilns < 1) throw new RangeError('jumlah tungku minimal 1');
  if (i.shellKg === undefined && i.targetCharcoalKg === undefined) throw new RangeError('Isi berat batok atau target arang');
  if (i.shellKg !== undefined) assertPositive(i.shellKg, 'batok');
  if (i.targetCharcoalKg !== undefined) assertPositive(i.targetCharcoalKg, 'target arang');
  const smoke = i.liquidSmokeLPerKg ?? { min: 0, typ: 0, max: 0 };
  const result = evaluateRange(
    { y: i.yieldPct, batch: i.batchShellKg, burn: i.burnH, cool: i.coolingH, smoke },
    (v) => {
      const shellKg = i.shellKg ?? i.targetCharcoalKg! / (v.y / 100);
      const charcoalKg = i.shellKg !== undefined ? shellKg * (v.y / 100) : i.targetCharcoalKg!;
      const batches = Math.ceil(shellKg / v.batch);
      const cycleH = v.burn + v.cool;
      return { shellKg, charcoalKg, batches, cycleH, totalH: Math.ceil(batches / i.kilns) * cycleH, liquidSmokeL: shellKg * v.smoke };
    },
  );
  const warnings: CalcWarning[] = [warning('FLAMMABLE')];
  if (i.coolingH.min < MIN_COOLING_H) warnings.push(warning('COOLING_TOO_SHORT', `${i.coolingH.min} jam`));
  if (i.yieldPct.typ < i.referenceYieldMinPct) warnings.push(warning('YIELD_BELOW_REFERENCE', `${i.yieldPct.typ}% < ${i.referenceYieldMinPct}%`));
  const params = [i.yieldPct, i.batchShellKg, i.burnH, i.coolingH, ...(i.liquidSmokeLPerKg ? [i.liquidSmokeLPerKg] : [])];
  return formulaOutput(result, params, warnings, i.datasetVersion);
}

export interface YieldMeasurement {
  shellInKg: number;
  charcoalOutKg: number;
  /** Arang mentah tersortir (kg) — key measure % mentah. */
  rawKg?: number;
}

export interface YieldStatus {
  yieldPct: number;
  rawPct?: number;
  vsReference: 'below' | 'within' | 'above';
  meetsTarget3m: boolean;
  meetsTarget6m: boolean;
}

/** Rendemen terukur vs acuan & target bertahap KORA (≥25% → ≥28%). */
export function charcoalYieldStatus(m: YieldMeasurement, reference: { min: number; max: number }, target3m: number, target6m: number): YieldStatus {
  assertPositive(m.shellInKg, 'batok masuk');
  assertNonNegative(m.charcoalOutKg, 'arang keluar');
  const yieldPct = (m.charcoalOutKg / m.shellInKg) * 100;
  const out: YieldStatus = {
    yieldPct,
    vsReference: yieldPct < reference.min ? 'below' : yieldPct > reference.max ? 'above' : 'within',
    meetsTarget3m: yieldPct >= target3m,
    meetsTarget6m: yieldPct >= target6m,
  };
  if (m.rawKg !== undefined && m.charcoalOutKg > 0) out.rawPct = (m.rawKg / m.charcoalOutKg) * 100;
  return out;
}

/** Persentase per fraksi ayak (kg terukur → % dari total masuk). */
export function fractionShares(massesKg: Readonly<Record<string, number>>): { totalKg: number; pct: Record<string, number> } {
  const totalKg = Object.values(massesKg).reduce((a, b) => a + b, 0);
  if (!(totalKg > 0)) throw new RangeError('Total fraksi harus > 0');
  const pct: Record<string, number> = {};
  for (const [k, v] of Object.entries(massesKg)) {
    assertNonNegative(v, k);
    pct[k] = (v / totalKg) * 100;
  }
  return { totalKg, pct };
}
