import { NextResponse } from 'next/server';
import { datasetOrBundled } from '@/server/datasets';
import { handle } from '@/server/http';

export const GET = handle(async (req: Request) => {
  const ds = await datasetOrBundled(new URL(req.url).searchParams.get('version'));
  return NextResponse.json({
    version: ds.version,
    containers: ds.containers.map((c) => ({
      id: c.id,
      name: c.name,
      innerM: { L: c.L, W: c.W, H: c.H },
      volumeM3: c.volumeM3,
      payloadKg: c.payloadKg,
      confidence: c.confidence,
    })),
  });
});
