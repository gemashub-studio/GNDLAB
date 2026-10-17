'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthCard } from './AuthCard';

/** Login/daftar di halaman (GnD Lab & hasil yang terkunci): kartu username + password + kode email (DEC-090). */
export function LoginForm({ testId = 'login', note }: { testId?: string; note?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {note && <p className="self-stretch text-sm text-muted">{note}</p>}
      <AuthCard testId={testId} />
    </div>
  );
}

/** Tombol "Login" yang membuka jendela login/daftar. */
export function LoginButton({ className = 'btn-primary', label = 'Login', testId = 'login-open' }: { className?: string; label?: string; testId?: string }) {
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label="Login atau daftar" onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="login-dialog">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl bg-surface px-4 pb-7 pt-10 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper">✕</button>
        <AuthCard testId="login-form" onDone={onClose} />
      </div>
    </div>,
    document.body,
  );
}
