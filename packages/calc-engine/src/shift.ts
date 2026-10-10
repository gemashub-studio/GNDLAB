/**
 * Rencana produksi per shift (ADR-009, kora_research.md §6).
 *
 * Setiap stasiun diubah ke kapasitas PRODUK per shift:
 *   manual  : laju/orang/jam · orang · jam_shift · efisiensi · faktor_produk
 *   mesin   : laju/unit/jam  · unit  · jam_shift · efisiensi · faktor_produk
 *   batch   : isi/angkatan · unit · (angkatan per hari ÷ shift per hari) · faktor_produk
 *             Angkatan hanya bisa DIMULAI (dimuat) di jam kerja — shift berurutan mulai jam 0 —
 *             tetapi boleh berjalan terus di luar jam kerja (oven, tungku, greenhouse). Angkatan per hari
 *             = rata-rata kondisi tunak hasil simulasi 60 hari. Contoh 1 shift 8 jam: oven 13 jam → 1/hari
 *             (bukan 24/13 = 1,85), oven 7,9 jam → 2/hari.
 * Output lini = min(kapasitas stasiun) — stasiun pembatas (bottleneck) = yang terkecil (typ).
 * Min/max output = min atas min/max tiap stasiun (min monoton tiap argumen → sah tanpa sudut gabungan).
 * Kebutuhan orang/unit untuk target = ⌈target ÷ kapasitas satu orang/unit⌉ (typ).
 */
import { evaluateRange, point, type Param, type Range } from './range.ts';
import { assertPositive, formulaOutput } from './formula-common.ts';
import type { CalcWarning } from './warnings.ts';
import type { Confidence } from './range.ts';
import type { Trace } from './trace.ts';

export type StationKind = 'manual' | 'machine' | 'batch';

export interface ShiftStation {
  id: string;
  nameId: string;
  kind: StationKind;
  /** manual/mesin: laju per orang atau per unit per jam (satuan stasiun). */
  rate?: Param;
  /** batch: isi per angkatan (satuan stasiun) & siklus (jam). */
  batchSize?: Param;
  cycleH?: Param;
  /** Jumlah orang (manual) atau unit mesin/tungku/pengering. */
  count: number;
  /** Satuan produk akhir per satuan stasiun (mis. kg kopra per butir). */
  toProduct: Param;
  /** Label satuan stasiun untuk tampilan. */
  unitLabel: string;
}

export interface ShiftInput {
  stations: ShiftStation[];
  shiftHours: number;
  /** Fraksi jam efektif (istirahat, setup, ganti lot) 0–1. */
  efficiency: number;
  shiftsPerDay: number;
  targetProduct?: number;
  datasetVersion?: string;
}

export interface StationCapacity {
  id: string;
  nameId: string;
  kind: StationKind;
  /** Kapasitas produk per shift. */
  capacity: Range;
  /** Kapasitas dalam satuan stasiun per shift. */
  stationUnits: Range;
  unitLabel: string;
  /** Utilisasi typ bila lini berjalan pada output pembatas (0–1). */
  utilization: number;
  /** Orang/unit yang dibutuhkan untuk target (typ); undefined bila tanpa target. */
  neededCount?: number;
  count: number;
}

export interface ShiftPlan {
  output: Range;
  bottleneckId: string;
  stations: StationCapacity[];
  confidence: Confidence;
  warnings: CalcWarning[];
  trace: Trace;
}

/**
 * Rata-rata angkatan per hari per unit bila angkatan hanya dimulai di jam kerja [0, jam·shift) tiap hari.
 * Simulasi 60 hari, rata-rata 30 hari terakhir (kondisi tunak).
 */
export function batchesPerDay(cycleH: number, shiftHours: number, shiftsPerDay: number): number {
  assertPositive(cycleH, 'siklus');
  const workH = shiftHours * shiftsPerDay;
  const days = 60;
  let t = 0;
  const starts: number[] = [];
  while (t < days * 24) {
    starts.push(t);
    let next = t + cycleH;
    const inDay = next % 24;
    if (inDay >= workH - 1e-9) next = Math.floor(next / 24) * 24 + 24; // tunggu shift pertama hari berikutnya
    t = next;
  }
  const from = (days / 2) * 24;
  return starts.filter((x) => x >= from).length / (days / 2);
}

