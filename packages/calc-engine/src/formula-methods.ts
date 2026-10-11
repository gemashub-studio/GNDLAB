/**
 * Metode R&D cuka & bioleather (dataset formula v1.1.0): banding metode asetifikasi, potensi cuka
 * tanpa tambah gula, resep plastisasi, pewarnaan, dan finishing. Fungsi murni, rentang via sudut.
 */
import { ACETIC_PER_ETHANOL, ETHANOL_DENSITY_G_L, ETHANOL_PER_HEXOSE } from './formula-cuka.ts';
import { assertNonNegative, assertPct, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { evaluateRange, point, type Param, type Range } from './range.ts';
import { warning, type CalcWarning } from './warnings.ts';


// ------------------------------------------------------------------ cuka: metode asetifikasi

export type VinegarMethodKind = 'batch' | 'semi' | 'generator';

export interface VinegarMethodInput {
  kind: VinegarMethodKind;
  /** Volume kerja wadah/tangki (L) — untuk generator: volume cairan per run. */
  workingL: number;
  /** Lama asetifikasi per siklus (hari) — batch & semi. */
  acetifyDays?: Param;
  /** Lama per run (jam) — generator. */
  acetifyHours?: Param;
  /** Fraksi volume yang ditarik tiap siklus (batch = 1). */
  withdrawFraction?: Param;
  /** Run awal untuk mengkondisikan generator. */
  startupRuns?: Param;
  /** Lama fermentasi alkohol sebelum asetifikasi (hari) — sama untuk semua metode. */
  alcoholDays: Param;
  /** Jendela hitung keluaran (hari), mis. 30 = per bulan. */
  horizonDays: number;
  datasetVersion?: string;
}

export interface VinegarMethodResult extends Record<string, number> {
  cycleDays: number;
  /** Hari dari must sampai tarikan cuka pertama (alkohol + asetifikasi [+ kondisi generator]). */
  firstVinegarDays: number;
  perCycleL: number;
  cyclesInHorizon: number;
  litersInHorizon: number;
}

/**
 * Keluaran cuka per metode. Batch: seluruh volume tiap siklus. Semi-kontinu: volume × fraksi tarik,
 * sisa jadi starter siklus berikutnya. Generator: satu run = volume kerja, setelah run kondisi.
 * Siklus dihitung bulat di dalam jendela (setelah tarikan pertama).
 */
export function vinegarMethodPlan(i: VinegarMethodInput): FormulaOutput<VinegarMethodResult> {
  assertPositive(i.workingL, 'volume kerja');
  assertPositive(i.horizonDays, 'jendela hari');
  const params: Param[] = [i.alcoholDays];
  const r: Record<string, Range> = { alc: i.alcoholDays };
  if (i.kind === 'generator') {
    if (!i.acetifyHours || !i.startupRuns) throw new RangeError('Generator butuh lama per run & jumlah run awal');
    r.h = i.acetifyHours;
    r.runs = i.startupRuns;
    params.push(i.acetifyHours, i.startupRuns);
  } else {
    if (!i.acetifyDays || !i.withdrawFraction) throw new RangeError('Metode butuh lama asetifikasi & fraksi tarik');
    r.d = i.acetifyDays;
    r.f = i.withdrawFraction;
    params.push(i.acetifyDays, i.withdrawFraction);
  }
  const result = evaluateRange(r, (v) => {
    const cycleDays = i.kind === 'generator' ? v.h! / 24 : v.d!;
    const perCycleL = i.kind === 'generator' ? i.workingL : i.workingL * v.f!;
    const firstVinegarDays = v.alc! + (i.kind === 'generator' ? v.runs! * cycleDays : cycleDays);
    // Batch: tiap siklus mulai dari alkohol baru (alkohol + asetifikasi). Semi & generator: alkohol disiapkan paralel.
    const repeatDays = i.kind === 'batch' ? v.alc! + cycleDays : cycleDays;
    const cyclesInHorizon = i.horizonDays >= firstVinegarDays ? 1 + Math.floor((i.horizonDays - firstVinegarDays) / repeatDays + 1e-9) : 0;
    return { cycleDays, firstVinegarDays, perCycleL, cyclesInHorizon, litersInHorizon: cyclesInHorizon * perCycleL };
  });
  return formulaOutput(result, params, [], i.datasetVersion);
}

export interface NaturalVinegarInput {
  waterL: number;
  density: Param;
  /** Gula alami air kelapa (% massa). */
  naturalSugarPct: Param;
  ethanolEfficiency: Param;
  aceticEfficiency: Param;
  starterPct: number;
  aceticMinPct: number;
  datasetVersion?: string;
}

/** Cuka dari air kelapa TANPA tambah gula: potensi alkohol & asam asetat dari gula alami saja. */
export function naturalVinegarPotential(i: NaturalVinegarInput): FormulaOutput<{ ethanolPctV: number; aceticPotentialPct: number }> {
  assertPositive(i.waterL, 'volume air kelapa');
  assertPct(i.starterPct, 'starter');
  const result = evaluateRange({ rho: i.density, sug: i.naturalSugarPct, eE: i.ethanolEfficiency, eA: i.aceticEfficiency }, (v) => {
    const ethanolG = i.waterL * v.rho * 1000 * (v.sug / 100) * ETHANOL_PER_HEXOSE * v.eE;
    const totalL = i.waterL * (1 + i.starterPct / 100);
    return { ethanolPctV: (ethanolG / ETHANOL_DENSITY_G_L / i.waterL) * 100, aceticPotentialPct: (ethanolG * ACETIC_PER_ETHANOL * v.eA) / totalL / 10 };
  });
  const warnings: CalcWarning[] = result.max.aceticPotentialPct < i.aceticMinPct ? [warning('ACETIC_POTENTIAL_LOW', `maks ${result.max.aceticPotentialPct.toFixed(2)}%`)] : [];
  return formulaOutput(result, [i.density, i.naturalSugarPct, i.ethanolEfficiency, i.aceticEfficiency], warnings, i.datasetVersion);
}

// ------------------------------------------------------------------ bioleather: plastisasi, warna, finishing

export type PlasticizerBasis = { kind: 'bath_pct'; glycerolPct: Param } | { kind: 'bc_pct'; glycerolPctOfBc: Param } | { kind: 'glycerin_ethanol'; glycerinFraction: Param };

export interface PlasticizerInput {
  basis: PlasticizerBasis;
  /** Volume larutan rendam (L). */
  bathL: number;
  /** Berat lembar BC kering (g) — basis resep B. */
  bcDryG: number;
  datasetVersion?: string;
}

/** Gliserol (g) / gliserin & etanol (mL) per resep plastisasi. */
export function plasticizerRecipe(i: PlasticizerInput): FormulaOutput<{ glycerolG: number; glycerinMl: number; ethanolMl: number }> {
  assertNonNegative(i.bathL, 'volume larutan');
  assertNonNegative(i.bcDryG, 'berat BC kering');
  const b = i.basis;
  const p = b.kind === 'bath_pct' ? b.glycerolPct : b.kind === 'bc_pct' ? b.glycerolPctOfBc : b.glycerinFraction;
  const result = evaluateRange({ x: p }, (v) => {
    if (b.kind === 'bath_pct') {
      if (!(i.bathL > 0)) throw new RangeError('Isi volume larutan rendam');
      return { glycerolG: i.bathL * 10 * v.x, glycerinMl: 0, ethanolMl: 0 }; // % b/v → g/L = % × 10
    }
    if (b.kind === 'bc_pct') {
      if (!(i.bcDryG > 0)) throw new RangeError('Isi berat lembar BC kering');
      return { glycerolG: (i.bcDryG * v.x) / 100, glycerinMl: 0, ethanolMl: 0 };
    }
    if (!(i.bathL > 0)) throw new RangeError('Isi volume larutan rendam');
    // fraksi gliserin dari total (100 : 200 → 1/3); dataset menyimpan rasio gliserin:etanol = 0,5
    const glycerinMl = (i.bathL * 1000 * v.x) / (1 + v.x);
    return { glycerolG: 0, glycerinMl, ethanolMl: i.bathL * 1000 - glycerinMl };
  });
  return formulaOutput(result, [p], [], i.datasetVersion);
}

export interface DyeInput {
  bathL: number;
  fiberDryG: number;
  mordantGPerL?: Param;
  saltGPerL?: Param;
  dyePctOfFiber?: Param;
  datasetVersion?: string;
}

/** Takaran pewarna alami: mordan & garam per L larutan, pewarna kopi sebagai % berat serat. */
export function dyeRecipe(i: DyeInput): FormulaOutput<{ mordantG: number; saltG: number; dyeG: number }> {
  assertNonNegative(i.bathL, 'volume larutan');
  assertNonNegative(i.fiberDryG, 'berat lembar kering');
  const zero = point(0);
  const result = evaluateRange({ m: i.mordantGPerL ?? zero, s: i.saltGPerL ?? zero, d: i.dyePctOfFiber ?? zero }, (v) => ({
    mordantG: i.bathL * v.m,
    saltG: i.bathL * v.s,
    dyeG: (i.fiberDryG * v.d) / 100,
  }));
  return formulaOutput(result, [i.mordantGPerL, i.saltGPerL, i.dyePctOfFiber].filter((x): x is Param => !!x), [], i.datasetVersion);
}

export interface FinishInput {
  areaM2: number;
  /** Takaran oles (g/m²) — GAP, diisi dari timbang uji sendiri. */
  coverageGPerM2: number;
  /** Porsi lilin dalam campuran lilin+minyak (%); kosong = satu bahan (resin). */
  waxSharePct?: Param;
  datasetVersion?: string;
}

export function finishRecipe(i: FinishInput): FormulaOutput<{ totalG: number; waxG: number; oilG: number }> {
  assertPositive(i.areaM2, 'luas lembar');
  assertPositive(i.coverageGPerM2, 'takaran oles');
  const share = i.waxSharePct ?? point(100);
  const result = evaluateRange({ w: share }, (v) => {
    const totalG = i.areaM2 * i.coverageGPerM2;
    return { totalG, waxG: (totalG * v.w) / 100, oilG: totalG * (1 - v.w / 100) };
  });
  return formulaOutput(result, i.waxSharePct ? [i.waxSharePct] : [], [], i.datasetVersion);
}
