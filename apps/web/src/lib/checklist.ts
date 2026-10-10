/**
 * Isian ceklis (R&D / QC / produk) — fungsi murni: status lolos & ekspor CSV.
 * Definisi ceklis = data di dataset formula (ADR-009 §8); di sini hanya isian pengguna.
 */
import type { FormulaChecklist } from '@gemas/dataset';

export type Mark = 'ok' | 'ng' | undefined;

export interface ChecklistFill {
  id: string;
  checklistId: string;
  date: string;
  shift: string;
  officer: string;
  lot: string;
  marks: Mark[];
  notes: string[];
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export type ChecklistStatus = 'incomplete' | 'pass' | 'fail' | 'pass_with_minor';

export interface ChecklistSummary {
  status: ChecklistStatus;
  answered: number;
  total: number;
  ok: number;
  ng: number;
  /** Item kritis yang TIDAK (= gagal). */
  criticalNg: number;
  /** Item kritis yang belum dijawab. */
  criticalOpen: number;
}

/**
 * Lolos bila semua item kritis OK; item non-kritis TIDAK → "lolos dengan catatan" (minor).
 * Satu item kritis TIDAK → gagal (Modul QC: kategori kritis = zero tolerance).
 */
export function summarize(def: FormulaChecklist, marks: readonly Mark[]): ChecklistSummary {
  let ok = 0;
  let ng = 0;
  let criticalNg = 0;
  let criticalOpen = 0;
  def.items.forEach((it, i) => {
    const m = marks[i];
    if (m === 'ok') ok++;
    if (m === 'ng') {
      ng++;
      if (it.critical) criticalNg++;
    }
    if (m === undefined && it.critical) criticalOpen++;
  });
  const total = def.items.length;
  const answered = ok + ng;
  let status: ChecklistStatus;
  if (criticalNg > 0) status = 'fail';
  else if (answered < total) status = 'incomplete';
  else status = ng > 0 ? 'pass_with_minor' : 'pass';
  return { status, answered, total, ok, ng, criticalNg, criticalOpen };
}

export const STATUS_TEXT: Record<ChecklistStatus, string> = {
  incomplete: 'Belum lengkap',
  pass: 'Lolos',
  pass_with_minor: 'Lolos dengan catatan',
  fail: 'Gagal — ada item kritis',
};

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** CSV pemisah `;` + BOM UTF-8 agar terbaca Excel Indonesia (DEC-022). */
export function checklistCsv(def: FormulaChecklist, fill: ChecklistFill): string {
  const sum = summarize(def, fill.marks);
  const head = [
    ['Ceklis', def.stage],
    ['Form', def.form_ref],
    ['Tanggal', fill.date],
    ['Shift', fill.shift],
    ['Petugas', fill.officer],
    ['Lot/Batch', fill.lot],
    ['Status', STATUS_TEXT[sum.status]],
  ];
  const rows = def.items.map((it, i) => [String(i + 1), it.text, it.critical ? 'KRITIS' : '', fill.marks[i] === 'ok' ? 'OK' : fill.marks[i] === 'ng' ? 'TIDAK' : '', fill.notes[i] ?? '']);
  const lines = [
    ...head.map((r) => r.map(q).join(';')),
    '',
    ['No', 'Item', 'Kritis', 'Hasil', 'Catatan'].map(q).join(';'),
    ...rows.map((r) => r.map(q).join(';')),
    '',
    [q('Catatan umum'), q(fill.remark)].join(';'),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
