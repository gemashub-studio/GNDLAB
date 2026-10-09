/**
 * Sampling lapangan (M4): skema input + parser CSV format `architecture/logs/field_sampling_template.csv`.
 * Fungsi murni (dipakai client untuk pratinjau & server untuk validasi ulang).
 */
import type { DatasetSI } from '@gemas/dataset';
import { z } from 'zod';

export const SAMPLING_COLUMNS = [
  'measured_at',
  'location',
  'lot_ref',
  'commodity_code',
  'form_code',
  'parameter_key',
  'value',
  'unit',
  'method',
  'officer',
  'note',
] as const;

/** Sama dengan CHECK `measurement.method` di schema.sql. */
export const METHODS = ['timbang', 'jangka_sorong', 'meteran', 'ember_1m3', 'drum', 'moisture_meter', 'realisasi_stuffing'] as const;
export const METHOD_LABEL: Record<(typeof METHODS)[number], string> = {
  timbang: 'Timbang',
  jangka_sorong: 'Jangka sorong',
  meteran: 'Meteran',
  ember_1m3: 'Ember / kotak volume',
  drum: 'Drum',
  moisture_meter: 'Moisture meter',
  realisasi_stuffing: 'Realisasi muat container',
};

export const MeasurementSchema = z.object({
  measuredAt: z.string().datetime({ offset: true }),
  location: z.string().max(200).optional(),
  lotRef: z.string().max(100).optional(),
  commodityId: z.string().min(1),
  formCode: z.string().min(1),
  key: z.string().min(1),
  value: z.number().finite().positive(),
  unit: z.enum(['m', 'kg', 'm3', 'kg_m3', 'fraction', 'pct', 'count']),
  method: z.enum(METHODS),
  note: z.string().max(500).optional(),
});
export type MeasurementInput = z.infer<typeof MeasurementSchema>;

export interface RowError {
  line: number;
  reason: string;
}

/** Validasi domain terhadap dataset (komoditas/form/parameter ada & satuan cocok). */
export function checkAgainstDataset(ds: DatasetSI, m: MeasurementInput): string | undefined {
  const c = ds.commodities.find((x) => x.id === m.commodityId);
  if (!c) return `komoditas "${m.commodityId}" tidak dikenal`;
  const f = c.forms.find((x) => x.code === m.formCode);
  if (!f) return `bentuk "${m.formCode}" tidak ada untuk ${m.commodityId}`;
  const p = f.params[m.key];
  if (!p) return `parameter "${m.key}" tidak ada di ${m.commodityId}.${m.formCode}`;
  if (p.unit !== m.unit) return `satuan "${m.unit}" salah — parameter ini memakai "${p.unit}"`;
  if (p.unit === 'fraction' && m.value > 1) return 'nilai fraksi harus ≤ 1';
  return undefined;
}

/** Pemecah satu baris CSV (tanda kutip ganda, pemisah `,` atau `;`). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ParsedCsv {
  rows: (MeasurementInput & { line: number; officer?: string })[];
  errors: RowError[];
  /** Kesalahan fatal (header salah, file kosong). */
  fatal?: string;
}

/**
 * Parse CSV sampling. Header harus PERSIS kolom template (urutan sama). Baris contoh
 * ("contoh baris - hapus") ditolak. Desimal koma diterima bila pemisah `;`.
 */
export function parseSamplingCsv(text: string, ds: DatasetSI): ParsedCsv {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerLine = lines[0] ?? '';
  if (!headerLine.trim()) return { rows: [], errors: [], fatal: 'File kosong' };
  const sep = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const header = splitCsvLine(headerLine, sep).map((h) => h.toLowerCase());
  if (header.join(',') !== SAMPLING_COLUMNS.join(',')) {
    return { rows: [], errors: [], fatal: `Kolom harus persis: ${SAMPLING_COLUMNS.join(', ')}` };
  }
  const rows: ParsedCsv['rows'] = [];
  const errors: RowError[] = [];
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    if (!raw.trim()) return;
    const cells = splitCsvLine(raw, sep);
    if (cells.length !== SAMPLING_COLUMNS.length) {
      errors.push({ line, reason: `jumlah kolom ${cells.length}, seharusnya ${SAMPLING_COLUMNS.length}` });
      return;
    }
    const get = (k: (typeof SAMPLING_COLUMNS)[number]) => cells[SAMPLING_COLUMNS.indexOf(k)] ?? '';
    if (/contoh baris/i.test(get('note'))) {
      errors.push({ line, reason: 'baris contoh dari template — hapus dulu' });
      return;
    }
    const valueRaw = sep === ';' ? get('value').replace(/\./g, '').replace(',', '.') : get('value');
    const candidate = {
      measuredAt: get('measured_at'),
      ...(get('location') && { location: get('location') }),
      ...(get('lot_ref') && { lotRef: get('lot_ref') }),
      commodityId: get('commodity_code'),
      formCode: get('form_code'),
      key: get('parameter_key'),
      value: Number(valueRaw),
      unit: get('unit'),
      method: get('method'),
      ...(get('note') && { note: get('note') }),
    };
    const parsed = MeasurementSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const field = String(issue.path[0] ?? '');
      const reason =
        field === 'measuredAt'
          ? `tanggal "${candidate.measuredAt}" tidak valid (pakai format 2026-10-15T09:00:00+07:00)`
          : field === 'value'
            ? `nilai "${get('value')}" harus angka > 0`
            : field === 'method'
              ? `metode "${candidate.method}" tidak dikenal (${METHODS.join(', ')})`
              : field === 'unit'
                ? `satuan "${candidate.unit}" tidak dikenal`
                : `${field}: ${issue.message}`;
      errors.push({ line, reason });
      return;
    }
    const domain = checkAgainstDataset(ds, parsed.data);
    if (domain) {
      errors.push({ line, reason: domain });
      return;
    }
    rows.push({ ...parsed.data, line, ...(get('officer') && { officer: get('officer') }) });
  });
  return { rows, errors };
}

/**
 * Satuan tampilan untuk input lapangan (ADR-004: konversi hanya di presentasi).
 * kg < 1 (massa per butir) → gram; m → cm; fraksi → %.
 */
export function displayUnit(unit: string, typical: number): { label: string; toSi: (v: number) => number; fromSi: (v: number) => number } {
  if (unit === 'kg' && typical < 1) return { label: 'g', toSi: (v) => v / 1000, fromSi: (v) => v * 1000 };
  if (unit === 'm') return { label: 'cm', toSi: (v) => v / 100, fromSi: (v) => v * 100 };
  if (unit === 'fraction') return { label: '%', toSi: (v) => v / 100, fromSi: (v) => v * 100 };
  const label = { kg: 'kg', kg_m3: 'kg/m³', m3: 'm³', pct: '%', count: '' }[unit] ?? unit;
  return { label, toSi: (v) => v, fromSi: (v) => v };
}
