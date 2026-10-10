/**
 * Dataset formula R&D, produksi per shift & ceklis (ADR-009): skema Zod + loader ke Param engine.
 * Sumber: `architecture/00-research/data/coconut_formula_dataset.json` (dari dokumen KORA + riset).
 * Parameter yang sudah ada di dataset proses (KA daging segar, dll.) DIRUJUK, tidak disalin.
 */
import type { Confidence, Param, Unit } from '@gemas/calc-engine';
import { z } from 'zod';
import { DatasetError, parseConfidence } from './loader.ts';
import { RefSourceSchema, type ProcessDatasetSI } from './process.ts';

const UNIT_MAP = {
  kg: 'kg',
  L: 'L',
  g: 'g',
  'g/L': 'g_L',
  'kg/L': 'kg_L',
  'g/m3': 'g_m3',
  pct: 'pct',
  fraction: 'fraction',
  h: 'h',
  d: 'd',
  wk: 'wk',
  C: 'C',
  pH: 'pH',
  brix: 'brix',
  M: 'M',
  MPa: 'MPa',
  mm: 'mm',
  m2: 'm2',
  m3: 'm3',
  count: 'count',
  'g/cm3': 'g_cm3',
  'g/L/d': 'g_L_d',
  'cal/g': 'cal_g',
  'butir/h': 'count_h',
  'kg/h': 'kg_h',
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

const GradeSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  name_id: z.string(),
  moisture_max_pct: z.number().positive(),
  oil_min_pct: z.number(),
  ffa_max_pct: z.number(),
  foreign_max_pct: z.number(),
  mould_max_pct: z.number(),
  aflatoxin_max_ppb: z.number(),
  confidence: z.string(),
  source_ids: Ids,
});

const SpecSchema = z
  .object({
    moisture_max_pct: z.number(),
    ash_max_pct: z.number(),
    vm_max_pct: z.number(),
    fc_min_pct: z.number(),
    calorific_min_kcal_kg: z.number(),
    burn_min_min: z.number(),
    ignition_max_min: z.number(),
    broken_max_pct: z.number(),
  })
  .partial();

const ChecklistSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(['rnd', 'qc', 'product']),
  product: z.enum(['kopra', 'arang', 'briket', 'cuka', 'bioleather']),
  stage: z.string().min(1),
  form_ref: z.string(),
  items: z.array(z.object({ text: z.string().min(1), critical: z.boolean() })).min(1),
  source_ids: Ids,
});

