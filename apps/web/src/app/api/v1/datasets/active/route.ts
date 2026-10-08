import { rawDataset } from '@gemas/dataset';
import { NextResponse } from 'next/server';
import { activeDataset, activeVersion } from '@/server/datasets';
import { handle } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Versi dataset aktif (DB) + isi dataset JSON versi tersebut. */
export const GET = handle(async () => {
  const v = await activeVersion();
  await activeDataset(); // memastikan bundle engine = versi aktif DB
  return NextResponse.json({
    version: v.semver,
    status: v.status,
    publishedAt: v.published_at,
    dataset: rawDataset,
  });
});
