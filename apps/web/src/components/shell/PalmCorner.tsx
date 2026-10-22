'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';

/** Ukuran gambar pohon (palm-wind.js: kanvas 818×1014). */
const PALM_W = 818;
const PALM_H = 1014;
/** Pangkal batang di gambar: baris terbawah yang tak transparan (y 978) & tepi kiri pangkal (x ≈ 231). */
const BASE_X = 231 / PALM_W;
const BASE_Y = 978 / PALM_H;
/** Lama pohon tampil penuh setelah disorot / diklik. */
export const PALM_SHOW_MS = 10_000;
/** Saat bersembunyi pohon condong ke kiri (berporos di pangkal batang) sehingga mahkotanya keluar layar. */
const HIDE_DEG = -25;
/** Area pemicu tetap di tepi kiri bawah saat bersembunyi (tidak ikut berputar, tidak menutupi isi halaman). */
const HIT = { desktop: { w: 64, h: 360 }, ponsel: { w: 22, h: 190 } };

declare global {
  interface Window {
    PalmWind?: { mount: (c: HTMLCanvasElement) => void };
  }
}

/**
 * Pohon kelapa tertiup angin (WebGL, paket owner di public/assets/palm, DEC-129 → DEC-130) di pojok kiri bawah layar.
 * Pangkal batang selalu menempel di pojok kiri bawah layar — saat bersembunyi maupun muncul. Bawaan: pohon condong ke
 * kiri (mahkota sebagian keluar layar); disorot / diklik / difokus → tegak penuh selama 10 detik lalu condong lagi.
 */
export function PalmCorner() {
  const wide = useMediaQuery('(min-width: 640px)');
  const width = wide ? 360 : 190;
  const height = (width * PALM_H) / PALM_W;
  const hit = wide ? HIT.desktop : HIT.ponsel;
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

  const handlers = {
    onMouseEnter: show,
    onClick: show,
    onFocus: show,
    onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), show()),
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Pohon kelapa — tampilkan"
        aria-expanded={open}
        {...handlers}
        className="fixed left-0 z-40 cursor-pointer outline-none transition-transform duration-700 ease-out focus-visible:ring-2 focus-visible:ring-acid print:hidden"
        style={{
          width,
          height,
          // pangkal batang tepat di pojok kiri bawah layar
          bottom: -(1 - BASE_Y) * height,
          transformOrigin: `${BASE_X * 100}% ${BASE_Y * 100}%`,
          transform: `translateX(${-BASE_X * 100}%) rotate(${open ? 0 : HIDE_DEG}deg)`,
          pointerEvents: open ? 'auto' : 'none',
        }}
        data-testid="palm-corner"
        data-open={open ? '1' : '0'}
      >
        <canvas ref={canvas} className="palm-wind" data-src="/assets/palm/" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      {!open && <span aria-hidden className="fixed bottom-0 left-0 z-40 cursor-pointer print:hidden" style={{ width: hit.w, height: hit.h }} onMouseEnter={show} onClick={show} data-testid="palm-hit" />}
    </>
  );
}
