/**
 * Satuan internal SI (ADR-004). Branded types mencegah pencampuran satuan
 * saat compile; konversi dari satuan dataset (cm, g, cm³, %) hanya lewat fungsi di sini.
 */
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type Meters = Brand<number, 'm'>;
export type Kg = Brand<number, 'kg'>;
export type M3 = Brand<number, 'm3'>;
export type KgPerM3 = Brand<number, 'kg/m3'>;
export type Fraction = Brand<number, 'fraction'>;

/**
 * Satuan parameter — sama dengan enum `param_unit` di schema.sql, ditambah `h` (jam) untuk
 * parameter alur proses (ADR-007) dan satuan formula R&D (ADR-009). Satuan formula tidak
 * disimpan di tabel `parameter`; hanya dipakai dataset formula & engine formula.
 */
export type Unit =
  | 'm'
  | 'kg'
  | 'm3'
  | 'kg_m3'
  | 'fraction'
  | 'pct'
  | 'count'
  | 'h'
  // --- formula R&D (ADR-009) ---
  | 'm2'
  | 'L'
  | 'g'
  | 'g_L'
  | 'kg_L'
  | 'g_m3'
  | 'brix'
  | 'pH'
  | 'C'
  | 'd'
  | 'wk'
  | 'mm'
  | 'M'
  | 'MPa'
  | 'g_cm3'
  | 'g_L_d'
  | 'cal_g'
  | 'count_h'
  | 'kg_h'
  // --- rantai produksi (ADR-010) ---
  | 'deg';

export const meters = (v: number): Meters => v as Meters;
export const kg = (v: number): Kg => v as Kg;
export const m3 = (v: number): M3 => v as M3;
export const kgPerM3 = (v: number): KgPerM3 => v as KgPerM3;

export function fraction(v: number): Fraction {
  if (!(v >= 0 && v <= 1)) throw new RangeError(`Fraksi harus 0–1, didapat ${v}`);
  return v as Fraction;
}

export const cmToM = (cm: number): Meters => (cm / 100) as Meters;
export const gToKg = (g: number): Kg => (g / 1000) as Kg;
export const cm3ToM3 = (cm3: number): M3 => (cm3 / 1e6) as M3;
export const tonnesToKg = (t: number): Kg => (t * 1000) as Kg;
export const kgToTonnes = (v: Kg | number): number => v / 1000;

export function pctToFraction(pct: number): Fraction {
  if (!(pct >= 0 && pct <= 100)) throw new RangeError(`Persen harus 0–100, didapat ${pct}`);
  return (pct / 100) as Fraction;
}

/** Stowage factor (m³/t) → densitas: ρ = 1000 / SF (calculation_spec §5). */
export function stowageFactorToDensity(sfM3PerT: number): KgPerM3 {
  if (!(sfM3PerT > 0)) throw new RangeError(`Stowage factor harus > 0, didapat ${sfM3PerT}`);
  return (1000 / sfM3PerT) as KgPerM3;
}

/** Spek dagang kelapa "inch" adalah KELILING (DEC-006): D = (inch · 0,0254) / π. */
export const tradeInchToDiameterM = (inch: number): Meters => ((inch * 0.0254) / Math.PI) as Meters;
