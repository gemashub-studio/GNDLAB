'use client';

import { useEffect, useState } from 'react';
import { getSupabase, supabaseConfigured } from './supabase';

/** Username: dari pendaftaran (user_metadata.username, DEC-090); cadangan untuk akun lama = slug email (bagian sebelum @), mis. "Budi.Santoso+lab@x.com" → "budi-santoso-lab". */
export function emailSlug(email: string): string {
  return (email.split('@')[0] ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pengguna';
}

export interface AuthState {
  /** false = Supabase belum diatur (mode offline: semua terbuka seperti sebelumnya). */
  configured: boolean;
  /** Sesi sudah dibaca dari penyimpanan browser. */
  ready: boolean;
  email?: string;
  username?: string;
  lastSignIn?: string;
  createdAt?: string;
}

/** Status login Supabase (DEC-087). Dipakai header, beranda, dan GnD Lab. */
export function useAuth(): AuthState {
  const [st, setSt] = useState<AuthState>({ configured: supabaseConfigured(), ready: !supabaseConfigured() });
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return setSt({ configured: false, ready: true });
    const apply = (u?: { email?: string; last_sign_in_at?: string; created_at?: string; user_metadata?: { username?: unknown } } | null) =>
      setSt({ configured: true, ready: true, ...(u?.email && { email: u.email, username: typeof u.user_metadata?.username === 'string' && u.user_metadata.username ? u.user_metadata.username : emailSlug(u.email), ...(u.last_sign_in_at && { lastSignIn: u.last_sign_in_at }), ...(u.created_at && { createdAt: u.created_at }) }) });
    void sb.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data } = sb.auth.onAuthStateChange((_e, s) => apply(s?.user));
    return () => data.subscription.unsubscribe();
  }, []);
  return st;
}

/** Perlu login? (hanya bila Supabase diatur dan belum masuk). */
export const needsLogin = (a: AuthState) => a.configured && a.ready && !a.email;
