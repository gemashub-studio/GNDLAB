/**
 * Dataset rantai produksi (Fase G, ADR-010): kendaraan angkut, kelas asal lot, sortir belah,
 * desain greenhouse/jemur/oven, karbonisasi drum/kolam, kemasan, briket, aditif bioleather.
 * Sumber: `architecture/00-research/data/coconut_chain_dataset.json`.
 * Angka yang sudah ada di dataset inventory/proses/formula DIRUJUK lewat field `*_ref`, tidak disalin.
 */
import type { Param, Unit } from '@gemas/calc-engine';
import { z } from 'zod';
import { DatasetError, parseConfidence, type DatasetSI } from './loader.ts';
import { RefSourceSchema } from './process.ts';
import type { FormulaDatasetSI } from './formula.ts';

const UNIT_MAP = {
  kg: 'kg',
  m: 'm',
  mm: 'mm',
  m3: 'm3',
  h: 'h',
  d: 'd',
  C: 'C',
  pct: 'pct',
  deg: 'deg',
  count: 'count',
  fraction: 'fraction',
} as const satisfies Record<string, Unit>;
type RawUnit = keyof typeof UNIT_MAP;

const RangeP = z
  .object({
    min: z.number().nonnegative(),
    typ: z.number().nonnegative(),
    max: z.number().nonnegative(),
    unit: z.enum(Object.keys(UNIT_MAP) as [RawUnit, ...RawUnit[]]),
    confidence: z.string().regex(/^[ABC](\/[ABC])*$/),
    source_ids: z.array(z.string()).min(1),
    note: z.string().optional(),
  })
  .refine((r) => r.min <= r.typ && r.typ <= r.max, { message: 'wajib min ≤ typ ≤ max' });
type RawRange = z.infer<typeof RangeP>;

const Ids = z.array(z.string()).min(1);
const Dim = z.object({ L: z.number().positive(), W: z.number().positive(), H: z.number().positive() });
const Route = z.enum(['edible', 'reguler', 'asalan', 'reject']);