export const FormulaDatasetSchema = z
  .object({
    meta: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), compiled: z.string(), requires_process_dataset: z.string(), requires_inventory_dataset: z.string() }).passthrough(),
    kopra: z.object({
      nut_dehusked_kg: RangeP,
      trial_reserve_min_nuts: RangeP,
      meat_per_nut_kg: RangeP,
      water_per_nut_l: RangeP,
      copra_kg_per_1000_nuts: RangeP,
      split_to_dryer_max_h: RangeP,
      alarm_moisture_24h_max_pct: RangeP,
      alarm_moisture_48h_max_pct: RangeP,
      min_final_moisture_pct: RangeP,
      grades: z.array(GradeSchema).min(1),
      sulfur: z.object({
        g_per_nut: RangeP,
        g_per_m3: RangeP,
        night_schedule_pct: z.array(z.number().positive().max(100)).min(1),
        max_nights: z.number().int().positive(),
        lab_test_from_night: z.number().int().positive(),
        so2_residue_eu_max_mg_kg: z.number().positive(),
        source_ids: Ids,
      }),
      bisulfite_soak_pct: RangeP,
      oven_profiles: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z_]+$/),
            name_id: z.string(),
            temp_c: z.number(),
            hours: z.number().positive(),
            final_moisture_pct: z.number(),
            ffa_pct: z.number(),
            batch_kg: z.number().positive().optional(),
            source_ids: Ids,
          }),
        )
        .min(1),
      oven_max_temp_c: RangeP,
      greenhouse: z.object({ room_m3: RangeP, rack_area_m2: RangeP, halves_per_m2: RangeP, cycle_h: RangeP }),
      smoke_min_h: RangeP,
      smoked_copra_per_kg_meat: RangeP,
    }),
    arang: z.object({
      yield_reference_pct: RangeP,
      yield_kora_actual_pct: RangeP,
      yield_target_3m_pct: RangeP,
      yield_target_6m_pct: RangeP,
      raw_max_pct: RangeP,
      shell_moisture_max_pct: RangeP,
      reactor_temp_c: RangeP,
      methods: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z_]+$/),
            name_id: z.string(),
            batch_shell_kg: RangeP,
            burn_h: RangeP,
            cooling_h: RangeP,
            liquid_smoke: z.boolean(),
          }),
        )
        .min(1),
      liquid_smoke_l_per_kg_shell: RangeP,
      weathering_days_export_min: z.number().positive(),
      packing_temp_max_c: z.number().positive(),
      fractions: z.array(z.object({ id: z.string(), name_id: z.string(), min_mm: z.number().optional(), max_mm: z.number().optional(), use: z.string() })).min(1),
      hammer_mill_kg_h: RangeP,
      standards: z
        .array(
          z.object({
            id: z.string(),
            name_id: z.string(),
            moisture_max_pct: z.number(),
            ash_max_pct: z.number(),
            vm_max_pct: z.number(),
            fc_min_pct: z.number().optional(),
            foreign_max_pct: z.number().optional(),
            fines_max_pct: z.number().optional(),
            confidence: z.string(),
            source_ids: Ids,
            note: z.string().optional(),
          }),
        )
        .min(1),
    }),
    briket: z.object({
      binder_pct: RangeP,
      binder_moisture_pct: RangeP,
      charcoal_powder_moisture_pct: RangeP,
      dough_moisture_pct: RangeP,
      final_moisture_pct: RangeP,
      gelatinization_min_c: RangeP,
      binder_hot_water_share_pct: RangeP,
      aging_h: RangeP,
      predry_h: RangeP,
      oven_temp_c: RangeP,
      oven_h: RangeP,
      process_water: z.object({
        tds_max_ppm: z.number(),
        ph_min: z.number(),
        ph_max: z.number(),
        fe_max_mg_l: z.number(),
        kora_well: z.object({ tds_ppm: z.number(), ec_us_cm: z.number(), ph: z.number() }),
        source_ids: Ids,
      }),
      literature_calorific_cal_g: RangeP,
      variants: z
        .array(
          z.object({
            id: z.enum(['shisha', 'bbq', 'custom']),
            name_id: z.string(),
            rnd_code: z.string().regex(/^[A-Z]{2}$/),
            shape: z.enum(['cube', 'pillow', 'custom']),
            dims_mm: z.record(z.number().positive()).optional(),
            dim_tolerance_mm: z.number().optional(),
            density_g_cm3: RangeP,
            spec: SpecSchema,
            spec_note: z.string(),
            confidence: z.string(),
            source_ids: Ids,
          }),
        )
        .length(3),
    }),
    cuka: z.object({
      water_brix: RangeP,
      water_sugar_pct: RangeP,
      water_ph: RangeP,
      water_density_kg_l: RangeP,
      water_max_cold_h: RangeP,
      must_brix: RangeP,
      must_pasteurize_c: RangeP,
      yeast_g_l: RangeP,
      alcohol_days: RangeP,
      ferment_temp_c: RangeP,
      ethanol_efficiency: RangeP,
      starter_pct: RangeP,
      acetify_weeks: RangeP,
      acetify_temp_c: RangeP,
      aging_weeks: RangeP,
      acetic_efficiency: RangeP,
      acetic_min_pct: RangeP,
      acetic_target_pct: RangeP,
      residual_alcohol_max_pct: RangeP,
      egg_white_g_l: RangeP,
      egg_white_per_egg_g: RangeP,
      bottle_pasteurize_c: RangeP,
      titration: z.object({ naoh_n_default: z.number().positive(), sample_ml_default: z.number().positive(), acetic_g_mol: z.number(), source_ids: Ids, note: z.string() }),
    }),
    bioleather: z.object({
      sucrose_g_l: RangeP,
      za_g_l: RangeP,
      ph: RangeP,
      starter_pct: RangeP,
      culture_days: RangeP,
      culture_temp_c: RangeP,
      wet_yield_g_l_day: RangeP,
      dry_fraction_of_wet: RangeP,
      target_wet_thickness_mm: RangeP,
      naoh_m: RangeP,
      glycerol_pct: RangeP,
      dry_temp_c: RangeP,
      tensile_min_mpa: RangeP,
      fold_min: RangeP,
    }),
    production: z.object({ shift_hours: RangeP, work_days_per_week: RangeP, oven_load_basis: z.string() }),
    stations: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z_]+$/),
          name_id: z.string(),
          kind: z.enum(['manual', 'machine']),
          unit: z.string(),
          rate_per_person_h: RangeP.optional(),
          rate_per_unit_h: RangeP.optional(),
        }),
      )
      .min(1),
    checklists: z.array(ChecklistSchema).min(1),
    sources: z.array(RefSourceSchema(/^F\d{2}$/)).min(1),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.sources.map((s) => s.id));
    // Kumpulkan semua source_ids di seluruh pohon & pastikan terdaftar.
    const walk = (node: unknown, path: (string | number)[]) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, [...path, i]));
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === 'source_ids' && Array.isArray(v)) {
            for (const s of v) if (!ids.has(s)) ctx.addIssue({ code: 'custom', path: [...path, k], message: `source_id ${s} tidak terdaftar` });
          } else walk(v, [...path, k]);
        }
      }
    };
    walk({ ...d, sources: [] }, []);
    const cl = new Set<string>();
    d.checklists.forEach((c, i) => {
      if (cl.has(c.id)) ctx.addIssue({ code: 'custom', path: ['checklists', i, 'id'], message: `id ceklis ganda: ${c.id}` });
      cl.add(c.id);
    });
    for (const s of d.stations) {
      const ok = s.kind === 'manual' ? !!s.rate_per_person_h : !!s.rate_per_unit_h;
      if (!ok) ctx.addIssue({ code: 'custom', path: ['stations', s.id], message: 'laju stasiun tidak sesuai jenis' });
    }
  });

