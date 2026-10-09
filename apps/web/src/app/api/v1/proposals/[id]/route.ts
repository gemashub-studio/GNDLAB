import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth';
import { approveProposal, rejectProposal } from '@/server/approval';
import { handle, parseBody, unauthorized } from '@/server/http';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ action: z.enum(['approve', 'reject']) });

/** Setujui (→ versi patch baru PUBLISHED & aktif) atau tolak usulan. Hanya data_admin (IR-07). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await currentUser();
  if (!user) throw unauthorized();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Usulan tidak ditemukan' } }, { status: 404 });
  const { action } = await parseBody(req, BodySchema);
  return NextResponse.json(action === 'approve' ? await approveProposal(user, id) : await rejectProposal(user, id));
});
