import { NextResponse } from 'next/server';
import { runReminder } from '@/server/labReminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pengingat email tiap jam (DEC-093) — dipanggil penjadwal pg_cron Supabase setiap jam.
 * Aman dipanggil berulang: server sendiri menolak bila sudah dijalankan < 55 menit lalu,
 * jadi tiap pengguna paling banyak menerima 1 email per jam.
 */
async function handle(req: Request) {
  try {
    return NextResponse.json(await runReminder(new URL(req.url).origin));
  } catch (e) {
    console.error('[lab-reminder]', e);
    return NextResponse.json({ ok: false, error: 'Pengingat gagal dijalankan.' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
