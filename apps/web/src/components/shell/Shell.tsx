'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { LogoMark, Wordmark } from './Logo';

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: IconName;
  mobile?: boolean;
  soon?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Ringkasan', short: 'Beranda', icon: 'home', mobile: true },
  { href: '/proses', label: 'Alur Proses', short: 'Proses', icon: 'process', mobile: true },
  { href: '/muat', label: 'Muat Container', short: 'Muat', icon: 'container', mobile: true },
  { href: '/gudang', label: 'Gudang', short: 'Gudang', icon: 'warehouse', mobile: true },
  { href: '/simulator', label: 'Simulator', short: 'Simulasi', icon: 'cube' },
  { href: '/konversi', label: 'Konversi', short: 'Konversi', icon: 'convert' },
  { href: '/skenario', label: 'Skenario', short: 'Simpan', icon: 'saved' },
  { href: '/sampling', label: 'Sampling', short: 'Sampling', icon: 'scale' },
  { href: '/data', label: 'Data & Sumber', short: 'Data', icon: 'data' },
  { href: '/panduan', label: 'Panduan', short: 'Panduan', icon: 'help', mobile: true },
  { href: '/lab', label: 'R&D Lab', short: 'Lab', icon: 'lab', soon: true },
];

const isActive = (path: string, href: string) =>
  href === '/' ? path === '/' : path.startsWith(href) || (href === '/sampling' && path.startsWith('/kalibrasi'));

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function Shell({ children, datasetVersion, profile }: { children: ReactNode; datasetVersion: string; profile: string }) {
  const path = usePathname() ?? '/';
  const online = useOnline();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-acid focus:p-3 focus:font-bold">
        Lompat ke konten
      </a>

      {/* Sidebar desktop (mockup Main) */}
      <nav
        aria-label="Navigasi utama"
        className="hidden w-[260px] flex-none flex-col gap-7 border-r-4 border-ink bg-ink px-5 py-7 text-paper lg:flex"
      >
        <Link href="/" className="flex flex-col gap-2.5 no-underline">
          <span className="flex items-center gap-2.5">
            <LogoMark />
            <Wordmark />
          </span>
          <span className="-rotate-2 self-start bg-safety px-2 py-1 font-mono text-[11px] font-bold tracking-[0.12em] text-ink">
            COCO LAB · EST. 2026
          </span>
        </Link>
        <ul className="flex flex-col gap-1.5">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            const IconC = Icon[n.icon];
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-touch items-center gap-2.5 border-2 px-3 text-sm uppercase tracking-[0.04em] no-underline ${
                    active ? 'border-acid bg-acid font-extrabold text-ink' : 'border-line-ink font-bold text-paper hover:border-acid'
                  }`}
                >
                  <IconC />
                  <span className="flex-1">{n.label}</span>
                  {n.soon && <span className="font-mono text-[10px] text-muted-ink">M5</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-1.5 border-2 border-dashed border-acid p-3.5 font-mono text-xs">
          <span className="font-bold tracking-[0.1em] text-acid">DATASET</span>
          <span className="text-xl font-bold">v{datasetVersion}</span>
          <span className="text-muted-ink">{profile}</span>
          <span className={`mt-1 font-bold ${online ? 'text-acid' : 'text-safety'}`}>{online ? '● ONLINE' : '● OFFLINE'}</span>
        </div>
      </nav>

      {/* Header HP (mockup Mobile) */}
      <header className="flex items-center justify-between gap-2.5 bg-ink px-4 py-4 text-paper lg:hidden">
        <Link href="/" className="no-underline">
          <Wordmark className="text-xl" />
        </Link>
        <span
          className={`border-2 px-1.5 py-0.5 font-mono text-[11px] font-bold ${online ? 'border-acid text-acid' : 'border-safety text-safety'}`}
        >
          {online ? 'ONLINE' : 'OFFLINE'} · v{datasetVersion}
        </span>
      </header>

      {!online && (
        <div role="status" className="border-b-3 border-ink bg-safety px-4 py-2 text-center text-sm font-extrabold uppercase lg:hidden">
          Lagi offline — kalkulator tetap jalan (data v{datasetVersion}). Simpan dulu di HP, nanti dikirim.
        </div>
      )}

      <main id="konten" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-7">{children}</div>
      </main>

      {/* Menu bawah HP */}
      <nav
        aria-label="Menu bawah"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-3 border-ink bg-surface lg:hidden"
      >
        {NAV.filter((n) => n.mobile).map((n) => {
          const active = isActive(path, n.href);
          const IconC = Icon[n.icon];
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 font-mono text-[10px] font-bold uppercase no-underline ${
                active ? 'bg-acid' : ''
              }`}
            >
              <IconC />
              {n.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
