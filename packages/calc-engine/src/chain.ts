/**
 * Rantai produksi (ADR-010): angkut, kode lot asal, belah/sortir/air kelapa, desain ruang rak
 * (greenhouse/oven/jemur), karbonisasi drum/kolam + ayak + hammer mill, campuran briket per asal,
 * dan aditif selulosa bioleather. Fungsi murni tanpa I/O; parameter dari dataset rantai/formula.
 */
import { containerCapacity, type ContainerResult, type PackSpec } from './container.ts';
import { MIN_COOLING_H } from './formula-arang.ts';
import type { BriquetteSpec, SpecCheck } from './formula-briket.ts';
import { checkSpec } from './formula-briket.ts';
import { assertNonNegative, assertPct, assertPositive, formulaOutput, type FormulaOutput } from './formula-common.ts';
import { evaluateRange, type Param, type Range } from './range.ts';
import type { CalcOutput } from './trace.ts';
import type { Binding } from './types.ts';
import type { Kg, Meters } from './units.ts';
import { warning, type CalcWarning } from './warnings.ts';

// ------------------------------------------------------------------ asal lot

export type OriginClass = 'DR' | 'DT';

/** Kelas asal dari ketinggian kebun: DR bila ≤ batas, DT bila > batas (dataset rantai, keputusan owner K-03). */
export function originClass(altitudeM: number, thresholdM: number): OriginClass {
  assertNonNegative(altitudeM, 'ketinggian kebun (mdpl)');
  assertPositive(thresholdM, 'batas ketinggian');
  return altitudeM <= thresholdM ? 'DR' : 'DT';
}

/** Isi pola kode lot dataset, mis. `{KELAS}-{YYMMDD}-{NNN}` → `DT-261010-001`. */
export function formatLotCode(pattern: string, origin: OriginClass, isoDate: string, seq: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new RangeError(`Tanggal harus YYYY-MM-DD, didapat ${isoDate}`);
  if (!Number.isInteger(seq) || seq < 1 || seq > 999) throw new RangeError('Nomor urut lot 1–999');
  return pattern
    .replace('{KELAS}', origin)
    .replace('{YYMMDD}', `${m[1]!.slice(2)}${m[2]}${m[3]}`)
    .replace('{NNN}', String(seq).padStart(3, '0'));
}

// ------------------------------------------------------------------ angkut

export interface VehicleSpec {
  L: number;
  W: number;
  H: number;
  payload: Param;
  kind: 'truck' | 'container';
}

/** Karung (grid, ADR-005) atau curah butir lepas (densitas tumpukan ÷ massa butir). */
export type LoadForm = { mode: 'bag'; pack: PackSpec } | { mode: 'bulk'; rho: Param; unitMass: Param };

export interface VehicleLoadResult extends Record<string, number> {
  pieces: number;
  massKg: number;
  packs: number;
  volumeFill: number;
  weightFill: number;
}

/**
 * Muatan satu kendaraan = min(batas ruang, payload). Payload truk berupa rentang data vendor →
 * dihitung di tiap sudut payload; hasil min/typ/max = sudut terkecil/typ/terbesar.
 */
