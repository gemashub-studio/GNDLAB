'use client';

import type { NestedColumn, Placement, Rect, WarehouseStack } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { fmt } from '@/lib/format';
import { ftIn } from '@/lib/imperial';

const INK = '#0E1A1F';
const ACID = '#63E6CF';
const SAFETY = '#F5A524';
const PAPER = '#F3F6F7';
const GRID = '#E2E8EA';
const SURFACE = '#FFFFFF';
const MONO = 'JetBrains Mono, monospace';

/** Skala SVG: lebar tetap 1000 unit, tinggi mengikuti rasio. */
function scaleFor(Lm: number, Wm: number, width = 1000) {
  const s = width / Lm;
  return { s, w: width, h: Wm * s };
}

function DimLabel({ x, y, text, anchor = 'middle' }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={MONO} fontSize={18} fontWeight={700} fill={INK}>
      {text}
    </text>
  );
}

/**
 * Container tampak atas (L×W) + tampak samping (L×H). Kotak tampak atas diwarnai menurut jumlah
 * lapis yang terisi: penuh = hitam, sebagian = hijau asam, kosong = putih. Hover → isi kolom.
 */
export function ContainerPlan2D({
  inner,
  placements,
  visible,
  grid,
}: {
  inner: { L: number; W: number; H: number };
  placements: Placement[];
  visible: number;
  grid: { nx: number; ny: number; nz: number };
}) {
  const [hover, setHover] = useState<string>();
  const shown = placements.slice(0, visible);
  const cols = useMemo(() => {
    const m = new Map<string, { x: number; y: number; l: number; w: number; layers: number }>();
    for (const p of shown) {
      const k = `${p.x.toFixed(4)}|${p.y.toFixed(4)}`;
      const c = m.get(k);
      if (c) c.layers++;
      else m.set(k, { x: p.x, y: p.y, l: p.l, w: p.w, layers: 1 });
    }
    return [...m.entries()];
  }, [shown]);
  const side = useMemo(() => {
    const m = new Map<string, { x: number; z: number; l: number; h: number; n: number }>();
    for (const p of shown) {
      const k = `${p.x.toFixed(4)}|${p.z.toFixed(4)}`;
      const c = m.get(k);
      if (c) c.n++;
      else m.set(k, { x: p.x, z: p.z, l: p.l, h: p.h, n: 1 });
    }
    return [...m.values()];
  }, [shown]);

  const top = scaleFor(inner.L, inner.W);
  const sv = scaleFor(inner.L, inner.H);
  const pad = 30;

  return (
    <div className="flex flex-col gap-3" data-testid="plan-2d">
      <svg viewBox={`${-pad} ${-pad} ${top.w + pad * 2} ${top.h + pad * 2 + 10}`} className="w-full border-3 border-ink bg-paper" role="img"
        aria-label={`Tampak atas container: ${fmt(visible)} kemasan`}>
        <rect x={0} y={0} width={top.w} height={top.h} fill={SURFACE} stroke={INK} strokeWidth={4} />
        {cols.map(([k, c]) => {
          const full = c.layers >= grid.nz;
          return (
            <rect key={k} x={c.x * top.s} y={c.y * top.s} width={c.l * top.s} height={c.w * top.s}
              fill={full ? INK : ACID} stroke={INK} strokeWidth={1.5}
              onMouseEnter={() => setHover(`Kolom ${fmt(c.x * 100)}–${fmt((c.x + c.l) * 100)} cm dari dinding depan: ${c.layers} dari ${grid.nz} lapis`)}
              onMouseLeave={() => setHover(undefined)}>
              <title>{`${c.layers}/${grid.nz} lapis`}</title>
            </rect>
          );
        })}
        <text x={top.w + 8} y={top.h / 2} fontFamily={MONO} fontSize={16} fontWeight={700} fill={SAFETY} transform={`rotate(90 ${top.w + 8} ${top.h / 2})`} textAnchor="middle">PINTU</text>
        <DimLabel x={top.w / 2} y={top.h + 24} text={`TAMPAK ATAS · ${ftIn(inner.L)} × ${ftIn(inner.W)}`} />
      </svg>
      <svg viewBox={`${-pad} ${-pad} ${sv.w + pad * 2} ${sv.h + pad * 2 + 10}`} className="w-full border-3 border-ink bg-paper" role="img"
        aria-label="Tampak samping container">
        <rect x={0} y={0} width={sv.w} height={sv.h} fill={SURFACE} stroke={INK} strokeWidth={4} />
        {side.map((c, i) => (
          <rect key={i} x={c.x * sv.s} y={(inner.H - c.z - c.h) * sv.s} width={c.l * sv.s} height={c.h * sv.s}
            fill={c.n >= grid.ny ? INK : ACID} stroke={INK} strokeWidth={1.2} />
        ))}
        <DimLabel x={sv.w / 2} y={sv.h + 24} text={`TAMPAK SAMPING · tinggi ${ftIn(inner.H)}`} />
      </svg>
      <p className="min-h-[1.25rem] font-mono text-xs" aria-live="polite">{hover ?? 'Arahkan kursor/ketuk kotak untuk lihat isinya.'}</p>
      <div className="flex flex-wrap gap-4 font-mono text-[11px]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 border-2 border-ink bg-ink" /> penuh sampai atas</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 border-2 border-ink bg-acid" /> sebagian</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 border-2 border-ink bg-surface" /> kosong</span>
      </div>
    </div>
  );
}

