/**
 * Kontrak golden cases (calculation_spec §7). File fixture dibangkitkan validate_dataset.py —
 * JANGAN diedit. Bila gagal: perbaiki engine, bukan fixture.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bestGridFit,
  cmToM,
  containerCapacity,
  correctMoisture,
  gToKg,
  kg,
  m3,
  nestedColumnCount,
  param,
  warehouseSpace,
  type ContainerSpec,
} from '../src/index.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../architecture/${p}`, import.meta.url));
const golden = JSON.parse(readFileSync(root('tests/fixtures/golden_cases.json'), 'utf8')) as {
  generated_from_version: string;
  cases: Array<Record<string, any>>;
};
const dataset = JSON.parse(readFileSync(root('00-research/data/coconut_inventory_dataset.json'), 'utf8')) as {
  meta: { version: string };
  containers: Array<{ id: string; inner_cm: { L: number; W: number; H: number }; volume_m3: number; payload_kg: number }>;
};

/** Toleransi uji engine ±0,5% (calculation_spec §7). */
const TOL = 0.005;
const expectClose = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(TOL);
};

function container(id: string): ContainerSpec {
  const c = dataset.containers.find((x) => x.id === id);
  if (!c) throw new Error(`container ${id} tidak ada di dataset`);
  return {
    L: cmToM(c.inner_cm.L),
    W: cmToM(c.inner_cm.W),
    H: cmToM(c.inner_cm.H),
    payloadKg: kg(c.payload_kg),
    volumeM3: m3(c.volume_m3),
  };
}

type Runner = (c: Record<string, any>) => void;

/** Pilih runner berdasarkan bentuk kasus; kasus yang tak dikenali = gagal (kontrak tidak boleh terlewat). */
function runnerFor(c: Record<string, any>): Runner | undefined {
  if ('expect_pcs' in c) {
    return () => {
      const out = containerCapacity({
        container: container(c.container),
        form: {
          mode: 'PIECE',
          rho: param('bulk_density', 'kg_m3', c.rho_eff_kg_m3),
          unitMass: param('mass_per_unit', 'kg', gToKg(c.unit_mass_g)),
        },
      });
      expectClose(out.result.typ.pieces!, c.expect_pcs);
      expect(out.binding).toBe(c.expect_binding);
    };
  }
  if ('expect_t' in c) {
    return () => {
      const out = containerCapacity({
        container: container(c.container),
        form: { mode: 'BULK', rho: param('bulk_density', 'kg_m3', c.rho_eff_kg_m3) },
        ...(c.volume_util !== undefined && { volumeUtil: param('volume_util', 'fraction', c.volume_util) }),
      });
      expectClose(out.result.typ.massKg / 1000, c.expect_t);
      expect(out.binding).toBe(c.expect_binding);
    };
  }
  switch (c.case) {
    case 'moisture_correction':
      return () => expectClose(correctMoisture(c.input.M1_kg, c.input.w1, c.input.w2), c.expect.M2_kg);
    case 'nested_stack_count':
      return () =>
        expect(nestedColumnCount(cmToM(c.input.H_cm), cmToM(c.input.h_cup_cm), cmToM(c.input.pitch_cm))).toBe(
          c.expect.n,
        );
    case 'warehouse_floor_area':
      return () => {
        const out = warehouseSpace({
          stock: { massKg: c.input.mass_kg },
          rho: param('bulk_density', 'kg_m3', c.input.rho_kg_m3),
          stackHeightM: c.input.h_stack_m,
          floorUtil: param('floor_util', 'fraction', c.input.u_floor),
        });
        expectClose(out.result.typ.floorAreaM2, c.expect.A_m2);
      };
  }
  if (typeof c.case === 'string' && c.case.startsWith('grid_fit_')) {
    return () => {
      const cont = container(c.input.container);
      const b = c.input.bag_cm;
      const box = { l: cmToM(b.l), w: cmToM(b.w), h: cmToM(b.h) };
      if ('bags' in c.expect) {
        // Jumlah karung adalah bilangan bulat → harus persis sama.
        expect(bestGridFit({ l: cont.L, w: cont.W, h: cont.H }, box).count).toBe(c.expect.bags);
        return;
      }
      expect(bestGridFit({ l: cont.L, w: cont.W, h: cont.H }, box).count).toBe(c.expect.bags_geom);
      const out = containerCapacity({
        container: cont,
        form: { mode: 'PACKAGE', pack: { ...box, netKg: param('pack.net', 'kg', c.input.bag_net_kg) } },
      });
      expectClose(out.result.typ.massKg / 1000, c.expect.load_t);
      expect(out.binding).toBe(c.expect.binding);
    };
  }
  return undefined;
}

describe('golden cases (kontrak engine)', () => {
  it('fixture dibangkitkan dari versi dataset yang sama', () => {
    expect(golden.generated_from_version).toBe(dataset.meta.version);
  });

  it('berisi tepat 17 kasus dan semuanya dikenali runner', () => {
    expect(golden.cases).toHaveLength(17);
    const unknown = golden.cases.filter((c) => !runnerFor(c)).map((c) => c.case);
    expect(unknown).toEqual([]);
  });

  it.each(golden.cases.map((c) => [c.case as string, c] as const))('%s', (_name, c) => {
    runnerFor(c)!(c);
  });
});