export function vehicleLoad(v: VehicleSpec, form: LoadForm, datasetVersion?: string): FormulaOutput<VehicleLoadResult> & { binding: Binding } {
  const run = (payloadKg: number): CalcOutput<ContainerResult> =>
    containerCapacity({
      container: { L: v.L as Meters, W: v.W as Meters, H: v.H as Meters, payloadKg: payloadKg as Kg },
      form: form.mode === 'bag' ? { mode: 'PACKAGE', pack: form.pack } : { mode: 'PIECE', rho: form.rho, unitMass: form.unitMass },
    });
  const pick = (r: ContainerResult): VehicleLoadResult => ({
    pieces: r.pieces ?? 0,
    massKg: r.massKg,
    packs: r.packs ?? 0,
    volumeFill: r.volumeFill,
    weightFill: r.weightFill,
  });
  const lo = run(v.payload.min);
  const mid = run(v.payload.typ);
  const hi = run(v.payload.max);
  const result = { min: pick(lo.result.min), typ: pick(mid.result.typ), max: pick(hi.result.max) };
  const formParams = form.mode === 'bag' ? [form.pack.netKg] : [form.rho, form.unitMass];
  const warnings: CalcWarning[] = mid.warnings.filter((w) => w.code !== 'LOW_CONFIDENCE_PARAM');
  if (v.kind === 'truck') warnings.push(warning('PAYLOAD_LEGAL_CHECK'));
  return { ...formulaOutput(result, [v.payload, ...formParams], warnings, datasetVersion), binding: mid.binding };
}

/** Jumlah rit untuk memindahkan `total` butir: min memakai muatan terbesar, max muatan terkecil. */
export function tripsNeeded(total: number, perTrip: Range): Range {
  assertPositive(total, 'jumlah butir');
  if (!(perTrip.min > 0)) throw new RangeError('Muatan per rit 0 — kemasan tidak muat di kendaraan');
  return { min: Math.ceil(total / perTrip.max), typ: Math.ceil(total / perTrip.typ), max: Math.ceil(total / perTrip.min) };
}

// ------------------------------------------------------------------ belah, sortir, air kelapa

export interface GradeShare {
  edible: number;
  reguler: number;
  asalan: number;
}

export interface SplitPlanInput {
  nuts: number;
  /** Pembagian jalur kopra (% dari butir yang tidak ditolak), jumlah 100. */
  share: GradeShare;
  /** % butir busuk yang ditolak saat belah (hasil sortir; 0 bila belum ada data). */
  rejectPct: number;
  waterPerNutL: Param;
  meatPerNutKg: Param;
  halfShellKg: Param;
  splitRatePerPersonH: Param;
  workers: number;
  chillWithinH: Param;
  datasetVersion?: string;
}

export interface SplitPlanResult extends Record<string, number> {
  acceptedNuts: number;
  edibleNuts: number;
  regulerNuts: number;
  asalanNuts: number;
  /** Air ditampung hanya dari jalur edible + reguler (air jernih); tunas/retak/busuk tidak. */
  waterL: number;
  meatEdibleKg: number;
  meatRegulerKg: number;
  meatAsalanKg: number;
  /** Batok mentah: semua butir (termasuk yang ditolak) → jalur arang setelah cuci-jemur. */
  shellKg: number;
  splitH: number;
  /** Air yang keluar per jendela pendinginan → kapasitas pendingin minimum. */
  chillBatchL: number;
}

export function splitPlan(i: SplitPlanInput): FormulaOutput<SplitPlanResult> {
  assertPositive(i.nuts, 'jumlah butir');
  assertPositive(i.workers, 'jumlah pekerja belah');
  assertPct(i.rejectPct, '% ditolak');
  const sum = i.share.edible + i.share.reguler + i.share.asalan;
  if (Math.abs(sum - 100) > 0.01) throw new RangeError(`Pembagian jalur harus 100%, didapat ${sum}`);
  const accepted = i.nuts * (1 - i.rejectPct / 100);
  const e = (accepted * i.share.edible) / 100;
  const r = (accepted * i.share.reguler) / 100;
  const a = (accepted * i.share.asalan) / 100;
  const result = evaluateRange(
    { w: i.waterPerNutL, m: i.meatPerNutKg, s: i.halfShellKg, rate: i.splitRatePerPersonH, chill: i.chillWithinH },
    (v) => {
      const splitH = i.nuts / (v.rate * i.workers);
      const waterL = (e + r) * v.w;
      return {
        acceptedNuts: accepted,
        edibleNuts: e,
        regulerNuts: r,
        asalanNuts: a,
        waterL,
        meatEdibleKg: e * v.m,
        meatRegulerKg: r * v.m,
        meatAsalanKg: a * v.m,
        shellKg: i.nuts * 2 * v.s,
        splitH,
        chillBatchL: (waterL / splitH) * Math.min(v.chill, splitH),
      };
    },
  );
  return formulaOutput(result, [i.waterPerNutL, i.meatPerNutKg, i.halfShellKg, i.splitRatePerPersonH, i.chillWithinH], [], i.datasetVersion);
}

