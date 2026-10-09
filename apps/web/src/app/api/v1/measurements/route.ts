import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MeasurementSchema } from '@/lib/sampling';
import { currentUser } from '@/server/auth';
import { insertMeasurements } from '@/server/calibration';
import { handle, parseBody, unauthorized } from '@/server/http';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ rows: z.array(MeasurementSchema).min(1).max(500) });

/** ARD §6 — catat sampel lapangan (editor/data_admin). Semua baris valid atau tidak ada yang tersimpan. */
export const POST = handle(async (req: Request) => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const { rows } = await parseBody(req, BodySchema);
  const r = await insertMeasurements(user, rows);
  return NextResponse.json(r, { status: 201 });
});
