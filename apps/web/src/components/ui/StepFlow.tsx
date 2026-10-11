import type { ReactNode } from 'react';
import { guessPicto, type PictoName } from '@/lib/picto';

export { guessPicto, type PictoName };

/**
 * Ilustrasi langkah gaya infografis "stiker" Punk Skate Lab: piktogram garis tebal dua warna
 * (aksen safety di atas kotak acid), kartu miring bergantian yang tegak saat disentuh,
 * nomor sebagai badge tempel, dan panah alur. Hanya token desain (ink, paper, acid, safety).
 */
const S = { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true } as const;
/** Aksen isi (di belakang garis). */
const A = 'fill-safety stroke-none';
/** Kilau putih kecil. */
const W = 'fill-paper stroke-none';

export const PICTO = {
  coconut: (
    <svg {...S}>
      <ellipse className={A} cx="24" cy="28" rx="12" ry="13" />
      <ellipse cx="24" cy="27" rx="13" ry="14" />
      <path d="M24 13l-5-8M24 13l5-8M24 13V4" />
      <circle cx="19" cy="23" r="2" fill="currentColor" />
      <circle cx="29" cy="23" r="2" fill="currentColor" />
      <circle cx="24" cy="30" r="2" fill="currentColor" />
      <path className={W} d="M15 30a4 6 0 0 0 3 6l2-2a4 4 0 0 1-2-5z" />
    </svg>
  ),
  split: (
    <svg {...S}>
      <path className={W} d="M8 24a9 9 0 0 0 16 0z" />
      <path d="M6 22a10 10 0 0 0 20 0z" />
      <path className={A} d="M24 32a9 9 0 0 0 16 0z" />
      <path d="M22 30a10 10 0 0 0 20 0z" />
      <path d="M30 4v12M26 12l4 4 4-4" />
    </svg>
  ),
  truck: (
    <svg {...S}>
      <rect className={A} x="5" y="16" width="22" height="14" />
      <rect x="3" y="14" width="26" height="18" />
      <path d="M29 20h9l6 7v5H29z" />
      <circle className={W} cx="12" cy="36" r="4" />
      <circle cx="12" cy="36" r="4" />
      <circle className={W} cx="36" cy="36" r="4" />
      <circle cx="36" cy="36" r="4" />
      <path d="M33 22h3l3 4h-6z" fill="currentColor" />
    </svg>
  ),
  sack: (
    <svg {...S}>
      <path className={A} d="M19 16c-6 3-7 9-7 14 0 5 3 8 12 8s12-3 12-8c0-5-1-11-7-14z" />
      <path d="M16 8h16l-3 6c7 3 9 10 9 16 0 6-4 10-14 10S10 36 10 30c0-6 2-13 9-16z" />
      <path d="M18 14h12M20 26h8" />
    </svg>
  ),
  scale: (
    <svg {...S}>
      <rect className={A} x="8" y="32" width="32" height="8" />
      <rect x="6" y="30" width="36" height="12" />
      <path d="M14 30v-6h20v6M24 24V14" />
      <rect className={W} x="16" y="6" width="16" height="8" />
      <rect x="16" y="6" width="16" height="8" />
    </svg>
  ),
  label: (
    <svg {...S}>
      <path className={A} d="M8 12h19l12 12-12 12H8z" />
      <path d="M6 10h22l14 14-14 14H6z" />
      <circle className={W} cx="14" cy="24" r="3" />
      <circle cx="14" cy="24" r="3" />
      <path d="M20 20h8M20 28h6" />
    </svg>
  ),
  pallet: (
    <svg {...S}>
      <rect className={A} x="8" y="18" width="32" height="8" />
      <rect x="8" y="8" width="32" height="8" />
      <rect x="8" y="18" width="32" height="8" />
      <rect x="8" y="28" width="32" height="8" />
      <path d="M4 40h40M10 40v4M24 40v4M38 40v4" />
    </svg>
  ),
  vessel: (
    <svg {...S}>
      <path className={A} d="M10 21c5 3 9-3 14 0s9 3 14 0v19H10z" />
      <path d="M10 10h28v30H10z" />
      <path d="M10 20c5 3 9-3 14 0s9 3 14 0" />
      <path className={W} d="M14 26h3v10h-3z" />
    </svg>
  ),
  cover: (
    <svg {...S}>
      <path className={A} d="M12 24h24v18H12z" />
      <path d="M12 16h24v26H12z" />
      <path d="M8 12c5-4 11 4 16 0s11 4 16 0" />
      <path d="M10 16h28M14 16l-2 6M34 16l2 6" />
    </svg>
  ),
  drop: (
    <svg {...S}>
      <path className={A} d="M24 8c7 10 11 16 11 21a11 11 0 0 1-22 0c0-5 4-11 11-21z" />
      <path d="M24 6c8 11 12 17 12 23a12 12 0 0 1-24 0c0-6 4-12 12-23z" />
      <path className={W} d="M17 28a7 8 0 0 0 4 8l1-3a4 5 0 0 1-2-5z" />
    </svg>
  ),
  thermo: (
    <svg {...S}>
      <circle className={A} cx="24" cy="34" r="6" />
      <path d="M20 8a4 4 0 0 1 8 0v20a8 8 0 1 1-8 0z" />
      <path d="M24 16v16" />
      <path d="M32 12h6M32 18h6M32 24h6" />
    </svg>
  ),
  clock: (
    <svg {...S}>
      <path className={A} d="M24 24V7a17 17 0 0 1 15 9z" />
      <circle cx="24" cy="24" r="17" />
      <path d="M24 13v11l8 6" />
      <circle cx="24" cy="24" r="2" fill="currentColor" />
    </svg>
  ),
  cold: (
    <svg {...S}>
      <circle className={A} cx="24" cy="24" r="7" />
      <path d="M24 5v38M8 14l32 20M40 14L8 34" />
      <path d="M20 9l4 4 4-4M20 39l4-4 4 4" />
    </svg>
  ),
  tap: (
    <svg {...S}>
      <rect className={A} x="8" y="14" width="18" height="16" />
      <rect x="6" y="6" width="22" height="26" />
      <path d="M28 24h10v6M33 18h6" />
      <path className={A} d="M38 34c2 3 2 5 0 6-2-1-2-3 0-6z" />
      <path d="M38 34c2 3 2 5 0 6-2-1-2-3 0-6z" strokeWidth="2" />
      <path d="M2 42h44" />
    </svg>
  ),
  bubbles: (
    <svg {...S}>
      <path className={A} d="M12 16h24v24H12z" />
      <path d="M10 8h28v34H10z" />
      <circle className={W} cx="18" cy="32" r="3" />
      <circle cx="18" cy="32" r="3" />
      <circle className={W} cx="29" cy="25" r="3.5" />
      <circle cx="29" cy="25" r="3.5" />
      <circle cx="21" cy="19" r="2" />
      <path d="M24 42v4M18 46h12" />
    </svg>
  ),
  cob: (
    <svg {...S}>
      <ellipse className={A} cx="24" cy="24" rx="8" ry="16" />
      <ellipse cx="24" cy="24" rx="9" ry="18" />
      <path d="M15 18h18M15 24h18M15 30h18M24 6v36" />
      <path d="M33 30c6-2 9-8 9-14M15 30c-6-2-9-8-9-14" />
    </svg>
  ),
  burette: (
    <svg {...S}>
      <path className={A} d="M21 16h6v13h-6z" />
      <path d="M20 4h8v26h-8z" />
      <path d="M24 30v4" />
      <circle cx="24" cy="38" r="1.5" fill="currentColor" />
      <path className={A} d="M15 44l5-5h8l5 5z" />
      <path d="M14 44l6-6h8l6 6z" />
      <path d="M20 10h4M20 16h4M20 22h4" />
    </svg>
  ),
  bottle: (
    <svg {...S}>
      <path className={A} d="M17 26h14v14H17z" />
      <path d="M20 4h8v8l4 6v24H16V18l4-6z" />
      <path d="M16 26h16M20 4h8v4h-8z" />
      <path className={W} d="M19 29h3v8h-3z" />
    </svg>
  ),
  fire: (
    <svg {...S}>
      <path className={A} d="M24 7c3 8 11 12 11 21a11 11 0 0 1-22 0c0-5 3-8 5-11 1 4 3 6 5 6-2-6 0-11 1-16z" />
      <path d="M24 4c3 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 1 4 3 6 5 6-2-6 0-12 2-18z" />
      <path className={W} d="M24 30c2 3 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7z" />
    </svg>
  ),
  sun: (
    <svg {...S}>
      <circle className={A} cx="24" cy="24" r="8" />
      <circle cx="24" cy="24" r="8" />
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" />
    </svg>
  ),
  oven: (
    <svg {...S}>
      <rect className={A} x="8" y="18" width="32" height="20" />
      <rect x="6" y="8" width="36" height="32" />
      <path d="M6 16h36M12 12h2M18 12h2" />
      <path d="M16 34c-2-3 2-5 0-8M24 34c-2-3 2-5 0-8M32 34c-2-3 2-5 0-8" />
    </svg>
  ),
  fan: (
    <svg {...S}>
      <path className={A} d="M24 24c0-8 8-10 8-4s-8 4-8 4zM24 24c7 4 5 12 0 9s0-9 0-9zM24 24c-7 4-12-2-7-5s7 5 7 5z" />
      <circle cx="24" cy="24" r="18" />
      <path d="M24 24c0-8 8-10 8-4s-8 4-8 4zM24 24c7 4 5 12 0 9s0-9 0-9zM24 24c-7 4-12-2-7-5s7 5 7 5z" />
      <path d="M44 12c2 4 2 8 0 12M4 36c-2-4-2-8 0-12" />
    </svg>
  ),
  rack: (
    <svg {...S}>
      <path className={A} d="M12 12l6-4 4 4M22 22l6-4 4 4M30 32l6-4 3 4" />
      <path d="M8 4v40M40 4v40M8 12h32M8 22h32M8 32h32" />
      <path d="M12 12l6-4M22 22l6-4M30 32l6-4" />
    </svg>
  ),
  sheet: (
    <svg {...S}>
      <path className={A} d="M8 16c6-4 12 4 16 0s12 4 16 0v16c-6 4-10-4-16 0s-12-4-16 0z" />
      <path d="M6 14c6-4 12 4 18 0s12 4 18 0v20c-6 4-12-4-18 0s-12-4-18 0z" />
      <path className={W} d="M12 22h10v3H12z" />
    </svg>
  ),
  soak: (
    <svg {...S}>
      <path className={A} d="M8 27c5-3 9 3 14 0s9 3 14 0l-1 11H9z" />
      <path d="M4 20h40l-4 20H8z" />
      <path d="M10 26c5-3 9 3 14 0s9 3 14 0" />
      <path d="M16 4v12M24 4v12M32 4v12" />
    </svg>
  ),
  brush: (
    <svg {...S}>
      <path className={A} d="M8 40l4-10c2-6 6-9 11-9l4 4c0 5-3 9-9 11z" />
      <path d="M30 4l14 14-14 8-8-8z" />
      <path d="M22 18c-6 0-10 4-12 10l-6 14 14-6c6-2 10-6 10-12" />
    </svg>
  ),
  sieve: (
    <svg {...S}>
      <ellipse className={A} cx="24" cy="16" rx="16" ry="4" />
      <ellipse cx="24" cy="16" rx="18" ry="6" />
      <path d="M6 16l6 18h24l6-18" />
      <path d="M16 24v8M24 24v8M32 24v8M14 28h20" />
      <circle cx="20" cy="40" r="1.5" fill="currentColor" />
      <circle cx="28" cy="43" r="1.5" fill="currentColor" />
      <circle cx="24" cy="46" r="1.5" fill="currentColor" />
    </svg>
  ),
  hammer: (
    <svg {...S}>
      <path className={A} d="M10 12h16v6H10z" />
      <path d="M8 10h20v10H8z" />
      <path d="M22 20l18 20" />
      <path d="M28 14h6M36 6l4-2M38 12h5" />
    </svg>
  ),
  drum: (
    <svg {...S}>
      <path className={A} d="M10 20c0 3 6 5 14 5s14-2 14-5v10c0 3-6 5-14 5s-14-2-14-5z" />
      <ellipse className={W} cx="24" cy="9" rx="14" ry="5" />
      <ellipse cx="24" cy="9" rx="14" ry="5" />
      <path d="M10 9v30c0 3 6 5 14 5s14-2 14-5V9" />
      <path d="M10 20c0 3 6 5 14 5s14-2 14-5M10 30c0 3 6 5 14 5s14-2 14-5" />
    </svg>
  ),
  smoke: (
    <svg {...S}>
      <path className={A} d="M4 44h40v-4H4z" />
      <path d="M14 40c-6-6 6-10 0-16s6-10 0-16M24 40c-6-6 6-10 0-16s6-10 0-16M34 40c-6-6 6-10 0-16s6-10 0-16" />
    </svg>
  ),
  spoon: (
    <svg {...S}>
      <ellipse className={A} cx="16" cy="16" rx="6" ry="8" />
      <ellipse cx="16" cy="16" rx="8" ry="10" />
      <path d="M22 24l18 18" />
      <circle cx="34" cy="8" r="1.5" fill="currentColor" />
      <circle cx="40" cy="12" r="1.5" fill="currentColor" />
      <circle cx="36" cy="16" r="1.5" fill="currentColor" />
    </svg>
  ),
  check: (
    <svg {...S}>
      <rect className={W} x="10" y="8" width="28" height="34" />
      <rect x="8" y="6" width="32" height="38" />
      <path className={A} d="M18 4h12v6H18z" />
      <path d="M18 4h12v6H18z" />
      <path d="M16 26l6 6 12-12" />
    </svg>
  ),
  shield: (
    <svg {...S}>
      <path className={W} d="M24 6l14 5v11c0 9-6 16-14 20-8-4-14-11-14-20V11z" />
      <path d="M24 4l16 6v12c0 10-7 18-16 22C15 40 8 32 8 22V10z" />
      <path d="M24 14v12" strokeWidth="4" />
      <circle cx="24" cy="33" r="2" fill="currentColor" />
    </svg>
  ),
  mix: (
    <svg {...S}>
      <path className={A} d="M8 31c4-3 8 3 12 0s8 3 12 0 6 2 8 0l-2 11H10z" />
      <path d="M6 20h36l-4 22H10z" />
      <path d="M30 4L20 30" />
      <path d="M14 30c4-3 8 3 12 0s8 3 12 0" />
    </svg>
  ),
  press: (
    <svg {...S}>
      <rect className={A} x="14" y="22" width="20" height="8" />
      <path d="M10 4h28v8H10zM24 12v10" />
      <rect x="14" y="22" width="20" height="8" />
      <path d="M6 40h36M14 34h6v6h-6zM28 34h6v6h-6z" />
    </svg>
  ),
} as const satisfies Record<PictoName, ReactNode>;

