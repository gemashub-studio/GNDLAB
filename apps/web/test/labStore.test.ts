import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GEMA_DOSSIERS, GEMA_SOURCES, sourceById, sourceCounts } from '@/lib/gemaSources';
import { applyUpdate, filterExperiments, labBackupJson, LAB_PRODUCTS, nextExperimentId, openNextSteps, type Experiment } from '@/lib/labStore';

const exp = (over: Partial<Experiment>): Experiment => ({
  id: 'KE-2610-001', product: 'KE', title: 'Uji oven', startedAt: '2026-10-11', question: '', objective: '', methodVersion: '',
  processConditions: '', resultSummary: '', conclusion: '', status: 'rencana', nextSteps: [], createdAt: '2026-10-11T01:00:00.000Z', ...over,
});

describe('buku catatan GEMA RnD', () => {
  it('ID eksperimen = produk-TahunBulan-urut, lanjut dari ID tertinggi', () => {
    expect(nextExperimentId('KE', '2026-10-11', [])).toBe('KE-2610-001');
    expect(nextExperimentId('KE', '2026-10-11', ['KE-2610-001', 'KE-2610-003', 'CK-2610-007', 'KE-2609-009'])).toBe('KE-2610-004');
    expect(nextExperimentId('BR', '2026-11-02', ['BR-2610-002'])).toBe('BR-2611-001');
  });

  it('tanggal tak valid atau urutan penuh → tanpa ID', () => {
    expect(nextExperimentId('AR', '', [])).toBeUndefined();
    expect(nextExperimentId('AR', '2026-10-11', ['AR-2610-999'])).toBeUndefined();
  });

  it('melengkapi eksperimen menyimpan versi lama di riwayat (tidak menimpa)', () => {
    const a = exp({ status: 'berjalan' });
    const b = applyUpdate(a, { resultSummary: 'Kadar air turun', status: 'selesai' }, '2026-10-12T00:00:00.000Z');
    expect(b.resultSummary).toBe('Kadar air turun');
    expect(b.history).toHaveLength(1);
    expect(b.history![0]).toMatchObject({ status: 'berjalan', resultSummary: '', savedAt: a.createdAt });
    const c = applyUpdate(b, { conclusion: 'Perlu ulangan' }, '2026-10-13T00:00:00.000Z');
    expect(c.history).toHaveLength(2);
    expect(c.history![1]).toMatchObject({ resultSummary: 'Kadar air turun', savedAt: '2026-10-12T00:00:00.000Z' });
    expect(a.history).toBeUndefined();
  });

  it('cari & saring menurut teks, jalur, status; langkah terbuka lintas eksperimen', () => {
    const items = [
      exp({}),
      exp({ id: 'AR-2610-001', product: 'AR', title: 'Kolam bakar', processConditions: 'drum 200 L', status: 'berjalan', nextSteps: [{ id: 'a', action: 'Ayak 2×', done: false }, { id: 'b', action: 'Timbang', done: true }] }),
    ];
    expect(filterExperiments(items, { q: 'DRUM' }).map((e) => e.id)).toEqual(['AR-2610-001']);
    expect(filterExperiments(items, { product: 'KE' })).toHaveLength(1);
    expect(filterExperiments(items, { status: 'berjalan', product: 'all' })).toHaveLength(1);
    expect(openNextSteps(items).map((x) => x.step.action)).toEqual(['Ayak 2×']);
  });

  it('cadangan JSON memuat format, versi & semua eksperimen', () => {
    const json = JSON.parse(labBackupJson([], '2026-10-11T00:00:00.000Z'));
    expect(json).toEqual({ format: 'gemas-lab', version: 1, exportedAt: '2026-10-11T00:00:00.000Z', experiments: [] });
  });
});

describe('library sumber GEMA RnD', () => {
  const md = readFileSync(resolve(__dirname, '../../../architecture/07-rnd/library/sumber/sources.md'), 'utf8');

  it('sinkron dengan sources.md: ID, URL & status sama', () => {
    for (const s of GEMA_SOURCES) {
      const row = md.split('\n').find((l) => l.startsWith(`| ${s.id} |`));
      expect(row, s.id).toBeDefined();
      expect(row).toContain(s.url);
      expect(row).toContain(`| ${s.status} |`);
    }
    expect(md.match(/^\| GS-\d{3} \|/gm)).toHaveLength(GEMA_SOURCES.length);
  });

  it('tiap jalur punya dossier yang merujuk sumber yang ada', () => {
    for (const p of LAB_PRODUCTS) {
      const d = GEMA_DOSSIERS[p.id];
      expect(d.standards.length).toBeGreaterThan(0);
      for (const id of d.standards) expect(sourceById(id), id).toBeDefined();
    }
    const c = sourceCounts();
    expect(c.diperiksa + c.dilaporkan + c['belum-diperiksa']).toBe(GEMA_SOURCES.length);
  });
});
