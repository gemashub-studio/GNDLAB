/**
 * Koneksi Supabase (DEC-084). Nilai dibaca dari env Vercel `PROJECT_URL` & `ANON_KEY_SUPABASE` yang dipetakan
 * ke NEXT_PUBLIC_* di next.config.ts (anon key memang publik; keamanan data lewat RLS + login).
 * Kata sandi database TIDAK pernah dipakai aplikasi.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export type SupabaseHealth = 'off' | 'ok' | 'error';

/** Cek koneksi ke layanan Auth Supabase (tidak membaca/menulis data). */
export async function supabaseHealth(timeoutMs = 8000): Promise<SupabaseHealth> {
  if (!supabaseConfigured()) return 'off';
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, signal: ctl.signal, cache: 'no-store' });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  } finally {
    clearTimeout(t);
  }
}