/** Piktogram "stiker": kotak berwarna, garis tebal, bayangan keras, sedikit miring + selotip. */
export function Picto({ name, size = 'md', tone = 'acid', tilt = 0 }: { name: PictoName; size?: 'sm' | 'md' | 'lg'; tone?: 'acid' | 'paper' | 'safety'; tilt?: -1 | 0 | 1 }) {
  const box = size === 'sm' ? 'h-9 w-9 p-1' : size === 'lg' ? 'h-[72px] w-[72px] p-2' : 'h-14 w-14 p-1.5';
  const bg = tone === 'acid' ? 'bg-acid' : tone === 'safety' ? 'bg-safety' : 'bg-paper';
  const rot = tilt === -1 ? '-rotate-3' : tilt === 1 ? 'rotate-3' : '';
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center border-3 border-ink text-ink shadow-hard-sm ${bg} ${box} ${rot} [&>svg]:h-full [&>svg]:w-full`}>
      {size !== 'sm' && <span aria-hidden className="absolute -top-2 left-1/2 h-3 w-7 -translate-x-1/2 rotate-[-4deg] border-2 border-ink bg-paper/80" />}
      {PICTO[name]}
    </span>
  );
}

export type FlowStep = string | { text: ReactNode; icon?: PictoName; key?: string };

/**
 * Alur langkah infografis: kartu stiker miring bergantian (tegak & terangkat saat disentuh),
 * badge nomor tempel, piktogram besar, panah alur oranye ke kartu berikutnya.
 */
export function StepFlow({ steps, testId }: { steps: FlowStep[]; testId?: string }) {
  return (
    <ol className="grid gap-x-5 gap-y-6 pt-2 sm:grid-cols-2 xl:grid-cols-3" data-testid={testId}>
      {steps.map((s, i) => {
        const text = typeof s === 'string' ? s : s.text;
        const icon = typeof s === 'string' ? guessPicto(s) : (s.icon ?? (typeof s.text === 'string' ? guessPicto(s.text) : 'check'));
        const safety = icon === 'shield';
        const odd = i % 2 === 1;
        return (
          <li
            key={i}
            className={`group relative flex items-center gap-4 border-3 border-ink p-3 pl-4 pt-4 shadow-hard motion-safe:transition-transform motion-safe:duration-200 hover:z-10 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0 ${
              odd ? 'motion-safe:rotate-[0.6deg]' : 'motion-safe:-rotate-[0.6deg]'
            } ${safety ? 'bg-paper' : 'bg-surface'}`}
            data-testid={testId ? `${testId}-${i + 1}` : undefined}
            data-picto={icon}
          >
            <span
              aria-hidden
              className={`absolute -left-3 -top-3 border-3 border-ink px-1.5 font-display text-lg leading-tight shadow-hard-sm ${odd ? 'rotate-3 bg-safety text-ink' : '-rotate-3 bg-ink text-acid'}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <Picto name={icon} size="lg" tone={safety ? 'safety' : 'acid'} tilt={odd ? 1 : -1} />
            <p className="text-sm leading-snug">{text}</p>
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 border-2 border-ink bg-safety px-1 font-mono text-xs font-bold leading-none text-ink sm:-right-4 sm:bottom-auto sm:left-auto sm:top-1/2 sm:-translate-y-1/2 sm:translate-x-0">
                <span className="sm:hidden">↓</span>
                <span className="hidden sm:inline">→</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
