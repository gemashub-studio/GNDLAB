import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runWarehouse, WarehouseStateSchema } from '@/lib/scenario';
import { datasetOrBundled } from '@/server/datasets';
import { handle, parseBody } from '@/server/http';

/** ARD §6: `{commodityId, form, massKg | pieces, stackHeightM, floorUtil, overrides?}` (+ packs, zona, dst.). */
const Body = z
  .object({
    commodityId: z.string(),
    form: z.string(),
    massKg: z.number().optional(),
    pieces: z.number().int().optional(),
    packs: z.number().int().optional(),
    stackHeightM: z.number(),
    floorUtil: z.number().optional(),
    usePackaging: z.boolean().optional(),
    zone: z.object({ lengthM: z.number(), widthM: z.number() }).optional(),
    floorLoadKgM2: z.number().optional(),
    moisturePct: z.number().optional(),
    coStored: z.array(z.string()).optional(),
    overrides: z.record(z.number()).optional(),
    version: z.string().optional(),
  })
  .refine((b) => [b.massKg, b.pieces, b.packs].filter((x) => x !== undefined).length === 1, {
    message: 'isi tepat satu: massKg, pieces, atau packs',
  });

export const POST = handle(async (req: Request) => {
  const { form, massKg, pieces, packs, version, ...rest } = await parseBody(req, Body);
  const ds = await datasetOrBundled(version);
  const stock = massKg !== undefined ? { massKg } : pieces !== undefined ? { pieces } : { packs: packs! };
  const state = WarehouseStateSchema.parse({ kind: 'WAREHOUSE', formCode: form, stock, ...rest });
  return NextResponse.json(runWarehouse(ds, state));
});
