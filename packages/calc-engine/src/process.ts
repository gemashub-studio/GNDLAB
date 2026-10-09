/**
 * Alur proses kelapa (ADR-007): loading masuk → kupas sabut → belah → jemur di rak → cungkil →
 * kopra; batok → arang. Fungsi murni, rentang {min,typ,max} via evaluasi sudut (ADR-003).
 *
 * Neraca massa per butir bersabut (basis basah):
 *   sabut = M·h · batok = M·s · daging = M·k · air = M·max(0, 1 − h − s − k)
 *   kopra = daging · (1 − w0) / (1 − w1)                       (koreksi kadar air, calc_spec §5)
 * Rak jemur: kapasitas/rak = belahan per m² per susun × luas per susun × jumlah susun.
 * Arang: arang = batok · rendemen; angkatan drum = ⌈batok / isi drum⌉.
 * Evaluasi dipecah per kelompok agar parameter tak pasti per evaluasi ≤ 8 (calc_spec §2).
 */
import { evaluateRange, point, weakestConfidence, type Param, type Range } from './range.ts';
import { buildTrace, dedupeWarnings, type Trace } from './trace.ts';
import { commodityWarnings, lowConfidenceWarnings, warning, type CalcWarning } from './warnings.ts';

export interface OriginLot {
  /** Kode asal, mis. `dataran_rendah`. */
  key: string;
  /** Jumlah butir bersabut yang masuk. */
  nuts: number;
  wholeMassKg: Param;
  huskFraction: Param;
}

export interface DryingSetup {
  method: string;
  duration: Param; // jam per angkatan
  halvesPerM2: Param; // belahan per m² per susun
  /** Luas satu susun rak (m²). */
  tierAreaM2: number;
  /** Jumlah susun per rak (jemur langsung di lantai/para-para = 1). */
  tiers: number;
  /** Jumlah rak yang tersedia; kosong → hanya hitung rak yang dibutuhkan untuk sekali angkatan. */
  racksAvailable?: number;
  weatherDependent?: boolean;
}

export interface CharcoalSetup {
  yieldFraction: Param;
  drumBatchKg: Param;
  burnH: Param;
  coolingH: Param;
  drums: number;
}

export interface ProcessInput {
  lots: OriginLot[];
  shellFraction: Param;
  kernelFraction: Param;
  coirPerNutKg: Param;
  /** Kadar air daging segar (fraksi 0–1). */
  kernelMoisture: Param;
  /** Target kadar air kopra (fraksi 0–1). */
  targetMoisture: Param;
  /** Kode komoditas produk untuk peringatan (mis. `kopra_asalan`). */
  productCode?: string;
  drying?: DryingSetup;
  charcoal?: CharcoalSetup;
  datasetVersion?: string;
}

export type MassBalance = {
  incomingKg: number;
  huskKg: number;
  coirKg: number;
  dehuskedKg: number;
  halves: number;
  waterKg: number;
  kernelFreshKg: number;
  shellKg: number;
  copraKg: number;
};

export type DryingResult = {
  halves: number;
  capacityPerRack: number;
  racksForOneBatch: number;
  batches: number;
  totalHours: number;
};

export type CharcoalResult = {
  shellKg: number;
  charcoalKg: number;
  drumBatches: number;
  rounds: number;
  totalHours: number;
};

type R<T> = { min: T; typ: T; max: T };

export interface LotOutput {
  key: string;
  nuts: number;
  mass: R<MassBalance>;
  drying?: R<DryingResult>;
}

export interface ProcessOutput {
  lots: LotOutput[];
  total: { mass: R<MassBalance>; drying?: R<DryingResult>; charcoal?: R<CharcoalResult> };
  confidence: 'A' | 'B' | 'C';
  warnings: CalcWarning[];
  trace: Trace;
}

const ceil = (x: number) => Math.ceil(x - 1e-9);