// ------------------------------------------------------------------ ruang rak (greenhouse / oven)

export interface RackRoomInput {
  roomL: number;
  roomW: number;
  roomH: number;
  rackDepth: Param;
  tierPitch: Param;
  aisleMin: Param;
  roofClearance: Param;
  halvesPerM2: Param;
  /** Jarak bebas di tiap ujung rak (untuk kipas/pintu), m. Default 0 seperti contoh KORA. */
  endClearanceM?: number;
  /** Ukuran tray (m). Default tray persegi selebar rak. */
  trayL?: number;
  trayW?: number;
  datasetVersion?: string;
}

export interface RackRoomResult extends Record<string, number> {
  racks: number;
  aisles: number;
  aisleM: number;
  rackLenM: number;
  rackHeightM: number;
  tiers: number;
  tierAreaM2: number;
  totalAreaM2: number;
  traysPerTier: number;
  trays: number;
  halvesPerTray: number;
  nutsPerTray: number;
  nutsByTrays: number;
  nutsByArea: number;
  roomM3: number;
}

/**
 * Tata letak rak memanjang searah panjang ruang: rak–lorong–rak (rak tepi menempel dinding).
 * rak = ⌊(W + a) ÷ (d + a)⌋; 1 rak butuh W ≥ d + a. Tingkat = ⌊(H − ruang atap) ÷ jarak tingkat⌋.
 * Belahan per tray = grid persegi berjarak 1/√(belahan/m²). Contoh KORA 3×10×3,5 m → 3 rak × 6 tingkat = 117 m².
 */
export function rackRoomDesign(i: RackRoomInput): FormulaOutput<RackRoomResult> {
  for (const [k, v] of Object.entries({ panjang: i.roomL, lebar: i.roomW, tinggi: i.roomH })) assertPositive(v, `${k} ruang`);
  const d = i.rackDepth.typ;
  const a = i.aisleMin.typ;
  const pitch = i.tierPitch.typ;
  const end = i.endClearanceM ?? 0;
  assertNonNegative(end, 'jarak bebas ujung');
  let racks = Math.floor((i.roomW + a) / (d + a) + 1e-9);
  if (racks === 1 && i.roomW < d + a - 1e-9) racks = 0;
  if (racks < 1) throw new RangeError(`Lebar ruang ${i.roomW} m terlalu sempit: butuh ≥ ${d + a} m (rak ${d} m + lorong ${a} m)`);
  const aisles = racks > 1 ? racks - 1 : 1;
  const aisleM = racks > 1 ? (i.roomW - racks * d) / (racks - 1) : i.roomW - d;
  const rackLenM = i.roomL - 2 * end;
  if (!(rackLenM > 0)) throw new RangeError('Jarak bebas ujung melebihi panjang ruang');
  const tiers = Math.floor((i.roomH - i.roofClearance.typ) / pitch + 1e-9);
  if (tiers < 1) throw new RangeError(`Tinggi ruang ${i.roomH} m tidak cukup untuk 1 tingkat (+ ruang atap ${i.roofClearance.typ} m)`);
  const trayW = i.trayW ?? d;
  const trayL = i.trayL ?? d;
  assertPositive(trayW, 'lebar tray');
  assertPositive(trayL, 'panjang tray');
  if (trayW > d + 1e-9) throw new RangeError(`Tray ${trayW} m lebih lebar dari rak ${d} m`);
  const traysPerTier = Math.floor(rackLenM / trayL + 1e-9) * Math.floor(d / trayW + 1e-9);
  const trays = racks * tiers * traysPerTier;
  const tierAreaM2 = d * rackLenM;
  const totalAreaM2 = racks * tiers * tierAreaM2;
  const result = evaluateRange({ h: i.halvesPerM2 }, (v) => {
    const c = 1 / Math.sqrt(v.h);
    const halvesPerTray = Math.floor(trayL / c + 1e-9) * Math.floor(trayW / c + 1e-9);
    return {
      racks,
      aisles,
      aisleM,
      rackLenM,
      rackHeightM: tiers * pitch,
      tiers,
      tierAreaM2,
      totalAreaM2,
      traysPerTier,
      trays,
      halvesPerTray,
      nutsPerTray: halvesPerTray / 2,
      nutsByTrays: Math.floor((trays * halvesPerTray) / 2),
      nutsByArea: Math.floor((totalAreaM2 * v.h) / 2),
      roomM3: i.roomL * i.roomW * i.roomH,
    };
  });
  return formulaOutput(result, [i.rackDepth, i.tierPitch, i.aisleMin, i.roofClearance, i.halvesPerM2], [], i.datasetVersion);
}

