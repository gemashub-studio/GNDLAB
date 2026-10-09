import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { samplingStats } from '@/server/calibration';
import { handle, unauthorized } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Statistik sampel per parameter versi aktif (n, P5/median/P95, sisa sampel menuju usulan). */
export const GET = handle(async () => {
  if (!(await currentUser())) throw unauthorized();
  return NextResponse.json({ stats: await samplingStats() });
});
