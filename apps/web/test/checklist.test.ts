import { bundledFormulaDataset } from '@gemas/dataset';
import { describe, expect, it } from 'vitest';
import { checklistCsv, summarize, type ChecklistFill, type Mark } from '@/lib/checklist';

const f = bundledFormulaDataset();
const def = f.checklists.find((c) => c.id === 'prd-cuka')!;
const critical = def.items.map((i) => i.critical);

describe('ceklis', () => {
  it('belum dijawab → belum lengkap', () => {
    expect(summarize(def, []).status).toBe('incomplete');
    expect(summarize(def, []).criticalOpen).toBe(critical.filter(Boolean).length);
  });
  it('semua OK → lolos', () => {
    expect(summarize(def, def.items.map(() => 'ok')).status).toBe('pass');
  });
  it('satu item kritis TIDAK → gagal walau yang lain belum dijawab', () => {
    const marks: Mark[] = [];
    marks[critical.indexOf(true)] = 'ng';
    const s = summarize(def, marks);
    expect(s.status).toBe('fail');
    expect(s.criticalNg).toBe(1);
  });
  it('item non-kritis TIDAK → lolos dengan catatan', () => {
    const d = f.checklists.find((c) => c.items.some((i) => !i.critical))!;
    const marks: Mark[] = d.items.map((i) => (i.critical ? 'ok' : 'ng'));
    expect(summarize(d, marks).status).toBe('pass_with_minor');
  });
  it('CSV: BOM, pemisah ;, kutip ganda di-escape', () => {
    const fill: ChecklistFill = {
      id: 'x', checklistId: def.id, date: '2026-10-10', shift: '1', officer: 'Petugas "A"', lot: 'CKA-2610-001',
      marks: def.items.map(() => 'ok'), notes: [], remark: 'baik', createdAt: '', updatedAt: '',
    };
    const csv = checklistCsv(def, fill);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Petugas ""A"""');
    expect(csv).toContain('"Status";"Lolos"');
    expect(csv.split('\r\n').some((l) => l.startsWith('"1";'))).toBe(true);
  });
});