export interface GreenhouseServicesInput {
  roomM3: number;
  nuts: number;
  aisles: number;
  refRoomM3: number;
  fansPerRefRoom: Param;
  sulfurGPerNut: Param;
  sulfurGPerM3: Param;
  roomPerPointM3: Param;
  datasetVersion?: string;
}

export interface GreenhouseServicesResult extends Record<string, number> {
  fans: number;
  /** Posisi kipas yang disarankan: kedua ujung tiap lorong. */
  fanPositions: number;
  sulfurByNutsG: number;
  sulfurByRoomG: number;
  burnPoints: number;
  sulfurPerPointG: number;
}

/** Kipas & belerang diskalakan linear dari ruang acuan KORA (turunan, keyakinan C). */
export function greenhouseServices(i: GreenhouseServicesInput): FormulaOutput<GreenhouseServicesResult> {
  assertPositive(i.roomM3, 'volume ruang');
  assertNonNegative(i.nuts, 'jumlah butir');
  assertPositive(i.refRoomM3, 'volume ruang acuan');
  const result = evaluateRange({ f: i.fansPerRefRoom, gn: i.sulfurGPerNut, gm: i.sulfurGPerM3, pp: i.roomPerPointM3 }, (v) => {
    const burnPoints = Math.max(1, Math.ceil(i.roomM3 / v.pp - 1e-9));
    const sulfurByNutsG = i.nuts * v.gn;
    return {
      fans: Math.max(1, Math.ceil((i.roomM3 * v.f) / i.refRoomM3 - 1e-9)),
      fanPositions: 2 * Math.max(1, i.aisles),
      sulfurByNutsG,
      sulfurByRoomG: i.roomM3 * v.gm,
      burnPoints,
      sulfurPerPointG: sulfurByNutsG / burnPoints,
    };
  });
  const warnings = Math.abs(i.roomM3 - i.refRoomM3) / i.refRoomM3 > 0.05 ? [warning('DERIVED_SCALING', `${Math.round(i.roomM3)} m³ vs acuan ${i.refRoomM3} m³`)] : [];
  return formulaOutput(result, [i.fansPerRefRoom, i.sulfurGPerNut, i.sulfurGPerM3, i.roomPerPointM3], warnings, i.datasetVersion);
}

/** Luas jemur satu lapis (para-para) untuk `nuts` butir (2 belahan/butir). */
export function sunDryingArea(nuts: number, halvesPerM2: Param, datasetVersion?: string): FormulaOutput<{ areaM2: number }> {
  assertPositive(nuts, 'jumlah butir');
  const result = evaluateRange({ h: halvesPerM2 }, (v) => ({ areaM2: (nuts * 2) / v.h }));
  return formulaOutput(result, [halvesPerM2], [], datasetVersion);
}

