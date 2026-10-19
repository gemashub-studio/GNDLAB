/**
 * Pengingat otomatis (DEC-093, DEC-097): tiap jam cek rnd_data — bila masih ada Pencatatan Data yang belum lengkap
 * (belum ada data akhir final), kirim email lewat Resend ke semua pengguna terdaftar (tabel users).
 * Bila tidak ada, tidak mengirim apa-apa. Email dikirim paling sering sekali per 2 hari (DEC-097).
 */
import { createClient } from '@supabase/supabase-js';
import { reminderEmail, type PendingItem } from './labAuthCore';
import { missingEnv } from './labAuth';

const MIN_GAP_MS = 55 * 60_000;
/** Jarak antar email pengingat: 2 hari (dikurangi 30 menit agar jadwal per jam yang sedikit maju tidak menunda 1 jam). */
export const SEND_GAP_MS = 2 * 24 * 3_600_000 - 30 * 60_000;

/** Boleh kirim email sekarang? (email terakhir yang benar-benar terkirim sudah ≥ 2 hari lalu) */
export const reminderDue = (lastSentAt: number, now = Date.now()) => !lastSentAt || now - lastSentAt >= SEND_GAP_MS;

const admin = () =>
  createClient((process.env.PROJECT_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''), process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

export async function runReminder(origin: string) {
  const missing = missingEnv();
  if (missing.length) return { ok: false, skipped: 'belum dikonfigurasi', missing };
  const db = admin();

  // 1) maksimal sekali per jam (panggilan ganda dari penjadwal / orang lain diabaikan)
  const { data: last } = await db.from('lab_reminder_runs').select('ran_at').order('ran_at', { ascending: false }).limit(1);
  const lastAt = last?.[0]?.ran_at ? Date.parse(last[0].ran_at as string) : 0;
  if (lastAt && Date.now() - lastAt < MIN_GAP_MS) return { ok: true, skipped: 'baru saja dijalankan', lastRun: new Date(lastAt).toISOString() };

  // 1b) email hanya tiap 2 hari: hitung dari run terakhir yang benar-benar mengirim email
  const { data: lastSent } = await db.from('lab_reminder_runs').select('ran_at').gt('sent', 0).order('ran_at', { ascending: false }).limit(1);
  const lastSentAt = lastSent?.[0]?.ran_at ? Date.parse(lastSent[0].ran_at as string) : 0;
  if (!reminderDue(lastSentAt)) return { ok: true, skipped: 'email terakhir < 2 hari lalu', lastSent: new Date(lastSentAt).toISOString(), next: new Date(lastSentAt + SEND_GAP_MS).toISOString() };

  // 2) pencatatan yang belum lengkap (data akhir belum final)
  const { data: rows, error } = await db.from('rnd_data').select('id,data_awal,data_akhir').eq('menu', 'pencatatan_data').eq('deleted', false);
  if (error) throw new Error(`baca rnd_data: ${error.message}`);
  const pending: PendingItem[] = (rows ?? [])
    .filter((r) => !(r.data_akhir as { finishedAt?: string } | null)?.finishedAt)
    .map((r) => {
      const a = (r.data_awal ?? {}) as { item?: string; count?: number; createdAt?: string };
      return { id: r.id as string, item: a.item ?? '–', count: a.count ?? 0, createdAt: a.createdAt ?? '', draft: !!(r.data_akhir as { akhirSavedAt?: string } | null)?.akhirSavedAt };
    })
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt));

  let sent = 0;
  if (pending.length) {
    // 3) penerima: semua pengguna terdaftar (email login dari Supabase Auth)
    const { data: users } = await db.from('users').select('id,username');
    const ids = new Map(((users ?? []) as { id: string; username: string }[]).map((u) => [u.id, u.username]));
    const recipients: { email: string; username: string }[] = [];
    for (let page = 1; ids.size && page <= 20; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data.users) if (u.email && ids.has(u.id)) recipients.push({ email: u.email, username: ids.get(u.id)! });
      if (data.users.length < 1000) break;
    }
    const logoUrl = `${origin}/email-logo.png`;
    const siteUrl = `${origin}/lab?t=bahan`;
    // 4) kirim lewat Resend batch (maks. 100 per panggilan)
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100).map((r) => {
        const m = reminderEmail({ username: r.username, items: pending, logoUrl, siteUrl });
        return { from: process.env.RESEND_FROM ?? 'GnD Lab <no-reply@cekidku.my.id>', to: [r.email], subject: m.subject, html: m.html, text: m.text, tags: [{ name: 'app', value: 'gnd-lab' }, { name: 'purpose', value: 'reminder' }] };
      });
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else console.error('[lab-reminder] Resend batch gagal', res.status, (await res.text().catch(() => '')).slice(0, 300));
    }
  }
  await db.from('lab_reminder_runs').insert({ pending: pending.length, sent });
  console.log('[lab-reminder] selesai', { pending: pending.length, sent });
  return { ok: true, pending: pending.length, sent };
}
