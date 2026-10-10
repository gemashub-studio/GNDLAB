/**
 * Dataset proses (ADR-007): skema Zod + loader ke Param SI + perakit input `processChain`.
 * Parameter yang sudah ada di dataset inventory DIRUJUK dari situ (tidak disalin).
 */
import {
  pctToFraction,
  type Confidence,
  type Param,
  type ProcessInput,
  type Range,
  type Unit,
} from '@gemas/calc-engine';
import { z } from 'zod';
import { DatasetError, getForm, parseConfidence, type DatasetSI } from './loader.ts';

/**
 * Sumber: URL publik ATAU dokumen internal owner (`doc`, mis. SOP KORA) — minimal salah satu.
 * Dokumen internal tidak punya URL; jalurnya dicatat agar bisa ditelusuri (ADR-009).
 */
export const RefSourceSchema = (id: RegExp) =>
  z
    .object({
      id: z.string().regex(id),
      title: z.string().min(1),
      url: z.string().regex(/^https?:\/\//).optional(),
      doc: z.string().min(1).optional(),
      grade: z.enum(['A', 'B', 'C']),
    })
    .refine((s) => s.url !== undefined || s.doc !== undefined, { message: 'sumber wajib punya url atau doc' });

const RangeWithMeta = z
  .object({
    min: z.number().positive(),
    typ: z.number().positive(),
    max: z.number().positive(),
    confidence: z.string().regex(/^[ABC](\/[ABC])*$/),
    source_ids: z.array(z.string()).min(1),
    note: z.string().optional(),
  })
  .refine((r) => r.min <= r.typ && r.typ <= r.max, { message: 'wajib min ≤ typ ≤ max' });

export const ProcessDatasetSchema = z
  .object({
    meta: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), compiled: z.string(), requires_inventory_dataset: z.string() }).passthrough(),
    origins: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z_]+$/),
          name_id: z.string().min(1),
          altitude_m: z.object({ min: z.number().optional(), max: z.number().optional() }),
          note: z.string().optional(),
          whole_fruit_mass_kg: RangeWithMeta,
          husk_fraction: RangeWithMeta,
        }),
      )
      .min(1),
    fruit_composition: z.object({ shell_fraction: RangeWithMeta, kernel_fraction: RangeWithMeta, coir_fibre_per_nut_kg: RangeWithMeta }),
    kernel: z.object({ fresh_moisture_pct: RangeWithMeta }),
    drying_methods: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z_]+$/),
          name_id: z.string().min(1),
          duration_h: RangeWithMeta,
          temperature_c: RangeWithMeta.optional(),
          weather_dependent: z.boolean(),
        }),
      )
      .min(1),
    rack: z.object({ halves_per_m2_per_tier: z.object({ derivation: z.string(), confidence: z.string() }) }),
    charcoal_kiln: z.object({ drum_batch_shell_kg: RangeWithMeta, burn_h: RangeWithMeta, cooling_h: RangeWithMeta }),
    sources: z.array(RefSourceSchema(/^P\d{2}$/)).min(1),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.sources.map((s) => s.id));
    const check = (r: { source_ids: string[] }, path: (string | number)[]) => {
      for (const s of r.source_ids) if (!ids.has(s)) ctx.addIssue({ code: 'custom', path, message: `source_id ${s} tidak terdaftar` });
    };
    d.origins.forEach((o, i) => {
      check(o.whole_fruit_mass_kg, ['origins', i, 'whole_fruit_mass_kg']);
      check(o.husk_fraction, ['origins', i, 'husk_fraction']);
      if (o.husk_fraction.max >= 1) ctx.addIssue({ code: 'custom', path: ['origins', i], message: 'fraksi sabut harus < 1' });
    });
    const fc = d.fruit_composition;
    check(fc.shell_fraction, ['fruit_composition', 'shell_fraction']);
    check(fc.kernel_fraction, ['fruit_composition', 'kernel_fraction']);
    check(fc.coir_fibre_per_nut_kg, ['fruit_composition', 'coir_fibre_per_nut_kg']);
    check(d.kernel.fresh_moisture_pct, ['kernel']);
    d.drying_methods.forEach((m, i) => check(m.duration_h, ['drying_methods', i]));
    check(d.charcoal_kiln.drum_batch_shell_kg, ['charcoal_kiln']);
  });

