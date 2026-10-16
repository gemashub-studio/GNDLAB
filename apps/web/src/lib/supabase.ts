/**
 * Koneksi Supabase (DEC-084/085). Nilai dibaca dari env Vercel `PROJECT_URL` & `ANON_KEY_SUPABASE` yang dipetakan
 * ke NEXT_PUBLIC_* di next.config.ts (anon key memang publik; keamanan data lewat RLS + login email link).
 * Kata sandi database TIDAK pernah dipakai aplikasi.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

/** Klien tunggal (sesi login disimpan di browser ini); null bila env belum diatur atau di server. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured() || typeof window === 'undefined') return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'gemas-lab-auth' },
  });
  return client;
}

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
