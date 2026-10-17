/**
 * Login GnD Lab di server (DEC-090): username + password + OTP email (Resend, domain cekidku.my.id).
 * Kunci rahasia hanya dibaca dari env server: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY (tidak pernah ke browser).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  emailError,
  genOtp,
  isOtpFormat,
  maskEmail,
  normUsername,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_MS,
  OTP_TTL_MS,
  otpEmail,
  otpHash,
  otpMatches,
  passwordError,
  seal,
  unseal,
  usernameError,
  type OtpPurpose,
} from './labAuthCore';

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const env = () => ({
  url: (process.env.PROJECT_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  anon: process.env.ANON_KEY_SUPABASE ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  service: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  resend: process.env.RESEND_API_KEY ?? '',
  from: process.env.RESEND_FROM ?? 'GnD Lab <no-reply@cekidku.my.id>',
});

/** Nama env yang belum diisi (untuk pesan yang jelas, tanpa membocorkan nilai). */
export function missingEnv(): string[] {
  const e = env();
  return [
    ...(!e.url ? ['PROJECT_URL'] : []),
    ...(!e.anon ? ['ANON_KEY_SUPABASE'] : []),
    ...(!e.service ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ...(!e.resend ? ['RESEND_API_KEY'] : []),
  ];
}

const secret = () => process.env.OTP_SECRET || env().service;
const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;
const admin = (): SupabaseClient => createClient(env().url, env().service, noSession);
const anon = (): SupabaseClient => createClient(env().url, env().anon, noSession);

async function sendOtpEmail(to: string, code: string, purpose: OtpPurpose, username: string, origin: string) {
  const mail = otpEmail({ code, purpose, username, logoUrl: `${origin}/email-logo.png`, siteUrl: `${origin}/lab` });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env().resend}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env().from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[lab-auth] Resend gagal', res.status, detail.slice(0, 300));
    throw new AuthError(502, 'Email kode verifikasi gagal dikirim. Coba lagi sebentar lagi.');
  }
}

async function rateLimit(email: string, purpose: OtpPurpose) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { data, error } = await admin().from('auth_otps').select('created_at').eq('email', email).eq('purpose', purpose).gte('created_at', since).order('created_at', { ascending: false });
  if (error) throw new AuthError(500, 'Server sibuk. Coba lagi.');
  const rows = data ?? [];
  const last = rows[0]?.created_at ? Date.parse(rows[0].created_at as string) : 0;
  if (last && Date.now() - last < OTP_RESEND_MS) throw new AuthError(429, `Tunggu ${Math.ceil((OTP_RESEND_MS - (Date.now() - last)) / 1000)} detik sebelum meminta kode baru.`);
  if (rows.length >= OTP_MAX_PER_HOUR) throw new AuthError(429, 'Terlalu banyak permintaan kode. Coba lagi dalam 1 jam.');
}

async function createOtp(email: string, purpose: OtpPurpose, payload?: string): Promise<string> {
  const code = genOtp();
  const { error } = await admin()
    .from('auth_otps')
    .insert({ email, purpose, code_hash: otpHash(secret(), purpose, email, code), payload: payload ?? null, expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString() });
  if (error) throw new AuthError(500, 'Server sibuk. Coba lagi.');
  return code;
}

