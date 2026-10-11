'use client';

import { useId } from 'react';
import { Hint } from '@/components/ui/Hint';
import { fmt } from '@/lib/format';
import { containerFtName, ftIn } from '@/lib/imperial';

export interface SimSegment {
  /** Jumlah butir yang dimuat untuk segmen ini (mis. per asal kelapa). */
  count: number;
  label: string;
  tone: 'acid' | 'safety' | 'ink';
}

const FILL: Record<SimSegment['tone'], string> = { acid: '#63E6CF', safety: '#F5A524', ink: '#0E1A1F' };

/**
 * Tampak samping container: kelapa digambar sebagai lingkaran. Satu lingkaran = `perCircle` butir.
 * Lingkaran diisi dari belakang-bawah ke depan-atas sesuai urutan muat. Representasi grid (ADR-005).
 */
export function ContainerCircleSim({
  containerId,
  innerM,
  capacity,
  segments,
  title,
}: {
  containerId: string;
  innerM: { L: number; W: number; H: number };
  /** Kapasitas butir container (dari engine). */
  capacity: number;
  segments: SimSegment[];
  title?: string;
}) {
  const id = useId();
  const loaded = segments.reduce((n, s) => n + s.count, 0);
  // Grid lingkaran mengikuti rasio panjang : tinggi container.
  const rows = 8;
  const cols = Math.max(8, Math.round((innerM.L / innerM.H) * rows));
  const total = rows * cols;
  const perCircle = capacity > 0 ? capacity / total : 1;

  // Urutan isi: kolom paling belakang dulu (kiri), dari bawah ke atas.
  const fills: string[] = [];
  let remaining = segments.map((s) => s.count);
  for (let i = 0; i < total; i++) {
    let tone: string | undefined;
    for (let s = 0; s < segments.length; s++) {
      if (remaining[s]! >= perCircle / 2) {
        remaining[s] = remaining[s]! - perCircle;
        tone = FILL[segments[s]!.tone];
        break;
      }
    }
    fills.push(tone ?? 'none');
  }
  remaining = [];

  const cell = 20;
  const pad = 6;
  const w = cols * cell + pad * 2;
  const h = rows * cell + pad * 2;
  const pct = capacity > 0 ? Math.min(1, loaded / capacity) : 0;

  return (
    <figure className="flex flex-col gap-2" aria-labelledby={`${id}-cap`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-bold tracking-[0.08em]">{title ?? `SIMULASI · ${containerFtName(containerId).toUpperCase()}`}</span>
        <span className="flex items-center gap-2 font-mono text-[11px]">
          gambar perkiraan, bukan posisi asli <Hint k="grid" />
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h + 26}`}
        className="w-full border-3 border-ink bg-paper"
        role="img"
        aria-label={`Container ${containerFtName(containerId)} terisi ${Math.round(pct * 100)} persen, ${fmt(loaded)} dari ${fmt(capacity)} butir`}
      >
        <rect x={pad / 2} y={pad / 2} width={w - pad} height={h - pad} fill="#FFFFFF" stroke="#0E1A1F" strokeWidth={3} />
        {fills.map((f, i) => {
          const col = Math.floor(i / rows);
          const row = rows - 1 - (i % rows);
          return (
            <circle
              key={i}
              cx={pad + col * cell + cell / 2}
              cy={pad + row * cell + cell / 2}
              r={cell / 2 - 2}
              fill={f === 'none' ? '#FFFFFF' : f}
              stroke={f === 'none' ? '#E2E8EA' : '#0E1A1F'}
              strokeWidth={f === 'none' ? 1 : 1.6}
            />
          );
        })}
        {/* Ukuran dalam (ft/in) */}
        <text x={w / 2} y={h + 18} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="700" fill="#0E1A1F">
          ← panjang {ftIn(innerM.L)} · lebar {ftIn(innerM.W)} · tinggi {ftIn(innerM.H)} →
        </text>
      </svg>
      <figcaption id={`${id}-cap`} className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
        <span className="font-bold">1 lingkaran ≈ {fmt(perCircle)} butir</span>
        <span>
          terisi {fmt(loaded)} / {fmt(capacity)} butir ({Math.round(pct * 100)}%)
        </span>
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-ink" style={{ background: FILL[s.tone] }} />
            {s.label}: {fmt(s.count)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
