import { describe, expect, it } from 'vitest';
import {
  bestGridFit,
  cmToM,
  containerCapacity,
  kg,
  m3,
  MissingInputError,
  overrideParam,
  param,
  type ContainerSpec,
} from '../src/index.ts';

const C20: ContainerSpec = {
  L: cmToM(589.8),
  W: cmToM(235.2),
  H: cmToM(239.3),
  payloadKg: kg(28200),
  volumeM3: m3(33.2),
};
const rhoJambul = param('bulk_density', 'kg_m3', { min: 360, typ: 385, max: 410 }, 'C');
const massJambul = param('mass_per_unit', 'kg', { min: 0.45, typ: 0.575, max: 0.85 }, 'B');

describe('containerCapacity — PIECE', () => {
  const out = containerCapacity({
    container: C20,
    form: { mode: 'PIECE', rho: rhoJambul, unitMass: massJambul },
    context: { commodityCode: 'kelapa_jambul', benchmarks: [{ conservative: true, pieces: { min: 10000, max: 11000 } }] },
    datasetVersion: '1.0.4',
  });

  it('typ ≈ 22.230 butir, VOLUME', () => {
    expect(out.result.typ.pieces).toBe(22229); // floor (spec); golden membulatkan → 22.230
    expect(out.binding).toBe('VOLUME');
  });

  it('min = ρ_min / m_max; max = ρ_max / m_min (ADR-003)', () => {
    expect(out.result.min.pieces).toBe(Math.floor((33.2 * 360) / 0.85));
    expect(out.result.max.pieces).toBe(Math.floor((33.2 * 410) / 0.45));
  });

  it('peringatan: estimasi C, umur simpan, gap benchmark konservatif', () => {
    const codes = out.warnings.map((w) => w.code);
    expect(codes).toEqual(['LOW_CONFIDENCE_PARAM', 'SHELF_LIFE', 'CONSERVATIVE_BENCHMARK_GAP']);
    expect(out.warnings[0]!.detail).toBe('bulk_density');
  });

  it('trace & keyakinan gabungan', () => {
    expect(out.confidence).toBe('C');
    expect(out.trace.datasetVersion).toBe('1.0.4');
    expect(out.trace.params.bulk_density).toMatchObject({ source: 'dataset', confidence: 'C' });
  });

  it('isi volume 100% saat VOLUME-limited', () => {
    expect(out.result.typ.volumeFill).toBeCloseTo(1, 3);
    expect(out.result.typ.weightFill).toBeCloseTo((22229 * 0.575) / 28200, 6);
  });
});

describe('containerCapacity — BULK', () => {
  it('WEIGHT-limited bila V·u·ρ > payload', () => {
    const out = containerCapacity({
      container: { ...C20, volumeM3: m3(76.3), payloadKg: kg(26500) },
      form: { mode: 'BULK', rho: param('bulk_density', 'kg_m3', 475, 'B') },
      volumeUtil: param('volume_util', 'fraction', 0.8, 'B'),
      context: { commodityCode: 'arang_batok_belah2' },
    });
    expect(out.binding).toBe('WEIGHT');
    expect(out.result.typ.massKg).toBe(26500);
    expect(out.warnings.map((w) => w.code)).toEqual(['WEIGHT_LIMITED', 'FLAMMABLE']);
  });

  it('tanpa volumeM3 → volume = L·W·H', () => {
    const { volumeM3: _, ...noNominal } = C20;
    const out = containerCapacity({ container: noNominal, form: { mode: 'BULK', rho: param('rho', 'kg_m3', 100) } });
    expect(out.result.typ.massKg).toBeCloseTo(5.898 * 2.352 * 2.393 * 100, 6);
  });

  it('override dianggap pasti & tidak memicu LOW_CONFIDENCE', () => {
    const out = containerCapacity({
      container: C20,
      form: { mode: 'BULK', rho: overrideParam(param('rho', 'kg_m3', { min: 50, typ: 85, max: 155 }, 'C'), 90) },
    });
    expect(out.result.min.massKg).toBe(out.result.max.massKg);
    expect(out.warnings).toEqual([]);
    expect(out.trace.params.rho!.source).toBe('override');
  });

  it('SELF_HEATING_RISK untuk kopra dengan kadar air > 10%', () => {
    const base = { container: C20, form: { mode: 'BULK' as const, rho: param('rho', 'kg_m3', 440, 'A') } };
    const wet = containerCapacity({ ...base, context: { commodityCode: 'kopra_asalan', moisture: { min: 0.08, typ: 0.12, max: 0.22 } } });
    const dry = containerCapacity({ ...base, context: { commodityCode: 'kopra_edible', moisture: { min: 0.04, typ: 0.05, max: 0.06 } } });
    expect(wet.warnings.map((w) => w.code)).toContain('SELF_HEATING_RISK');
    expect(dry.warnings.map((w) => w.code)).not.toContain('SELF_HEATING_RISK');
  });

  it('input wajib hilang → MissingInputError', () => {
    expect(() => containerCapacity({ container: C20, form: { mode: 'BULK' } })).toThrow(MissingInputError);
    expect(() => containerCapacity({ container: C20, form: { mode: 'PIECE', rho: rhoJambul } })).toThrow(/unitMass/);
  });

  it('container tidak valid → RangeError', () => {
    expect(() =>
      containerCapacity({ container: { ...C20, payloadKg: kg(0) }, form: { mode: 'BULK', rho: rhoJambul } }),
    ).toThrow(RangeError);
  });
});

