import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cmToM,
  containerCapacity,
  containerPackLayout,
  kg,
  m3,
  nestedColumnCount,
  nestedColumnLayout,
  param,
  visibleCount,
  warehouseSpace,
  warehouseStackLayout,
  type ContainerSpec,
} from '../src/index.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../architecture/${p}`, import.meta.url));
const golden = JSON.parse(readFileSync(root('tests/fixtures/golden_cases.json'), 'utf8')).cases as Array<Record<string, any>>;
const dataset = JSON.parse(readFileSync(root('00-research/data/coconut_inventory_dataset.json'), 'utf8')) as {
  containers: Array<{ id: string; inner_cm: { L: number; W: number; H: number }; volume_m3: number; payload_kg: number }>;
};
const container = (id: string): ContainerSpec => {
  const c = dataset.containers.find((x) => x.id === id)!;
  return { L: cmToM(c.inner_cm.L), W: cmToM(c.inner_cm.W), H: cmToM(c.inner_cm.H), payloadKg: kg(c.payload_kg), volumeM3: m3(c.volume_m3) };
};

describe('containerPackLayout — simulator = kartu hasil (semua golden kemasan)', () => {
  const cases = golden.filter((c) => String(c.case).startsWith('grid_fit_'));
  it.each(cases.map((c) => [c.case as string, c] as const))('%s', (_n, c) => {
    const cont = container(c.input.container);
    const b = c.input.bag_cm;
    const box = { l: cmToM(b.l), w: cmToM(b.w), h: cmToM(b.h) };
    const net = c.input.bag_net_kg ?? 14;
    const out = containerCapacity({ container: cont, form: { mode: 'PACKAGE', pack: { ...box, netKg: param('n', 'kg', net) } } });
    const layout = containerPackLayout({ l: cont.L, w: cont.W, h: cont.H }, box, out.result.typ.packs!);
    expect(layout.placements).toHaveLength(out.result.typ.packs!);
    expect(layout.overflow).toBe(0);
    // Semua kemasan di dalam container & tidak saling tumpang tindih (grid).
    for (const p of layout.placements) {
      expect(p.x + p.l).toBeLessThanOrEqual(cont.L + 1e-9);
      expect(p.y + p.w).toBeLessThanOrEqual(cont.W + 1e-9);
      expect(p.z + p.h).toBeLessThanOrEqual(cont.H + 1e-9);
    }
    const keys = new Set(layout.placements.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`));
    expect(keys.size).toBe(layout.placements.length);
  });

  it('urutan muat: dinding depan dulu, bawah ke atas', () => {
    const l = containerPackLayout({ l: cmToM(100), w: cmToM(100), h: cmToM(100) }, { l: cmToM(50), w: cmToM(50), h: cmToM(50) }, 8);
    expect(l.placements.slice(0, 4).every((p) => p.x === 0)).toBe(true);
    expect(l.placements[0]!.z).toBe(0);
    expect(l.placements[2]!.z).toBeGreaterThan(0);
  });

  it('jumlah melebihi grid → overflow dilaporkan', () => {
    const l = containerPackLayout({ l: cmToM(100), w: cmToM(100), h: cmToM(100) }, { l: cmToM(50), w: cmToM(50), h: cmToM(50) }, 10);
    expect(l.placements).toHaveLength(8);
    expect(l.overflow).toBe(2);
  });
});

describe('warehouseStackLayout', () => {
  it('jumlah tumpukan = hasil warehouseSpace; lorong mengikuti utilisasi lantai', () => {
    const pack = { l: cmToM(79), w: cmToM(53), h: cmToM(18), netKg: param('n', 'kg', 25) };
    const out = warehouseSpace({ stock: { massKg: 10_000 }, pack, stackHeightM: 1.8 as never, zone: { L: 20 as never, W: 10 as never } });
    const t = out.result.typ;
    const lay = warehouseStackLayout({ L: 20, W: 10 }, { l: pack.l, w: pack.w }, t.stacks!, t.packs!, 10, 0.65);
    expect(lay.stacks).toHaveLength(t.stacks!);
    expect(lay.stacks.reduce((n, s) => n + s.packs, 0)).toBe(t.packs);
    expect(lay.aisleWidthM).toBeCloseTo((2 * 0.53 * 0.35) / 0.65, 9);
    expect(lay.overflowStacks).toBe(0);
    for (const s of lay.stacks) for (const a of lay.aisles) {
      const overlap = s.y < a.y + a.w - 1e-9 && a.y < s.y + s.w - 1e-9;
      expect(overlap).toBe(false);
    }
  });

  it('zona terlalu kecil → overflow', () => {
    const lay = warehouseStackLayout({ L: 1, W: 1 }, { l: 0.5, w: 0.5 }, 10, 100, 10, 0.65);
    expect(lay.capacityStacks).toBeLessThan(10);
    expect(lay.overflowStacks).toBe(10 - lay.capacityStacks);
  });
});

describe('nestedColumnLayout', () => {
  it('US-05: kolom 100 cm berisi 80 keping; tinggi kolom ≤ ruang', () => {
    const per = nestedColumnCount(1, 0.044, 0.012);
    const cols = nestedColumnLayout({ L: 0.5, W: 0.5 }, 0.1, per, per * 25, 0.044, 0.012);
    expect(cols).toHaveLength(25);
    expect(cols.every((c) => c.pieces === 80)).toBe(true);
    expect(cols[0]!.heightM).toBeLessThanOrEqual(1);
  });
});

it('visibleCount: slider 0–100% → 0..total', () => {
  expect(visibleCount(1200, 0)).toBe(0);
  expect(visibleCount(1200, 0.5)).toBe(600);
  expect(visibleCount(1200, 1)).toBe(1200);
  expect(visibleCount(924, 1.2)).toBe(924);
});