export type RawFormulaDataset = z.infer<typeof FormulaDatasetSchema>;
export type FormulaChecklist = z.infer<typeof ChecklistSchema>;
export type BriquetteVariant = RawFormulaDataset['briket']['variants'][number];

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

/** Ubah setiap objek rentang di sebuah grup menjadi Param (kunci `grup.nama`). */
type RangeKeys<T> = { [K in keyof T as T[K] extends RawRange ? K : never]: Param };
function params<T extends Record<string, unknown>>(group: string, obj: T): RangeKeys<T> {
  const out: Record<string, Param> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && 'typ' in v && 'source_ids' in v) out[k] = toParam(`${group}.${k}`, v as RawRange);
  }
  return out as never;
}

export interface FormulaDatasetSI {
  version: string;
  compiled: string;
  raw: RawFormulaDataset;
  kopra: ReturnType<typeof params<RawFormulaDataset['kopra']>> & {
    sulfurGPerNut: Param;
    sulfurGPerM3: Param;
    greenhouseRoomM3: Param;
    greenhouseArea: Param;
    greenhouseHalves: Param;
    greenhouseCycleH: Param;
    /** KA daging segar (%) — dirujuk dari dataset proses. */
    meatMoisturePct: Param;
  };
  arang: ReturnType<typeof params<RawFormulaDataset['arang']>> & {
    methods: { id: string; nameId: string; batchShellKg: Param; burnH: Param; coolingH: Param; liquidSmoke: boolean }[];
  };
  briket: ReturnType<typeof params<RawFormulaDataset['briket']>> & {
    variants: (BriquetteVariant & { density: Param })[];
  };
  cuka: ReturnType<typeof params<RawFormulaDataset['cuka']>>;
  bioleather: ReturnType<typeof params<RawFormulaDataset['bioleather']>>;
  production: ReturnType<typeof params<RawFormulaDataset['production']>>;
  stations: { id: string; nameId: string; kind: 'manual' | 'machine'; unit: string; rate: Param }[];
  checklists: FormulaChecklist[];
  sources: RawFormulaDataset['sources'];
}

export function loadFormulaDataset(raw: unknown, process: ProcessDatasetSI): FormulaDatasetSI {
  const parsed = FormulaDatasetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DatasetError('Dataset formula tidak valid:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  const d = parsed.data;
  if (d.meta.requires_process_dataset !== process.version) {
    throw new DatasetError(`Dataset formula v${d.meta.version} butuh dataset proses v${d.meta.requires_process_dataset}, terpasang v${process.version}`);
  }
  const km = process.kernelMoisture; // fraksi → persen
  const meatMoisturePct: Param = { ...km, key: 'kopra.meat_moisture_pct', unit: 'pct', min: km.min * 100, typ: km.typ * 100, max: km.max * 100 };
  return {
    version: d.meta.version,
    compiled: d.meta.compiled,
    raw: d,
    kopra: {
      ...params('kopra', d.kopra),
      sulfurGPerNut: toParam('kopra.sulfur.g_per_nut', d.kopra.sulfur.g_per_nut),
      sulfurGPerM3: toParam('kopra.sulfur.g_per_m3', d.kopra.sulfur.g_per_m3),
      greenhouseRoomM3: toParam('kopra.greenhouse.room_m3', d.kopra.greenhouse.room_m3),
      greenhouseArea: toParam('kopra.greenhouse.rack_area_m2', d.kopra.greenhouse.rack_area_m2),
      greenhouseHalves: toParam('kopra.greenhouse.halves_per_m2', d.kopra.greenhouse.halves_per_m2),
      greenhouseCycleH: toParam('kopra.greenhouse.cycle_h', d.kopra.greenhouse.cycle_h),
      meatMoisturePct,
    },
    arang: {
      ...params('arang', d.arang),
      methods: d.arang.methods.map((m) => ({
        id: m.id,
        nameId: m.name_id,
        batchShellKg: toParam(`arang.${m.id}.batch_shell_kg`, m.batch_shell_kg),
        burnH: toParam(`arang.${m.id}.burn_h`, m.burn_h),
        coolingH: toParam(`arang.${m.id}.cooling_h`, m.cooling_h),
        liquidSmoke: m.liquid_smoke,
      })),
    },
    briket: {
      ...params('briket', d.briket),
      variants: d.briket.variants.map((v) => ({ ...v, density: toParam(`briket.${v.id}.density`, v.density_g_cm3) })),
    },
    cuka: params('cuka', d.cuka),
    bioleather: params('bioleather', d.bioleather),
    production: params('production', d.production),
    stations: d.stations.map((s) => ({
      id: s.id,
      nameId: s.name_id,
      kind: s.kind,
      unit: s.unit,
      rate: toParam(`station.${s.id}.rate`, (s.rate_per_person_h ?? s.rate_per_unit_h)!),
    })),
    checklists: d.checklists,
    sources: d.sources,
  };
}

/** Keyakinan string ('B', 'A/C') → huruf terlemah. */
export const confidenceOf = (s: string): Confidence => parseConfidence(s);
