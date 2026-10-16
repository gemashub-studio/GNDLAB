'use client';

import { useEffect, useState } from 'react';
import { SUPABASE_URL, supabaseHealth, type SupabaseHealth } from '@/lib/supabase';

const TEXT: Record<SupabaseHealth | 'checking', string> = {
  checking: 'memeriksa…',
  ok: 'terhubung',
  off: 'belum diatur (PROJECT_URL & ANON_KEY_SUPABASE)',
  error: 'gagal terhubung — cek URL/anon key atau koneksi internet',
};

/** Status koneksi Supabase (DEC-084). Data lab tetap tersimpan di perangkat sampai sinkron Supabase diaktifkan. */
export function SupabaseStatus() {
  const [h, setH] = useState<SupabaseHealth | 'checking'>('checking');
  useEffect(() => {
    void supabaseHealth().then(setH);
  }, []);
  const dot = h === 'ok' ? 'bg-acid' : h === 'checking' ? 'bg-paper-grid' : 'bg-safety';
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="supabase-status" data-state={h}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
      <span className="font-semibold">Supabase:</span> <span>{TEXT[h]}</span>
      {h === 'ok' && <span className="font-mono text-xs text-muted">{SUPABASE_URL.replace(/^https?:\/\//, '')}</span>}
    </p>
  );
}
