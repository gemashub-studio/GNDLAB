'use client';

import {
  containerPackLayout,
  nestedColumnCount,
  nestedColumnLayout,
  visibleCount,
  warehouseStackLayout,
  floorDiv,
  type NestedColumn,
  type Placement,
} from '@gemas/calc-engine';
import { getForm } from '@gemas/dataset';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BindingTag, ConfidenceBadge } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { COMMODITY_UI, formLabel } from '@/lib/catalog';
import { fmt, fmtTon } from '@/lib/format';
import { containerFtName } from '@/lib/imperial';
import { primaryFigure } from '@/lib/present';
import { encodeState, runContainer, runWarehouse, type ContainerState, type ScenarioState, type WarehouseState } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';
import { ContainerCircleSim } from './ContainerCircleSim';
import { BulkPlan2D, ContainerPlan2D, NestedPlan2D, WarehousePlan2D } from './Plan2D';

const Sim3D = dynamic(() => import('./Sim3D'), {
  ssr: false,
  loading: () => <div className="flex h-[360px] items-center justify-center border-3 border-ink bg-paper font-mono text-sm">Memuat 3D…</div>,
});

const DEFAULT: ContainerState = { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PACKAGE' };

type Scene =
  | { kind: 'packs'; space: { L: number; W: number; H: number }; placements: Placement[]; grid: { nx: number; ny: number; nz: number } }
  | { kind: 'bulk'; space: { L: number; W: number; H: number }; fill: number; util: number }
  | { kind: 'nested'; space: { L: number; W: number; H: number }; columns: NestedColumn[]; perColumn: number }
  | { kind: 'warehouse'; zone: { L: number; W: number; H: number }; layout: ReturnType<typeof warehouseStackLayout>; packH: number; packsPerStack: number; auto: boolean }
  | { kind: 'warehouse-bulk'; zone: { L: number; W: number; H: number }; pile: { l: number; w: number; h: number }; auto: boolean };

export function SimulatorView({ initial }: { initial?: ScenarioState }) {
  const ds = useDataset();
  const state: ContainerState | WarehouseState = initial && initial.kind !== 'CONVERT' ? initial : DEFAULT;
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [fill, setFill] = useState(1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  // Animasi stuffing 0 → 100% dalam ±4 detik.
  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / 4000);
      setFill(f);
      if (f < 1) raf.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const sim = useMemo(() => {
    try {
      if (state.kind === 'CONTAINER') {
        const out = runContainer(ds, state);
        const form = getForm(ds, state.commodityId, state.formCode);
        const c = state.custom
          ? { L: state.custom.lengthM, W: state.custom.widthM, H: state.custom.heightM }
          : (() => {
              const k = ds.containers.find((x) => x.id === state.containerId)!;
              return { L: k.L, W: k.W, H: k.H };
            })();
        let scene: Scene;
        if (state.mode === 'PACKAGE') {
          const pk = form.packaging[state.packagingIndex ?? 0]!;
          const lay = containerPackLayout({ l: c.L as never, w: c.W as never, h: c.H as never }, pk.dims!, out.result.typ.packs ?? 0);
          scene = { kind: 'packs', space: c, placements: lay.placements, grid: lay.fit.grid };
        } else if (form.nestable && form.code === 'halves_nested' && state.mode === 'PIECE') {
          const depth = form.params['geometry.charcoal_half.depth']!.typ;
          const pitch = form.params['geometry.nest_pitch']!.typ;
          const rim = form.params['geometry.charcoal_half.rim_diameter']!.typ;
          const per = nestedColumnCount(c.H, depth, pitch);
          const cols = nestedColumnLayout({ L: c.L, W: c.W }, rim, per, out.result.typ.pieces ?? 0, depth, pitch);
          scene = { kind: 'nested', space: c, columns: cols, perColumn: per };
        } else {
          const util = state.volumeUtil ?? form.volumeUtilDefault;
          scene = { kind: 'bulk', space: c, fill: out.result.typ.volumeFill, util };
        }
        return { ok: true as const, kind: 'CONTAINER' as const, out, scene, form };
      }
      const out = runWarehouse(ds, state);
      const form = getForm(ds, state.commodityId, state.formCode);
      const t = out.result.typ;
      const auto = !state.zone;
      const side = Math.max(1, Math.ceil(Math.sqrt(t.floorAreaM2) * 2) / 2);
      const zone = { L: state.zone?.lengthM ?? side, W: state.zone?.widthM ?? side, H: state.stackHeightM };
      if (t.stacks !== undefined && t.packs !== undefined) {
        const pk = form.packaging[state.packagingIndex ?? 0]!;
        const perStack = floorDiv(state.stackHeightM, pk.dims!.h);
        const lay = warehouseStackLayout({ L: zone.L, W: zone.W }, { l: pk.dims!.l, w: pk.dims!.w }, t.stacks, t.packs, perStack, state.floorUtil ?? 0.65);
        return { ok: true as const, kind: 'WAREHOUSE' as const, out, form, scene: { kind: 'warehouse', zone, layout: lay, packH: pk.dims!.h, packsPerStack: perStack, auto } as Scene };
      }
      const fp = t.footprintM2;
      const l = Math.min(zone.L, Math.sqrt(fp * (zone.L / zone.W)));
      return {
        ok: true as const,
        kind: 'WAREHOUSE' as const,
        out,
        form,
        scene: { kind: 'warehouse-bulk', zone, pile: { l, w: Math.min(zone.W, fp / l), h: state.stackHeightM }, auto } as Scene,
      };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Gagal' };
    }
  }, [ds, state]);

  if (!sim.ok) {
    return <div role="alert" className="card"><h2 className="text-xl">Hmm, simulasi belum bisa dibuat</h2><p className="mt-2">{sim.message}</p></div>;
  }

  const scene = sim.scene;
  const totalItems =
    scene.kind === 'packs' ? scene.placements.length : scene.kind === 'nested' ? scene.columns.length : scene.kind === 'warehouse' ? scene.layout.stacks.length : 1;
  const visible = visibleCount(totalItems, fill);
  const backHref = `${state.kind === 'CONTAINER' ? '/muat' : '/gudang'}?s=${encodeState(state)}`;
  const name = COMMODITY_UI[state.commodityId]?.short ?? state.commodityId;

  // Placements 3D untuk gudang: satu balok per tumpukan (tinggi = karung × tinggi karung).
  const warehousePlacements: Placement[] =
    scene.kind === 'warehouse'
      ? scene.layout.stacks.map((s) => ({ index: s.index, x: s.x, y: s.y, z: 0, l: s.l, w: s.w, h: s.packs * scene.packH }))
      : scene.kind === 'warehouse-bulk'
        ? [{ index: 0, x: 0, y: 0, z: 0, l: scene.pile.l, w: scene.pile.w, h: scene.pile.h }]
        : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href={backHref} className="font-mono text-xs font-bold no-underline">← kembali ke kalkulator</Link>
          <h1 className="text-[40px] sm:text-[52px]">Simulator</h1>
          <p className="text-[15px]">
            {name} · {formLabel(state.commodityId, state.formCode)} ·{' '}
            {state.kind === 'CONTAINER' ? (state.custom ? 'container custom' : containerFtName(state.containerId!)) : 'gudang'}
          </p>
        </div>
        <div role="group" aria-label="Tampilan" className="flex border-3 border-ink bg-surface">
          {(['2d', '3d'] as const).map((v, i) => (
            <button key={v} type="button" aria-pressed={view === v} data-testid={`view-${v}`} onClick={() => setView(v)}
              className={`min-h-touch px-5 text-sm font-extrabold uppercase ${i ? 'border-l-3 border-ink' : ''} ${view === v ? 'bg-acid' : ''}`}>
              {v === '2d' ? 'Denah 2D' : '3D'}
            </button>
          ))}
        </div>
      </header>

      {/* Angka = kartu hasil kalkulator (engine sama) */}
      <section aria-label="Angka simulasi" className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="sim-stats">
        {sim.kind === 'CONTAINER' ? (
          <>
            <div className="border-3 border-ink bg-acid p-3">
              <span className="label-mono">{primaryFigure(sim.out, (state as ContainerState).mode, state.commodityId).unit}</span>
              <span className="block font-display text-3xl" data-testid="sim-primary">{primaryFigure(sim.out, (state as ContainerState).mode, state.commodityId).text}</span>
            </div>
            <div className="border-3 border-ink bg-surface p-3"><span className="label-mono">Muatan</span><span className="block text-xl font-extrabold">{fmtTon(sim.out.result.typ.massKg)}</span></div>
            <div className="flex items-center border-3 border-ink bg-surface p-3"><BindingTag b={sim.out.binding} /></div>
            <div className="flex items-center gap-2 border-3 border-ink bg-surface p-3"><ConfidenceBadge c={sim.out.confidence} withText /></div>
          </>
        ) : (
          <>
            <div className="border-3 border-ink bg-acid p-3"><span className="label-mono">Luas lantai</span><span className="block font-display text-3xl" data-testid="sim-primary">{fmt(sim.out.result.typ.floorAreaM2, 2)}</span><span className="font-mono text-xs">m²</span></div>
            <div className="border-3 border-ink bg-surface p-3"><span className="label-mono">Tumpukan</span><span className="block text-xl font-extrabold" data-testid="sim-stacks">{fmt(sim.out.result.typ.stacks ?? 0)}</span></div>
            <div className="border-3 border-ink bg-surface p-3"><span className="label-mono">Massa</span><span className="block text-xl font-extrabold">{fmtTon(sim.out.result.typ.massKg)}</span></div>
            <div className="flex items-center gap-2 border-3 border-ink bg-surface p-3"><ConfidenceBadge c={sim.out.confidence} withText /></div>
          </>
        )}
      </section>

      {(scene.kind === 'packs' || scene.kind === 'nested' || scene.kind === 'warehouse') && (
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <label htmlFor="fill" className="label-mono">Isi {Math.round(fill * 100)}% · {fmt(visible)} / {fmt(totalItems)} {scene.kind === 'packs' ? 'karung' : scene.kind === 'nested' ? 'kolom' : 'tumpukan'}</label>
          <input id="fill" type="range" min={0} max={100} value={Math.round(fill * 100)} data-testid="fill-slider"
            onChange={(e) => { setPlaying(false); setFill(Number(e.target.value) / 100); }}
            className="h-11 min-w-[200px] flex-1 cursor-pointer accent-ink" />
          <button type="button" className="btn-acid" onClick={() => { setFill(0); setPlaying(true); }} data-testid="play">
            ▶ Putar stuffing
          </button>
        </div>
      )}

      <section aria-label="Visual" className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-xs font-bold tracking-[0.08em]">{view === '2d' ? 'DENAH 2D' : 'ISOMETRIK 3D'}</span>
          <span className="flex items-center gap-2 bg-ink px-2 py-1 font-mono text-[11px] font-bold text-acid" data-testid="grid-label">
            Visual adalah representasi grid, bukan posisi fisik eksak <Hint k="grid" />
          </span>
        </div>
        {view === '2d' ? (
          <>
            {scene.kind === 'packs' && <ContainerPlan2D inner={scene.space} placements={scene.placements} visible={visible} grid={scene.grid} />}
            {scene.kind === 'bulk' && <BulkPlan2D inner={scene.space} fill={scene.fill} util={scene.util} />}
            {scene.kind === 'nested' && <NestedPlan2D space={scene.space} columns={scene.columns.slice(0, visible)} perColumn={scene.perColumn} />}
            {scene.kind === 'warehouse' && (
              <WarehousePlan2D zone={scene.zone} stacks={scene.layout.stacks.slice(0, visible)} aisles={scene.layout.aisles} packsPerStack={scene.packsPerStack} overflow={scene.layout.overflowStacks} />
            )}
            {scene.kind === 'warehouse-bulk' && (
              <WarehousePlan2D zone={scene.zone} stacks={[{ index: 0, x: 0, y: 0, l: scene.pile.l, w: scene.pile.w, packs: 1 }]} aisles={[]} packsPerStack={1} overflow={0} />
            )}
            {sim.kind === 'CONTAINER' && state.commodityId === 'kelapa_jambul' && (state as ContainerState).mode === 'PIECE' && sim.out.result.typ.pieces !== undefined && (
              <ContainerCircleSim
                containerId={(state as ContainerState).containerId ?? 'CUSTOM'}
                innerM={(scene as { space: { L: number; W: number; H: number } }).space}
                capacity={Math.round(sim.out.result.typ.pieces / Math.max(sim.out.result.typ.volumeFill, 1e-9))}
                segments={[{ count: Math.round(sim.out.result.typ.pieces * fill), label: 'Kelapa jambul', tone: 'acid' }]}
              />
            )}
          </>
        ) : (
          <Sim3D
            space={scene.kind === 'warehouse' || scene.kind === 'warehouse-bulk' ? scene.zone : scene.space}
            placements={scene.kind === 'packs' ? scene.placements : warehousePlacements}
            visible={scene.kind === 'packs' || scene.kind === 'warehouse' ? visible : warehousePlacements.length}
            {...(scene.kind === 'bulk' && { bulkLevel: scene.fill * scene.util * fill })}
            columns={scene.kind === 'nested' ? scene.columns.slice(0, visible) : []}
          />
        )}
        {(scene.kind === 'warehouse' || scene.kind === 'warehouse-bulk') && scene.auto && (
          <p className="font-mono text-[11px]">Ukuran zona belum diisi — denah memakai zona otomatis seluas kebutuhan. Isi ukuran zona di kalkulator Gudang biar lebih nyata.</p>
        )}
      </section>
    </div>
  );
}
