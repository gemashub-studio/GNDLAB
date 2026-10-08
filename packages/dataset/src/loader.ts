/**
 * Loader dataset → satuan SI (ADR-004). Normalisasi form & parameter mencerminkan
 * architecture/scripts/seed_from_dataset.py SATU-BANDING-SATU, sehingga key parameter di aplikasi
 * identik dengan kolom `parameter.key` di database (penting untuk override & kalibrasi M4).
 */
import {
  cmToM,
  kg,
  m3,
  type CalcMode,
  type Confidence,
  type ContainerSpec,
  type Dim3,
  type Param,
  type Range,
  type Unit,
} from '@gemas/calc-engine';
import { DatasetSchema, type RawCommodity, type RawDataset } from './schema.ts';

// ---------------------------------------------------------------- konfigurasi model (ERD §3)

interface FormConfig {
  densityKey: string;
  calcModeDefault: CalcMode;
  nestable: boolean;
  /** Key parameter massa per unit untuk mode PIECE (bila relevan). */
  unitMassKey?: string;
}

/** Sama dengan FORMS di seed_from_dataset.py. */
export const FORMS: Record<string, Record<string, FormConfig>> = {
  kelapa_jambul: {
    loose: { densityKey: 'loose_pile', calcModeDefault: 'PIECE', nestable: false, unitMassKey: 'mass_per_unit' },
    bagged: { densityKey: 'bagged_in_container', calcModeDefault: 'PACKAGE', nestable: false, unitMassKey: 'mass_per_unit' },
  },
  arang_batok_belah2: {
    halves_loose: { densityKey: 'charcoal_halves_loose', calcModeDefault: 'PIECE', nestable: true, unitMassKey: 'mass_per_unit.charcoal_half' },
    halves_nested: { densityKey: 'charcoal_halves_nested', calcModeDefault: 'PIECE', nestable: true, unitMassKey: 'mass_per_unit.charcoal_half' },
    lumps: { densityKey: 'charcoal_broken_lumps', calcModeDefault: 'BULK', nestable: false },
    raw_halves: { densityKey: 'raw_halves_loose', calcModeDefault: 'BULK', nestable: true, unitMassKey: 'mass_per_unit.raw_half_shell' },
  },
  kopra_asalan: {
    loose_bulk: { densityKey: 'loose_bulk', calcModeDefault: 'BULK', nestable: false, unitMassKey: 'mass_per_piece' },
    bagged_jute: { densityKey: 'bagged_jute', calcModeDefault: 'BULK', nestable: false, unitMassKey: 'mass_per_piece' },
  },
  kopra_edible: {
    loose_cups: { densityKey: 'loose_cups', calcModeDefault: 'BULK', nestable: false, unitMassKey: 'mass_per_piece' },
    bagged: { densityKey: 'bagged_in_container', calcModeDefault: 'PACKAGE', nestable: false, unitMassKey: 'mass_per_piece' },
  },
};

const SHAPE_BULK_FORMS = new Set(['lumps', 'loose_bulk', 'bagged_jute']);

/**
 * Utilisasi volume default mode BULK (calculation_spec §3.1): 0,80 arang lump dalam karung,
 * 0,90 kopra karung goni, selain itu 1,00 (ρ sudah densitas efektif-dalam-container).
 */
export const DEFAULT_VOLUME_UTIL: Record<string, number> = {
  'arang_batok_belah2.lumps': 0.8,
  'kopra_asalan.bagged_jute': 0.9,
};

// ---------------------------------------------------------------- port fungsi seed

/** Return [unit, faktor] atau undefined. Urutan pemeriksaan = unit_for() di seed. */
export function unitFor(path: string): [Unit, number] | undefined {
  const p = path.toLowerCase();
  if (p.includes('fraction') || p.includes('shrinkage')) return ['fraction', 1];
  if (p.includes('kg_m3') || p.includes('density')) return ['kg_m3', 1];
  if (p.includes('cm3')) return ['m3', 1e-6];
  if (p.includes('_cm') || p.endsWith('cm') || p.includes('circumference')) return ['m', 0.01];
  if (p.includes('mass') || p.endsWith('_g') || p.includes('_g.') || p.includes('per_nut_g')) return ['kg', 0.001];
  if (p.includes('bag_net_kg')) return ['kg', 1];
  if (p.includes('pct')) return ['pct', 1];
  if (p.includes('nuts_per_kg')) return ['count', 1];
  if (p.includes('stack_height_m') || p.includes('pile_height_m')) return ['m', 1];
  if (p.includes('stack_height_bags')) return ['count', 1];
  return undefined;
}

const UNIT_SUFFIXES = ['_kg_m3', '_cm3', '_cm', '_g', '_pct', '_kg'];

