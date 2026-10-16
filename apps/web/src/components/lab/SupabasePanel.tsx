'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '@/lib/supabase';
import { onSyncStatus, sendLoginLink, signOut, syncNow, type SyncStatus } from '@/lib/supabaseSync';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '–');

/**
 * Panel Supabase di tab Ringkasan (DEC-085): masuk lewat email link, status sinkron otomatis, sinkron sekarang, keluar.
 * Sinkron otomatisnya sendiri dijalankan LabPage (startAutoSync) selama halaman lab terbuka.
 */
export function SupabasePanel() {
  const [s, setS] = useState<SyncStatus>({ phase: 'off' });
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => onSyncStatus(setS), []);

  if (!supabaseConfigured())
    return (
      <p className="text-sm text-muted" data-testid="sb-panel" data-phase="off">
        Sinkron Supabase belum diatur di perangkat/versi ini — data tetap tersimpan di perangkat.
      </p>
    );

  const dot = s.phase === 'idle' ? 'bg-acid' : s.phase === 'syncing' ? 'bg-acid animate-pulse' : s.phase === 'error' || s.phase === 'not-member' ? 'bg-safety' : 'bg-paper-grid';
  return (
    <div className="flex flex-col gap-3" data-testid="sb-panel" data-phase={s.phase}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        <h3 className="font-display text-base font-semibold">Sinkron online (Supabase)</h3>
      </div>

      {s.phase === 'signed-out' || s.phase === 'off' ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Tulis alamat email yang benar.');
            setBusy(true);
            setErr('');
            void sendLoginLink(email)
              .then(() => setSent(email.trim().toLowerCase()))
              .catch((x: Error) => setErr(x.message))
              .finally(() => setBusy(false));
          }}
        >
          <p className="text-sm text-muted">Masuk dengan email anggota lab. Data di HP & laptop akan sama otomatis; foto/video ikut tersimpan online.</p>
          {sent ? (
            <p className="rounded-xl bg-paper p-3 text-sm" role="status" data-testid="sb-sent">
              Link masuk dikirim ke <strong>{sent}</strong>. Buka email itu <strong>di perangkat ini</strong>, lalu klik tautannya — kamu akan kembali ke GnD Lab dalam keadaan masuk.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input type="email" required autoComplete="email" inputMode="email" className="field min-h-[44px] min-w-0 flex-1 bg-white text-sm" placeholder="email@contoh.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" data-testid="sb-email" />
              <button type="submit" className="btn-primary" disabled={busy} data-testid="sb-send">{busy ? 'Mengirim…' : 'Kirim link masuk'}</button>
            </div>
          )}
          {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
        </form>
      ) : s.phase === 'not-member' ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Email <strong>{s.email}</strong> belum terdaftar sebagai anggota GnD Lab, jadi data tidak dibuka. Minta pemilik menambahkannya (Supabase → SQL Editor:{' '}
            <code className="font-mono text-xs">insert into lab_members (email) values (&apos;{s.email}&apos;);</code>).
          </p>
          <button type="button" className="btn-ghost self-start" onClick={() => void signOut()}>Keluar</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Masuk sebagai <strong data-testid="sb-email-on">{s.email}</strong> · sinkron otomatis aktif · terakhir {fmt(s.last)}
          </p>
          {s.message && (
            <p className={s.phase === 'error' ? '' : 'text-muted'} role={s.phase === 'error' ? 'alert' : 'status'} data-testid="sb-msg">
              {s.phase === 'error' ? <span className="bg-safety px-1">{s.message}</span> : s.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={s.phase === 'syncing'} onClick={() => void syncNow().catch(() => undefined)} data-testid="sb-sync">
              {s.phase === 'syncing' ? 'Menyinkronkan…' : 'Sinkron sekarang'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => void signOut()} data-testid="sb-out">Keluar</button>
          </div>
        </div>
      )}
    </div>
  );
}
