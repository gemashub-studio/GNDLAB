import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defaultFormCode } from '@/lib/defaults';
import { ConvertStateSchema, runConvert } from '@/lib/scenario';
import { datasetOrBundled } from '@/server/datasets';
import { handle, parseBody } from '@/server/http';

/** ARD §6: `{commodityId, from:{unit,value}, to}` (+ opsional form, overrides, version). */
const Body = z.object({
  commodityId: z.string(),
  form: z.string().optional(),
  from: z.object({ unit: z.string(), value: z.number() }),
  to: z.string(),
  overrides: z.record(z.number()).optional(),
  version: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const b = await parseBody(req, Body);
  const ds = await datasetOrBundled(b.version);
  const state = ConvertStateSchema.parse({
    kind: 'CONVERT',
    commodityId: b.commodityId,
    formCode: b.form ?? defaultFormCode(ds, b.commodityId),
    from: b.from,
    to: b.to,
    ...(b.overrides && { overrides: b.overrides }),
  });
  return NextResponse.json(runConvert(ds, state));
});
