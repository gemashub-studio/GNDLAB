import { availableModes } from '@gemas/dataset';
import { NextResponse } from 'next/server';
import { datasetOrBundled } from '@/server/datasets';
import { handle } from '@/server/http';

/** Daftar komoditas + form + parameter (SI). `?version=` opsional (404 bila tak dikenal). */
export const GET = handle(async (req: Request) => {
  const ds = await datasetOrBundled(new URL(req.url).searchParams.get('version'));
  return NextResponse.json({
    version: ds.version,
    commodities: ds.commodities.map((c) => ({
      id: c.id,
      nameId: c.nameId,
      nameEn: c.nameEn,
      unitType: c.unitType,
      forms: c.forms.map((f) => ({
        code: f.code,
        shape: f.shape,
        calcModeDefault: f.calcModeDefault,
        modes: availableModes(f),
        nestable: f.nestable,
        params: Object.values(f.params),
        packaging: f.packaging,
        benchmarks: f.benchmarks,
      })),
    })),
  });
});
