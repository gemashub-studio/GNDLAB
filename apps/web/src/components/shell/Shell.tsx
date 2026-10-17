'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { LogoMark, Wordmark } from './Logo';
import { ProfileMenu } from '@/components/auth/ProfileMenu';
import { HomeDriftBg } from '@/components/home/HomeDriftBg';
import { useAuth } from '@/lib/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Tampil langsung di bilah atas pada layar lebar (selain di menu ☰). */
  quick?: boolean;
}

/** Menu dikelompokkan supaya mudah dipindai di HP maupun laptop. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Kalkulator',
    items: [
      { href: '/', label: 'Ringkasan', icon: 'home', quick: true },
      { href: '/proses', label: 'Alur Proses', icon: 'process' },
      { href: '/muat', label: 'Muat Container', icon: 'container', quick: true },
      { href: '/gudang', label: 'Gudang', icon: 'warehouse', quick: true },
      { href: '/konversi', label: 'Konversi', icon: 'convert' },
      { href: '/simulator', label: 'Simulator', icon: 'cube' },
      { href: '/skenario', label: 'Skenario', icon: 'saved' },
    ],
  },
  {
    title: 'Produksi',
    items: [
      { href: '/rantai', label: 'Rantai Produksi', icon: 'chain' },
      { href: '/produksi', label: 'Produksi per Shift', icon: 'clock' },
      { href: '/ceklis', label: 'Ceklis', icon: 'check' },
      { href: '/formula', label: 'Formula R&D', icon: 'flask' },
    ],
  },
  {
    title: 'Riset & data',
    items: [
      { href: '/lab', label: 'GnD Lab', icon: 'lab', quick: true },
      { href: '/sampling', label: 'Sampling', icon: 'scale' },
      { href: '/data', label: 'Data & Sumber', icon: 'data' },
      { href: '/panduan', label: 'Panduan', icon: 'help' },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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

/** Jumlah pencatatan data yang belum lengkap (untuk menu GnD Lab berkedip neon, DEC-087). */
function usePendingCatat(path: string): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void import('@/lib/pencatatan')
        .then((m) => m.listCatat())
        .then((rs) => alive && setN(rs.filter((r) => !r.finishedAt).length))
        .catch(() => undefined);
    load();
    window.addEventListener('gemas-catat-changed', load);
    return () => {
      alive = false;
      window.removeEventListener('gemas-catat-changed', load);
    };
  }, [path]);
  return n;
}

