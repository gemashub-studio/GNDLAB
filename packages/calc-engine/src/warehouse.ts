/**
 * Kalkulator ruang gudang (calculation_spec §4).
 */
import { need, type PackSpec } from './container.ts';
import { floorDiv } from './grid.ts';
import { evaluateRange, point, type Param, type Range } from './range.ts';
import { buildTrace, combinedConfidence, dedupeWarnings, type CalcOutput } from './trace.ts';
import type { Meters } from './units.ts';
import {
  commodityWarnings,
  lowConfidenceWarnings,
  warning,
  zoneWarnings,
  type CalcWarning,
  type WarningContext,
} from './warnings.ts';

/** Utilisasi lantai default (sisa untuk lorong & ventilasi). */
export const DEFAULT_FLOOR_UTIL = 0.65;
/** Ruang bebas di bawah atap untuk ventilasi/sprinkler. */
export const CEILING_CLEARANCE_M = 0.5;

/** Tinggi tumpuk efektif gudang = clear_height − 0,5 m. */
export function effectiveStackHeight(clearHeightM: number): Meters {
  const h = clearHeightM - CEILING_CLEARANCE_M;
  if (!(h > 0)) throw new RangeError(`Tinggi bersih ${clearHeightM} m terlalu rendah (perlu > ${CEILING_CLEARANCE_M} m)`);
  return h as Meters;
}

export type WarehouseStock = { massKg: number | Range } | { pieces: number; unitMass: Param };

export interface WarehouseInput {
  stock: WarehouseStock;
  /** Densitas curah — wajib untuk mode curah; diabaikan bila `pack` diisi. */
  rho?: Param;
  stackHeightM: Meters;
  floorUtil?: Param;
  pack?: PackSpec;
  /** Kapasitas beban lantai (kg/m²) untuk peringatan FLOOR_OVERLOAD. */
  floorLoadKgM2?: number;
  /** Dimensi zona untuk persentase zona terpakai. */
  zone?: { L: Meters; W: Meters };
  context?: WarningContext & { coStoredCommodities?: string[] };
  datasetVersion?: string;
}

export type WarehouseResult = {
  massKg: number;
  volumeM3: number;
  footprintM2: number;
  floorAreaM2: number;
  /** Beban lantai q = M / A_footprint (kg/m²). */
  floorLoadKgM2: number;
  stacks?: number;
  packs?: number;
  /** Luas lantai dibutuhkan ÷ luas zona. > 1 berarti tidak muat. */
  zoneUsedFraction?: number;
};

export function warehouseSpace(i: WarehouseInput): CalcOutput<WarehouseResult> {
  if (!(i.stackHeightM > 0)) throw new RangeError(`Tinggi tumpuk harus > 0, didapat ${i.stackHeightM}`);
  const uf = i.floorUtil ?? point(DEFAULT_FLOOR_UTIL);
  if (!(uf.min > 0 && uf.max <= 1)) throw new RangeError('Utilisasi lantai harus 0 < u ≤ 1');

  const used: Param[] = i.floorUtil ? [i.floorUtil] : [];
  let massRange: Range;
  let unitMass: Range = point(0);
  let pieces: number | undefined;
  if ('massKg' in i.stock) {
    massRange = typeof i.stock.massKg === 'number' ? point(i.stock.massKg) : i.stock.massKg;
  } else {
    pieces = i.stock.pieces;
    unitMass = i.stock.unitMass;
    used.push(i.stock.unitMass);
    massRange = point(0); // dihitung dari pieces · m di dalam f
  }
  if (pieces !== undefined && !(Number.isInteger(pieces) && pieces >= 0)) {
    throw new RangeError(`Jumlah butir harus bilangan bulat ≥ 0, didapat ${pieces}`);
  }
  if (!(massRange.min >= 0)) throw new RangeError('Massa stok harus ≥ 0');

  const zoneArea = i.zone ? i.zone.L * i.zone.W : undefined;
  const withZone = (r: Omit<WarehouseResult, 'zoneUsedFraction'>): WarehouseResult =>
    zoneArea ? { ...r, zoneUsedFraction: r.floorAreaM2 / zoneArea } : r;
  const massOf = (v: { mass: number; m: number }) => (pieces === undefined ? v.mass : pieces * v.m);

  const extra: CalcWarning[] = [];
  let result: CalcOutput<WarehouseResult>['result'];
  if (i.pack) {
    const pack = i.pack;
    used.push(pack.netKg);
    const perStack = floorDiv(i.stackHeightM, pack.h);
    if (perStack === 0) extra.push(warning('ITEM_EXCEEDS_CONTAINER', 'tinggi kemasan > tinggi tumpuk'));
    result = evaluateRange({ mass: massRange, m: unitMass, net: pack.netKg, uf }, (v) => {
      const massKg = massOf(v);
      const packs = Math.ceil(massKg / v.net - 1e-9);
      const stacks = perStack > 0 ? Math.ceil(packs / perStack) : 0;
      const footprintM2 = stacks * pack.l * pack.w;
      return withZone({
        massKg,
        packs,
        stacks,
        volumeM3: packs * pack.l * pack.w * pack.h,
        footprintM2,
        floorAreaM2: footprintM2 / v.uf,
        floorLoadKgM2: footprintM2 > 0 ? massKg / footprintM2 : 0,
      });
    });
  } else {
    const rho = need(i.rho, 'rho');
    used.push(rho);
    result = evaluateRange({ mass: massRange, m: unitMass, rho, uf }, (v) => {
      const massKg = massOf(v);
      const volumeM3 = massKg / v.rho;
      const footprintM2 = volumeM3 / i.stackHeightM;
      return withZone({
        massKg,
        volumeM3,
        footprintM2,
        floorAreaM2: footprintM2 / v.uf,
        floorLoadKgM2: footprintM2 > 0 ? massKg / footprintM2 : 0,
      });
    });
  }

  if (i.floorLoadKgM2 !== undefined && result.max.floorLoadKgM2 > i.floorLoadKgM2) {
    extra.push(warning('FLOOR_OVERLOAD', `${Math.round(result.max.floorLoadKgM2)} > ${i.floorLoadKgM2} kg/m²`));
  }
  const codes = [i.context?.commodityCode, ...(i.context?.coStoredCommodities ?? [])].filter(
    (c): c is string => !!c,
  );
  const warnings = [
    ...extra,
    ...lowConfidenceWarnings(used),
    ...commodityWarnings(i.context),
    ...zoneWarnings(codes),
  ];
  return {
    result,
    binding: 'NONE',
    confidence: combinedConfidence(used),
    warnings: dedupeWarnings(warnings),
    trace: buildTrace(used, i.datasetVersion),
  };
}
