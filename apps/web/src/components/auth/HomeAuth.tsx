'use client';

import Link from 'next/link';
import { needsLogin, useAuth } from '@/lib/useAuth';
import { LoginButton } from './LoginDialog';

/** "Selamat Datang <username>" di atas judul Ringkasan Kapasitas (DEC-087). */
export function HomeWelcome() {
  const a = useAuth();
  if (!a.username) return null;
  return (
    <p className="font-display text-lg font-semibold sm:text-xl" data-testid="home-welcome">
      Selamat Datang <span className="text-[#1FA88F]">{a.username}</span>
    </p>
  );
}

/** Belum login → tombol Login menggantikan "Hitung gudang" & "Rencana muat"; sesudah login keduanya muncul lagi. */
export function HomeCtas() {
  const a = useAuth();
  if (!a.ready) return <div className="h-11 w-56" aria-hidden />;
  if (needsLogin(a)) return <LoginButton className="btn-primary shadow-[5px_5px_0_#0E1A1F]" label="Login" testId="home-login" />;
  return (
    <>
      <Link href="/gudang" className="btn-ghost no-underline">
        Hitung gudang
      </Link>
      <Link href="/muat?wizard=1" className="btn-primary no-underline shadow-[5px_5px_0_#0E1A1F]" data-testid="cta-plan">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Rencana muat
      </Link>
    </>
  );
}