describe('containerCapacity — PACKAGE', () => {
  const bag = { l: cmToM(49), w: cmToM(34), h: cmToM(21) };

  it('924 karung jambul × 25 butir', () => {
    const out = containerCapacity({
      container: C20,
      form: { mode: 'PACKAGE', pack: { ...bag, netKg: param('pack.net', 'kg', { min: 13, typ: 14, max: 14.5 }), pcs: 25 } },
    });
    expect(out.result.typ.packs).toBe(924);
    expect(out.result.typ.pieces).toBe(924 * 25);
    expect(out.binding).toBe('VOLUME');
  });

  it('kemasan lebih besar dari container → 0 + ITEM_EXCEEDS_CONTAINER', () => {
    const out = containerCapacity({
      container: C20,
      form: { mode: 'PACKAGE', pack: { l: cmToM(300), w: cmToM(300), h: cmToM(300), netKg: param('pack.net', 'kg', 550) } },
    });
    expect(out.result.typ.packs).toBe(0);
    expect(out.result.max.massKg).toBe(0);
    expect(out.binding).toBe('NONE');
    expect(out.warnings[0]!.code).toBe('ITEM_EXCEEDS_CONTAINER');
  });
});

describe('bestGridFit', () => {
  it('memilih orientasi terbaik & melaporkan grid per sumbu', () => {
    const fit = bestGridFit({ l: cmToM(589.8), w: cmToM(235.2), h: cmToM(239.3) }, { l: cmToM(49), w: cmToM(34), h: cmToM(21) });
    expect(fit.count).toBe(924);
    expect(fit.grid.nx * fit.grid.ny * fit.grid.nz).toBe(924);
  });

  it('pembagian pas tidak hilang karena floating-point (FND-003)', () => {
    // 2,352 / 0,336 = 7 tepat; tanpa epsilon IEEE-754 bisa memberi 6
    const fit = bestGridFit({ l: cmToM(235.2), w: cmToM(33.6), h: cmToM(33.6) }, { l: cmToM(33.6), w: cmToM(33.6), h: cmToM(33.6) });
    expect(fit.count).toBe(7);
  });

  it('menolak dimensi ≤ 0', () => {
    expect(() => bestGridFit({ l: cmToM(1), w: cmToM(1), h: cmToM(1) }, { l: cmToM(0), w: cmToM(1), h: cmToM(1) })).toThrow();
  });
});

it('NFR-01: satu skenario < 50 ms', () => {
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) {
    containerCapacity({ container: C20, form: { mode: 'PIECE', rho: rhoJambul, unitMass: massJambul } });
  }
  expect((performance.now() - t0) / 100).toBeLessThan(50);
});
