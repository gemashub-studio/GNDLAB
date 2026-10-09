import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';
import { listProposals } from '@/server/approval';
import { handle, unauthorized } from '@/server/http';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

/** Daftar usulan kalibrasi (?status=PENDING|APPROVED|REJECTED). */
export const GET = handle(async (req: Request) => {
  if (!(await currentUser())) throw unauthorized();
  const s = new URL(req.url).searchParams.get('status');
  const status = STATUSES.find((x) => x === s);
  return NextResponse.json({ proposals: await listProposals(status) });
});
