'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/supabaseSync';
import { useAuth } from '@/lib/useAuth';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '–');

/** Ikon profil di header (kiri tombol ☰) — klik → kartu kecil berisi data login (DEC-087). */
export function ProfileMenu() {
  const a = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!a.email) return null;
  const initial = (a.username ?? '?').slice(0, 1).toUpperCase();
  return (
    <div ref={wrap} className="relative ml-auto sm:ml-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Profil ${a.username}`}
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-acid/60 bg-acid/15 font-display text-base font-bold text-acid transition hover:bg-acid hover:text-ink"
        data-testid="profile-open"
      >
        {initial}
      </button>
      {open && (
        <div role="dialog" aria-label="Data login" className="alert-slide-in absolute right-0 top-[52px] z-50 w-72 rounded-2xl border border-line-ink bg-white p-4 text-ink shadow-2xl" data-testid="profile-card">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink font-display text-lg font-bold text-acid">{initial}</span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold" data-testid="profile-username">{a.username}</p>
              <p className="truncate text-xs text-muted">{a.email}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">Username</dt>
            <dd className="font-mono">{a.username}</dd>
            <dt className="text-muted">Masuk via</dt>
            <dd>Username + password + kode email</dd>
            <dt className="text-muted">Terakhir masuk</dt>
            <dd>{fmt(a.lastSignIn)}</dd>
            <dt className="text-muted">Akses GnD Lab</dt>
            <dd>data bersama (semua pengguna yang login)</dd>
          </dl>
          <button type="button" className="btn-ghost mt-3 w-full justify-center" onClick={() => void signOut().then(() => setOpen(false))} data-testid="profile-logout">
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}
