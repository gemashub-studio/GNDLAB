import { describe, expect, it } from 'vitest';
import {
  cmToM,
  convert,
  correctMoisture,
  correctMoistureRange,
  ENGINE_VERSION,
  gToKg,
  InvalidMoistureError,
  kg,
  MissingInputError,
  nestedCapacity,
  nestedColumnCount,
  nutsToCopraKg,
  param,
  pctToFraction,
  shellToCharcoalKg,
  stowageFactorToDensity,
  tradeInchToDiameterM,
  zoneWarnings,
} from '../src/index.ts';
import pkg from '../package.json' with { type: 'json' };

describe('moisture', () => {
  it('US-04: 1.000 kg @15% → 6% = 904,26 kg', () => {
    expect(correctMoisture(1000, 0.15, 0.06)).toBeCloseTo(904.26, 2);
  });
  it('kadar air ≥ 100% atau < 0 ditolak (ARD §9)', () => {
    expect(() => correctMoisture(1000, 1, 0.06)).toThrow(InvalidMoistureError);
    expect(() => correctMoisture(1000, 0.15, -0.01)).toThrow(InvalidMoistureError);
  });
  it('versi rentang', () => {
    const r = correctMoistureRange({ min: 1000, typ: 1000, max: 1000 }, { min: 0.08, typ: 0.12, max: 0.22 }, { min: 0.06, typ: 0.06, max: 0.06 });
    expect(r.max).toBeCloseTo((1000 * 0.92) / 0.94);
    expect(r.min).toBeCloseTo((1000 * 0.78) / 0.94);
  });
});

describe('nesting', () => {
  it('US-05: H 100, cup 4,4, pitch 1,2 → 80 keping/kolom', () => {
    expect(nestedColumnCount(cmToM(100), cmToM(4.4), cmToM(1.2))).toBe(80);
  });
  it('ruang lebih rendah dari satu cup → 0', () => {
    expect(nestedColumnCount(cmToM(4), cmToM(4.4), cmToM(1.2))).toBe(0);
  });
  it('kapasitas kolom persegi dalam ruang', () => {
    const out = nestedCapacity({
      space: { L: cmToM(100), W: cmToM(50), H: cmToM(100), payloadKg: kg(1_000_000) },
      rimDiameter: param('geometry.charcoal_half.rim_diameter', 'm', cmToM(10), 'C'),
      cupHeight: param('geometry.charcoal_half.depth', 'm', cmToM(4.4), 'C'),
      pitch: param('geometry.nest_pitch', 'm', cmToM(1.2), 'C'),
      unitMass: param('mass_per_unit.charcoal_half', 'kg', gToKg(25), 'C'),
      context: { commodityCode: 'arang_batok_belah2' },
    });
    expect(out.result.typ.columns).toBe(50);
    expect(out.result.typ.pieces).toBe(4000);
    expect(out.result.typ.massKg).toBeCloseTo(100);
    expect(out.warnings.map((w) => w.code)).toEqual(['LOW_CONFIDENCE_PARAM', 'FLAMMABLE']);
  });
});

describe('convert', () => {
  const unitMass = param('mass_per_unit', 'kg', { min: 0.45, typ: 0.575, max: 0.85 }, 'B');
  const rho = param('bulk_density', 'kg_m3', { min: 445, typ: 483, max: 520 }, 'A');

  it('butir → kg dengan rentang', () => {
    const out = convert({ from: { unit: 'pcs', value: 1000 }, to: 'kg', params: { unitMass } });
    expect(out.result).toEqual({ min: { value: 450 }, typ: { value: 575 }, max: { value: 850 } });
    expect(out.confidence).toBe('B');
  });
  it('kg → m³ → kg bolak-balik', () => {
    const a = convert({ from: { unit: 'kg', value: 483 }, to: 'm3', params: { rho } });
    expect(a.result.typ.value).toBe(1);
    const b = convert({ from: { unit: 'm3', value: 1 }, to: 't', params: { rho } });
    expect(b.result.typ.value).toBeCloseTo(0.483);
  });
  it('karung ↔ butir lewat pcsPerPack; karung ↔ kg lewat berat bersih', () => {
    expect(convert({ from: { unit: 'pack', value: 2 }, to: 'pcs', params: { unitMass, pcsPerPack: 25 } }).result.typ.value).toBeCloseTo(50);
    expect(
      convert({ from: { unit: 't', value: 1 }, to: 'pack', params: { packNetKg: param('pack.net', 'kg', 25) } }).result.typ.value,
    ).toBe(40);
  });
  it('parameter rute hilang → MissingInputError', () => {
    expect(() => convert({ from: { unit: 'pcs', value: 1 }, to: 'kg', params: {} })).toThrow(MissingInputError);
  });
  it('parameter yang tidak dipakai rute tidak masuk trace', () => {
    const out = convert({ from: { unit: 'kg', value: 1 }, to: 't', params: { unitMass, rho } });
    expect(Object.keys(out.trace.params)).toEqual([]);
  });
});

describe('konversi khusus', () => {
  it('spek dagang 12 inch = keliling → D ≈ 9,7 cm (DEC-006)', () => {
    expect(tradeInchToDiameterM(12) * 100).toBeCloseTo(9.70, 2);
  });
  it('stowage factor 2,0 m³/t → 500 kg/m³', () => {
    expect(stowageFactorToDensity(2)).toBe(500);
  });
  it('butir → kopra & batok → arang', () => {
    expect(nutsToCopraKg(4000, { min: 3.5, typ: 4, max: 5 })).toEqual({ min: 800, typ: 1000, max: 4000 / 3.5 });
    expect(shellToCharcoalKg(1000, { min: 0.25, typ: 0.3, max: 0.35 }).typ).toBeCloseTo(300);
  });
  it('persen → fraksi tervalidasi', () => {
    expect(pctToFraction(12)).toBeCloseTo(0.12);
    expect(() => pctToFraction(120)).toThrow();
  });
});

it('zoneWarnings tanpa pasangan bermasalah → kosong', () => {
  expect(zoneWarnings(['kopra_edible', 'kelapa_jambul'])).toEqual([]);
});

it('ENGINE_VERSION sinkron dengan package.json', () => {
  expect(ENGINE_VERSION).toBe(pkg.version);
});
