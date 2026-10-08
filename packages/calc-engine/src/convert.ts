/**
 * Konverter satuan dua arah (calculation_spec §5): butir ↔ kg ↔ ton ↔ m³ ↔ karung.
 * Semua rute lewat kg; parameter yang tak dibutuhkan rute tidak masuk evaluasi rentang.
 */
import { MissingInputError } from './container.ts';
import { evaluateRange, point, type Param, type Range } from './range.ts';
import { buildTrace, combinedConfidence, dedupeWarnings, type CalcOutput } from './trace.ts';
import { commodityWarnings, lowConfidenceWarnings, type WarningContext } from './warnings.ts';

export type QuantityUnit = 'pcs' | 'kg' | 't' | 'm3' | 'pack';

export interface ConvertInput {
  from: { unit: QuantityUnit; value: number };
  to: QuantityUnit;
  params: {
    unitMass?: Param;
    rho?: Param;
    /** Berat bersih per kemasan — dipakai bila pcsPerPack tidak ada. */
    packNetKg?: Param;
    pcsPerPack?: number;
  };
  context?: WarningContext;
  datasetVersion?: string;
}

type Need = 'm' | 'rho' | 'net';

function needs(unit: QuantityUnit, hasPcsPerPack: boolean): Need[] {
  switch (unit) {
    case 'kg':
    case 't':
      return [];
    case 'pcs':
      return ['m'];
    case 'm3':
      return ['rho'];
    case 'pack':
      return hasPcsPerPack ? ['m'] : ['net'];
  }
}

export function convert(i: ConvertInput): CalcOutput<{ value: number }> {
  if (!(i.from.value >= 0)) throw new RangeError(`Nilai harus ≥ 0, didapat ${i.from.value}`);
  const pcs = i.params.pcsPerPack;
  if (pcs !== undefined && !(Number.isInteger(pcs) && pcs > 0)) throw new RangeError('pcsPerPack harus bulat > 0');

  const required = new Set([...needs(i.from.unit, !!pcs), ...needs(i.to, !!pcs)]);
  const lookup: Record<Need, Param | undefined> = { m: i.params.unitMass, rho: i.params.rho, net: i.params.packNetKg };
  const names: Record<Need, string> = { m: 'params.unitMass', rho: 'params.rho', net: 'params.packNetKg' };
  const used: Param[] = [];
  const ranges: Record<Need, Range> = { m: point(1), rho: point(1), net: point(1) };
  for (const k of required) {
    const p = lookup[k];
    if (!p) throw new MissingInputError(names[k]);
    used.push(p);
    ranges[k] = p;
  }

  const toKg = (u: QuantityUnit, x: number, v: Record<Need, number>): number => {
    switch (u) {
      case 'kg':
        return x;
      case 't':
        return x * 1000;
      case 'pcs':
        return x * v.m;
      case 'm3':
        return x * v.rho;
      case 'pack':
        return pcs ? x * pcs * v.m : x * v.net;
    }
  };
  const fromKg = (u: QuantityUnit, kg: number, v: Record<Need, number>): number => {
    switch (u) {
      case 'kg':
        return kg;
      case 't':
        return kg / 1000;
      case 'pcs':
        return kg / v.m;
      case 'm3':
        return kg / v.rho;
      case 'pack':
        return pcs ? kg / (pcs * v.m) : kg / v.net;
    }
  };

  const result = evaluateRange(ranges, (v) => ({ value: fromKg(i.to, toKg(i.from.unit, i.from.value, v), v) }));
  return {
    result,
    binding: 'NONE',
    confidence: combinedConfidence(used),
    warnings: dedupeWarnings([...lowConfidenceWarnings(used), ...commodityWarnings(i.context)]),
    trace: buildTrace(used, i.datasetVersion),
  };
}

/** Butir kelapa → kopra: kg_kopra = n_butir / nuts_per_kg_copra. */
export function nutsToCopraKg(nuts: number, nutsPerKgCopra: Range): Range {
  const r = evaluateRange({ k: nutsPerKgCopra }, (v) => ({ kg: nuts / v.k }));
  return { min: r.min.kg, typ: r.typ.kg, max: r.max.kg };
}

/** Batok mentah → arang: kg_arang = kg_batok · charcoal_yield_mass_fraction. */
export function shellToCharcoalKg(shellKg: number, yieldFraction: Range): Range {
  const r = evaluateRange({ y: yieldFraction }, (v) => ({ kg: shellKg * v.y }));
  return { min: r.min.kg, typ: r.typ.kg, max: r.max.kg };
}
