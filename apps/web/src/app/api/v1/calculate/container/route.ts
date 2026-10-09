import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ContainerStateSchema, runContainer } from '@/lib/scenario';
import { datasetOrBundled } from '@/server/datasets';
import { handle, parseBody } from '@/server/http';

/** ARD §6: `{commodityId, form, containerId, overrides?, mode}` (+ opsional custom, volumeUtil, packagingIndex, version). */
const Body = z.object({
  commodityId: z.string(),
  form: z.string(),
  containerId: z.string().optional(),
  custom: z.object({ lengthM: z.number(), widthM: z.number(), heightM: z.number(), payloadKg: z.number() }).optional(),
  mode: z.enum(['BULK', 'PIECE', 'PACKAGE']),
  overrides: z.record(z.number()).optional(),
  volumeUtil: z.number().optional(),
  packagingIndex: z.number().int().optional(),
  version: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const b = await parseBody(req, Body);
  const ds = await datasetOrBundled(b.version);
  const state = ContainerStateSchema.parse({
    kind: 'CONTAINER',
    commodityId: b.commodityId,
    formCode: b.form,
    mode: b.mode,
    ...(b.containerId && { containerId: b.containerId }),
    ...(b.custom && { custom: b.custom }),
    ...(b.overrides && { overrides: b.overrides }),
    ...(b.volumeUtil !== undefined && { volumeUtil: b.volumeUtil }),
    ...(b.packagingIndex !== undefined && { packagingIndex: b.packagingIndex }),
  });
  return NextResponse.json(runContainer(ds, state));
});
