'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type Mode = 'login' | 'register';
interface Pending {
  mode: Mode;
  username: string;
  email: string;
  password: string;
  sentTo: string;
  at: number;
}

async function call(action: string, body: Record<string, string>): Promise<{ ok: boolean; error?: string; sentTo?: string; access_token?: string; refresh_token?: string }> {
  const res = await fetch(`/api/lab-auth/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: !!j.ok && res.ok, ...j, error: j.error ?? (res.ok ? undefined : `Gagal (${res.status}).`) };
}

/**
 * Kartu login/daftar bolak-balik (UI dari Uiverse oleh andrew-demchenk0, disesuaikan, DEC-090).
 * Login: username + password → kode OTP 6 digit ke email. Daftar: username + email + password → kode OTP.
 */
export function AuthCard({ onDone, testId = 'auth' }: { onDone?: () => void; testId?: string }) {
  const [mode, setMode] = useState<Mode>('login');
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending]);

  const start = async (p: Omit<Pending, 'sentTo' | 'at'>) => {
    setBusy(true);
    setErr('');
    const r = await call(p.mode === 'login' ? 'login-start' : 'register-start', p.mode === 'login' ? { username: p.username, password: p.password } : { username: p.username, email: p.email, password: p.password }).catch(() => ({ ok: false, error: 'Tidak bisa menghubungi server.' }) as const);
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? 'Gagal.');
    setPending({ ...p, sentTo: ('sentTo' in r && r.sentTo) || p.email, at: Date.now() });
  };

  const verify = async (code: string) => {
    if (!pending) return;
    setBusy(true);
    setErr('');
    const r = await call(pending.mode === 'login' ? 'login-verify' : 'register-verify', pending.mode === 'login' ? { username: pending.username, code } : { username: pending.username, email: pending.email, password: pending.password, code }).catch(() => ({ ok: false, error: 'Tidak bisa menghubungi server.' }) as const);
    if (!r.ok || !('access_token' in r) || !r.access_token || !r.refresh_token) {
      setBusy(false);
      return setErr(r.error ?? 'Verifikasi gagal.');
    }
    const { error } = (await getSupabase()?.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token })) ?? { error: new Error('Supabase belum diatur') };
    setBusy(false);
    if (error) return setErr('Sesi gagal disimpan di browser ini. Coba lagi.');
    onDone?.();
  };

  const flipped = mode === 'register';
  return (
    <div className="gnd-auth" data-testid={testId}>
      <div className="gnd-auth__switch" role="tablist" aria-label="Pilih masuk atau daftar">
        <button type="button" role="tab" aria-selected={!flipped} className={`gnd-auth__tab ${!flipped ? 'is-on' : ''}`} onClick={() => !pending && setMode('login')} data-testid={`${testId}-tab-login`}>Log in</button>
        <button type="button" role="switch" aria-checked={flipped} aria-label="Ganti ke daftar" className={`gnd-auth__slider ${flipped ? 'is-on' : ''}`} onClick={() => !pending && setMode(flipped ? 'login' : 'register')} />
        <button type="button" role="tab" aria-selected={flipped} className={`gnd-auth__tab ${flipped ? 'is-on' : ''}`} onClick={() => !pending && setMode('register')} data-testid={`${testId}-tab-register`}>Sign up</button>
      </div>
      <div className={`gnd-auth__inner ${flipped ? 'is-flipped' : ''}`}>
        <div className="gnd-auth__face gnd-auth__front" {...(flipped && { inert: true })} aria-hidden={flipped}>
          {pending?.mode === 'login' ? (
            <OtpForm pending={pending} busy={busy} err={err} now={now} onVerify={verify} onResend={() => void start(pending)} onBack={() => setPending(undefined)} testId={`${testId}-otp`} />
          ) : (
            <form
              className="gnd-auth__form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void start({ mode: 'login', username: String(f.get('username') ?? '').trim().toLowerCase(), email: '', password: String(f.get('password') ?? '') });
              }}
            >
              <div className="gnd-auth__title">Log in</div>
              <input className="gnd-auth__input" name="username" placeholder="Username" autoComplete="username" autoCapitalize="none" required data-testid={`${testId}-login-username`} />
              <input className="gnd-auth__input" name="password" placeholder="Password" type="password" autoComplete="current-password" required data-testid={`${testId}-login-password`} />
              {!flipped && err && <p className="gnd-auth__err" role="alert">{err}</p>}
              <button className="gnd-auth__btn" disabled={busy} data-testid={`${testId}-login-submit`}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
            </form>
          )}
        </div>
        <div className="gnd-auth__face gnd-auth__back" {...(!flipped && { inert: true })} aria-hidden={!flipped}>
          {pending?.mode === 'register' ? (
            <OtpForm pending={pending} busy={busy} err={err} now={now} onVerify={verify} onResend={() => void start(pending)} onBack={() => setPending(undefined)} testId={`${testId}-otp`} />
          ) : (
            <form
              className="gnd-auth__form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void start({ mode: 'register', username: String(f.get('username') ?? '').trim().toLowerCase(), email: String(f.get('email') ?? '').trim().toLowerCase(), password: String(f.get('password') ?? '') });
              }}
            >
              <div className="gnd-auth__title">Sign up</div>
              <input className="gnd-auth__input" name="username" placeholder="Username" autoComplete="username" autoCapitalize="none" minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,29}" title="3–30 karakter: huruf, angka, titik, garis bawah, minus" required data-testid={`${testId}-reg-username`} />
              <input className="gnd-auth__input" name="email" placeholder="Email" type="email" autoComplete="email" required data-testid={`${testId}-reg-email`} />
              <input className="gnd-auth__input" name="password" placeholder="Password (min. 8, huruf+angka)" type="password" autoComplete="new-password" minLength={8} required data-testid={`${testId}-reg-password`} />
              {flipped && err && <p className="gnd-auth__err" role="alert">{err}</p>}
              <button className="gnd-auth__btn" disabled={busy} data-testid={`${testId}-reg-submit`}>{busy ? 'Mengirim…' : 'Daftar'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function OtpForm({ pending, busy, err, now, onVerify, onResend, onBack, testId }: { pending: Pending; busy: boolean; err: string; now: number; onVerify: (code: string) => void; onResend: () => void; onBack: () => void; testId: string }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => refs.current[0]?.focus(), []);
  const wait = Math.max(0, 60 - Math.floor((now - pending.at) / 1000));
  const code = digits.join('');
  const setAt = (i: number, v: string) => {
    const only = v.replace(/\D/g, '');
    if (only.length > 1) {
      // tempel 6 digit sekaligus
      const next = only.slice(0, 6).padEnd(6, ' ').split('').map((c) => c.trim());
      setDigits(next);
      refs.current[Math.min(5, only.length)]?.focus();
      if (only.length >= 6) onVerify(only.slice(0, 6));
      return;
    }
    const next = digits.map((d, j) => (j === i ? only : d));
    setDigits(next);
    if (only && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && only) onVerify(next.join(''));
  };
  return (
    <form
      className="gnd-auth__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onVerify(code);
      }}
      data-testid={testId}
    >
      <div className="gnd-auth__title">Kode verifikasi</div>
      <p className="gnd-auth__hint">Kode 6 digit dikirim ke <strong>{pending.sentTo}</strong>. Cek kotak masuk / spam.</p>
      <div className="gnd-auth__otp" role="group" aria-label="Kode 6 digit">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="gnd-auth__digit"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? 6 : 1}
            value={d}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && refs.current[i - 1]?.focus()}
            data-testid={`${testId}-d${i}`}
          />
        ))}
      </div>
      {err && <p className="gnd-auth__err" role="alert">{err}</p>}
      <button className="gnd-auth__btn" disabled={busy || code.length < 6} data-testid={`${testId}-submit`}>{busy ? 'Memeriksa…' : 'Verifikasi'}</button>
      <div className="gnd-auth__links">
        <button type="button" onClick={onBack} disabled={busy}>Kembali</button>
        <button type="button" onClick={onResend} disabled={busy || wait > 0}>{wait > 0 ? `Kirim ulang (${wait})` : 'Kirim ulang kode'}</button>
      </div>
    </form>
  );
}
