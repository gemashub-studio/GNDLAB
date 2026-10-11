import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GEMA_DOSSIERS, GEMA_SOURCES, sourceById, sourceCounts } from '@/lib/gemaSources';
import { labBackupJson, parseBackup, planRestore } from '@/lib/labBackup';
import {
  applyUpdate,
  chartable,
  filterExperiments,
  LAB_PRODUCTS,
  measurementSeries,
  nextEntryId,
  nextExperimentId,
  nextProtocolKey,
  nextProtocolVersion,
  openNextSteps,
  parseMeasure,
  type DailyEntry,
  type Experiment,
  type ProtocolVersion,
} from '@/lib/labStore';

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

  it('cadangan JSON v2 memuat eksperimen, catatan harian, protokol & media', () => {
    const json = JSON.parse(labBackupJson([], '2026-10-11T00:00:00.000Z'));
    expect(json).toEqual({ format: 'gemas-lab', version: 2, exportedAt: '2026-10-11T00:00:00.000Z', experiments: [], entries: [], protocols: [], media: [] });
  });
});

const entry = (over: Partial<DailyEntry>): DailyEntry => ({
  id: 'KE-2610-001-H01', experimentId: 'KE-2610-001', entryDate: '2026-10-11', createdAt: '2026-10-11T02:00:00.000Z', protocolId: '',
  plan: '', actual: '', materials: [], tools: '', conditions: '', measurements: [], deviations: '', interpretation: '', nextStep: '', mediaIds: [], ...over,
});
const meas = (name: string, value: string, at: string, unit = '%', group = '') => ({ name, value, unit, at, group, note: '' });

describe('catatan harian, protokol & laporan', () => {
  it('ID catatan harian berurutan per eksperimen', () => {
    expect(nextEntryId('KE-2610-001', [])).toBe('KE-2610-001-H01');
    expect(nextEntryId('KE-2610-001', ['KE-2610-001-H01', 'KE-2610-001-H03', 'KE-2610-002-H09'])).toBe('KE-2610-001-H04');
  });

  it('protokol: resep baru dapat kunci baru; perubahan = versi berikutnya (versi lama tetap)', () => {
    const v1: ProtocolVersion = { id: 'KE-P01-v1', key: 'KE-P01', version: 1, product: 'KE', name: 'Oven', ingredients: [], steps: [], reason: 'versi awal', author: '', createdAt: '' };
    expect(nextProtocolKey('KE', [v1])).toBe('KE-P02');
    expect(nextProtocolKey('CK', [v1])).toBe('CK-P01');
    expect(nextProtocolVersion('KE-P01', [v1])).toEqual({ id: 'KE-P01-v2', version: 2 });
    expect(nextProtocolVersion('KE-P01', [v1, { ...v1, id: 'KE-P01-v2', version: 2 }])).toEqual({ id: 'KE-P01-v3', version: 3 });
  });

  it('nilai ukur dibaca seperti kolom angka lain; teks bukan angka tidak dipaksa', () => {
    expect(parseMeasure('6,2')).toBe(6.2);
    expect(parseMeasure('0.575')).toBe(0.575);
    expect(parseMeasure('1.250,5')).toBe(1250.5);
    expect(parseMeasure('retak')).toBeUndefined();
    expect(parseMeasure('')).toBeUndefined();
  });

  it('seri grafik hanya dari data tercatat, urut waktu, per variabel+satuan; < 2 titik → tidak digambar', () => {
    const series = measurementSeries([
      entry({ measurements: [meas('Kadar air', '12', '2026-10-12T08:00', '%', 'U1'), meas('Warna', 'putih', '2026-10-12T08:00', '')] }),
      entry({ id: 'H02', measurements: [meas('kadar air', '9,5', '2026-10-11T08:00', '%', 'U1'), meas('Suhu', '60', '2026-10-11T08:00', '°C')] }),
    ]);
    const ka = series.find((x) => x.name === 'Kadar air')!;
    expect(ka.points.map((p) => p.value)).toEqual([9.5, 12]);
    expect(chartable(ka)).toBe(true);
    expect(chartable(series.find((x) => x.name === 'Suhu')!)).toBe(false);
    expect(series.find((x) => x.name === 'Warna')).toMatchObject({ points: [], nonNumeric: 1 });
  });

  it('pulihkan cadangan hanya menambah; ID yang sudah ada dilewati, tidak ditimpa', () => {
    const b = parseBackup(labBackupJson([exp({}), exp({ id: 'KE-2610-002' })], '2026-10-11T00:00:00.000Z', { entries: [entry({})] }));
    const plan = planRestore(b, { experiments: new Set(['KE-2610-001']), entries: new Set(), protocols: new Set(), media: new Set() });
    expect(plan.add.experiments.map((e) => e.id)).toEqual(['KE-2610-002']);
    expect(plan.add.entries).toHaveLength(1);
    expect(plan.skipped).toEqual([{ kind: 'eksperimen', id: 'KE-2610-001' }]);
  });

  it('cadangan versi 1 (langkah 1) tetap bisa dipulihkan; file asing ditolak', () => {
    const v1 = parseBackup(JSON.stringify({ format: 'gemas-lab', version: 1, exportedAt: 'x', experiments: [exp({})] }));
    expect(v1.entries).toEqual([]);
    expect(() => parseBackup('{"hello":1}')).toThrow(/bukan file cadangan/);
    expect(() => parseBackup('bukan json')).toThrow(/JSON/);
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
