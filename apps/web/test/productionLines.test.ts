import { shiftPlan } from '@gemas/calc-engine';
import { bundledFormulaDataset, bundledProcessDataset } from '@gemas/dataset';
import { describe, expect, it } from 'vitest';
import { buildLine, type LineOptions } from '@/lib/productionLines';

const f = bundledFormulaDataset();
const proc = bundledProcessDataset();
const base: LineOptions = { counts: {}, overrides: {} };

describe('lini produksi per shift', () => {
  it('kopra + oven listrik IPB: konversi dari dataset & stasiun pembatas manual', () => {
    const line = buildLine('kopra', f, proc, { ...base, dryer: 'oven', ovenProfileId: 'electric' });
    expect(line.stations.map((s) => s.id)).toEqual(['belah', 'congkel', 'oven', 'kupas_testa']);
    const oven = line.stations.find((s) => s.id === 'oven')!;
    expect(oven.batchSize!.typ).toBe(280);
    expect(oven.cycleH!.typ).toBe(13);
    // Kopra per kg daging = (1 − KA daging) / (1 − 6%)
    expect(oven.toProduct.typ).toBeCloseTo((1 - proc.kernelMoisture.typ) / 0.94, 9);
    const plan = shiftPlan({ stations: line.stations, shiftHours: 8, efficiency: 1, shiftsPerDay: 1 });
    // belah 2 org × 50 butir/jam × 8 jam × 0,2 kg/butir = 160 kg
    expect(plan.stations.find((s) => s.id === 'belah')!.capacity.typ).toBeCloseTo(2 * 50 * 8 * 0.2, 9);
    // Oven 13 jam + 1 shift 8 jam → 1 angkatan/hari: 280 kg daging × 0,532 ≈ 149 kg kopra < 160 → oven pembatas.
    expect(plan.stations.find((s) => s.id === 'oven')!.capacity.typ).toBeCloseTo(280 * oven.toProduct.typ, 9);
    expect(plan.bottleneckId).toBe('oven');
  });

  it('kopra + greenhouse: isi angkatan dari kapasitas rak (1.462–1.755 butir)', () => {
    const gh = buildLine('kopra', f, proc, { ...base, dryer: 'greenhouse' }).stations.find((s) => s.id === 'greenhouse')!;
    expect(gh.batchSize!.min).toBe(1462);
    expect(gh.batchSize!.max).toBe(1755);
  });

  it('arang: siklus = bakar + mati hampa (≥8 jam); rendemen acuan / KORA', () => {
    const kiln = buildLine('arang', f, proc, { ...base, kilnMethodId: 'kombi', kilnYield: 'kora' }).stations[0]!;
    expect(kiln.cycleH!.min).toBeGreaterThanOrEqual(8 + 4);
    expect(kiln.toProduct.typ).toBeCloseTo(0.2, 9);
  });

  it('briket: press & oven tanpa data → ditandai wajib isi (tanpa angka karangan)', () => {
    const line = buildLine('briket', f, proc, base);
    expect(line.stations.filter((s) => s.missing).map((s) => s.id)).toEqual(['press', 'oven_briket']);
    const filled = buildLine('briket', f, proc, { ...base, overrides: { press: { rate: 100 }, oven_briket: { batch: 500 } } });
    expect(filled.stations.some((s) => s.missing)).toBe(false);
    // Faktor produk per kg adonan < 1 (air diuapkan)
    expect(filled.stations.find((s) => s.id === 'press')!.toProduct.typ).toBeLessThan(1);
  });

  it('cuka: liter cuka per butir > air kelapa per butir (gula + starter menambah volume)', () => {
    const belah = buildLine('cuka', f, proc, base).stations.find((s) => s.id === 'belah')!;
    expect(belah.toProduct.typ).toBeGreaterThan(f.kopra.water_per_nut_l.typ);
    expect(buildLine('cuka', f, proc, base).stations.find((s) => s.id === 'tank')!.missing).toMatch(/volume/);
  });

  it('bioleather: g kering per L media per siklus = laju · hari · fraksi kering', () => {
    const tray = buildLine('bioleather', f, proc, { ...base, overrides: { tray: { batch: 3.6 } } }).stations[0]!;
    const b = f.bioleather;
    expect(tray.toProduct.typ).toBeCloseTo(b.wet_yield_g_l_day.typ * b.culture_days.typ * b.dry_fraction_of_wet.typ, 9);
    expect(tray.missing).toBeUndefined();
  });
});