export const ChainDatasetSchema = z
  .object({
    meta: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), compiled: z.string(), requires_formula_dataset: z.string(), requires_inventory_dataset: z.string() }).passthrough(),
    raw_material: z.object({
      commodity_ref: z.string(),
      note: z.string(),
      size_classes_whole_kg: z.array(z.object({ id: z.string(), kg: z.number().positive(), note: z.string().optional() })).min(1),
      size_classes_source_ids: Ids,
      standard_whole_min_kg: RangeP,
      copra_per_nut_by_type_g: z.array(z.object({ id: z.string(), name_id: z.string(), g: z.number().positive() })).min(1),
      copra_per_nut_source_ids: Ids,
    }),
    origin: z.object({
      classes: z
        .array(z.object({ id: z.enum(['DR', 'DT']), name_id: z.string(), altitude_min_m: z.number().optional(), altitude_max_m: z.number().optional(), rule: z.string() }))
        .length(2),
      lot_code_pattern: z.string(),
      source_ids: Ids,
      note: z.string(),
    }),
    vehicles: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9_]+$/),
          name_id: z.string(),
          kind: z.enum(['truck', 'container']),
          body: z.enum(['box', 'bak', 'wingbox']),
          inner_m: Dim,
          payload_kg: RangeP,
          source_ids: Ids,
          note: z.string().optional(),
        }),
      )
      .min(1),
    vehicles_note: z.string(),
    receiving: z.object({ max_stack_height_m: RangeP }),
    sorting: z.object({
      classes: z.array(z.object({ id: z.string(), name_id: z.string(), criteria: z.string(), handling: z.string(), route: Route })).min(1),
      min_meat_thickness_mm: RangeP,
      grade_split_pct: z.array(z.object({ id: z.string(), name_id: z.string(), edible: z.number(), reguler: z.number(), asalan: z.number() })).min(1),
      grade_split_source_ids: Ids,
      source_ids: Ids,
    }),
    coconut_water: z.object({ chill_within_h: RangeP, chill_target_max_c: RangeP, max_cold_h_ref: z.string() }),
    greenhouse: z.object({
      ref_room_m: Dim,
      ref_room_source_ids: Ids,
      rack_depth_m: RangeP,
      tier_pitch_m: RangeP,
      aisle_min_m: RangeP,
      roof_clearance_m: RangeP,
      face_down_days: RangeP,
      face_up_tilt_deg: RangeP,
      fan_tray_tilt_deg: RangeP,
      fans_per_ref_room: RangeP,
      fan_diameter_mm: RangeP,
      fan_run_h: RangeP,
      vent_open_pct: RangeP,
      day_temp_c: RangeP,
      sulfur_exposure_h: RangeP,
      sulfur_ventilate_h: RangeP,
      sulfur_room_per_point_m3: RangeP,
      sulfur_dose_ref: z.string(),
      halves_per_m2_ref: z.string(),
      cycle_h_ref: z.string(),
    }),
    sun: z.object({ rack_height_m: RangeP, duration_ref: z.string() }),
    oven: z.object({ ref_room_m: Dim, ref_room_source_ids: Ids, tray_tilt_deg: RangeP, temp_ref: z.string(), note: z.string() }),
    packing: z.object({
      copra_sack_kg: RangeP,
      warehouse_rh_max_pct: RangeP,
      charcoal_bag_kg: z.array(z.object({ id: z.string(), kg: z.number().positive() })).min(1),
      charcoal_bag_source_ids: Ids,
      charcoal_container_net_kg: z.array(z.object({ container: z.string(), net: RangeP })).min(1),
      briquette_cartons: z.array(z.object({ id: z.string(), name_id: z.string(), net_kg: z.number().positive(), dims_mm: Dim })).min(1),
      briquette_cartons_source_ids: Ids,
      briquette_20ft_net_kg: RangeP,
      bbq_20ft_net_kg: z.array(z.object({ shape: z.string(), net: RangeP })).min(1),
    }),
    charcoal: z.object({
      shell_moisture_ref: z.string(),
      shell_moisture_kora_max_pct: RangeP,
      shell_sun_dry_days: RangeP,
      shell_wash_drain_h: RangeP,
      drum_piece_mm: RangeP,
      kiln_seal_h: RangeP,
      kolam_cool_h: RangeP,
      spread_cool_h: RangeP,
      pit_yield_pct: RangeP,
      drum_yield_kg_per_1000_shells: RangeP,
      pit_fill_fraction: RangeP,
      raw_bulk_ref: z.string(),
      sieve_passes: RangeP,
      phases: z.array(z.object({ id: z.string(), name_id: z.string(), smoke: z.string(), action: z.string() })).min(1),
      phases_source_ids: Ids,
    }),
    briquette: z.object({
      shapes: z
        .array(
          z.object({
            id: z.enum(['cube', 'hexagonal', 'flat', 'pillow', 'finger']),
            name_id: z.string(),
            dims_mm: z.array(z.tuple([z.number().positive(), z.number().positive(), z.number().positive()])),
            note: z.string().optional(),
          }),
        )
        .min(1),
      shapes_source_ids: Ids,
      origin_blend_note: z.string(),
    }),
    bioleather_additive: z.object({
      materials: z.array(z.object({ id: z.string(), name_id: z.string(), prep: z.string() })).min(1),
      coir_alkali_naoh_pct: RangeP,
      coir_alkali_liquor_ratio: RangeP,
      in_situ_note: z.string(),
      source_ids: Ids,
    }),
    sources: z.array(RefSourceSchema(/^C\d{2}$/)).min(1),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.sources.map((s) => s.id));
    const walk = (node: unknown, path: (string | number)[]) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, [...path, i]));
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k.endsWith('source_ids') && Array.isArray(v)) {
            for (const s of v) if (!ids.has(s)) ctx.addIssue({ code: 'custom', path: [...path, k], message: `source_id ${s} tidak terdaftar` });
          } else walk(v, [...path, k]);
        }
      }
    };
    walk({ ...d, sources: [] }, []);
    const vid = new Set<string>();
    d.vehicles.forEach((v, i) => {
      if (vid.has(v.id)) ctx.addIssue({ code: 'custom', path: ['vehicles', i, 'id'], message: `id kendaraan ganda: ${v.id}` });
      vid.add(v.id);
    });
    for (const g of d.sorting.grade_split_pct) {
      const sum = g.edible + g.reguler + g.asalan;
      if (Math.abs(sum - 100) > 1e-6) ctx.addIssue({ code: 'custom', path: ['sorting', 'grade_split_pct', g.id], message: `pembagian grade harus 100%, didapat ${sum}` });
    }
  });

export type RawChainDataset = z.infer<typeof ChainDatasetSchema>;

const toParam = (key: string, r: RawRange): Param => ({
  key,
  unit: UNIT_MAP[r.unit],
  min: r.min,
  typ: r.typ,
  max: r.max,
  confidence: parseConfidence(r.confidence),
  sourceIds: r.source_ids,
  source: 'dataset',
  ...(r.note && { note: r.note }),
});