function assertMoisture(r: Range, label: string) {
  if (!(r.min >= 0 && r.max < 1)) throw new RangeError(`${label} harus 0 ≤ w < 1 (fraksi)`);
}

function massBalance(lot: OriginLot, i: ProcessInput): { mass: R<MassBalance>; clamped: boolean } {
  if (!(Number.isInteger(lot.nuts) && lot.nuts >= 0)) throw new RangeError(`Jumlah butir ${lot.key} harus bulat ≥ 0`);
  let clamped = false;
  const mass = evaluateRange(
    {
      m: lot.wholeMassKg,
      h: lot.huskFraction,
      s: i.shellFraction,
      k: i.kernelFraction,
      c: i.coirPerNutKg,
      w0: i.kernelMoisture,
      w1: i.targetMoisture,
    },
    (v): MassBalance => {
      const incomingKg = lot.nuts * v.m;
      const waterFrac = 1 - v.h - v.s - v.k;
      if (waterFrac < 0) clamped = true;
      const kernelFreshKg = incomingKg * v.k;
      return {
        incomingKg,
        huskKg: incomingKg * v.h,
        coirKg: lot.nuts * v.c,
        dehuskedKg: incomingKg * (1 - v.h),
        halves: lot.nuts * 2,
        waterKg: incomingKg * Math.max(0, waterFrac),
        kernelFreshKg,
        shellKg: incomingKg * v.s,
        copraKg: (kernelFreshKg * (1 - v.w0)) / (1 - v.w1),
      };
    },
  );
  return { mass, clamped };
}

function drying(halves: number, d: DryingSetup): R<DryingResult> {
  if (!(d.tierAreaM2 > 0) || !(Number.isInteger(d.tiers) && d.tiers > 0)) {
    throw new RangeError('Luas susun rak harus > 0 dan jumlah susun bulat > 0');
  }
  if (d.racksAvailable !== undefined && !(Number.isInteger(d.racksAvailable) && d.racksAvailable > 0)) {
    throw new RangeError('Jumlah rak harus bulat > 0');
  }
  return evaluateRange({ dens: d.halvesPerM2, dur: d.duration }, (v): DryingResult => {
    const capacityPerRack = Math.floor(v.dens * d.tierAreaM2 * d.tiers);
    if (capacityPerRack <= 0) return { halves, capacityPerRack: 0, racksForOneBatch: 0, batches: 0, totalHours: 0 };
    const racksForOneBatch = ceil(halves / capacityPerRack);
    const racks = d.racksAvailable ?? racksForOneBatch;
    const batches = halves === 0 ? 0 : ceil(halves / (racks * capacityPerRack));
    return { halves, capacityPerRack, racksForOneBatch, batches, totalHours: batches * v.dur };
  });
}

function charcoal(shellKg: Range, c: CharcoalSetup): R<CharcoalResult> {
  if (!(Number.isInteger(c.drums) && c.drums > 0)) throw new RangeError('Jumlah drum harus bulat > 0');
  return evaluateRange(
    { shell: shellKg, y: c.yieldFraction, batch: c.drumBatchKg, burn: c.burnH, cool: c.coolingH },
    (v): CharcoalResult => {
      const drumBatches = ceil(v.shell / v.batch);
      const rounds = ceil(drumBatches / c.drums);
      return { shellKg: v.shell, charcoalKg: v.shell * v.y, drumBatches, rounds, totalHours: rounds * (v.burn + v.cool) };
    },
  );
}

function sum<T extends Record<string, number>>(list: R<T>[], keys: (keyof T)[]): R<T> {
  const acc = (pick: 'min' | 'typ' | 'max') =>
    Object.fromEntries(keys.map((k) => [k, list.reduce((n, r) => n + (r[pick][k] as number), 0)])) as T;
  return { min: acc('min'), typ: acc('typ'), max: acc('max') };
}

