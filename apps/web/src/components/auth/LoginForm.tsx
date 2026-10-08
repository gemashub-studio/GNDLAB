'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await signIn('email', { email, callbackUrl });
        setBusy(false);
      }}
    >
      <label htmlFor="email" className="label-mono">Email</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="field font-sans text-base"
        placeholder="nama@perusahaan.com"
      />
      <button type="submit" className="btn-primary self-start" disabled={busy}>
        {busy ? 'Mengirim…' : 'Kirim tautan masuk'}
      </button>
    </form>
  );
}
