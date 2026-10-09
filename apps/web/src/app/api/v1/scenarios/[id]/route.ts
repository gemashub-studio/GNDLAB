import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { handle, unauthorized } from '@/server/http';
import { deleteScenario, getScenario, isScenarioUuid } from '@/server/scenarios';

export const dynamic = 'force-dynamic';

/**
 * Ambil skenario. Lewat `share_slug` → publik (siapa pun yang punya tautan bagikan).
 * Lewat UUID → hanya pemiliknya (cegah IDOR).
 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const byId = isScenarioUuid(id);
  const user = byId ? await currentUser() : null;
  if (byId && !user) throw unauthorized();
  const s = await getScenario(id, byId ? user!.id : undefined);
  return NextResponse.json({
    id: s.id,
    name: s.name,
    shareSlug: s.shareSlug,
    createdAt: s.createdAt,
    datasetVersion: s.datasetVersion,
    state: s.state,
    ...s.output.out,
  });
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const { id } = await ctx.params;
  await deleteScenario(user, id);
  return new NextResponse(null, { status: 204 });
});
