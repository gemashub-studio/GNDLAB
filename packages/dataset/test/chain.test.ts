import { describe, expect, it } from 'vitest';
import { bundledChainDataset, bundledDataset, bundledFormulaDataset, loadChainDataset, rawChainDataset } from '../src/index.ts';

const clone = () => structuredClone(rawChainDataset) as Record<string, any>;
const load = (raw: unknown) => loadChainDataset(raw, bundledFormulaDataset(), bundledDataset());

describe('dataset rantai produksi (ADR-010)', () => {
  const c = bundledChainDataset();

  it('valid & terkunci ke dataset formula v1.2.0 + inventory v1.0.4; tanpa parameter fumigasi (DEC-048)', () => {
    expect(c.version).toBe('1.1.0');
    expect(Object.keys(c.raw.greenhouse).filter((k) => k.startsWith('sulfur'))).toEqual([]);
    expect(() => load({ ...clone(), meta: { ...clone().meta, requires_formula_dataset: '9.9.9' } })).toThrow(/butuh dataset formula/);
    expect(() => load({ ...clone(), meta: { ...clone().meta, requires_inventory_dataset: '9.9.9' } })).toThrow(/butuh dataset inventory/);
  });

  it('kendaraan: truk dataset rantai + container inventory (20GP/40GP/40HC) + 45HC', () => {
    const ids = c.vehicles.map((v) => v.id);
    for (const id of ['pickup', 'cdd_box', 'tronton_wingbox', '20GP', '40GP', '40HC', 'c45hc']) expect(ids).toContain(id);
    const c45 = c.vehicles.find((v) => v.id === 'c45hc')!;
    expect(c45.L).toBeCloseTo(13.556);
    expect(c45.payload.typ).toBe(27700);
    // container inventory TIDAK disalin ke dataset rantai
    expect(rawChainDataset.vehicles.some((v: { id: string }) => v.id === '20GP')).toBe(false);
  });

  it('kelas asal: DR ≤500 / DT >500 mdpl (keputusan owner K-03)', () => {
    const [dr, dt] = c.raw.origin.classes;
    expect(dr!.altitude_max_m).toBe(500);
    expect(dt!.altitude_min_m).toBe(500);
  });

  it('source_id tak terdaftar, id kendaraan ganda & pembagian grade ≠100% ditolak', () => {
    const a = clone();
    a.greenhouse.tier_pitch_m.source_ids = ['C99'];
    expect(() => load(a)).toThrow(/C99/);
    const b = clone();
    b.vehicles[1].id = b.vehicles[0].id;
    expect(() => load(b)).toThrow(/ganda/);
    const g = clone();
    g.sorting.grade_split_pct[0].asalan = 30;
    expect(() => load(g)).toThrow(/100%/);
  });

  it('parameter greenhouse cocok dengan contoh KORA (rak 0,65 m, jarak tingkat 0,5 m, kemiringan °)', () => {
    expect(c.greenhouse.rack_depth_m.typ).toBe(0.65);
    expect(c.greenhouse.tier_pitch_m.typ).toBe(0.5);
    expect(c.greenhouse.face_up_tilt_deg.unit).toBe('deg');
    expect(c.greenhouse.face_up_tilt_deg.min).toBe(15);
    expect(c.greenhouse.face_up_tilt_deg.max).toBe(30);
  });
});
