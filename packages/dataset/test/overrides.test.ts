import { containerCapacity } from '@gemas/calc-engine';
import { describe, expect, it } from 'vitest';
import { applyParameterOverrides, buildContainerInput, bundledDataset, DatasetError, diffParameters, getForm } from '../src/index.ts';

const base = bundledDataset();

describe('override parameter versi kalibrasi', () => {
  const o = { commodityId: 'kelapa_jambul', formCode: 'bagged', key: 'bulk_density', min: 390, typ: 400, max: 415, confidence: 'A' as const, note: 'kalibrasi n=12' };

  it('dataset baru memakai nilai kalibrasi; basis tidak berubah', () => {
    const v = applyParameterOverrides(base, '1.0.5', [o]);
    expect(v.version).toBe('1.0.5');
    expect(getForm(v, 'kelapa_jambul', 'bagged').params.bulk_density).toMatchObject({ typ: 400, confidence: 'A', note: 'kalibrasi n=12' });
    expect(getForm(base, 'kelapa_jambul', 'bagged').params.bulk_density!.typ).toBe(385);
    // Form lain tidak ikut berubah (referensi sama).
    expect(getForm(v, 'kelapa_jambul', 'loose')).toBe(getForm(base, 'kelapa_jambul', 'loose'));
  });

  it('engine menghitung dengan nilai baru: 33,2 × 400 / 0,575', () => {
    const v = applyParameterOverrides(base, '1.0.5', [o]);
    const out = containerCapacity(buildContainerInput(v, { commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE' }));
    expect(out.result.typ.pieces).toBe(Math.floor((33.2 * 400) / 0.575));
    expect(out.trace.datasetVersion).toBe('1.0.5');
    expect(out.trace.params.bulk_density!.confidence).toBe('A');
  });

  it('diffParameters hanya mengembalikan yang berbeda', () => {
    const same = { ...o, min: 360, typ: 385, max: 410, confidence: 'C' as const };
    expect(diffParameters(base, [same, o])).toEqual([o]);
  });

  it('form / parameter tak dikenal atau rentang buruk → DatasetError', () => {
    expect(() => applyParameterOverrides(base, 'x', [{ ...o, formCode: 'zzz' }])).toThrow(DatasetError);
    expect(() => applyParameterOverrides(base, 'x', [{ ...o, key: 'nope' }])).toThrow(DatasetError);
    expect(() => applyParameterOverrides(base, 'x', [{ ...o, min: 500 }])).toThrow(DatasetError);
  });
});
