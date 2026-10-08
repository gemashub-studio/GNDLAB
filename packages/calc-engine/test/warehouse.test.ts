import { describe, expect, it } from 'vitest';
import { cmToM, effectiveStackHeight, meters, param, warehouseSpace } from '../src/index.ts';

const rho = param('bulk_density', 'kg_m3', 500, 'A');

describe('warehouseSpace — curah', () => {
  it('US-03: 50 t, ρ 500, h 2,5 m, u_f default 0,65 → 61,54 m²', () => {
    const out = warehouseSpace({ stock: { massKg: 50_000 }, rho, stackHeightM: meters(2.5) });
    expect(out.result.typ.volumeM3).toBe(100);
    expect(out.result.typ.footprintM2).toBe(40);
    expect(out.result.typ.floorAreaM2).toBeCloseTo(61.54, 2);
    expect(out.result.typ.floorLoadKgM2).toBe(1250);
    expect(out.binding).toBe('NONE');
  });

  it('stok butir × massa butir rentang', () => {
    const out = warehouseSpace({
      stock: { pieces: 1000, unitMass: param('mass_per_unit', 'kg', { min: 0.45, typ: 0.575, max: 0.85 }, 'B') },
      rho: param('bulk_density', 'kg_m3', 483, 'A'),
      stackHeightM: meters(1.8),
    });
    expect(out.result.typ.massKg).toBeCloseTo(575);
    expect(out.result.min.massKg).toBeCloseTo(450);
    expect(out.result.max.massKg).toBeCloseTo(850);
  });

  it('FLOOR_OVERLOAD & persentase zona', () => {
    const out = warehouseSpace({
      stock: { massKg: 50_000 },
      rho,
      stackHeightM: meters(2.5),
      floorLoadKgM2: 1000,
      zone: { L: meters(10), W: meters(5) },
    });
    expect(out.warnings.map((w) => w.code)).toContain('FLOOR_OVERLOAD');
    expect(out.result.typ.zoneUsedFraction).toBeCloseTo(61.538 / 50, 3);
  });

  it('ODOR_CONTAMINATION bila kopra edible & asalan satu zona', () => {
    const out = warehouseSpace({
      stock: { massKg: 1000 },
      rho,
      stackHeightM: meters(2),
      context: { commodityCode: 'kopra_edible', coStoredCommodities: ['kopra_asalan'] },
    });
    expect(out.warnings.map((w) => w.code)).toContain('ODOR_CONTAMINATION');
  });
});

describe('warehouseSpace — kemasan', () => {
  const pack = { l: cmToM(79), w: cmToM(53), h: cmToM(18), netKg: param('pack.net', 'kg', 25, 'B') };

  it('tumpukan = ⌈karung / karung per tumpuk⌉', () => {
    const out = warehouseSpace({ stock: { massKg: 10_000 }, pack, stackHeightM: meters(1.8) });
    // 400 karung; ⌊1,8 / 0,18⌋ = 10 per tumpuk → 40 tumpuk
    expect(out.result.typ.packs).toBe(400);
    expect(out.result.typ.stacks).toBe(40);
    expect(out.result.typ.footprintM2).toBeCloseTo(40 * 0.79 * 0.53, 9);
  });

  it('kemasan lebih tinggi dari tumpukan → peringatan', () => {
    const out = warehouseSpace({ stock: { massKg: 100 }, pack, stackHeightM: meters(0.1) });
    expect(out.warnings[0]!.code).toBe('ITEM_EXCEEDS_CONTAINER');
    expect(out.result.typ.footprintM2).toBe(0);
  });
});

describe('validasi input', () => {
  it('tinggi efektif = clear height − 0,5 m', () => {
    expect(effectiveStackHeight(3)).toBe(2.5);
    expect(() => effectiveStackHeight(0.4)).toThrow(RangeError);
  });
  it('menolak tinggi tumpuk ≤ 0 dan utilisasi lantai > 1', () => {
    expect(() => warehouseSpace({ stock: { massKg: 1 }, rho, stackHeightM: meters(0) })).toThrow();
    expect(() =>
      warehouseSpace({ stock: { massKg: 1 }, rho, stackHeightM: meters(1), floorUtil: param('u', 'fraction', 1.2) }),
    ).toThrow();
  });
  it('menolak butir pecahan', () => {
    expect(() =>
      warehouseSpace({ stock: { pieces: 1.5, unitMass: param('m', 'kg', 1) }, rho, stackHeightM: meters(1) }),
    ).toThrow(/bulat/);
  });
});