// ------------------------------------------------------------------ karbonisasi

export type KilnInput =
  | { method: 'drum'; drumBatchKg: Param; drumCount: number }
  | { method: 'kolam'; L: number; W: number; D: number; fillFraction: Param; rawBulkDensity: Param };

export interface KilnPlanInput {
  shellKg: number;
  kiln: KilnInput;
  yieldPct: Param;
  burnH: Param;
  sealH: Param;
  coolH: Param;
  spreadH: Param;
  datasetVersion?: string;
}

export interface KilnPlanResult extends Record<string, number> {
  batchShellKg: number;
  batches: number;
  charcoalKg: number;
  cycleH: number;
  totalH: number;
}

/** Kapasitas angkatan drum (isi × jumlah drum) atau kolam (V × isi berguna × densitas batok lepas). */
export function kilnPlan(i: KilnPlanInput): FormulaOutput<KilnPlanResult> {
  assertPositive(i.shellKg, 'batok');
  const k = i.kiln;
  const params: Param[] = [i.yieldPct, i.burnH, i.sealH, i.coolH, i.spreadH];
  let batchOf: (v: Record<string, number>) => number;
  const extra: Record<string, Param> = {};
  if (k.method === 'drum') {
    assertPositive(k.drumCount, 'jumlah drum');
    extra.b = k.drumBatchKg;
    batchOf = (v) => v.b! * k.drumCount;
  } else {
    for (const [n, x] of Object.entries({ panjang: k.L, lebar: k.W, dalam: k.D })) assertPositive(x, `${n} kolam`);
    extra.f = k.fillFraction;
    extra.rho = k.rawBulkDensity;
    batchOf = (v) => k.L * k.W * k.D * v.f! * v.rho!;
  }
  params.push(...Object.values(extra));
  const result = evaluateRange({ y: i.yieldPct, burn: i.burnH, seal: i.sealH, cool: i.coolH, spread: i.spreadH, ...extra }, (v) => {
    const batchShellKg = batchOf(v);
    const batches = Math.ceil(i.shellKg / batchShellKg - 1e-9);
    const cycleH = v.burn + v.seal + v.cool + v.spread;
    return { batchShellKg, batches, charcoalKg: (i.shellKg * v.y) / 100, cycleH, totalH: batches * cycleH };
  });
  const warnings = i.coolH.min < MIN_COOLING_H ? [warning('COOLING_TOO_SHORT', `${i.coolH.min} jam`)] : [];
  return formulaOutput(result, params, warnings, i.datasetVersion);
}

export interface SievePlanInput {
  charcoalKg: number;
  /** % massa lolos ayakan (debu/serbuk) per lintasan — hasil uji ayak sendiri. */
  finesPctPerPass: number[];
  /** % arang belum matang yang disortir & dibakar ulang. */
  unburntPct: number;
  /** Arang batok (lump) ikut digiling menjadi tepung? */
  grindLumps: boolean;
  hammerMillKgH: Param;
  datasetVersion?: string;
}

export interface SievePlanResult extends Record<string, number> {
  unburntKg: number;
  lumpsKg: number;
  finesKg: number;
  millKg: number;
  millH: number;
  powderKg: number;
}

/** Ayak rotari berulang: tiap lintasan memisahkan fraksi lolos dari sisa di atas ayakan. */
export function sievePlan(i: SievePlanInput): FormulaOutput<SievePlanResult> {
  assertPositive(i.charcoalKg, 'arang');
  assertPct(i.unburntPct, '% belum matang');
  if (!i.finesPctPerPass.length) throw new RangeError('Minimal 1 lintasan ayak');
  i.finesPctPerPass.forEach((p, n) => assertPct(p, `% lolos lintasan ${n + 1}`));
  const unburntKg = (i.charcoalKg * i.unburntPct) / 100;
  let over = i.charcoalKg - unburntKg;
  let finesKg = 0;
  for (const p of i.finesPctPerPass) {
    const f = (over * p) / 100;
    finesKg += f;
    over -= f;
  }
  const lumpsKg = over;
  const millKg = i.grindLumps ? lumpsKg : 0;
  const result = evaluateRange({ r: i.hammerMillKgH }, (v) => ({
    unburntKg,
    lumpsKg: i.grindLumps ? 0 : lumpsKg,
    finesKg,
    millKg,
    millH: millKg / v.r,
    powderKg: finesKg + millKg,
  }));
  return formulaOutput(result, [i.hammerMillKgH], [], i.datasetVersion);
}

