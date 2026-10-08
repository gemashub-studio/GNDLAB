/**
 * Skema Zod untuk coconut_inventory_dataset.json. Memvalidasi bentuk + integritas referensi
 * (source_ids, container, density_ref). Field tambahan diizinkan (passthrough) agar dataset bisa
 * tumbuh tanpa merusak loader; field yang DIPAKAI loader divalidasi ketat.
 */
import { z } from 'zod';

const positive = z.number().positive();

export const RangeSchema = z
  .object({ min: z.number(), typ: z.number(), max: z.number() })
  .passthrough()
  .refine((r) => r.min <= r.typ && r.typ <= r.max, { message: 'wajib min ≤ typ ≤ max' });

/** "A", "B", "C" atau campuran seperti "A/C" (DEC-008: dihitung terlemah). */
export const ConfidenceStrSchema = z.string().regex(/^[ABC](\/[ABC])*$/);

const MinMaxOrNumber = z.union([positive, z.object({ min: positive, max: positive }).refine((r) => r.min <= r.max)]);

const Dims = z.object({ L: positive, W: positive, H: positive });

export const ContainerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    inner_cm: Dims,
    volume_m3: positive,
    payload_kg: positive,
    confidence: ConfidenceStrSchema,
  })
  .passthrough();

export const PackagingSchema = z
  .object({
    type: z.string().min(1),
    pcs_per_bag: z.number().int().positive().optional(),
    bag_net_kg: RangeSchema.optional(),
    bag_dims_cm_filled: Dims.extend({ confidence: ConfidenceStrSchema.optional(), note: z.string().optional() })
      .passthrough()
      .optional(),
    density_ref: z.string().nullable().optional(),
  })
  .passthrough();

export const BenchmarkSchema = z
  .object({
    container: z.string().min(1),
    form: z.string().optional(),
    bags: MinMaxOrNumber.optional(),
    pcs: MinMaxOrNumber.optional(),
    net_t: MinMaxOrNumber.optional(),
    note: z.string().optional(),
    source_ids: z.array(z.string()).min(1),
  })
  .passthrough()
  .refine((b) => b.bags ?? b.pcs ?? b.net_t, { message: 'benchmark wajib punya bags, pcs, atau net_t' });

export const CommoditySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    name_id: z.string().min(1),
    name_en: z.string().optional(),
    description: z.string().optional(),
    unit_type: z.enum(['piece', 'bulk']),
    geometry: z.object({ shape: z.string().min(1) }).passthrough(),
    bulk_density_kg_m3: z.record(RangeSchema),
    packaging: z.array(PackagingSchema),
    container_benchmarks: z.array(BenchmarkSchema).optional(),
    storage: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const SourceSchema = z.object({
  id: z.string().regex(/^S\d{2}$/),
  title: z.string().min(1),
  url: z.string().regex(/^https?:\/\//),
  grade: z.enum(['A', 'B', 'C']),
});

export const DatasetSchema = z
  .object({
    meta: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), compiled: z.string() }).passthrough(),
    containers: z.array(ContainerSchema).min(1),
    commodities: z.array(CommoditySchema).min(1),
    sources: z.array(SourceSchema).min(1),
  })
  .superRefine((d, ctx) => {
    const sources = new Set(d.sources.map((s) => s.id));
    const containers = new Set(d.containers.map((c) => c.id));
    d.commodities.forEach((cm, i) => {
      cm.container_benchmarks?.forEach((b, j) => {
        const path = ['commodities', i, 'container_benchmarks', j];
        if (!containers.has(b.container)) {
          ctx.addIssue({ code: 'custom', path, message: `container ${b.container} tidak terdaftar` });
        }
        for (const s of b.source_ids) {
          if (!sources.has(s)) ctx.addIssue({ code: 'custom', path, message: `source_id ${s} tidak terdaftar` });
        }
      });
      cm.packaging.forEach((p, j) => {
        if (p.density_ref && !(p.density_ref in cm.bulk_density_kg_m3)) {
          ctx.addIssue({
            code: 'custom',
            path: ['commodities', i, 'packaging', j],
            message: `density_ref ${p.density_ref} tidak ada di bulk_density_kg_m3`,
          });
        }
      });
    });
  });

export type RawDataset = z.infer<typeof DatasetSchema>;
export type RawCommodity = z.infer<typeof CommoditySchema>;
