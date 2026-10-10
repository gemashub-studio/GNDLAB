import { describe, expect, it } from 'vitest';
import { briquetteMix, copraFromNuts, sugarToBrixKg } from '@gemas/calc-engine';
import { bundledFormulaDataset, bundledProcessDataset, loadFormulaDataset, rawFormulaDataset } from '../src/index.ts';

const clone = () => structuredClone(rawFormulaDataset) as Record<string, any>;

describe('dataset formula (ADR-009)', () => {
  const f = bundledFormulaDataset();

  it('valid, versi & kompatibilitas dengan dataset proses v1.1.0', () => {
    expect(f.version).toBe('1.0.0');
    expect(bundledProcessDataset().version).toBe('1.1.0');
    expect(() => loadFormulaDataset({ ...clone(), meta: { ...clone().meta, requires_process_dataset: '9.9.9' } }, bundledProcessDataset())).toThrow(/butuh dataset proses/);
  });

  it('dataset proses v1.1.0: koreksi K-01 (mati hampa ≥8 jam) & K-02 (oven kopra ≤70 °C)', () => {
    const p = bundledProcessDataset();
    expect(p.charcoal.coolingH.min).toBeGreaterThanOrEqual(8);
    expect(p.dryingMethods.find((m) => m.id === 'oven')!.temperatureC!.max).toBeLessThanOrEqual(70);
  });

  it('source_id tak terdaftar & sumber tanpa url/doc ditolak', () => {
    const bad = clone();
    bad.cuka.must_brix.source_ids = ['F99'];
    expect(() => loadFormulaDataset(bad, bundledProcessDataset())).toThrow(/F99/);
    const bad2 = clone();
    delete bad2.sources[0].doc;
    expect(() => loadFormulaDataset(bad2, bundledProcessDataset())).toThrow(/url atau doc/);
  });

  it('rentang tidak urut & id ceklis ganda ditolak', () => {
    const bad = clone();
    bad.briket.binder_pct.min = 9;
    expect(() => loadFormulaDataset(bad, bundledProcessDataset())).toThrow(/min ≤ typ ≤ max/);
    const dup = clone();
    dup.checklists[1].id = dup.checklists[0].id;
    expect(() => loadFormulaDataset(dup, bundledProcessDataset())).toThrow(/ganda/);
  });

  it('parameter dipetakan ke Param engine (satuan & keyakinan)', () => {
    expect(f.briket.binder_pct).toMatchObject({ key: 'briket.binder_pct', unit: 'pct', min: 4, typ: 6, max: 8, confidence: 'B' });
    expect(f.cuka.water_density_kg_l.unit).toBe('kg_L');
    expect(f.kopra.greenhouseArea.unit).toBe('m2');
    expect(f.stations.find((s) => s.id === 'belah')!.rate.unit).toBe('count_h');
    // KA daging dirujuk dari dataset proses (fraksi → persen), tidak disalin.
    expect(f.kopra.meatMoisturePct.typ).toBeCloseTo(bundledProcessDataset().kernelMoisture.typ * 100, 9);
  });

  it('3 varian briket bertautan kode R&D BS/BB/BC', () => {
    expect(f.briket.variants.map((v) => [v.id, v.rnd_code])).toEqual([['shisha', 'BS'], ['bbq', 'BB'], ['custom', 'BC']]);
  });

  it('ceklis mencakup semua jenis & produk', () => {
    const types = new Set(f.checklists.map((c) => c.type));
    const products = new Set(f.checklists.map((c) => c.product));
    expect([...types].sort()).toEqual(['product', 'qc', 'rnd']);
    expect([...products].sort()).toEqual(['arang', 'bioleather', 'briket', 'cuka', 'kopra']);
  });

  it('cek silang: rendemen kopra dari butir masuk rentang FAO/ILO 150–250 kg/1.000 butir', () => {
    const r = copraFromNuts({
      nuts: 1000,
      meatPerNutKg: f.kopra.meat_per_nut_kg,
      meatMoisturePct: f.kopra.meatMoisturePct,
      targetMoisturePct: 6,
      waterPerNutL: f.kopra.water_per_nut_l,
    }).result.typ;
    expect(r.copraPer1000Nuts).toBeGreaterThanOrEqual(f.kopra.copra_kg_per_1000_nuts.min);
    expect(r.copraPer1000Nuts).toBeLessThanOrEqual(f.kopra.copra_kg_per_1000_nuts.max);
  });

  it('cek silang: gula must typ dataset (4,5 → 15 °Brix) masuk akal & air adonan briket positif', () => {
    const c = f.cuka;
    expect(sugarToBrixKg(100 * c.water_density_kg_l.typ, c.water_brix.typ, c.must_brix.typ)).toBeGreaterThan(12);
    const b = f.briket;
    const out = briquetteMix({
      charcoalKg: 100,
      charcoalMoisturePct: b.charcoal_powder_moisture_pct.typ,
      binderPct: b.binder_pct.typ,
      binderMoisturePct: b.binder_moisture_pct.typ,
      doughMoisturePct: b.dough_moisture_pct.typ,
      finalMoisturePct: 6,
      hotWaterSharePct: b.binder_hot_water_share_pct.typ,
      piece: { kind: 'cube', sideMm: 25 },
      density: b.variants[0]!.density,
      binderRange: b.binder_pct,
      doughMoistureRange: b.dough_moisture_pct,
    });
    expect(out.result.typ.waterKg).toBeGreaterThan(0);
    expect(out.warnings.map((w) => w.code)).not.toContain('DOUGH_TOO_WET');
  });
});
