/**
 * Versi dataset hasil kalibrasi (ADR-002/ADR-008): patch SemVer hanya mengubah NILAI parameter.
 * Dataset versi X = dataset ter-bundle (basis) + override parameter yang berbeda dari basis.
 * Dipakai server (override dari DB) & client (override dari /api/v1/datasets/active, di-cache offline).
 */
import type { Confidence } from '@gemas/calc-engine';
import { DatasetError, type DatasetSI } from './loader.ts';

export interface ParameterOverride {
  commodityId: string;
  formCode: string;
  key: string;
  min: number;
  typ: number;
  max: number;
  confidence: Confidence;
  note?: string;
}

const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Hanya baris yang berbeda dari basis (nilai atau keyakinan). */
export function diffParameters(base: DatasetSI, rows: readonly ParameterOverride[]): ParameterOverride[] {
  return rows.filter((r) => {
    const p = base.commodities.find((c) => c.id === r.commodityId)?.forms.find((f) => f.code === r.formCode)?.params[r.key];
    return !p || !same(p.min, r.min) || !same(p.typ, r.typ) || !same(p.max, r.max) || p.confidence !== r.confidence;
  });
}

/** Salinan dataset basis dengan override diterapkan (basis tidak diubah). */
export function applyParameterOverrides(base: DatasetSI, version: string, overrides: readonly ParameterOverride[]): DatasetSI {
  const byForm = new Map<string, ParameterOverride[]>();
  for (const o of overrides) {
    const k = `${o.commodityId}.${o.formCode}`;
    byForm.set(k, [...(byForm.get(k) ?? []), o]);
  }
  for (const k of byForm.keys()) {
    const [c, f] = k.split('.');
    if (!base.commodities.find((x) => x.id === c)?.forms.find((x) => x.code === f)) {
      throw new DatasetError(`override: form ${k} tidak ada di dataset basis v${base.version}`);
    }
  }
  return {
    ...base,
    version,
    commodities: base.commodities.map((c) => ({
      ...c,
      forms: c.forms.map((f) => {
        const list = byForm.get(`${c.id}.${f.code}`);
        if (!list) return f;
        const params = { ...f.params };
        for (const o of list) {
          const p = params[o.key];
          if (!p) throw new DatasetError(`override: parameter ${o.key} tidak ada di ${c.id}.${f.code}`);
          if (!(o.min > 0 && o.min <= o.typ && o.typ <= o.max)) throw new DatasetError(`override ${o.key}: wajib 0 < min ≤ typ ≤ max`);
          params[o.key] = { ...p, min: o.min, typ: o.typ, max: o.max, confidence: o.confidence, ...(o.note && { note: o.note }) };
        }
        return { ...f, params };
      }),
    })),
  };
}

/**
 * Profil keyakinan parameter unik per komoditas dari dataset SI (metrik PRD §8).
 * Parameter tingkat-komoditas direplikasi ke tiap form → dihitung sekali; `bulk_density` per form.
 * Untuk dataset basis hasilnya sama dengan `confidenceProfile(raw)` (45: A6 · B9 · C30).
 */
export function profileOf(ds: DatasetSI): Record<Confidence, number> {
  const prof: Record<Confidence, number> = { A: 0, B: 0, C: 0 };
  for (const c of ds.commodities) {
    const seen = new Map<string, Confidence>();
    for (const f of c.forms) {
      for (const p of Object.values(f.params)) {
        const k = p.key === 'bulk_density' ? `bulk_density.${f.densityKey}` : p.key;
        // Ambil keyakinan terkuat bila form berbeda (kalibrasi bisa mengenai satu form saja).
        const prev = seen.get(k);
        seen.set(k, prev && prev < p.confidence ? prev : p.confidence);
      }
    }
    for (const v of seen.values()) prof[v]++;
  }
  return prof;
}
