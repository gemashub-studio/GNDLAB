import { rawDataset } from '@gemas/dataset';
import { NextResponse } from 'next/server';
import { activeDataset } from '@/server/datasets';
import { handle } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Versi dataset aktif. `overrides` = parameter yang berbeda dari dataset ter-bundle (`base`),
 * dipakai client untuk menghitung dengan versi aktif (ADR-008). `dataset` = JSON basis.
 */
export const GET = handle(async () => {
  const a = await activeDataset();
  return NextResponse.json({
    version: a.semver,
    status: a.status,
    publishedAt: a.publishedAt,
    base: rawDataset.meta.version,
    overrides: a.overrides,
    dataset: rawDataset,
  });
});
