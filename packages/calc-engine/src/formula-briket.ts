/**
 * Formula adonan briket arang (shisha / BBQ / custom) — ADR-009.
 *
 * Neraca padatan kering (basis basah):
 *   perekat = arang · p%
 *   kering  = arang·(1 − w_arang) + perekat·(1 − w_perekat)
 *   adonan  = kering / (1 − w_adonan)          air tambah = adonan − arang − perekat
 *   produk  = kering / (1 − w_akhir)           air diuapkan = adonan − produk
 * Kebalikan (target produk → arang): arang = produk·(1 − w_akhir) / [(1 − w_arang) + p·(1 − w_perekat)].
 * Butir: massa/biji = volume · densitas (kubus s³; balok p·l·t) atau massa terukur.
 * Perekat pati 4–8% sebagai pasta air panas (FAO FP 63 bab 11); adonan 22–28% (Modul QC KORA).
 */
import { evaluateRange, type Param, type Range } from './range.ts';
import { assertPct, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { warning, type CalcWarning } from './warnings.ts';

export type PieceShape =
  | { kind: 'cube'; sideMm: number }
  | { kind: 'box'; lengthMm: number; widthMm: number; heightMm: number }
  | { kind: 'mass'; grams: number };

/** Volume satu biji (cm³); undefined bila bentuk dinyatakan dengan massa terukur. */
export function pieceVolumeCm3(s: PieceShape): number | undefined {
  switch (s.kind) {
    case 'cube':
      assertPositive(s.sideMm, 'sisi kubus');
      return (s.sideMm / 10) ** 3;
    case 'box':
      assertPositive(s.lengthMm, 'panjang');
      assertPositive(s.widthMm, 'lebar');
      assertPositive(s.heightMm, 'tebal');
      return (s.lengthMm * s.widthMm * s.heightMm) / 1000;
    case 'mass':
      assertPositive(s.grams, 'massa per biji');
      return undefined;
  }
}

export interface BriquetteInput {
  /** Serbuk arang (kg, basis basah) — atau isi `targetProductKg` untuk hitung mundur. */
  charcoalKg?: number;
  targetProductKg?: number;
  charcoalMoisturePct: number;
  binderPct: number;
  binderMoisturePct: number;
  doughMoisturePct: number;
  finalMoisturePct: number;
  /** Porsi air panas untuk gelatinisasi pasta perekat (%). */
  hotWaterSharePct: number;
  /** Bentuk biji; kosong → jumlah biji tidak dihitung (mis. tebal pillow belum diukur). */
  piece?: PieceShape;
  density: Param;
  /** Rentang dianjurkan untuk peringatan. */
  binderRange: Range;
  doughMoistureRange: Range;
  /** KA maks spesifikasi produk (%). */
  specMoistureMaxPct?: number;
  datasetVersion?: string;
}

export interface BriquetteResult extends Record<string, number> {
  charcoalKg: number;
  binderKg: number;
  waterKg: number;
  hotWaterKg: number;
  coldWaterKg: number;
  doughKg: number;
  productKg: number;
  evaporatedKg: number;
  pieceG: number;
  pieces: number;
  piecesPerKg: number;
}

export function briquetteMix(i: BriquetteInput): FormulaOutput<BriquetteResult> {
  assertPct(i.charcoalMoisturePct, 'KA arang');
  assertPct(i.binderPct, 'dosis perekat');
  assertPct(i.binderMoisturePct, 'KA perekat');
  assertPct(i.doughMoisturePct, 'KA adonan');
  assertPct(i.finalMoisturePct, 'KA akhir');
  assertPct(i.hotWaterSharePct, 'porsi air panas', 100.0001);
  const mc = i.charcoalMoisturePct / 100;
  const b = i.binderPct / 100;
  const mb = i.binderMoisturePct / 100;
  const dryPerCharcoal = 1 - mc + b * (1 - mb);
  let charcoalKg: number;
  if (i.charcoalKg !== undefined) {
    assertPositive(i.charcoalKg, 'serbuk arang');
    charcoalKg = i.charcoalKg;
  } else if (i.targetProductKg !== undefined) {
    assertPositive(i.targetProductKg, 'target produk');
    charcoalKg = (i.targetProductKg * (1 - i.finalMoisturePct / 100)) / dryPerCharcoal;
  } else {
    throw new RangeError('Isi berat serbuk arang atau target produk');
  }
  const binderKg = charcoalKg * b;
  const dryKg = charcoalKg * dryPerCharcoal;
  const doughKg = dryKg / (1 - i.doughMoisturePct / 100);
  const rawWater = doughKg - charcoalKg - binderKg;
  const waterKg = Math.max(0, rawWater);
  const productKg = dryKg / (1 - i.finalMoisturePct / 100);
  const vol = i.piece ? pieceVolumeCm3(i.piece) : undefined;

  const result = evaluateRange({ rho: i.density }, (v) => {
    const pieceG = !i.piece ? 0 : vol === undefined ? (i.piece as { grams: number }).grams : vol * v.rho;
    return {
      charcoalKg,
      binderKg,
      waterKg,
      hotWaterKg: (waterKg * i.hotWaterSharePct) / 100,
      coldWaterKg: waterKg * (1 - i.hotWaterSharePct / 100),
      doughKg: Math.max(doughKg, charcoalKg + binderKg),
      productKg,
      evaporatedKg: Math.max(0, Math.max(doughKg, charcoalKg + binderKg) - productKg),
      pieceG,
      pieces: pieceG > 0 ? Math.floor((productKg * 1000) / pieceG) : 0,
      piecesPerKg: pieceG > 0 ? 1000 / pieceG : 0,
    };
  });

  const warnings: CalcWarning[] = [];
  if (i.binderPct > i.binderRange.max) warnings.push(warning('BINDER_ABOVE_RANGE', `${i.binderPct}%`));
  if (i.doughMoisturePct < i.doughMoistureRange.min || i.doughMoisturePct > i.doughMoistureRange.max) {
    warnings.push(warning('DOUGH_MOISTURE_OUT_OF_RANGE', `${i.doughMoisturePct}%`));
  }
  if (rawWater < 0) warnings.push(warning('DOUGH_TOO_WET', `${(-rawWater).toFixed(2)} kg kelebihan air`));
  if (i.specMoistureMaxPct !== undefined && i.finalMoisturePct > i.specMoistureMaxPct) {
    warnings.push(warning('FINAL_MOISTURE_ABOVE_SPEC', `${i.finalMoisturePct}% > ${i.specMoistureMaxPct}%`));
  }
  const params = vol === undefined ? [] : [i.density];
  return formulaOutput(result, params, warnings, i.datasetVersion);
}

/** Cek hasil uji lab/bakar terhadap spesifikasi produk (null = tidak diuji). */
export interface BriquetteSpec {
  moisture_max_pct?: number;
  ash_max_pct?: number;
  vm_max_pct?: number;
  fc_min_pct?: number;
  calorific_min_kcal_kg?: number;
  burn_min_min?: number;
  ignition_max_min?: number;
  broken_max_pct?: number;
}

export type SpecMeasurement = Partial<Record<keyof BriquetteSpec, number>>;

export interface SpecCheck {
  key: keyof BriquetteSpec;
  limit: number;
  value: number;
  pass: boolean;
}

/** Fixed carbon proksimat: FC = 100 − (KA + abu + VM). */
export const fixedCarbonPct = (moisture: number, ash: number, vm: number): number => 100 - (moisture + ash + vm);

export function checkSpec(spec: BriquetteSpec, m: SpecMeasurement): SpecCheck[] {
  const out: SpecCheck[] = [];
  for (const [k, limit] of Object.entries(spec) as [keyof BriquetteSpec, number][]) {
    const value = m[k];
    if (value === undefined || !Number.isFinite(value)) continue;
    const isMin = k.endsWith('_min_pct') || k.endsWith('_min_kcal_kg') || k === 'burn_min_min';
    out.push({ key: k, limit, value, pass: isMin ? value >= limit : value <= limit });
  }
  return out;
}