export function normKey(path: string): string {
  return path
    .split('.')
    .map((seg) => {
      for (const suf of UNIT_SUFFIXES) {
        if (seg.endsWith(suf) && seg !== suf.slice(1)) return seg.slice(0, -suf.length);
      }
      return seg;
    })
    .join('.');
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumRange = (v: Record<string, unknown>): boolean =>
  ['min', 'typ', 'max'].every((k) => typeof v[k] === 'number');

/** Keyakinan campuran "A/C" → terlemah (DEC-008). */
export const parseConfidence = (s: string): Confidence =>
  s.split('/').reduce<Confidence>((acc, c) => (c > acc ? (c as Confidence) : acc), 'A');

export interface WalkedRange {
  path: string;
  range: Range & { note?: string };
  confidence?: Confidence;
}

/** Port ranges() di seed: keyakinan diwarisi dari ancestor terdekat; array tidak ditelusuri. */
export function* walkRanges(node: unknown, path = '', conf?: Confidence): Generator<WalkedRange> {
  if (!isObj(node)) return;
  if (typeof node.confidence === 'string') conf = parseConfidence(node.confidence);
  if (isNumRange(node)) {
    const r = { min: node.min as number, typ: node.typ as number, max: node.max as number };
    const range = typeof node.note === 'string' ? { ...r, note: node.note } : r;
    yield conf === undefined ? { path, range } : { path, range, confidence: conf };
    return;
  }
  for (const [k, v] of Object.entries(node)) yield* walkRanges(v, path ? `${path}.${k}` : k, conf);
}

const round9 = (v: number): number => Number(v.toFixed(9));

// ---------------------------------------------------------------- tipe SI

export interface ContainerSI extends ContainerSpec {
  id: string;
  name: string;
  confidence: Confidence;
}

export interface PackagingSI {
  type: string;
  pcsPerPack?: number;
  netKg: Param;
  dims?: Dim3;
  dimsConfidence?: Confidence;
  densityRef?: string;
  deformable: true;
}

export interface BenchmarkSI {
  containerId: string;
  pieces?: { min: number; max: number };
  packs?: { min: number; max: number };
  massKg?: { min: number; max: number };
  conservative: boolean;
  sourceIds: string[];
  note?: string;
}

export interface FormSI extends FormConfig {
  code: string;
  shape: string;
  volumeUtilDefault: number;
  params: Record<string, Param>;
  packaging: PackagingSI[];
  benchmarks: BenchmarkSI[];
}

export interface CommoditySI {
  id: string;
  nameId: string;
  nameEn?: string;
  description?: string;
  unitType: 'piece' | 'bulk';
  forms: FormSI[];
  storage?: Record<string, unknown>;
}

export interface DatasetSI {
  version: string;
  compiled: string;
  containers: ContainerSI[];
  commodities: CommoditySI[];
  sources: RawDataset['sources'];
}

export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetError';
  }
}

// ---------------------------------------------------------------- loader

const minMax = (v: number | { min: number; max: number } | undefined, factor = 1) =>
  v === undefined ? undefined : typeof v === 'number' ? { min: v * factor, max: v * factor } : { min: v.min * factor, max: v.max * factor };

