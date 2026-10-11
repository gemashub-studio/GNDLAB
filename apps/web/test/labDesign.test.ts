import { describe, expect, it } from 'vitest';
import { buildRuns, lastValuePerRun, parseLevels, responseSuggestions, summarize, type ExperimentDesign } from '@/lib/labDesign';
import type { DailyEntry } from '@/lib/labStore';

const entry = (id: string, ms: { group: string; value: string; at: string; name?: string; unit?: string }[]): DailyEntry => ({
  id, experimentId: 'KE-2610-001', entryDate: ms[0]!.at.slice(0, 10), createdAt: '', protocolId: '', plan: '', actual: '', materials: [], tools: '', conditions: '',
  measurements: ms.map((m) => ({ name: m.name ?? 'Kadar air', unit: m.unit ?? '%', value: m.value, at: m.at, group: m.group, note: '' })),
  deviations: '', interpretation: '', nextStep: '', mediaIds: [],
});

describe('desain eksperimen (DEC-051)', () => {
  it('level dipisah koma/titik koma; kosong & duplikat dibuang', () => {
    expect(parseLevels('60, 70;80,, 70 ')).toEqual(['60', '70', '80']);
  });

  it('1 faktor × 3 level × 2 ulangan = 6 unit; urutan acak lengkap & bisa diulang dari seed', () => {
    const f = [{ name: 'Suhu', unit: '°C', levels: ['60', '70', '80'] }];
    const a = buildRuns(f, 2, 'KE-2610-001');
    expect(a.map((r) => r.code)).toEqual(['P1-U1', 'P1-U2', 'P2-U1', 'P2-U2', 'P3-U1', 'P3-U2']);
    expect(a[2]!.label).toBe('Suhu = 70 °C');
    expect(a.map((r) => r.order).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buildRuns(f, 2, 'KE-2610-001').map((r) => r.order)).toEqual(a.map((r) => r.order));
    expect(buildRuns(f, 2, 'KE-2610-002').map((r) => r.order)).not.toEqual(a.map((r) => r.order));
  });

  it('2 faktor = faktorial penuh; batas faktor, ulangan & jumlah unit', () => {
    const r = buildRuns([{ name: 'Suhu', unit: '°C', levels: ['60', '70'] }, { name: 'Rendam', unit: '', levels: ['tanpa', 'bisulfit'] }], 1, 'x');
    expect(r.map((x) => x.label)).toEqual(['Suhu = 60 °C · Rendam = tanpa', 'Suhu = 60 °C · Rendam = bisulfit', 'Suhu = 70 °C · Rendam = tanpa', 'Suhu = 70 °C · Rendam = bisulfit']);
    expect(() => buildRuns([], 3, 'x')).toThrow(/minimal satu faktor/);
    expect(() => buildRuns([{ name: 'a', unit: '', levels: ['1'] }, { name: 'b', unit: '', levels: ['1'] }, { name: 'c', unit: '', levels: ['1'] }], 1, 'x')).toThrow(/Maksimal 2/);
    expect(() => buildRuns([{ name: 'a', unit: '', levels: ['1'] }], 0, 'x')).toThrow(/Ulangan/);
    expect(() => buildRuns([{ name: 'a', unit: '', levels: Array.from({ length: 50 }, (_, i) => `${i}`) }], 5, 'x')).toThrow(/Terlalu banyak/);
  });

  it('nilai terakhir per unit; ringkasan deskriptif per perlakuan (SD n−1), unit tanpa data dihitung', () => {
    const design: ExperimentDesign = {
      factors: [{ name: 'Suhu', unit: '°C', levels: ['60', '70'] }], control: 'Suhu = 60 °C', replicates: 2,
      responses: [{ name: 'Kadar air', unit: '%' }], runs: buildRuns([{ name: 'Suhu', unit: '°C', levels: ['60', '70'] }], 2, 's'),
    };
    const entries = [
      entry('H01', [{ group: 'P1-U1', value: '20', at: '2026-10-11T08:00' }, { group: 'P1-U2', value: '22', at: '2026-10-11T08:00' }]),
      entry('H02', [{ group: 'P1-U1', value: '6,0', at: '2026-10-12T08:00' }, { group: 'P1-U2', value: '7,0', at: '2026-10-12T08:00' }, { group: 'P2-U1', value: '5', at: '2026-10-12T08:00' }, { group: 'P2-U2', value: 'retak', at: '2026-10-12T08:00' }]),
      entry('H03', [{ group: 'P1-U1', value: '99', at: '2026-10-12T08:00', name: 'Kadar air', unit: 'g' }]),
    ];
    expect(lastValuePerRun(entries, design.responses[0]!).get('P1-U1')).toEqual({ value: '6,0', at: '2026-10-12T08:00' });
    const [sum] = summarize(design, entries);
    expect(sum!.rows[0]).toMatchObject({ treatment: 'P1', n: 2, missing: 0, mean: 6.5, min: 6, max: 7 });
    expect(sum!.rows[0]!.sd).toBeCloseTo(Math.SQRT1_2, 9);
    expect(sum!.rows[1]).toMatchObject({ treatment: 'P2', n: 1, missing: 1, mean: 5 });
    expect(sum!.rows[1]!.sd).toBeUndefined();
  });

  it('saran variabel ukur dari draf parameter (data, bukan hardcode); briket = gabungan BS/BB/BC', () => {
    const ke = responseSuggestions('KE');
    expect(ke.some((s) => s.key === 'ka_akhir_pct' && s.unit === '%')).toBe(true);
    expect(ke.every((s) => s.label && s.key)).toBe(true);
    expect(responseSuggestions('BR').length).toBeGreaterThan(0);
  });
});
