'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const FINISH_WORD = 'Selesai';
/** Kata konfirmasi cocok (tanpa beda huruf besar/kecil & spasi di ujung). */
export const finishWordOk = (v: string) => v.trim().toLowerCase() === FINISH_WORD.toLowerCase();

/** Konfirmasi "Selesaikan" (DEC-098): pengguna harus mengetik kata Selesai; tombol OK & Kembali. */
export function FinishConfirm({ id, onOk, onBack }: { id: string; onOk: () => void; onBack: () => void }) {
  const [v, setV] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const ok = finishWordOk(v);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 px-4" role="dialog" aria-modal="true" aria-labelledby="finish-t" onClick={(e) => e.target === e.currentTarget && onBack()} data-testid="finish-confirm">
      <form
        className="sheet-up flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-surface p-5 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onOk();
        }}
      >
        <h2 id="finish-t" className="font-display text-lg font-semibold">Selesaikan pencatatan {id}?</h2>
        <p className="text-sm text-muted">Setelah diselesaikan, kartu berubah hijau dan catatan baru bisa dibuat. Ketik <b className="text-ink">{FINISH_WORD}</b> untuk melanjutkan.</p>
        <input ref={input} className="field min-h-[44px] bg-white" value={v} onChange={(e) => setV(e.target.value)} placeholder={FINISH_WORD} autoComplete="off" aria-label={`Ketik ${FINISH_WORD}`} data-testid="finish-input" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onBack} data-testid="finish-back">Kembali</button>
          <button type="submit" className="btn-primary" disabled={!ok} data-testid="finish-ok">OK</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

const COLORS = ['#63E6CF', '#1FA88F', '#F5A524', '#FF5D73', '#FFD84D', '#7C9CFF', '#FFFFFF'];

/** Alert sukses dengan animasi petasan meledak (kanvas, ±3,5 detik; dimatikan bila pengguna memilih kurangi gerak). */
export function FireworksAlert({ message, onClose }: { message: string; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
    type R = { x: number; y: number; vy: number; ty: number; color: string };
    const parts: P[] = [];
    const rockets: R[] = [];
    const burst = (x: number, y: number, color: string) => {
      const n = 70;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = (2 + Math.random() * 4.5) * dpr;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 50 + Math.random() * 30, color: Math.random() < 0.25 ? '#FFFFFF' : color, size: (1.5 + Math.random() * 2) * dpr });
      }
    };
    const launch = () => {
      const w = c.width;
      const h = c.height;
      rockets.push({ x: w * (0.15 + Math.random() * 0.7), y: h, vy: -(9 + Math.random() * 4) * dpr, ty: h * (0.15 + Math.random() * 0.35), color: COLORS[Math.floor(Math.random() * COLORS.length)]! });
    };
    // ledakan pertama langsung di tengah, lalu roket bergantian
    burst(c.width / 2, c.height * 0.3, COLORS[0]!);
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      if (frame < 160 && frame % 18 === 0) launch();
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'lighter';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]!;
        r.y += r.vy;
        g.fillStyle = r.color;
        g.fillRect(r.x - dpr, r.y, 2 * dpr, 8 * dpr);
        if (r.y <= r.ty) {
          burst(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life++;
        p.vx *= 0.97;
        p.vy = p.vy * 0.97 + 0.06 * dpr;
        p.x += p.vx;
        p.y += p.vy;
        const a = 1 - p.life / p.max;
        if (a <= 0) {
          parts.splice(i, 1);
          continue;
        }
        g.globalAlpha = a;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      if (frame < 240 || parts.length || rockets.length) raf = requestAnimationFrame(tick);
      else g.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/70 px-4" role="alertdialog" aria-modal="true" aria-labelledby="fw-t" aria-describedby="fw-m" data-testid="finish-success">
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden />
      <div className="sheet-up relative flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-surface p-6 text-center shadow-2xl">
        <span className="text-5xl" aria-hidden>🎆</span>
        <h2 id="fw-t" className="font-display text-2xl font-bold text-[#1FA88F]">Sukses!</h2>
        <p id="fw-m" className="text-sm text-ink">{message}</p>
        <button ref={btn} type="button" className="btn-primary mt-1" onClick={onClose} data-testid="finish-success-close">OK</button>
      </div>
    </div>,
    document.body,
  );
}
