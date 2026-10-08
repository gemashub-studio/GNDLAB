import { NextResponse } from 'next/server';

/** ARD §6 — usulan kalibrasi (perlu approval data_admin): dibangun di Fase M4. */
export const POST = () =>
  NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Kalibrasi dataset tersedia di fase M4' } }, { status: 501 });