export function Shell({ children, datasetVersion, profile }: { children: ReactNode; datasetVersion: string; profile: string }) {
  const path = usePathname() ?? '/';
  const pendingCatat = usePendingCatat(path);
  const signedIn = !!useAuth().email;
  const neon = (href: string) => (href === '/lab' && pendingCatat > 0 ? ' neon-blink' : '');
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // Tutup saat pindah halaman.
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current !== path) setOpen(false);
    lastPath.current = path;
  }, [path]);

  // Saat menu terbuka: kunci gulir halaman, Esc menutup, fokus ke tombol tutup; saat ditutup fokus kembali ke ☰.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      burger.current?.focus();
    };
  }, [open]);

  const current = NAV.find((n) => isActive(path, n.href));

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-acid focus:p-3 focus:font-bold">
        Lompat ke konten
      </a>

      {/* Bilah atas — sama di HP & laptop: logo kiri, menu ☰ pojok kanan atas */}
      <header className="sticky top-0 z-40 border-b border-line-ink bg-ink text-paper print:hidden" data-testid="topbar">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline" aria-label="gemasSTUDIO — beranda">
            <span className="hidden sm:inline-flex">
              <LogoMark size={36} />
            </span>
            <Wordmark className="text-xl" />
          </Link>
          {current && current.href !== '/' && (
            <span className="hidden truncate font-mono text-xs text-muted-ink md:inline">/ {current.label}</span>
          )}

          <nav aria-label="Pintasan" className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.filter((n) => n.quick).map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold no-underline transition ${active ? 'bg-acid text-ink' : 'text-paper hover:bg-line-ink'}${neon(n.href)}`}
                  {...(neon(n.href) && { title: `${pendingCatat} pencatatan data belum lengkap`, 'data-pending': pendingCatat })}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <span
            className={`ml-auto hidden rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold sm:inline lg:ml-2 ${online ? 'border-acid text-acid' : 'border-safety text-safety'}`}
            data-testid="online-pill"
          >
            {online ? 'ONLINE' : 'OFFLINE'} · v{datasetVersion}
          </span>

          <ProfileMenu />

          <button
            ref={burger}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
            aria-expanded={open}
            aria-controls="menu-utama"
            className={`relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line-ink text-paper transition hover:border-acid hover:text-acid sm:ml-0 ${signedIn ? 'ml-2' : 'ml-auto'}`}
            data-testid="menu-open"
          >
            <Icon.menu />
            {pendingCatat > 0 && <span className="neon-dot absolute -right-1 -top-1 h-3 w-3 rounded-full bg-acid lg:hidden" aria-hidden />}
          </button>
        </div>
      </header>

      {!online && (
        <div role="status" className="border-b border-ink bg-safety px-4 py-2 text-center text-sm font-extrabold uppercase">
          Lagi offline — kalkulator tetap jalan (data v{datasetVersion}). Simpan dulu di perangkat, nanti dikirim.
        </div>
      )}

      {/* Laci menu (kanan) */}
      <div className={`fixed inset-0 z-50 print:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-ink/60 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <nav
          id="menu-utama"
          aria-label="Navigasi utama"
          {...(!open && { inert: true })}
          className={`absolute inset-y-0 right-0 flex w-full max-w-[360px] flex-col bg-ink text-paper shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
          data-testid="menu-drawer"
        >
          <div className="flex h-16 flex-none items-center justify-between border-b border-line-ink px-5">
            <span className="flex items-center gap-2.5">
              <LogoMark size={32} />
              <Wordmark className="text-lg" />
            </span>
            <button
              ref={closeBtn}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line-ink hover:border-acid hover:text-acid"
              data-testid="menu-close"
            >
              <Icon.close />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {NAV_GROUPS.map((g) => (
              <section key={g.title} className="mb-4">
                <h2 className="mb-1.5 px-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-ink">{g.title}</h2>
                <ul className="flex flex-col gap-1">
                  {g.items.map((n) => {
                    const active = isActive(path, n.href);
                    const IconC = Icon[n.icon];
                    return (
                      <li key={n.href}>
                        <Link
                          href={n.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex min-h-touch items-center gap-3 rounded-xl px-3 text-[15px] no-underline transition ${
                            active ? 'bg-acid font-bold text-ink' : 'font-semibold text-paper hover:bg-line-ink'
                          }${neon(n.href)}`}
                          data-testid={`nav-${n.href.replace(/\W/g, '') || 'home'}`}
                        >
                          <IconC />
                          <span className="flex-1">{n.label}</span>
                          {neon(n.href) && <span className="rounded-full bg-acid px-2 py-0.5 font-mono text-[10px] font-bold text-ink">{pendingCatat} belum lengkap</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          <div className="flex-none border-t border-line-ink px-5 py-4 font-mono text-xs">
            <span className="text-muted-ink">DATASET </span>
            <span className="font-bold">v{datasetVersion}</span>
            <span className="block text-muted-ink">{profile}</span>
            <span className={`mt-1 block font-bold ${online ? 'text-acid' : 'text-safety'}`}>{online ? '● ONLINE' : '● OFFLINE'}</span>
          </div>
        </nav>
      </div>

      <main id="konten" className="min-w-0 flex-1 px-4 pb-14 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <div className="relative isolate mx-auto flex max-w-[1180px] flex-col gap-7">
          {/* latar animasi DriftWall seperti Ringkasan di semua halaman, kecuali Ringkasan (punya sendiri) & GnD Lab (DEC-096) */}
          {path !== '/' && path !== '/lab' && <HomeDriftBg page />}
          {children}
        </div>
      </main>
    </div>
  );
}
