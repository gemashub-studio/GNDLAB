import { NextResponse } from 'next/server';
import { runReminder } from '@/server/labReminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pengingat email tiap 2 hari (DEC-097; dulu tiap jam, DEC-093) — pg_cron Supabase memanggil setiap jam untuk memeriksa.
 * Aman dipanggil berulang: email hanya dikirim bila email terakhir sudah ≥ 2 hari lalu (dan pemeriksaan maks. sekali per jam),
 * jadi tiap pengguna paling banyak menerima 1 email per 2 hari.
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
