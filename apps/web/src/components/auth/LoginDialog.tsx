'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sendLoginLink } from '@/lib/supabaseSync';

/** Form masuk lewat email link (Supabase). `inline` = tampil di halaman, bukan jendela melayang. */
export function LoginForm({ testId = 'login', note }: { testId?: string; note?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Tulis alamat email yang benar.');
        setBusy(true);
        setErr('');
        void sendLoginLink(email, window.location.pathname)
          .then(() => setSent(email.trim().toLowerCase()))
          .catch((x: Error) => setErr(x.message))
          .finally(() => setBusy(false));
      }}
      data-testid={testId}
    >
      <p className="text-sm text-muted">{note ?? 'Masuk dengan email. Kami kirim link masuk — tanpa kata sandi.'}</p>
      {sent ? (
        <p className="rounded-xl bg-paper p-3 text-sm" role="status" data-testid={`${testId}-sent`}>
          Link masuk dikirim ke <strong>{sent}</strong>. Buka email itu <strong>di perangkat ini</strong> lalu klik tautannya.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input type="email" required autoComplete="email" inputMode="email" className="field min-h-[44px] min-w-0 flex-1 bg-white text-sm" placeholder="email@contoh.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" data-testid={`${testId}-email`} />
          <button type="submit" className="btn-primary" disabled={busy} data-testid={`${testId}-send`}>{busy ? 'Mengirim…' : 'Kirim link masuk'}</button>
        </div>
      )}
      {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
    </form>
  );
}

/** Tombol "Masuk" yang membuka jendela login. */
export function LoginButton({ className = 'btn-primary', label = 'Masuk / Login', testId = 'login-open' }: { className?: string; label?: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} data-testid={testId}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mr-1.5">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="M10 17l5-5-5-5M15 12H3" />
        </svg>
        {label}
      </button>
      {open && <LoginDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-labelledby="login-dialog-t" onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="login-dialog">
      <div ref={box} className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 id="login-dialog-t" className="font-display text-lg font-semibold">Masuk ke gemasSTUDIO</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper">✕</button>
        </div>
        <LoginForm testId="login-form" />
      </div>
    </div>,
    document.body,
  );
}