export function processChain(i: ProcessInput): ProcessOutput {
  if (!i.lots.length) throw new RangeError('Minimal satu kelompok asal kelapa');
  assertMoisture(i.kernelMoisture, 'Kadar air daging segar');
  assertMoisture(i.targetMoisture, 'Target kadar air kopra');

  const warnings: CalcWarning[] = [];
  const lots: LotOutput[] = i.lots.map((lot) => {
    const { mass, clamped } = massBalance(lot, i);
    if (clamped) warnings.push(warning('WATER_REMAINDER_CLAMPED', lot.key));
    // Lot dipisah per asal → rak dijemur terpisah per asal.
    const dry = i.drying && lot.nuts > 0 ? drying(lot.nuts * 2, i.drying) : undefined;
    return { key: lot.key, nuts: lot.nuts, mass, ...(dry && { drying: dry }) };
  });

  const massKeys: (keyof MassBalance)[] = ['incomingKg', 'huskKg', 'coirKg', 'dehuskedKg', 'halves', 'waterKg', 'kernelFreshKg', 'shellKg', 'copraKg'];
  const totalMass = sum(lots.map((l) => l.mass), massKeys);
  const dried = lots.filter((l) => l.drying).map((l) => l.drying!);
  // Lot berbeda asal dijemur paralel di rak masing-masing → total rak dijumlah, waktu = lot terlama.
  const totalDrying = dried.length
    ? (() => {
        const s = sum(dried, ['halves', 'racksForOneBatch', 'batches']);
        const longest = (p: 'min' | 'typ' | 'max') => Math.max(...dried.map((d) => d[p].totalHours));
        const cap = (p: 'min' | 'typ' | 'max') => dried[0]![p].capacityPerRack;
        return {
          min: { ...s.min, capacityPerRack: cap('min'), totalHours: longest('min') },
          typ: { ...s.typ, capacityPerRack: cap('typ'), totalHours: longest('typ') },
          max: { ...s.max, capacityPerRack: cap('max'), totalHours: longest('max') },
        };
      })()
    : undefined;
  const totalCharcoal = i.charcoal
    ? charcoal({ min: totalMass.min.shellKg, typ: totalMass.typ.shellKg, max: totalMass.max.shellKg }, i.charcoal)
    : undefined;

  const used: Param[] = [
    ...i.lots.flatMap((l) => [
      { ...l.wholeMassKg, key: `${l.key}.whole_fruit_mass` },
      { ...l.huskFraction, key: `${l.key}.husk_fraction` },
    ]),
    i.shellFraction,
    i.kernelFraction,
    i.coirPerNutKg,
    i.kernelMoisture,
    i.targetMoisture,
    ...(i.drying ? [i.drying.duration, i.drying.halvesPerM2] : []),
    ...(i.charcoal ? [i.charcoal.yieldFraction, i.charcoal.drumBatchKg, i.charcoal.burnH, i.charcoal.coolingH] : []),
  ];
  if (i.drying?.weatherDependent) warnings.push(warning('WEATHER_DEPENDENT'));
  warnings.push(...lowConfidenceWarnings(used));
  if (i.productCode) warnings.push(...commodityWarnings({ commodityCode: i.productCode, moisture: i.targetMoisture }));
  if (i.charcoal) warnings.push(warning('FLAMMABLE'));

  return {
    lots,
    total: { mass: totalMass, ...(totalDrying && { drying: totalDrying }), ...(totalCharcoal && { charcoal: totalCharcoal }) },
    confidence: weakestConfidence(used.map((p) => p.confidence)),
    warnings: dedupeWarnings(warnings),
    trace: buildTrace(used, i.datasetVersion),
  };
}

/** Utilitas: titik pasti untuk input pengguna (mis. target kadar air yang diketik). */
export const pointParam = (key: string, unit: Param['unit'], v: number): Param => ({
  key,
  unit,
  ...point(v),
  confidence: 'A',
  sourceIds: [],
  source: 'override',
});
