'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { CoconutMascot, MASCOT_RATIO } from './CoconutMascot';

/** Posisi tegak dok (jarak dari bawah layar, px) disimpan per perangkat. */
export const DOCK_KEY = 'gnd-va:dock-y';
export const DOCK_DEFAULT = 20;
/** Bagian badan yang bersembunyi di luar sisi kanan saat diam / saat disorot. */
const PEEK = '45%';
const PEEK_HOVER = '28%';
/** Jeda sebelum asisten mulai — memberi waktu maskot meluncur keluar (seperti pohon kelapa). */
export const DOCK_ACTIVATE_MS = 700;

export const clampDock = (b: number, h: number) => Math.round(Math.min(Math.max(b, 12), Math.max(12, (typeof window === 'undefined' ? 800 : window.innerHeight) - h - 72)));

export function readDockY(): number {
  try {
    const v = Number(localStorage.getItem(DOCK_KEY));
    return Number.isFinite(v) && v > 0 ? v : DOCK_DEFAULT;
  } catch {
    return DOCK_DEFAULT;
  }
}

/**
 * Dok maskot kelapa asisten suara (DEC-133) di sisi kanan layar: sebagian badan bersembunyi di luar layar; bisa diseret
 * naik-turun (atau ↑/↓ saat difokus) dan posisinya diingat; diklik → meluncur keluar penuh lalu asisten suara mulai.
 */
export function MascotDock({ bottom, onMove, onActivate, tip }: { bottom: number; onMove: (b: number) => void; onActivate: () => void; tip?: ReactNode }) {
  const wide = useMediaQuery('(min-width: 640px)');
  const h = wide ? 128 : 96;
  const w = Math.round(h * MASCOT_RATIO);
  const [out, setOut] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y0: number; b0: number; moved: boolean } | null>(null);

  const save = (b: number) => {
    try {
      localStorage.setItem(DOCK_KEY, String(b));
    } catch {
      // penyimpanan diblokir → posisi hanya untuk sesi ini
    }
  };
  const activate = () => {
    if (out) return;
    setOut(true);
    window.setTimeout(onActivate, DOCK_ACTIVATE_MS);
  };

  return (
    <div className="fixed right-0 z-[96] print:hidden" style={{ bottom }} data-testid="va-dock">
      {tip && (
        <div className="absolute bottom-full right-3 mb-1" style={{ width: 260 }}>
          <div className="flex justify-end">{tip}</div>
        </div>
      )}
      <button
        type="button"
        className={`coco-dock relative block cursor-grab rounded-l-full outline-none focus-visible:ring-2 focus-visible:ring-acid ${dragging ? 'coco-dock--drag' : ''}`}
        style={{ width: w, height: h, transform: `translateX(${out ? '0%' : PEEK})`, ['--dock-peek-hover' as string]: PEEK_HOVER }}
        aria-label="Mulai asisten suara (seret naik-turun untuk memindahkan)"
        title="Asisten suara — klik untuk mulai, seret untuk memindahkan"
        data-testid="va-fab"
        data-out={out ? '1' : '0'}
        onPointerDown={(e) => {
          drag.current = { y0: e.clientY, b0: bottom, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dy = e.clientY - d.y0;
          if (!d.moved && Math.abs(dy) > 5) {
            d.moved = true;
            setDragging(true);
          }
          if (d.moved) onMove(clampDock(d.b0 - dy, h));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          setDragging(false);
          if (d?.moved) save(bottom);
          else if (d) activate();
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        // klik dari keyboard (Enter/Spasi) tidak melewati pointer
        onClick={(e) => e.detail === 0 && activate()}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const b = clampDock(bottom + (e.key === 'ArrowUp' ? 32 : -32), h);
          onMove(b);
          save(b);
        }}
      >
        <CoconutMascot size={h} mood="idle" />
      </button>
    </div>
  );
}
