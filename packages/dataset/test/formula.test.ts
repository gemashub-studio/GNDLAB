import { describe, expect, it } from 'vitest';
import { briquetteMix, copraFromNuts, sugarToBrixKg } from '@gemas/calc-engine';
import { bundledFormulaDataset, bundledProcessDataset, loadFormulaDataset, rawFormulaDataset } from '../src/index.ts';

const clone = () => structuredClone(rawFormulaDataset) as Record<string, any>;

describe('dataset formula (ADR-009)', () => {
  const f = bundledFormulaDataset();

  it('valid, versi & kompatibilitas dengan dataset proses v1.1.0', () => {
    expect(f.version).toBe('1.2.0');
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

  it('metode cuka & bioleather (v1.1.0): 5 metode cuka, kultur/plastisasi/pewarna/finishing, ceklis R&D baru', () => {
    expect(f.cuka.methods.map((m) => m.id)).toEqual(['statis', 'semikontinu', 'generator', 'aerasi', 'alami']);
    const gen = f.cuka.methods.find((m) => m.id === 'generator')!;
    expect(gen.p.acetify_h!.typ).toBe(32);
    expect(f.cuka.methods.find((m) => m.id === 'aerasi')!.p.withdraw_fraction!.min).toBe(0.34);
    expect(f.bioleather.plasticizers.map((m) => m.id)).toEqual(['A', 'B', 'C']);
    expect(f.bioleather.cultureMethods.find((m) => m.id === 'berkala')!.p.wet_yield_g_l_day!.typ).toBe(19);
    for (const id of ['rnd-cuka-metode', 'rnd-blt-kultur', 'rnd-blt-plastis', 'rnd-blt-finish']) expect(f.checklists.some((c) => c.id === id)).toBe(true);
    const bad = clone();
    delete bad.cuka.methods[2].acetify_h;
    expect(() => loadFormulaDataset(bad, bundledProcessDataset())).toThrow(/generator butuh/);
    const bad2 = clone();
    bad2.bioleather.plasticizers[0].glycerol_pct_of_bc = bad2.bioleather.plasticizers[0].glycerol_pct_bath;
    expect(() => loadFormulaDataset(bad2, bundledProcessDataset())).toThrow(/tepat satu basis/);
  });

  it('sulfur kopra (DEC-048): tidak ada dosis otomatis; batas residu UE = produk akhir, bukan dosis', () => {
    const sul = f.raw.kopra.sulfur;
    expect(sul.auto_dose).toBe(false);
    expect(sul).not.toHaveProperty('g_per_nut');
    expect(sul).not.toHaveProperty('night_schedule_pct');
    expect(sul.residue_limits[0]).toMatchObject({ jurisdiction: 'EU', max_mg_kg: 50 });
    expect(sul.residue_limits[0]!.note).toMatch(/bukan dosis/);
    expect(f.raw.kopra).not.toHaveProperty('bisulfite_soak_pct');
    // catatan bukti tidak boleh memuat angka dosis (g, kg, g/m³, %) — angka bisa terbaca sebagai anjuran
    for (const e of sul.evidence) expect(e.note).not.toMatch(/\d+(?:[.,]\d+)?\s*(?:g|kg|%|g\/m)/);
    const bad = { ...clone(), kopra: { ...clone().kopra, sulfur: { ...clone().kopra.sulfur, auto_dose: true } } };
    expect(() => loadFormulaDataset(bad, bundledProcessDataset())).toThrow(/sulfur/);
  });

  it('DEC-049: tidak ada parameter A/B yang HANYA bersumber dokumen internal KORA (F01–F06)', () => {
    const internal = new Set(['F01', 'F02', 'F03', 'F04', 'F05', 'F06']);
    const offenders: string[] = [];
    const walk = (o: unknown, path: string) => {
      if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (!o || typeof o !== 'object') return;
      const r = o as Record<string, unknown>;
      if (typeof r.confidence === 'string' && Array.isArray(r.source_ids) && r.confidence !== 'C' && (r.source_ids as string[]).every((id) => internal.has(id))) offenders.push(path);
      for (const [k, v] of Object.entries(r)) if (k !== 'sources') walk(v, `${path}.${k}`);
    };
    walk(rawFormulaDataset, '');
    expect(offenders).toEqual([]);
    expect(f.bioleather.plasticizers[0]!.p.glycerol_pct_bath!.confidence).toBe('C');
  });
});
