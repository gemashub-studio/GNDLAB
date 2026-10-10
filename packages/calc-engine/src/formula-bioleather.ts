/**
 * Bioleather dari selulosa bakteri air kelapa (KORA-SOP-AKL-01 Bagian C; ADR-009).
 *
 * Media (per L): sukrosa, ZA, starter % v/v. Volume media dari baki: n · p · l · kedalaman.
 * Hasil basah = laju (g/L/hari) · volume · hari kultur; kering = basah · fraksi kering.
 * NaOH (g) = M · 40 g/mol · L larutan; gliserol (mL) = % · L larutan · 10.
 * Selulosa terbentuk di permukaan udara-cairan → luas lebih penting dari kedalaman (Verschuren 2000).
 */
import { evaluateRange, type Param } from './range.ts';
import { assertNonNegative, assertPct, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { warning, type CalcWarning } from './warnings.ts';

export const NAOH_G_MOL = 40;
/** Batas keras molaritas NaOH pemurnian (NaOH 2–8% merusak serat — Chen 2021). */
export const NAOH_MAX_M = 0.1;

export interface TraySetup {
  count: number;
  lengthCm: number;
  widthCm: number;
  /** Kedalaman cairan (cm) — optimum belum diketahui (GAP; uji 3/5/8 cm). */
  depthCm: number;
}

export const trayMediaL = (t: TraySetup): number => {
  assertPositive(t.count, 'jumlah baki');
  assertPositive(t.lengthCm, 'panjang baki');
  assertPositive(t.widthCm, 'lebar baki');
  assertPositive(t.depthCm, 'kedalaman cairan');
  return (t.count * t.lengthCm * t.widthCm * t.depthCm) / 1000;
};

export interface BioleatherInput {
  mediaL: number;
  /** Luas permukaan total (cm²) — untuk g/cm² lembar kering; opsional. */
  surfaceCm2?: number;
  sucroseGPerL: number;
  zaGPerL: number;
  starterPct: number;
  cultureDays: Param;
  wetYieldGPerLDay: Param;
  dryFraction: Param;
  naohM: number;
  naohSolutionL: number;
  glycerolPct: number;
  plastSolutionL: number;
  datasetVersion?: string;
}

export interface BioleatherResult extends Record<string, number> {
  sucroseG: number;
  zaG: number;
  starterMl: number;
  naohG: number;
  glycerolMl: number;
  wetSheetG: number;
  drySheetG: number;
  /** g lembar kering per cm² permukaan (0 bila luas tidak diisi). */
  dryGPerCm2: number;
}

export function bioleatherBatch(i: BioleatherInput): FormulaOutput<BioleatherResult> {
  assertPositive(i.mediaL, 'volume media');
  assertNonNegative(i.sucroseGPerL, 'sukrosa');
  assertNonNegative(i.zaGPerL, 'ZA');
  assertPct(i.starterPct, 'starter');
  assertNonNegative(i.naohM, 'molaritas NaOH');
  assertNonNegative(i.naohSolutionL, 'volume larutan NaOH');
  assertPct(i.glycerolPct, 'gliserol');
  assertNonNegative(i.plastSolutionL, 'volume larutan plastisasi');

  const result = evaluateRange({ days: i.cultureDays, rate: i.wetYieldGPerLDay, dry: i.dryFraction }, (v) => {
    const wetSheetG = v.rate * i.mediaL * v.days;
    const drySheetG = wetSheetG * v.dry;
    return {
      sucroseG: i.sucroseGPerL * i.mediaL,
      zaG: i.zaGPerL * i.mediaL,
      starterMl: (i.mediaL * 1000 * i.starterPct) / 100,
      naohG: i.naohM * NAOH_G_MOL * i.naohSolutionL,
      glycerolMl: i.glycerolPct * i.plastSolutionL * 10,
      wetSheetG,
      drySheetG,
      dryGPerCm2: i.surfaceCm2 ? drySheetG / i.surfaceCm2 : 0,
    };
  });
  const warnings: CalcWarning[] = [];
  if (i.naohM > NAOH_MAX_M) warnings.push(warning('NAOH_TOO_STRONG', `${i.naohM} M`));
  return formulaOutput(result, [i.cultureDays, i.wetYieldGPerLDay, i.dryFraction], warnings, i.datasetVersion);
}