function stationCapacity(s: ShiftStation, i: ShiftInput): { units: Range; product: Range; perOne: number } {
  if (s.kind === 'batch') {
    if (!s.batchSize || !s.cycleH) throw new RangeError(`${s.nameId}: stasiun batch butuh isi & siklus`);
    const r = evaluateRange({ b: s.batchSize, c: s.cycleH, t: s.toProduct }, (v) => {
      const perShift = batchesPerDay(v.c, i.shiftHours, i.shiftsPerDay) / i.shiftsPerDay;
      const units = s.count * v.b * perShift;
      return { units, product: units * v.t, perOne: v.b * perShift * v.t };
    });
    return { units: pick(r, 'units'), product: pick(r, 'product'), perOne: r.typ.perOne };
  }
  if (!s.rate) throw new RangeError(`${s.nameId}: stasiun ${s.kind} butuh laju`);
  const hours = i.shiftHours * i.efficiency;
  const r = evaluateRange({ r: s.rate, t: s.toProduct }, (v) => {
    const units = v.r * s.count * hours;
    return { units, product: units * v.t, perOne: v.r * hours * v.t };
  });
  return { units: pick(r, 'units'), product: pick(r, 'product'), perOne: r.typ.perOne };
}

const pick = <K extends string>(r: { min: Record<K, number>; typ: Record<K, number>; max: Record<K, number> }, k: K): Range => ({
  min: r.min[k],
  typ: r.typ[k],
  max: r.max[k],
});

export function shiftPlan(i: ShiftInput): ShiftPlan {
  if (!i.stations.length) throw new RangeError('Minimal satu stasiun');
  assertPositive(i.shiftHours, 'jam shift');
  if (!(i.efficiency > 0 && i.efficiency <= 1)) throw new RangeError('efisiensi harus 0 < e ≤ 1');
  if (!Number.isInteger(i.shiftsPerDay) || i.shiftsPerDay < 1 || i.shiftsPerDay > 3) throw new RangeError('shift per hari 1–3');
  if (i.shiftHours > 24 / i.shiftsPerDay) throw new RangeError('jam shift melebihi 24 ÷ shift per hari');
  for (const s of i.stations) if (!(s.count >= 0)) throw new RangeError(`${s.nameId}: jumlah tidak valid`);

  const caps = i.stations.map((s) => ({ s, ...stationCapacity(s, i) }));
  const output: Range = {
    min: Math.min(...caps.map((c) => c.product.min)),
    typ: Math.min(...caps.map((c) => c.product.typ)),
    max: Math.min(...caps.map((c) => c.product.max)),
  };
  const bottleneck = caps.reduce((a, b) => (b.product.typ < a.product.typ ? b : a));
  const stations: StationCapacity[] = caps.map((c) => ({
    id: c.s.id,
    nameId: c.s.nameId,
    kind: c.s.kind,
    capacity: c.product,
    stationUnits: c.units,
    unitLabel: c.s.unitLabel,
    count: c.s.count,
    utilization: c.product.typ > 0 ? output.typ / c.product.typ : 0,
    ...(i.targetProduct !== undefined && c.perOne > 0 && { neededCount: Math.ceil(i.targetProduct / c.perOne) }),
  }));
  const params: Param[] = i.stations.flatMap((s) => [s.rate, s.batchSize, s.cycleH, s.toProduct].filter((p): p is Param => !!p));
  const base = formulaOutput({ min: { o: output.min }, typ: { o: output.typ }, max: { o: output.max } }, params, [], i.datasetVersion);
  return { output, bottleneckId: bottleneck.s.id, stations, confidence: base.confidence, warnings: base.warnings, trace: base.trace };
}

/** Faktor konversi pasti (mis. 1 kg → 1 kg). */
export const unitFactor = (key: string): Param => ({ key, unit: 'fraction', ...point(1), confidence: 'A', sourceIds: [] });
