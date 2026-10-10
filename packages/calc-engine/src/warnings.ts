/**
 * Kode peringatan — calculation_spec §6. Pesan dalam Bahasa Indonesia.
 * Peringatan keselamatan (SELF_HEATING_RISK, FLOOR_OVERLOAD) dievaluasi pada kasus
 * terburuk (max) rentang; peringatan lain pada typ (DEC-016).
 */
import type { Param, Range } from './range.ts';

export const WARNING_MESSAGES = {
  LOW_CONFIDENCE_PARAM: 'Hasil memakai estimasi (C). Verifikasi dengan sampling.',
  SELF_HEATING_RISK: 'Kadar air > 10%: risiko pemanasan sendiri & jamur.',
  FLAMMABLE: 'Mudah terbakar; jauhkan dari api & kelembapan.',
  ODOR_CONTAMINATION: 'Bau asap kopra asalan mencemari kopra edible.',
  SHELF_LIFE: 'Umur simpan ambien 30–45 hari.',
  WEIGHT_LIMITED: 'Payload habis sebelum ruang penuh.',
  ITEM_EXCEEDS_CONTAINER: 'Kemasan lebih besar dari ruang.',
  FLOOR_OVERLOAD: 'Beban lantai melebihi kapasitas.',
  OVERRIDE_OUT_OF_RANGE: 'Nilai override di luar rentang wajar.',
  CONSERVATIVE_BENCHMARK_GAP: 'Satu sumber pasar melaporkan muat jauh lebih rendah.',
  WATER_REMAINDER_CLAMPED: 'Kombinasi sabut + batok + daging melebihi 100% — air kelapa dihitung 0.',
  WEATHER_DEPENDENT: 'Lama jemur tergantung cuaca; hujan menambah hari & risiko jamur.',
  // --- formula R&D & produksi (ADR-009) ---
  MUST_BRIX_OUT_OF_RANGE: 'Target °Brix must di luar 14–17.',
  ACETIC_POTENTIAL_LOW: 'Potensi asam asetat di bawah batas minimum cuka.',
  BINDER_ABOVE_RANGE: 'Dosis perekat di atas 8%: kalor turun, abu & zat terbang naik.',
  DOUGH_MOISTURE_OUT_OF_RANGE: 'Kadar air adonan di luar 22–28%.',
  DOUGH_TOO_WET: 'Bahan sudah lebih basah dari target adonan; tidak perlu tambah air.',
  FINAL_MOISTURE_ABOVE_SPEC: 'Kadar air akhir di atas spesifikasi produk.',
  NAOH_TOO_STRONG: 'NaOH di atas 0,1 M merusak serat selulosa (kuat tarik turun).',
  COOLING_TOO_SHORT: 'Pendinginan arang < 8 jam: risiko menyala ulang.',
  OVEN_TEMP_HIGH: 'Suhu oven di atas batas aman produk.',
  SULFUR_NIGHTS_EXCEEDED: 'Fumigasi belerang melebihi 4 malam.',
  SO2_TEST_REQUIRED: 'Fumigasi ≥3 malam: wajib uji residu SO₂ sebelum dikirim.',
  SPLIT_DELAY_EXCEEDED: 'Jeda belah → pengering melebihi 4 jam: maksimal grade Reguler.',
  DRYING_BEHIND_SCHEDULE: 'Kadar air belum mencapai alarm 24/48 jam: pindah ke pengering lebih panas.',
  YIELD_BELOW_REFERENCE: 'Rendemen di bawah acuan literatur.',
} as const;

export type WarningCode = keyof typeof WARNING_MESSAGES;

export interface CalcWarning {
  code: WarningCode;
  message: string;
  /** Rincian mesin-baca, mis. daftar parameter C. */
  detail?: string;
}

export const warning = (code: WarningCode, detail?: string): CalcWarning =>
  detail === undefined ? { code, message: WARNING_MESSAGES[code] } : { code, message: WARNING_MESSAGES[code], detail };

/** Ambang kadar air self-heating (fraksi basis basah). */
export const SELF_HEATING_MOISTURE = 0.1;
/** Toleransi uji silang benchmark — sama dengan TOL di validate_dataset.py. */
export const BENCHMARK_TOLERANCE = 0.1;

export interface Benchmark {
  conservative: boolean;
  pieces?: { min: number; max: number };
  massKg?: { min: number; max: number };
}

export interface WarningContext {
  /** Kode komoditas dataset, mis. `kopra_asalan`. */
  commodityCode?: string;
  /** Kadar air sebagai fraksi 0–1. */
  moisture?: Range;
  benchmarks?: Benchmark[];
}

export function commodityWarnings(ctx: WarningContext | undefined): CalcWarning[] {
  const out: CalcWarning[] = [];
  const code = ctx?.commodityCode;
  if (!code) return out;
  if (code.startsWith('arang')) out.push(warning('FLAMMABLE'));
  if (code.startsWith('kopra') && ctx.moisture && ctx.moisture.max > SELF_HEATING_MOISTURE) {
    out.push(warning('SELF_HEATING_RISK'));
  }
  if (code === 'kelapa_jambul') out.push(warning('SHELF_LIFE'));
  return out;
}

/** Komoditas yang disimpan di zona/ruang yang sama. */
export function zoneWarnings(commodityCodes: readonly string[]): CalcWarning[] {
  const set = new Set(commodityCodes);
  return set.has('kopra_edible') && set.has('kopra_asalan') ? [warning('ODOR_CONTAMINATION')] : [];
}

export function lowConfidenceWarnings(params: readonly Param[]): CalcWarning[] {
  const keys = params.filter((p) => p.confidence === 'C' && (p.source ?? 'dataset') === 'dataset').map((p) => p.key);
  return keys.length ? [warning('LOW_CONFIDENCE_PARAM', keys.join(','))] : [];
}

export function benchmarkGapWarnings(
  typ: { pieces?: number; massKg: number },
  benchmarks: readonly Benchmark[] | undefined,
): CalcWarning[] {
  for (const b of benchmarks ?? []) {
    if (!b.conservative) continue;
    const overPieces = b.pieces && typ.pieces !== undefined && typ.pieces > b.pieces.max * (1 + BENCHMARK_TOLERANCE);
    const overMass = b.massKg && typ.massKg > b.massKg.max * (1 + BENCHMARK_TOLERANCE);
    if (overPieces || overMass) return [warning('CONSERVATIVE_BENCHMARK_GAP')];
  }
  return [];
}
