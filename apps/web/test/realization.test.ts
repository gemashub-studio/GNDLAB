import { bundledDataset } from '@gemas/dataset';
import { describe, expect, it } from 'vitest';
import { realizationReport } from '@/lib/realization';

const ds = bundledDataset();
const jambul = { commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP' } as const;

describe('realisasi stuffing', () => {
  it('prediksi butir = kalkulator mode butir; selisih & target ≤ 10%', () => {
    const r = realizationReport(ds, { ...jambul, actualPieces: 22_500, fullByVolume: true });
    expect(r.basis).toBe('pieces');
    const pred = Math.floor((33.2 * 385) / 0.575);
    expect(r.predicted).toBe(pred);
    expect(r.gap).toBeCloseTo((22_500 - pred) / pred, 9);
    expect(r.withinTarget).toBe(true);
    // Densitas tersirat = butir × massa typ ÷ (V · u).
    expect(r.massFromPieces).toBe(true);
    expect(r.impliedDensity).toBeCloseTo((22_500 * 0.575) / 33.2, 6);
  });

  it('berat timbang diutamakan untuk densitas; selisih > 10% ditandai', () => {
    const r = realizationReport(ds, { ...jambul, actualPieces: 19_000, actualMassKg: 11_400, fullByVolume: true });
    expect(r.withinTarget).toBe(false);
    expect(r.massFromPieces).toBe(false);
    expect(r.impliedDensity).toBeCloseTo(11_400 / 33.2, 6);
  });

  it('container belum penuh → densitas tidak disimpulkan', () => {
    const r = realizationReport(ds, { ...jambul, actualPieces: 15_000, fullByVolume: false });
    expect(r.impliedDensity).toBeUndefined();
    expect(r.densityBlocked).toMatch(/belum penuh/);
  });

  it('mode berat (tanpa butir) membandingkan massa', () => {
    const r = realizationReport(ds, { commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '40HC', actualMassKg: 20_000, fullByVolume: true });
    expect(r.basis).toBe('mass');
    expect(r.predicted).toBeGreaterThan(0);
  });

  it('input kosong ditolak', () => {
    expect(() => realizationReport(ds, { ...jambul, fullByVolume: true })).toThrow(/butir atau berat/);
  });
});
