import { describe, expect, it } from 'vitest';
import { dyeRecipe, finishRecipe, naturalVinegarPotential, param, plasticizerRecipe, vinegarMethodPlan, type Unit } from '../src/index.ts';

/** Metode R&D cuka & bioleather (dataset formula v1.1.0). Angka harapan hitung tangan di komentar. */
const P = (key: string, unit: Unit, v: number | { min: number; typ: number; max: number }, c: 'A' | 'B' | 'C' = 'B') => param(key, unit, v, c);
const alc = P('alc', 'd', { min: 7, typ: 10, max: 14 });

describe('metode asetifikasi cuka', () => {
  it('statis batch 100 L: alkohol 10 + asetifikasi 28 hari → cuka pertama hari 38; 90 hari = 2 batch = 200 L', () => {
    const r = vinegarMethodPlan({ kind: 'batch', workingL: 100, acetifyDays: P('d', 'd', { min: 21, typ: 28, max: 42 }), withdrawFraction: P('f', 'fraction', 1), alcoholDays: alc, horizonDays: 90 }).result;
    expect(r.typ.firstVinegarDays).toBe(38);
    expect(r.typ.cyclesInHorizon).toBe(2);
    expect(r.typ.litersInHorizon).toBe(200);
    expect(r.max.firstVinegarDays).toBe(56); // 14 + 42
  });

  it('semi-kontinu: tarik 70,8% tiap 28 hari → 90 hari = 2 tarikan = 141,6 L', () => {
    const r = vinegarMethodPlan({ kind: 'semi', workingL: 100, acetifyDays: P('d', 'd', 28), withdrawFraction: P('f', 'fraction', { min: 0.667, typ: 0.708, max: 0.75 }), alcoholDays: P('a', 'd', 10), horizonDays: 90 }).result;
    expect(r.typ.cyclesInHorizon).toBe(2);
    expect(r.typ.litersInHorizon).toBeCloseTo(141.6);
    expect(r.min.perCycleL).toBeCloseTo(66.7);
  });

  it('generator 50 L/run: 32 jam/run, 5 run kondisi → cuka pertama hari 16,7; 30 hari = 11 run = 550 L', () => {
    const r = vinegarMethodPlan({ kind: 'generator', workingL: 50, acetifyHours: P('h', 'h', 32), startupRuns: P('n', 'count', 5), alcoholDays: P('a', 'd', 10), horizonDays: 30 }).result;
    expect(r.typ.firstVinegarDays).toBeCloseTo(10 + (5 * 32) / 24);
    expect(r.typ.cyclesInHorizon).toBe(11);
    expect(r.typ.litersInHorizon).toBe(550);
  });

  it('aerasi semi-kontinu 100 L: siklus 6 hari, tarik 50,3% → 30 hari = 3 tarikan = 150,9 L', () => {
    const r = vinegarMethodPlan({ kind: 'semi', workingL: 100, acetifyDays: P('d', 'd', { min: 5, typ: 6, max: 7 }), withdrawFraction: P('f', 'fraction', { min: 0.34, typ: 0.503, max: 0.667 }), alcoholDays: P('a', 'd', 10), horizonDays: 30 }).result;
    expect(r.typ.cyclesInHorizon).toBe(3);
    expect(r.typ.litersInHorizon).toBeCloseTo(150.9);
  });

  it('data metode wajib lengkap', () => {
    expect(() => vinegarMethodPlan({ kind: 'generator', workingL: 50, alcoholDays: alc, horizonDays: 30 })).toThrow(/Generator/);
    expect(() => vinegarMethodPlan({ kind: 'semi', workingL: 50, alcoholDays: alc, horizonDays: 30 })).toThrow(/fraksi tarik/);
  });

  it('tanpa tambah gula: gula alami 1,8% → alkohol ±1,05% v/v, asam ±0,70% (< 4%) + peringatan', () => {
    const r = naturalVinegarPotential({
      waterL: 100,
      density: P('rho', 'kg_L', 1.02),
      naturalSugarPct: P('s', 'pct', 1.8),
      ethanolEfficiency: P('e', 'fraction', 0.88),
      aceticEfficiency: P('a', 'fraction', 0.75),
      starterPct: 15,
      aceticMinPct: 4,
    });
    expect(r.result.typ.ethanolPctV).toBeCloseTo(1.046, 2);
    expect(r.result.typ.aceticPotentialPct).toBeCloseTo(0.702, 2);
    expect(r.warnings.map((w) => w.code)).toContain('ACETIC_POTENTIAL_LOW');
  });
});

describe('resep bioleather', () => {
  it('plastisasi A 10 L × 1% = 100 g gliserol; B 30% × 200 g BC = 60 g; C 3 L 1:2 = 1.000 mL gliserin + 2.000 mL etanol', () => {
    expect(plasticizerRecipe({ basis: { kind: 'bath_pct', glycerolPct: P('g', 'pct', 1, 'A') }, bathL: 10, bcDryG: 0 }).result.typ.glycerolG).toBeCloseTo(100);
    expect(plasticizerRecipe({ basis: { kind: 'bc_pct', glycerolPctOfBc: P('g', 'pct', 30, 'A') }, bathL: 0, bcDryG: 200 }).result.typ.glycerolG).toBeCloseTo(60);
    const c = plasticizerRecipe({ basis: { kind: 'glycerin_ethanol', glycerinFraction: P('r', 'fraction', 0.5, 'A') }, bathL: 3, bcDryG: 0 }).result.typ;
    expect(c.glycerinMl).toBeCloseTo(1000);
    expect(c.ethanolMl).toBeCloseTo(2000);
    expect(() => plasticizerRecipe({ basis: { kind: 'bc_pct', glycerolPctOfBc: P('g', 'pct', 30) }, bathL: 1, bcDryG: 0 })).toThrow(/BC kering/);
  });

  it('pewarna: 5 L tawas 20 g/L = 100 g, garam 100 g; kopi 200% × 50 g = 100 g', () => {
    expect(dyeRecipe({ bathL: 5, fiberDryG: 0, mordantGPerL: P('m', 'g_L', 20), saltGPerL: P('s', 'g_L', 20) }).result.typ).toMatchObject({ mordantG: 100, saltG: 100, dyeG: 0 });
    expect(dyeRecipe({ bathL: 5, fiberDryG: 50, dyePctOfFiber: P('d', 'pct', 200) }).result.typ.dyeG).toBe(100);
  });

  it('finishing 0,5 m² × 40 g/m² lilin:minyak 50:50 → 10 g + 10 g', () => {
    expect(finishRecipe({ areaM2: 0.5, coverageGPerM2: 40, waxSharePct: P('w', 'pct', 50) }).result.typ).toMatchObject({ totalG: 20, waxG: 10, oilG: 10 });
  });
});