function buildForm(cm: RawCommodity, code: string, cfg: FormConfig): FormSI {
  if (!(cfg.densityKey in cm.bulk_density_kg_m3)) {
    throw new DatasetError(`${cm.id}.${code} butuh bulk_density.${cfg.densityKey}`);
  }
  const params: Record<string, Param> = {};
  for (const { path, range, confidence } of walkRanges(cm)) {
    if (path.startsWith('bulk_density_kg_m3.') && path !== `bulk_density_kg_m3.${cfg.densityKey}`) continue;
    if (path.startsWith('packaging') || path.startsWith('container_benchmarks')) continue;
    const key = path.startsWith('bulk_density_kg_m3.') ? 'bulk_density' : normKey(path);
    const u = unitFor(path);
    if (!u) throw new DatasetError(`satuan tidak dikenali untuk ${cm.id}:${path}`);
    const [unit, f] = u;
    if (unit === 'fraction' && range.max > 1) throw new DatasetError(`${cm.id}:${path} fraksi > 1`);
    params[key] = {
      key,
      unit,
      min: round9(range.min * f),
      typ: round9(range.typ * f),
      max: round9(range.max * f),
      confidence: confidence ?? 'C', // tanpa label → anggap estimasi (seed)
      sourceIds: [],
      source: 'dataset',
      ...(range.note && { note: range.note }),
    };
  }

  const packaging: PackagingSI[] = [];
  for (const pk of cm.packaging) {
    if (!pk.bag_net_kg) continue;
    const d = pk.bag_dims_cm_filled;
    const dimsConfidence = d?.confidence ? parseConfidence(d.confidence) : undefined;
    packaging.push({
      type: pk.type,
      ...(pk.pcs_per_bag !== undefined && { pcsPerPack: pk.pcs_per_bag }),
      netKg: {
        key: 'pack.net',
        unit: 'kg',
        min: pk.bag_net_kg.min,
        typ: pk.bag_net_kg.typ,
        max: pk.bag_net_kg.max,
        confidence: 'C', // tidak berlabel di dataset → estimasi (aturan seed)
        sourceIds: [],
        source: 'dataset',
      },
      ...(d && { dims: { l: cmToM(d.L), w: cmToM(d.W), h: cmToM(d.H) } }),
      ...(dimsConfidence && { dimsConfidence }),
      ...(pk.density_ref && { densityRef: pk.density_ref }),
      deformable: true,
    });
  }

  const benchmarks: BenchmarkSI[] = [];
  for (const b of cm.container_benchmarks ?? []) {
    if (cm.id === 'arang_batok_belah2') {
      if (code !== (b.form?.startsWith('arang') ? 'lumps' : 'raw_halves')) continue;
    } else if ((cm.id === 'kopra_edible' || cm.id === 'kelapa_jambul') && code !== 'bagged') {
      continue;
    }
    const pieces = minMax(b.pcs);
    const packs = minMax(b.bags);
    const massKg = minMax(b.net_t, 1000);
    benchmarks.push({
      containerId: b.container,
      ...(pieces && { pieces }),
      ...(packs && { packs }),
      ...(massKg && { massKg }),
      conservative: (b.note ?? '').includes('konservatif'),
      sourceIds: b.source_ids,
      ...(b.note && { note: b.note }),
    });
  }

  return {
    code,
    ...cfg,
    shape: SHAPE_BULK_FORMS.has(code) ? 'bulk' : cm.geometry.shape,
    volumeUtilDefault: DEFAULT_VOLUME_UTIL[`${cm.id}.${code}`] ?? 1,
    params,
    packaging,
    benchmarks,
  };
}

export function loadDataset(raw: unknown): DatasetSI {
  const parsed = DatasetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DatasetError(
      'Dataset tidak valid:\n' +
        parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  }
  const d = parsed.data;
  return {
    version: d.meta.version,
    compiled: d.meta.compiled,
    sources: d.sources,
    containers: d.containers.map((c) => ({
      id: c.id,
      name: c.name,
      L: cmToM(c.inner_cm.L),
      W: cmToM(c.inner_cm.W),
      H: cmToM(c.inner_cm.H),
      payloadKg: kg(c.payload_kg),
      volumeM3: m3(c.volume_m3),
      confidence: parseConfidence(c.confidence),
    })),
    commodities: d.commodities.map((cm) => {
      const forms = FORMS[cm.id];
      if (!forms) throw new DatasetError(`komoditas ${cm.id} belum punya pemetaan form (ERD §3)`);
      return {
        id: cm.id,
        nameId: cm.name_id,
        ...(cm.name_en && { nameEn: cm.name_en }),
        ...(cm.description && { description: cm.description }),
        unitType: cm.unit_type,
        forms: Object.entries(forms).map(([code, cfg]) => buildForm(cm, code, cfg)),
        ...(cm.storage && { storage: cm.storage }),
      };
    }),
  };
}

// ---------------------------------------------------------------- akses & perakitan input engine

export function getContainer(ds: DatasetSI, id: string): ContainerSI {
  const c = ds.containers.find((x) => x.id === id);
  if (!c) throw new DatasetError(`container ${id} tidak dikenal`);
  return c;
}

export function getCommodity(ds: DatasetSI, id: string): CommoditySI {
  const c = ds.commodities.find((x) => x.id === id);
  if (!c) throw new DatasetError(`komoditas ${id} tidak dikenal`);
  return c;
}

export function getForm(ds: DatasetSI, commodityId: string, formCode: string): FormSI {
  const f = getCommodity(ds, commodityId).forms.find((x) => x.code === formCode);
  if (!f) throw new DatasetError(`form ${commodityId}.${formCode} tidak dikenal`);
  return f;
}

/** Kadar air form sebagai fraksi (param `moisture` berunit pct). */
export function moistureFraction(form: FormSI): Range | undefined {
  const p = form.params.moisture;
  return p && { min: p.min / 100, typ: p.typ / 100, max: p.max / 100 };
}

/** Profil keyakinan parameter unik per komoditas (metrik PRD §8; sama dengan validator). */
export function confidenceProfile(raw: unknown): Record<Confidence, number> {
  const d = DatasetSchema.parse(raw);
  const prof: Record<Confidence, number> = { A: 0, B: 0, C: 0 };
  for (const cm of d.commodities) {
    for (const r of walkRanges(cm)) {
      if (r.path.startsWith('packaging') || r.path.startsWith('container_benchmarks')) continue;
      prof[r.confidence ?? 'C']++;
    }
  }
  return prof;
}