// ------------------------------------------------------------------ campuran briket per asal

/** Sifat proksimat per lot (hasil lab). Sifat aditif massa: KA, abu, VM, FC, nilai kalor. */
export type OriginProps = Partial<Record<'moisture_max_pct' | 'ash_max_pct' | 'vm_max_pct' | 'fc_min_pct' | 'calorific_min_kcal_kg', number>>;
export type BlendKey = keyof OriginProps;
export const BLEND_KEYS: readonly BlendKey[] = ['moisture_max_pct', 'ash_max_pct', 'vm_max_pct', 'fc_min_pct', 'calorific_min_kcal_kg'];

/** Rata-rata tertimbang massa: hanya kunci yang terisi di kedua asal. */
export function blendProps(dt: OriginProps, dr: OriginProps, dtSharePct: number): OriginProps {
  if (!(dtSharePct >= 0 && dtSharePct <= 100)) throw new RangeError('Porsi DT harus 0–100%');
  const s = dtSharePct / 100;
  const out: OriginProps = {};
  for (const k of Object.keys({ ...dt, ...dr }) as BlendKey[]) {
    const a = dt[k];
    const b = dr[k];
    if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    out[k] = s * a + (1 - s) * b;
  }
  return out;
}

/**
 * Selang porsi DT (%) yang membuat campuran memenuhi SEMUA batas spek yang bisa dicek.
 * Sifat linear dalam porsi → tiap batas memberi setengah-garis; irisannya satu selang (atau kosong).
 */
export function feasibleDtShare(dt: OriginProps, dr: OriginProps, spec: BriquetteSpec): { lo: number; hi: number } | null {
  let lo = 0;
  let hi = 100;
  for (const k of Object.keys(spec) as (keyof BriquetteSpec)[]) {
    if (!BLEND_KEYS.includes(k as BlendKey)) continue;
    const limit = spec[k];
    const a = dt[k as BlendKey];
    const b = dr[k as BlendKey];
    if (limit === undefined || a === undefined || b === undefined) continue;
    const isMin = k.endsWith('_min_pct') || k.endsWith('_min_kcal_kg');
    // nilai(s) = b + s·(a − b), s ∈ [0,1]; syarat isMin ? ≥ limit : ≤ limit
    const slope = a - b;
    const ok = (val: number) => (isMin ? val >= limit - 1e-9 : val <= limit + 1e-9);
    if (Math.abs(slope) < 1e-12) {
      if (!ok(b)) return null;
      continue;
    }
    const s0 = ((limit - b) / slope) * 100;
    const increasingOk = isMin ? slope > 0 : slope < 0; // porsi DT naik → makin memenuhi
    if (increasingOk) lo = Math.max(lo, s0);
    else hi = Math.min(hi, s0);
  }
  lo = Math.max(0, lo);
  hi = Math.min(100, hi);
  return lo <= hi + 1e-9 ? { lo, hi } : null;
}

export interface OriginBlendResult {
  blended: OriginProps;
  checks: SpecCheck[];
  feasible: { lo: number; hi: number } | null;
  warnings: CalcWarning[];
}

