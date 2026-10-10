/**
 * Cuka air kelapa (KORA-SOP-AKL-01 Bagian B; ADR-009).
 *
 * Gula must — neraca massa (°Brix = % massa padatan terlarut):
 *   (M·b/100 + x) / (M + x) = B/100   →   x = M·(B − b) / (100 − B),   M = V·ρ
 * Rumus lama SOP/tracker KORA `x = (B − b)·V / 100` mengabaikan pengenceran oleh gula →
 * kurang ±15–17% (FND-021). Keduanya dikembalikan agar selisihnya terlihat.
 *
 * Alkohol & asam teoretis (stoikiometri):
 *   etanol (g) = (gula tambahan·0,538 + gula alami·0,511) · efisiensi_etanol
 *     (sukrosa → 2 heksosa: 342 → 360 g; heksosa → 0,511 g etanol/g, Gay-Lussac)
 *   asam asetat (g) = etanol · (60,05 / 46,07) · efisiensi_asetat
 * Volume must ≈ V + gula · 0,63 L/kg (volume spesifik sukrosa terlarut).
 */
import { evaluateRange, type Param, type Range } from './range.ts';
import { assertNonNegative, assertPct, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { warning, type CalcWarning } from './warnings.ts';

/** g etanol per g heksosa (Gay-Lussac, teoretis). */
export const ETHANOL_PER_HEXOSE = 0.511;
/** g etanol per g sukrosa (setelah inversi: 360/342 · 0,511). */
export const ETHANOL_PER_SUCROSE = (360 / 342) * ETHANOL_PER_HEXOSE;
/** g asam asetat per g etanol (60,05 / 46,07). */
export const ACETIC_PER_ETHANOL = 60.05 / 46.07;
/** Massa jenis etanol (g/L) untuk % v/v. */
export const ETHANOL_DENSITY_G_L = 789;
/** Volume spesifik sukrosa terlarut (L/kg) — penambahan volume must. */
export const SUCROSE_SPECIFIC_VOLUME_L_KG = 0.63;
/** Massa molar asam asetat (g/mol). */
export const ACETIC_G_MOL = 60.05;

/** Gula yang harus ditambahkan agar °Brix naik dari b ke B (neraca massa). */
export function sugarToBrixKg(massKg: number, brixStart: number, brixTarget: number): number {
  assertPositive(massKg, 'massa air kelapa');
  assertPct(brixStart, '°Brix awal');
  assertPct(brixTarget, '°Brix target');
  if (brixTarget <= brixStart) return 0;
  return (massKg * (brixTarget - brixStart)) / (100 - brixTarget);
}

/** Rumus lama SOP/tracker KORA — HANYA untuk pembanding (FND-021). */
export function legacySugarKg(volumeL: number, brixStart: number, brixTarget: number): number {
  return Math.max(0, ((brixTarget - brixStart) * volumeL) / 100);
}

/** °Brix akhir sebenarnya bila gula `addedKg` dimasukkan ke larutan massa M dengan °Brix b. */
export function brixAfterAdding(massKg: number, brixStart: number, addedKg: number): number {
  return ((massKg * brixStart) / 100 + addedKg) / (massKg + addedKg) * 100;
}

export interface TitrationInput {
  /** Volume NaOH terpakai sampai titik akhir (mL). */
  naohMl: number;
  /** Normalitas NaOH (N) — WAJIB sesuai label larutan standar. */
  normality: number;
  /** Volume sampel cuka dipipet (mL). */
  sampleMl: number;
}

export interface TitrationResult {
  /** Asam asetat (g/100 mL = % b/v). */
  acidityPct: number;
  /** Hasil rumus ringkas `0,06005 × V` (benar hanya untuk 0,1 N & 10 mL). */
  shortcutPct: number;
  /** true bila rumus ringkas tidak berlaku untuk N/Vs ini (FND-022). */
  shortcutInvalid: boolean;
}

/** % asam asetat (b/v) = V·N·60,05 / (10·Vs) = V·N·6,005 / Vs. */
export function titrationAcidity(i: TitrationInput): TitrationResult {
  assertNonNegative(i.naohMl, 'volume NaOH');
  assertPositive(i.normality, 'normalitas NaOH');
  assertPositive(i.sampleMl, 'volume sampel');
  const acidityPct = (i.naohMl * i.normality * ACETIC_G_MOL) / (10 * i.sampleMl);
  const shortcutPct = 0.06005 * i.naohMl;
  return { acidityPct, shortcutPct, shortcutInvalid: Math.abs(i.normality - 0.1) > 1e-9 || Math.abs(i.sampleMl - 10) > 1e-9 };
}

export interface VinegarInput {
  /** Air kelapa tersaring (L). */
  waterL: number;
  /** °Brix awal hasil ukur refraktometer. */
  brixStart: number;
  /** °Brix target must (14–17). */
  brixTarget: number;
  /** Massa jenis air kelapa (kg/L). */
  density: Param;
  /** Gula alami air kelapa (% massa) — bagian dari °Brix awal. */
  naturalSugarPct: Param;
  ethanolEfficiency: Param;
  aceticEfficiency: Param;
  /** Ragi (g per L must). */
  yeastGPerL: number;
  /** Starter cuka hidup (% v/v dari cairan alkohol). */
  starterPct: number;
  /** Putih telur klarifikasi (g/L); 0 = tanpa klarifikasi (alergen). */
  eggWhiteGPerL: number;
  eggWhitePerEggG: number;
  /** Rentang °Brix must yang dianjurkan (untuk peringatan). */
  mustBrixRange: Range;
  /** Asam asetat minimum produk (%). */
  aceticMinPct: number;
  datasetVersion?: string;
}

export interface VinegarResult extends Record<string, number> {
  sugarKg: number;
  legacySugarKg: number;
  /** °Brix yang benar-benar tercapai bila memakai rumus lama. */
  legacyBrix: number;
  mustKg: number;
  mustL: number;
  yeastG: number;
  ethanolPctV: number;
  starterL: number;
  acetifyL: number;
  /** Potensi asam asetat setelah starter (% b/v), belum termasuk asam bawaan starter. */
  aceticPotentialPct: number;
  eggWhiteG: number;
  eggs: number;
}

export function vinegarBatch(i: VinegarInput): FormulaOutput<VinegarResult> {
  assertPositive(i.waterL, 'volume air kelapa');
  if (i.brixTarget <= i.brixStart) throw new RangeError('°Brix target harus lebih tinggi dari °Brix awal');
  assertPct(i.starterPct, 'starter');
  assertNonNegative(i.yeastGPerL, 'ragi');
  assertNonNegative(i.eggWhiteGPerL, 'putih telur');
  assertPositive(i.eggWhitePerEggG, 'berat putih telur per butir');

  const result = evaluateRange(
    { rho: i.density, sug: i.naturalSugarPct, effE: i.ethanolEfficiency, effA: i.aceticEfficiency },
    (v) => {
      const waterKg = i.waterL * v.rho;
      const sugarKg = sugarToBrixKg(waterKg, i.brixStart, i.brixTarget);
      const legacy = legacySugarKg(i.waterL, i.brixStart, i.brixTarget);
      const mustKg = waterKg + sugarKg;
      const mustL = i.waterL + sugarKg * SUCROSE_SPECIFIC_VOLUME_L_KG;
      const ethanolG = (sugarKg * 1000 * ETHANOL_PER_SUCROSE + waterKg * 1000 * (v.sug / 100) * ETHANOL_PER_HEXOSE) * v.effE;
      const starterL = (mustL * i.starterPct) / 100;
      const acetifyL = mustL + starterL;
      const aceticG = ethanolG * ACETIC_PER_ETHANOL * v.effA;
      const eggWhiteG = i.eggWhiteGPerL * acetifyL;
      return {
        sugarKg,
        legacySugarKg: legacy,
        legacyBrix: brixAfterAdding(waterKg, i.brixStart, legacy),
        mustKg,
        mustL,
        yeastG: i.yeastGPerL * mustL,
        ethanolPctV: (ethanolG / ETHANOL_DENSITY_G_L / mustL) * 100,
        starterL,
        acetifyL,
        aceticPotentialPct: aceticG / acetifyL / 10,
        eggWhiteG,
        eggs: Math.ceil(eggWhiteG / i.eggWhitePerEggG),
      };
    },
  );

  const warnings: CalcWarning[] = [];
  if (i.brixTarget < i.mustBrixRange.min || i.brixTarget > i.mustBrixRange.max) {
    warnings.push(warning('MUST_BRIX_OUT_OF_RANGE', `${i.brixTarget}`));
  }
  if (result.typ.aceticPotentialPct < i.aceticMinPct) warnings.push(warning('ACETIC_POTENTIAL_LOW', result.typ.aceticPotentialPct.toFixed(2)));
  return formulaOutput(result, [i.density, i.naturalSugarPct, i.ethanolEfficiency, i.aceticEfficiency], warnings, i.datasetVersion);
}
