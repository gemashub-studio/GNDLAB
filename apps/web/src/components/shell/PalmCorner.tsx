'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';

/** Rasio & garis tanah gambar pohon (palm-wind.js: kanvas 818×1014, tanah di y 979,44). */
const PALM_W = 818;
const PALM_H = 1014;
const GROUND = 979.44;
/** Bawah ikon kelapa asisten suara: `bottom-5` = 20 px dari bawah layar. */
const FAB_BOTTOM = 20;
/** Lama pohon tampil penuh setelah disorot / diklik. */
export const PALM_SHOW_MS = 10_000;
/** Bagian pohon yang disembunyikan di luar sisi kiri layar saat diam. */
const HIDE_PCT = 58;
/** Lebar area pemicu di tepi kiri layar saat bersembunyi (agar tidak menutupi isi halaman). */
const HIT_DESKTOP = 64;
const HIT_PONSEL = 22;

declare global {
  interface Window {
    PalmWind?: { mount: (c: HTMLCanvasElement) => void };
  }
}

/**
 * Pohon kelapa tertiup angin (WebGL, paket owner di public/assets/palm, DEC-129) di pojok kiri bawah layar.
 * Garis tanah pohon sejajar dengan bawah ikon kelapa. Bawaan: bersembunyi di sisi kiri, hanya sebagian yang tampak;
 * disorot kursor / diklik / difokus → muncul penuh selama 10 detik lalu kembali bersembunyi. Saat bersembunyi hanya strip tipis
 * di tepi kiri (setinggi mahkota daun) yang menangkap kursor/ketukan, supaya bagian pohon yang mengintip tidak menghalangi isi.
 */
export function PalmCorner() {
  const wide = useMediaQuery('(min-width: 640px)');
  const width = wide ? 360 : 190;
  const height = (width * PALM_H) / PALM_W;
  const bottom = FAB_BOTTOM - ((PALM_H - GROUND) / PALM_H) * height;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const show = useCallback(() => {
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), PALM_SHOW_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Pohon kelapa — tampilkan"
      aria-expanded={open}
      onMouseEnter={show}
      onClick={show}
      onFocus={show}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), show())}
      className="fixed left-0 z-40 cursor-pointer outline-none transition-transform duration-700 ease-out focus-visible:ring-2 focus-visible:ring-acid print:hidden"
      style={{ bottom, width, height, transform: `translateX(${open ? 0 : -HIDE_PCT}%)`, pointerEvents: open ? 'auto' : 'none' }}
      data-testid="palm-corner"
      data-open={open ? '1' : '0'}
    >
      <canvas ref={canvas} className="palm-wind" data-src="/assets/palm/" style={{ width: '100%', height: 'auto', display: 'block' }} />
      {!open && <span aria-hidden className="absolute top-[8%] h-[62%]" style={{ left: `${HIDE_PCT}%`, width: wide ? HIT_DESKTOP : HIT_PONSEL, pointerEvents: 'auto' }} data-testid="palm-hit" />}
    </div>
  );
}