export function originBlend(dt: OriginProps, dr: OriginProps, dtSharePct: number, spec: BriquetteSpec): OriginBlendResult {
  const blended = blendProps(dt, dr, dtSharePct);
  const checks = checkSpec(spec, blended);
  const warnings = checks.some((c) => !c.pass) ? [warning('BLEND_OUT_OF_SPEC')] : [];
  return { blended, checks, feasible: feasibleDtShare(dt, dr, spec), warnings };
}

export interface BlendRawInput {
  charcoalKg: number;
  dtSharePct: number;
  yieldPct: Param;
  datasetVersion?: string;
}

/** Kebutuhan arang & batok mentah per asal untuk sejumlah serbuk arang briket. */
export function blendRawMaterial(i: BlendRawInput): FormulaOutput<{ dtCharcoalKg: number; drCharcoalKg: number; dtShellKg: number; drShellKg: number }> {
  assertPositive(i.charcoalKg, 'serbuk arang');
  if (!(i.dtSharePct >= 0 && i.dtSharePct <= 100)) throw new RangeError('Porsi DT harus 0–100%');
  const dtC = (i.charcoalKg * i.dtSharePct) / 100;
  const drC = i.charcoalKg - dtC;
  const r = evaluateRange({ y: i.yieldPct }, (v) => ({ dtCharcoalKg: dtC, drCharcoalKg: drC, dtShellKg: (dtC * 100) / v.y, drShellKg: (drC * 100) / v.y }));
  return formulaOutput(r, [i.yieldPct], [], i.datasetVersion);
}

// ------------------------------------------------------------------ aditif selulosa bioleather

export interface CelluloseAdditiveInput {
  mediaL: number;
  /** Dosis aditif kering (g per L media) — input R&D (GAP: belum ada dosis acuan). */
  dryGPerL: number;
  /** Kadar air bahan saat ditimbang (%). */
  moisturePct: number;
  /** Lembar BC kering tanpa aditif (g) dari kalkulator bioleather. */
  bcDryG: Range;
  /** Perlakuan alkali (serat sabut) — null bila tanpa NaOH. */
  alkali: { naohPct: Param; liquorRatio: Param } | null;
  datasetVersion?: string;
}

export interface CelluloseAdditiveResult extends Record<string, number> {
  additiveDryG: number;
  additiveWetG: number;
  compositeDryG: number;
  additiveSharePct: number;
  naohSolutionL: number;
  naohG: number;
}

/**
 * Neraca massa komposit in-situ: BC + serat/serbuk selulosa terbungkus BC (MDPI 2025).
 * Asumsi: aditif tidak larut & tidak mengubah hasil BC (review: viskositas media tidak berubah).
 */
export function celluloseAdditive(i: CelluloseAdditiveInput): FormulaOutput<CelluloseAdditiveResult> {
  assertPositive(i.mediaL, 'volume media');
  assertNonNegative(i.dryGPerL, 'dosis aditif');
  assertPct(i.moisturePct, 'kadar air aditif');
  const dry = i.mediaL * i.dryGPerL;
  const wet = dry / (1 - i.moisturePct / 100);
  const zero: Range = { min: 0, typ: 0, max: 0 };
  const naoh = i.alkali?.naohPct ?? zero;
  const ratio = i.alkali?.liquorRatio ?? zero;
  const r = evaluateRange({ bc: i.bcDryG, n: naoh, q: ratio }, (v): CelluloseAdditiveResult => {
    const solL = (dry / 1000) * v.q; // rasio larutan:serat (L per kg serat kering)
    return {
      additiveDryG: dry,
      additiveWetG: wet,
      compositeDryG: v.bc + dry,
      additiveSharePct: v.bc + dry > 0 ? (dry / (v.bc + dry)) * 100 : 0,
      naohSolutionL: solL,
      naohG: solL * v.n * 10, // % b/v → g/L = % × 10
    };
  });
  return formulaOutput(r, i.alkali ? [i.alkali.naohPct, i.alkali.liquorRatio] : [], [], i.datasetVersion);
}