async function consumeOtp(email: string, purpose: OtpPurpose, code: string): Promise<{ payload: string | null }> {
  if (!isOtpFormat(code)) throw new AuthError(400, 'Kode terdiri dari 6 angka.');
  const db = admin();
  const { data, error } = await db.from('auth_otps').select('id,code_hash,payload,expires_at,attempts').eq('email', email).eq('purpose', purpose).is('used_at', null).order('created_at', { ascending: false }).limit(1);
  if (error) throw new AuthError(500, 'Server sibuk. Coba lagi.');
  const row = data?.[0] as { id: string; code_hash: string; payload: string | null; expires_at: string; attempts: number } | undefined;
  if (!row || Date.parse(row.expires_at) < Date.now()) throw new AuthError(400, 'Kode sudah kedaluwarsa. Minta kode baru.');
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new AuthError(429, 'Terlalu banyak percobaan. Minta kode baru.');
  if (!otpMatches(secret(), purpose, email, code, row.code_hash)) {
    await db.from('auth_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    throw new AuthError(400, `Kode salah. Sisa percobaan: ${OTP_MAX_ATTEMPTS - row.attempts - 1}.`);
  }
  await db.from('auth_otps').update({ used_at: new Date().toISOString(), payload: null }).eq('id', row.id);
  return { payload: row.payload };
}

async function userIdByEmail(email: string): Promise<string | undefined> {
  const { data, error } = await admin().rpc('auth_user_id_by_email', { p_email: email });
  if (error) throw new AuthError(500, 'Server sibuk. Coba lagi.');
  return (data as string | null) ?? undefined;
}

async function profileByUsername(username: string): Promise<{ id: string; email: string } | undefined> {
  const db = admin();
  const { data } = await db.from('users').select('id').eq('username', username).maybeSingle();
  if (!data) return undefined;
  const { data: u } = await db.auth.admin.getUserById((data as { id: string }).id);
  return u.user?.email ? { id: u.user.id, email: u.user.email } : undefined;
}

async function usernameTaken(username: string, exceptId?: string): Promise<boolean> {
  const { data } = await admin().from('users').select('id').eq('username', username).maybeSingle();
  return !!data && (data as { id: string }).id !== exceptId;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

async function signIn(email: string, password: string): Promise<Tokens> {
  const { data, error } = await anon().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new AuthError(401, 'Username atau password salah.');
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

function req(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ------------------------------------------------------------------ alur

export async function registerStart(body: Record<string, unknown>, origin: string) {
  const username = normUsername(req(body.username));
  const email = req(body.email).trim().toLowerCase();
  const password = req(body.password);
  const bad = usernameError(username) ?? emailError(email) ?? passwordError(password);
  if (bad) throw new AuthError(400, bad);
  if (await usernameTaken(username)) throw new AuthError(409, 'Username sudah dipakai. Pilih username lain.');
  const uid = await userIdByEmail(email);
  if (uid) {
    const { data } = await admin().from('users').select('id').eq('id', uid).maybeSingle();
    if (data) throw new AuthError(409, 'Email ini sudah terdaftar. Silakan login.');
  }
  await rateLimit(email, 'register');
  const code = await createOtp(email, 'register');
  await sendOtpEmail(email, code, 'register', username, origin);
  return { ok: true, sentTo: maskEmail(email) };
}

export async function registerVerify(body: Record<string, unknown>): Promise<Tokens & { username: string }> {
  const username = normUsername(req(body.username));
  const email = req(body.email).trim().toLowerCase();
  const password = req(body.password);
  const bad = usernameError(username) ?? emailError(email) ?? passwordError(password);
  if (bad) throw new AuthError(400, bad);
  await consumeOtp(email, 'register', req(body.code));
  const db = admin();
  let uid = await userIdByEmail(email);
  if (await usernameTaken(username, uid)) throw new AuthError(409, 'Username sudah dipakai. Pilih username lain.');
  if (uid) {
    // akun lama (mis. dari link email) → pasang password & username
    const { error } = await db.auth.admin.updateUserById(uid, { password, email_confirm: true, user_metadata: { username } });
    if (error) throw new AuthError(500, 'Akun gagal diperbarui. Coba lagi.');
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
    if (error || !data.user) throw new AuthError(500, 'Akun gagal dibuat. Coba lagi.');
    uid = data.user.id;
  }
  const { error: e2 } = await db.from('users').upsert({ id: uid, username }, { onConflict: 'id' });
  if (e2) throw new AuthError(500, 'Data pengguna gagal disimpan.');
  return { ...(await signIn(email, password)), username };
}

export async function loginStart(body: Record<string, unknown>, origin: string) {
  const username = normUsername(req(body.username));
  const password = req(body.password);
  if (!username || !password) throw new AuthError(400, 'Isi username dan password.');
  const p = await profileByUsername(username);
  if (!p) throw new AuthError(401, 'Username atau password salah.');
  const tokens = await signIn(p.email, password);
  await rateLimit(p.email, 'login');
  const code = await createOtp(p.email, 'login', seal(secret(), JSON.stringify(tokens)));
  await sendOtpEmail(p.email, code, 'login', username, origin);
  return { ok: true, sentTo: maskEmail(p.email) };
}

export async function loginVerify(body: Record<string, unknown>): Promise<Tokens & { username: string }> {
  const username = normUsername(req(body.username));
  const p = await profileByUsername(username);
  if (!p) throw new AuthError(400, 'Kode salah atau sudah kedaluwarsa.');
  const { payload } = await consumeOtp(p.email, 'login', req(body.code));
  if (!payload) throw new AuthError(400, 'Kode sudah kedaluwarsa. Login ulang.');
  const tokens = JSON.parse(unseal(secret(), payload)) as Tokens;
  // data pengguna tersimpan di tabel users setiap kali login
  await admin().from('users').upsert({ id: p.id, username }, { onConflict: 'id' });
  return { ...tokens, username };
}