/** Muatan curah: tampak samping dengan tinggi isi = isi volume × ruang terpakai (sesuai engine). */
export function BulkPlan2D({ inner, fill, util }: { inner: { L: number; W: number; H: number }; fill: number; util: number }) {
  const sv = scaleFor(inner.L, inner.H);
  const pad = 30;
  const level = Math.max(0, Math.min(1, fill * util));
  return (
    <svg viewBox={`${-pad} ${-pad} ${sv.w + pad * 2} ${sv.h + pad * 2 + 10}`} className="w-full border-3 border-ink bg-paper" role="img"
      aria-label={`Tampak samping: terisi ${Math.round(level * 100)} persen tinggi`} data-testid="plan-2d-bulk">
      <defs>
        <pattern id="bulk-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill={ACID} />
          <circle cx="7" cy="7" r="3" fill={INK} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={sv.w} height={sv.h} fill={SURFACE} stroke={INK} strokeWidth={4} />
      <rect x={0} y={sv.h * (1 - level)} width={sv.w} height={sv.h * level} fill="url(#bulk-dots)" stroke={INK} strokeWidth={2} />
      <DimLabel x={sv.w / 2} y={sv.h + 24} text={`TAMPAK SAMPING · ${ftIn(inner.L)} × tinggi ${ftIn(inner.H)} · isi ${Math.round(level * 100)}%`} />
    </svg>
  );
}

/** Denah zona gudang: tumpukan (hijau), lorong diarsir. Hover → isi tumpukan. */
export function WarehousePlan2D({
  zone,
  stacks,
  aisles,
  packsPerStack,
  overflow,
}: {
  zone: { L: number; W: number };
  stacks: WarehouseStack[];
  aisles: Rect[];
  packsPerStack: number;
  overflow: number;
}) {
  const [hover, setHover] = useState<string>();
  const t = scaleFor(zone.L, zone.W);
  const pad = 30;
  return (
    <div className="flex flex-col gap-2" data-testid="plan-warehouse">
      <svg viewBox={`${-pad} ${-pad} ${t.w + pad * 2} ${t.h + pad * 2 + 10}`} className="w-full border-3 border-ink bg-paper" role="img"
        aria-label={`Denah zona: ${stacks.length} tumpukan`}>
        <defs>
          <pattern id="aisle-hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="16" height="16" fill={PAPER} />
            <line x1="0" y1="0" x2="0" y2="16" stroke={INK} strokeWidth="3" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={t.w} height={t.h} fill={SURFACE} stroke={INK} strokeWidth={4} />
        {aisles.map((a, i) => (
          <rect key={i} x={a.x * t.s} y={a.y * t.s} width={a.l * t.s} height={a.w * t.s} fill="url(#aisle-hatch)" stroke={GRID} />
        ))}
        {stacks.map((s) => (
          <rect key={s.index} x={s.x * t.s} y={s.y * t.s} width={s.l * t.s} height={s.w * t.s}
            fill={s.packs >= packsPerStack ? ACID : SURFACE} stroke={INK} strokeWidth={1.5}
            onMouseEnter={() => setHover(`Tumpukan #${s.index + 1}: ${s.packs} karung`)} onMouseLeave={() => setHover(undefined)}>
            <title>{`#${s.index + 1}: ${s.packs} karung`}</title>
          </rect>
        ))}
        <DimLabel x={t.w / 2} y={t.h + 24} text={`ZONA ${fmt(zone.L, 1)} × ${fmt(zone.W, 1)} m (${ftIn(zone.L)} × ${ftIn(zone.W)})`} />
      </svg>
      <p className="min-h-[1.25rem] font-mono text-xs" aria-live="polite">{hover ?? 'Arsiran = lorong. Arahkan kursor ke tumpukan untuk lihat isinya.'}</p>
      {overflow > 0 && <p role="alert" className="bg-safety p-2 text-sm font-bold">{fmt(overflow)} tumpukan nggak muat di zona ini.</p>}
    </div>
  );
}

/** Tampak atas kolom arang bersarang (lingkaran = satu kolom). */
export function NestedPlan2D({ space, columns, perColumn }: { space: { L: number; W: number }; columns: NestedColumn[]; perColumn: number }) {
  const t = scaleFor(space.L, space.W);
  const pad = 30;
  return (
    <svg viewBox={`${-pad} ${-pad} ${t.w + pad * 2} ${t.h + pad * 2 + 10}`} className="w-full border-3 border-ink bg-paper" role="img"
      aria-label={`${columns.length} kolom arang bersarang`} data-testid="plan-nested">
      <rect x={0} y={0} width={t.w} height={t.h} fill={SURFACE} stroke={INK} strokeWidth={4} />
      {columns.map((c) => (
        <circle key={c.index} cx={(c.x + c.l / 2) * t.s} cy={(c.y + c.w / 2) * t.s} r={(c.l / 2) * t.s * 0.92}
          fill={c.pieces >= perColumn ? INK : ACID} stroke={INK} strokeWidth={1}>
          <title>{`${c.pieces} keping`}</title>
        </circle>
      ))}
      <DimLabel x={t.w / 2} y={t.h + 24} text={`TAMPAK ATAS · ${ftIn(space.L)} × ${ftIn(space.W)} · 1 lingkaran = 1 kolom`} />
    </svg>
  );
}
