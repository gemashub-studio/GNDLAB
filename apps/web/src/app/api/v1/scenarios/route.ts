import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { handle, parseBody, unauthorized } from '@/server/http';
import { listScenarios, saveScenario, SaveScenarioSchema } from '@/server/scenarios';

export const dynamic = 'force-dynamic';

/** Simpan skenario (perlu login). Server menghitung ulang; respons 201 baru / 200 bila clientId sudah ada. */
export const POST = handle(async (req: Request) => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const body = await parseBody(req, SaveScenarioSchema);
  const r = await saveScenario(user, body);
  return NextResponse.json(
    { id: r.id, shareSlug: r.shareSlug, binding: r.out.out.binding, confidence: r.out.out.confidence },
    { status: r.created ? 201 : 200 },
  );
});

export const GET = handle(async () => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return NextResponse.json({ scenarios: await listScenarios(user.id) });
});
