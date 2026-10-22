'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';

/** Ukuran gambar pohon (palm-wind.js: kanvas 818×1014). */
const PALM_W = 818;
const PALM_H = 1014;
/** Pangkal batang di gambar: baris terbawah yang tak transparan (y 978) & tepi kiri pangkal (x ≈ 231). */
const BASE_X = 231 / PALM_W;
const BASE_Y = 978 / PALM_H;
/** Lama pohon tampil penuh setelah disorot / diklik (DEC-131: 20 detik). */
export const PALM_SHOW_MS = 20_000;
/** Saat bersembunyi pohon tetap tegak, digeser ke kiri sehingga hanya sebagian mahkota yang mengintip. */
const HIDE_PCT = 60;
/** Jeda sebelum sorotan kursor boleh menutup lagi (hindari langsung tertutup saat baru muncul). */
const ARM_MS = 700;
/** Area pemicu tetap di tepi kiri bawah saat bersembunyi (tidak menutupi isi halaman). */
const HIT = { desktop: { w: 64, h: 400 }, ponsel: { w: 22, h: 210 } };

declare global {
  interface Window {
    PalmWind?: { mount: (c: HTMLCanvasElement) => void };
  }
}

/**
 * Pohon kelapa tertiup angin (WebGL, paket owner di public/assets/palm, DEC-129 → DEC-131) di pojok kiri bawah layar,
 * tampil di semua halaman (dipasang di Shell). Pohon selalu tegak & bawahnya rata tepi bawah layar; bayangan tanah hitam
 * di pojok hanya muncul saat pohon tampil. Bawaan: bersembunyi di sisi kiri (sebagian mahkota mengintip). Disorot / diklik → muncul penuh dengan
 * pangkal batang menempel di pojok kiri bawah selama 20 detik; disorot lagi (setelah kursor sempat keluar) / diklik lagi →
 * kembali bersembunyi.
 */
export function PalmCorner() {
  const wide = useMediaQuery('(min-width: 640px)');
  const width = wide ? 360 : 190;
  const height = (width * PALM_H) / PALM_W;
  const hit = wide ? HIT.desktop : HIT.ponsel;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // buka/tutup berikutnya hanya setelah ARM_MS sejak buka/tutup terakhir (sorot + klik beruntun tidak saling membatalkan);
  // tutup lewat sorotan hanya setelah kursor sempat keluar dari pohon
  const lastToggle = useRef(-Infinity);
  const leftTree = useRef(false);
  const ready = () => Date.now() - lastToggle.current >= ARM_MS;

  // muat palm-wind.js sekali; skripnya memasang semua canvas.palm-wind saat dimuat, kalau sudah ada → pasang manual
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    if (window.PalmWind) {
      window.PalmWind.mount(c);
      return;
    }
    if (document.querySelector('script[data-palm-wind]')) return;
    const s = document.createElement('script');
    s.src = '/assets/palm/palm-wind.js';
    s.defer = true;
    s.dataset.palmWind = '1';
    document.body.appendChild(s);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    lastToggle.current = Date.now();
    setOpen(false);
  }, []);
  const show = useCallback(() => {
    clearTimeout(timer.current);
    lastToggle.current = Date.now();
    leftTree.current = false;
    setOpen(true);
    timer.current = setTimeout(() => setOpen(false), PALM_SHOW_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      {/* bayangan tanah hitam di pojok kiri bawah — menutup celah putih di bawah pangkal pohon; hanya saat pohon muncul */}
      <span
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 z-40 transition-opacity duration-700 ease-out print:hidden"
        style={{ opacity: open ? 1 : 0, width: width * 0.95, height: height * 0.16, background: 'radial-gradient(ellipse at 0% 100%, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.7) 28%, rgba(10,8,6,0.32) 52%, rgba(10,8,6,0) 74%)' }}
        data-testid="palm-ground"
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={open ? 'Pohon kelapa — sembunyikan' : 'Pohon kelapa — tampilkan'}
        aria-expanded={open}
        onClick={() => ready() && (open ? hide() : show())}
        onMouseEnter={() => open && leftTree.current && ready() && hide()}
        onMouseLeave={() => (leftTree.current = true)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open ? hide() : show())}
        className="fixed left-0 z-40 cursor-pointer outline-none transition-transform duration-700 ease-out focus-visible:ring-2 focus-visible:ring-acid print:hidden"
        style={{
          width,
          height,
          // bawah pohon (pangkal batang) rata tepi bawah layar; tegak di kedua keadaan
          bottom: -(1 - BASE_Y) * height,
          transform: `translateX(${-(open ? BASE_X * 100 : HIDE_PCT)}%)`,
          pointerEvents: open ? 'auto' : 'none',
        }}
        data-testid="palm-corner"
        data-open={open ? '1' : '0'}
      >
        <canvas ref={canvas} className="palm-wind" data-src="/assets/palm/" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      {!open && <span aria-hidden className="fixed bottom-0 left-0 z-40 cursor-pointer print:hidden" style={{ width: hit.w, height: hit.h }} onMouseEnter={() => ready() && show()} onClick={() => ready() && show()} data-testid="palm-hit" />}
    </>
  );
}
