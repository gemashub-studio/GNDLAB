/**
 * Ringkasan skenario sebagai baris label–nilai: sumber tunggal untuk CSV, PDF, dan halaman bagikan.
 */
import type { DatasetSI } from '@gemas/dataset';
import { getCommodity } from '@gemas/dataset';
import { COMMODITY_UI, MODE_UI, formLabel } from './catalog';
import { fmt, fmtM2, fmtM3, fmtPct } from './format';
import { containerFtName } from './imperial';
import type { ScenarioOutput, ScenarioState } from './scenario';

export interface ReportRow {
  section: 'Input' | 'Hasil' | 'Peringatan' | 'Jejak';
  label: string;
  value: string;
}

const UNIT_LABEL: Record<string, string> = { pcs: 'butir', kg: 'kg', t: 'ton', m3: 'm³', pack: 'karung' };

export function reportRows(ds: DatasetSI, s: ScenarioState, o: ScenarioOutput): ReportRow[] {
  const name = COMMODITY_UI[s.commodityId]?.short ?? getCommodity(ds, s.commodityId).nameId;
  const rows: ReportRow[] = [
    { section: 'Input', label: 'Komoditas', value: name },
    { section: 'Input', label: 'Bentuk', value: formLabel(s.commodityId, s.formCode) },
  ];
  const rng = (min: number, typ: number, max: number, f: (v: number) => string) => `${f(typ)} (min ${f(min)} · maks ${f(max)})`;

  if (s.kind === 'CONTAINER' && o.kind === 'CONTAINER') {
    const r = o.out.result;
    rows.push(
      { section: 'Input', label: 'Container', value: s.custom ? `Custom ${fmt(s.custom.lengthM * 100)}×${fmt(s.custom.widthM * 100)}×${fmt(s.custom.heightM * 100)} cm, ${fmt(s.custom.payloadKg)} kg` : `${containerFtName(s.containerId!)} (${s.containerId})` },
      { section: 'Input', label: 'Cara hitung', value: MODE_UI[s.mode].label },
    );
    if (r.typ.pieces !== undefined) rows.push({ section: 'Hasil', label: 'Jumlah butir', value: rng(r.min.pieces!, r.typ.pieces, r.max.pieces!, (v) => fmt(v)) });
    if (r.typ.packs !== undefined) rows.push({ section: 'Hasil', label: 'Jumlah karung', value: rng(r.min.packs!, r.typ.packs, r.max.packs!, (v) => fmt(v)) });
    rows.push(
      { section: 'Hasil', label: 'Muatan bersih (kg)', value: rng(r.min.massKg, r.typ.massKg, r.max.massKg, (v) => fmt(v)) },
      { section: 'Hasil', label: 'Batas pengikat', value: o.out.binding },
      { section: 'Hasil', label: 'Isi volume', value: fmtPct(r.typ.volumeFill) },
      { section: 'Hasil', label: 'Isi berat', value: fmtPct(r.typ.weightFill) },
    );
  } else if (s.kind === 'WAREHOUSE' && o.kind === 'WAREHOUSE') {
    const r = o.out.result;
    const stock = 'massKg' in s.stock ? `${fmt(s.stock.massKg)} kg` : 'pieces' in s.stock ? `${fmt(s.stock.pieces)} butir` : `${fmt(s.stock.packs)} karung`;
    rows.push(
      { section: 'Input', label: 'Stok', value: stock },
      { section: 'Input', label: 'Tinggi tumpuk', value: `${fmt(s.stackHeightM, 2)} m` },
      { section: 'Hasil', label: 'Massa (kg)', value: rng(r.min.massKg, r.typ.massKg, r.max.massKg, (v) => fmt(v)) },
      { section: 'Hasil', label: 'Volume', value: rng(r.min.volumeM3, r.typ.volumeM3, r.max.volumeM3, fmtM3) },
      { section: 'Hasil', label: 'Tapak tumpukan', value: fmtM2(r.typ.footprintM2) },
      { section: 'Hasil', label: 'Luas lantai dibutuhkan', value: rng(r.min.floorAreaM2, r.typ.floorAreaM2, r.max.floorAreaM2, fmtM2) },
      { section: 'Hasil', label: 'Beban lantai', value: `${fmt(r.typ.floorLoadKgM2)} kg/m²` },
    );
    if (r.typ.stacks !== undefined) rows.push({ section: 'Hasil', label: 'Jumlah tumpukan', value: fmt(r.typ.stacks) });
    if (r.typ.zoneUsedFraction !== undefined) rows.push({ section: 'Hasil', label: 'Zona terpakai', value: fmtPct(r.typ.zoneUsedFraction) });
  } else if (s.kind === 'CONVERT' && o.kind === 'CONVERT') {
    const r = o.out.result;
    rows.push(
      { section: 'Input', label: 'Dari', value: `${fmt(s.from.value, 2)} ${UNIT_LABEL[s.from.unit]}` },
      { section: 'Hasil', label: `Hasil (${UNIT_LABEL[s.to]})`, value: rng(r.min.value, r.typ.value, r.max.value, (v) => fmt(v, 2)) },
    );
  }

  rows.push({ section: 'Hasil', label: 'Keyakinan data', value: o.out.confidence });
  for (const w of o.out.warnings) rows.push({ section: 'Peringatan', label: w.code, value: w.message });
  rows.push(
    { section: 'Jejak', label: 'Versi dataset', value: o.out.trace.datasetVersion ?? ds.version },
    { section: 'Jejak', label: 'Versi engine', value: o.out.trace.engineVersion },
  );
  for (const [k, t] of Object.entries(o.out.trace.params)) {
    rows.push({ section: 'Jejak', label: k, value: `${fmt(t.value.typ, 4)} (${fmt(t.value.min, 4)}–${fmt(t.value.max, 4)}) · ${t.source} · ${t.confidence}` });
  }
  return rows;
}

/**
 * CSV untuk Excel berbahasa Indonesia: pemisah `;` (karena koma = desimal), UTF-8 dengan BOM (DEC-022).
 */
export function toCsv(rows: ReportRow[]): string {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['Bagian;Label;Nilai', ...rows.map((r) => [r.section, r.label, r.value].map(esc).join(';'))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
