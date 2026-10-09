/**
 * Realisasi stuffing (M4, PRD §8): bandingkan muat aktual vs prediksi kalkulator, lalu
 * turunkan densitas efektif tersirat sebagai sampel `bulk_density` (metode realisasi_stuffing).
 * Fungsi murni — angka prediksi dari engine + dataset versi aktif, tidak ada angka di sini.
 */
import { containerCapacity, REALIZATION_TARGET_GAP, relativeGap } from '@gemas/calc-engine';
import { buildContainerInput, getContainer, type DatasetSI } from '@gemas/dataset';

export interface RealizationInput {
  commodityId: string;
  formCode: string;
  containerId: string;
  /** Butir/keping yang benar-benar masuk (mode butir). */
  actualPieces?: number;
  /** Berat bersih muatan aktual (kg, tanpa tara container). */
  actualMassKg?: number;
  /** Container benar-benar penuh secara volume (pintu pas tertutup). Densitas tersirat hanya sah bila true. */
  fullByVolume: boolean;
}

export interface RealizationResult {
  /** Pembanding: 'pieces' bila butir diisi, selain itu 'mass'. */
  basis: 'pieces' | 'mass';
  predicted: number;
  actual: number;
  /** (aktual − prediksi) / prediksi. */
  gap: number;
  withinTarget: boolean;
  /** Massa aktual dipakai untuk densitas (kg): berat timbang, atau butir × massa per butir (typ). */
  massKg: number;
  massFromPieces: boolean;
  /** Densitas efektif tersirat (kg/m³) = massa ÷ (V · u); undefined bila tidak sah. */
  impliedDensity?: number;
  /** Alasan densitas tersirat tidak dihitung. */
  densityBlocked?: string;
  currentDensity: { min: number; typ: number; max: number };
}

export function realizationReport(ds: DatasetSI, r: RealizationInput): RealizationResult {
  const form = ds.commodities.find((c) => c.id === r.commodityId)?.forms.find((f) => f.code === r.formCode);
  if (!form) throw new Error(`Bentuk ${r.commodityId}.${r.formCode} tidak ada`);
  const rho = form.params.bulk_density;
  if (!rho) throw new Error('Bentuk ini tidak punya densitas curah');
  const usePieces = r.actualPieces !== undefined && r.actualPieces > 0;
  if (!usePieces && !(r.actualMassKg !== undefined && r.actualMassKg > 0)) throw new Error('Isi jumlah butir atau berat aktual');

  const unitMass = form.unitMassKey ? form.params[form.unitMassKey] : undefined;
  if (usePieces && !unitMass) throw new Error('Bentuk ini tidak dihitung per butir — isi berat aktual');

  const out = containerCapacity(
    buildContainerInput(ds, { commodityId: r.commodityId, formCode: r.formCode, containerId: r.containerId, mode: usePieces ? 'PIECE' : 'BULK' }),
  );
  const predicted = usePieces ? out.result.typ.pieces! : out.result.typ.massKg;
  const actual = usePieces ? r.actualPieces! : r.actualMassKg!;
  const gap = relativeGap(actual, predicted);

  const massFromPieces = !(r.actualMassKg !== undefined && r.actualMassKg > 0);
  const massKg = massFromPieces ? r.actualPieces! * unitMass!.typ : r.actualMassKg!;

  const container = getContainer(ds, r.containerId);
  const V = container.volumeM3 ?? container.L * container.W * container.H;
  const u = form.volumeUtilDefault;
  let impliedDensity: number | undefined;
  let densityBlocked: string | undefined;
  if (!r.fullByVolume) densityBlocked = 'Container belum penuh secara volume, jadi densitasnya belum bisa disimpulkan.';
  else if (massKg >= container.payloadKg) densityBlocked = 'Berat sudah mentok batas payload — yang membatasi berat, bukan ruang.';
  else impliedDensity = massKg / (V * u);

  return {
    basis: usePieces ? 'pieces' : 'mass',
    predicted,
    actual,
    gap,
    withinTarget: Math.abs(gap) <= REALIZATION_TARGET_GAP,
    massKg,
    massFromPieces,
    ...(impliedDensity !== undefined && { impliedDensity }),
    ...(densityBlocked && { densityBlocked }),
    currentDensity: { min: rho.min, typ: rho.typ, max: rho.max },
  };
}