export type RawProcessDataset = z.infer<typeof ProcessDatasetSchema>;

export interface OriginSI {
  id: string;
  nameId: string;
  altitude: { min?: number; max?: number };
  note?: string;
  wholeMassKg: Param;
  huskFraction: Param;
}

export interface DryingMethodSI {
  id: string;
  nameId: string;
  duration: Param;
  temperatureC?: Range;
  weatherDependent: boolean;
}

export interface ProcessDatasetSI {
  version: string;
  compiled: string;
  origins: OriginSI[];
  shellFraction: Param;
  kernelFraction: Param;
  coirPerNutKg: Param;
  kernelMoisture: Param; // fraksi
  dryingMethods: DryingMethodSI[];
  /** Turunan geometri dataset inventory: 1/d² (ADR-007 §3). */
  halvesPerM2: Param;
  charcoal: { yieldFraction: Param; drumBatchKg: Param; burnH: Param; coolingH: Param };
  sources: RawProcessDataset['sources'];
}

type RawRange = z.infer<typeof RangeWithMeta>;
const toParam = (key: string, unit: Unit, r: RawRange, factor = 1): Param => ({
  key,
  unit,
  min: r.min * factor,
  typ: r.typ * factor,
  max: r.max * factor,
  confidence: parseConfidence(r.confidence),
  sourceIds: r.source_ids,
  source: 'dataset',
  ...(r.note && { note: r.note }),
});

