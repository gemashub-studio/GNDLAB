import { NextResponse } from 'next/server';

/** ARD §6 — input sampling lapangan: dibangun di Fase M4. */
export const POST = () =>
  NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Sampling lapangan tersedia di fase M4' } }, { status: 501 });