type RangeKeys<T> = { [K in keyof T as T[K] extends RawRange ? K : never]: Param };
function params<T extends Record<string, unknown>>(group: string, obj: T): RangeKeys<T> {
  const out: Record<string, Param> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && 'typ' in v && 'source_ids' in v) out[k] = toParam(`${group}.${k}`, v as RawRange);
  }
  return out as never;
}

export interface ChainVehicle {
  id: string;
  nameId: string;
  kind: 'truck' | 'container';
  body: 'box' | 'bak' | 'wingbox';
  L: number;
  W: number;
  H: number;
  payload: Param;
  sourceIds: string[];
  note?: string;
}

export interface ChainDatasetSI {
  version: string;
  compiled: string;
  raw: RawChainDataset;
  /** Truk + container: container 20GP/40GP/40HC dari dataset inventory, sisanya dari dataset rantai. */
  vehicles: ChainVehicle[];
  receiving: RangeKeys<RawChainDataset['receiving']>;
  rawMaterial: { standardWholeMinKg: Param };
  sorting: { minMeatThicknessMm: Param };
  coconutWater: RangeKeys<RawChainDataset['coconut_water']>;
  greenhouse: RangeKeys<RawChainDataset['greenhouse']>;
  sun: RangeKeys<RawChainDataset['sun']>;
  oven: RangeKeys<RawChainDataset['oven']>;
  packing: RangeKeys<RawChainDataset['packing']>;
  charcoal: RangeKeys<RawChainDataset['charcoal']>;
  bioleatherAdditive: RangeKeys<RawChainDataset['bioleather_additive']>;
  sources: RawChainDataset['sources'];
}

export function loadChainDataset(raw: unknown, formula: FormulaDatasetSI, inventory: DatasetSI): ChainDatasetSI {
  const parsed = ChainDatasetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DatasetError('Dataset rantai produksi tidak valid:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  const d = parsed.data;
  if (d.meta.requires_formula_dataset !== formula.version) {
    throw new DatasetError(`Dataset rantai v${d.meta.version} butuh dataset formula v${d.meta.requires_formula_dataset}, terpasang v${formula.version}`);
  }
  if (d.meta.requires_inventory_dataset !== inventory.version) {
    throw new DatasetError(`Dataset rantai v${d.meta.version} butuh dataset inventory v${d.meta.requires_inventory_dataset}, terpasang v${inventory.version}`);
  }
  const containers: ChainVehicle[] = inventory.containers.map((c) => ({
    id: c.id,
    nameId: c.name,
    kind: 'container',
    body: 'box',
    L: c.L,
    W: c.W,
    H: c.H,
    payload: { key: `container.${c.id}.payload`, unit: 'kg', min: c.payloadKg, typ: c.payloadKg, max: c.payloadKg, confidence: c.confidence, sourceIds: ['inventory'], source: 'dataset' },
    sourceIds: [],
  }));
  const vehicles: ChainVehicle[] = d.vehicles.map((v) => ({
    id: v.id,
    nameId: v.name_id,
    kind: v.kind,
    body: v.body,
    L: v.inner_m.L,
    W: v.inner_m.W,
    H: v.inner_m.H,
    payload: toParam(`vehicle.${v.id}.payload`, v.payload_kg),
    sourceIds: v.source_ids,
    ...(v.note && { note: v.note }),
  }));
  return {
    version: d.meta.version,
    compiled: d.meta.compiled,
    raw: d,
    vehicles: [...vehicles.filter((v) => v.kind === 'truck'), ...containers, ...vehicles.filter((v) => v.kind === 'container')],
    receiving: params('receiving', d.receiving),
    rawMaterial: { standardWholeMinKg: toParam('raw.standard_whole_min_kg', d.raw_material.standard_whole_min_kg) },
    sorting: { minMeatThicknessMm: toParam('sorting.min_meat_thickness_mm', d.sorting.min_meat_thickness_mm) },
    coconutWater: params('coconut_water', d.coconut_water),
    greenhouse: params('greenhouse', d.greenhouse),
    sun: params('sun', d.sun),
    oven: params('oven', d.oven),
    packing: params('packing', d.packing),
    charcoal: params('charcoal', d.charcoal),
    bioleatherAdditive: params('bioleather_additive', d.bioleather_additive),
    sources: d.sources,
  };
}