export function loadProcessDataset(raw: unknown, inventory: DatasetSI): ProcessDatasetSI {
  const parsed = ProcessDatasetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DatasetError('Dataset proses tidak valid:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  const d = parsed.data;
  if (d.meta.requires_inventory_dataset !== inventory.version) {
    throw new DatasetError(
      `Dataset proses v${d.meta.version} butuh dataset inventory v${d.meta.requires_inventory_dataset}, terpasang v${inventory.version}`,
    );
  }
  // Rujukan ke dataset inventory (tidak disalin).
  const arang = getForm(inventory, 'arang_batok_belah2', 'raw_halves').params;
  const rim = arang['geometry.raw_half_shell.rim_diameter'];
  const yieldP = arang['charcoal_yield_mass_fraction'];
  if (!rim || !yieldP) throw new DatasetError('Dataset inventory tidak punya diameter mulut batok / rendemen arang');
  const halvesPerM2: Param = {
    key: 'rack.halves_per_m2',
    unit: 'count',
    min: 1 / (rim.max * rim.max),
    typ: 1 / (rim.typ * rim.typ),
    max: 1 / (rim.min * rim.min),
    confidence: weakest(rim.confidence, parseConfidence(d.rack.halves_per_m2_per_tier.confidence)),
    sourceIds: rim.sourceIds,
    source: 'dataset',
    note: d.rack.halves_per_m2_per_tier.derivation,
  };
  const m = d.kernel.fresh_moisture_pct;
  return {
    version: d.meta.version,
    compiled: d.meta.compiled,
    sources: d.sources,
    origins: d.origins.map((o) => ({
      id: o.id,
      nameId: o.name_id,
      altitude: o.altitude_m,
      ...(o.note && { note: o.note }),
      wholeMassKg: toParam(`${o.id}.whole_fruit_mass`, 'kg', o.whole_fruit_mass_kg),
      huskFraction: toParam(`${o.id}.husk_fraction`, 'fraction', o.husk_fraction),
    })),
    shellFraction: toParam('composition.shell_fraction', 'fraction', d.fruit_composition.shell_fraction),
    kernelFraction: toParam('composition.kernel_fraction', 'fraction', d.fruit_composition.kernel_fraction),
    coirPerNutKg: toParam('composition.coir_per_nut', 'kg', d.fruit_composition.coir_fibre_per_nut_kg),
    kernelMoisture: { ...toParam('kernel.fresh_moisture', 'fraction', m), min: pctToFraction(m.min), typ: pctToFraction(m.typ), max: pctToFraction(m.max) },
    dryingMethods: d.drying_methods.map((x) => ({
      id: x.id,
      nameId: x.name_id,
      duration: toParam(`drying.${x.id}.duration`, 'h', x.duration_h),
      ...(x.temperature_c && { temperatureC: { min: x.temperature_c.min, typ: x.temperature_c.typ, max: x.temperature_c.max } }),
      weatherDependent: x.weather_dependent,
    })),
    halvesPerM2,
    charcoal: {
      yieldFraction: yieldP,
      drumBatchKg: toParam('charcoal.drum_batch', 'kg', d.charcoal_kiln.drum_batch_shell_kg),
      burnH: toParam('charcoal.burn', 'h', d.charcoal_kiln.burn_h),
      coolingH: toParam('charcoal.cooling', 'h', d.charcoal_kiln.cooling_h),
    },
  };
}

const weakest = (a: Confidence, b: Confidence): Confidence => (a > b ? a : b);

// ---------------------------------------------------------------- perakit skenario proses

export type ProductTarget = 'kopra_edible' | 'kopra_asalan';

export interface ProcessScenario {
  /** Jumlah butir bersabut per asal (kode origin → butir). */
  lots: Record<string, number>;
  product: ProductTarget;
  drying?: { methodId: string; tierAreaM2: number; tiers: number; racksAvailable?: number; halvesPerM2?: number };
  charcoal?: { drums: number };
}

/** Target kadar air kopra = parameter `moisture` produk di dataset INVENTORY (typ). */
export function productMoisture(inventory: DatasetSI, product: ProductTarget): Param {
  const form = inventory.commodities.find((c) => c.id === product)?.forms[0];
  const m = form?.params.moisture;
  if (!m) throw new DatasetError(`Kadar air produk ${product} tidak ada di dataset inventory`);
  return { ...m, key: `${product}.moisture_target`, unit: 'fraction', min: m.min / 100, typ: m.typ / 100, max: m.max / 100 };
}

export function buildProcessInput(inventory: DatasetSI, p: ProcessDatasetSI, s: ProcessScenario): ProcessInput {
  const lots = Object.entries(s.lots)
    .filter(([, n]) => n > 0)
    .map(([key, nuts]) => {
      const o = p.origins.find((x) => x.id === key);
      if (!o) throw new DatasetError(`Asal kelapa ${key} tidak dikenal`);
      return { key, nuts, wholeMassKg: o.wholeMassKg, huskFraction: o.huskFraction };
    });
  if (!lots.length) throw new DatasetError('Isi jumlah kelapa minimal satu asal');
  let drying: ProcessInput['drying'];
  if (s.drying) {
    const method = p.dryingMethods.find((x) => x.id === s.drying!.methodId);
    if (!method) throw new DatasetError(`Metode jemur ${s.drying.methodId} tidak dikenal`);
    drying = {
      method: method.id,
      duration: method.duration,
      halvesPerM2:
        s.drying.halvesPerM2 !== undefined
          ? { ...p.halvesPerM2, min: s.drying.halvesPerM2, typ: s.drying.halvesPerM2, max: s.drying.halvesPerM2, source: 'override', confidence: 'B' }
          : p.halvesPerM2,
      tierAreaM2: s.drying.tierAreaM2,
      tiers: s.drying.tiers,
      ...(s.drying.racksAvailable !== undefined && { racksAvailable: s.drying.racksAvailable }),
      weatherDependent: method.weatherDependent,
    };
  }
  return {
    lots,
    shellFraction: p.shellFraction,
    kernelFraction: p.kernelFraction,
    coirPerNutKg: p.coirPerNutKg,
    kernelMoisture: p.kernelMoisture,
    targetMoisture: productMoisture(inventory, s.product),
    productCode: s.product,
    ...(drying && { drying }),
    ...(s.charcoal && { charcoal: { ...p.charcoal, drums: s.charcoal.drums } }),
    datasetVersion: `${inventory.version}+proses.${p.version}`,
  };
}
