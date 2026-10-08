import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { containerCapacity, OverrideOutOfRangeError } from '@gemas/calc-engine';
import { describe, expect, it } from 'vitest';
import {
  buildContainerInput,
  bundledDataset,
  confidenceProfile,
  DatasetError,
  getForm,
  loadDataset,
  provenance,
  rawDataset,
} from '../src/index.ts';

const arch = (p: string) => fileURLToPath(new URL(`../../../architecture/${p}`, import.meta.url));
const ds = bundledDataset();

describe('salinan dataset', () => {
  it('identik byte-per-byte dengan sumber kebenaran', () => {
    const src = readFileSync(arch('00-research/data/coconut_inventory_dataset.json'));
    expect(createHash('sha256').update(src).digest('hex')).toBe(provenance.sha256);
  });
});

describe('loader ↔ seed.sql (paritas normalisasi)', () => {
  const seed = readFileSync(arch('03-data/seed.sql'), 'utf8');
  const count = (table: string) => seed.split('\n').filter((l) => l.startsWith(`INSERT INTO ${table} `)).length;
  const forms = ds.commodities.flatMap((c) => c.forms);

  it('versi sama', () => {
    expect(seed).toContain(`dataset v${ds.version}`);
  });

  it('jumlah parameter, kemasan, benchmark sama dengan seed (102 / 14 / 9)', () => {
    expect(forms.reduce((n, f) => n + Object.keys(f.params).length, 0)).toBe(count('parameter'));
    expect(forms.reduce((n, f) => n + f.packaging.length, 0)).toBe(count('packaging_type'));
    expect(forms.reduce((n, f) => n + f.benchmarks.length, 0)).toBe(count('container_benchmark'));
    expect(count('parameter')).toBe(102);
  });

  it('setiap (key, unit, min, typ, max, keyakinan) identik dengan seed', () => {
    const re =
      /^INSERT INTO parameter .*VALUES \('[^']+', '[^']+', '([^']+)', '([^']+)', ([^,]+), ([^,]+), ([^,]+), '([ABC])'/;
    const fromSeed = seed
      .split('\n')
      .map((l) => re.exec(l))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [m[1], m[2], Number(m[3]), Number(m[4]), Number(m[5]), m[6]].join('|'))
      .sort();
    const fromLoader = forms
      .flatMap((f) => Object.values(f.params))
      .map((p) => [p.key, p.unit, p.min, p.typ, p.max, p.confidence].join('|'))
      .sort();
    expect(fromLoader).toEqual(fromSeed);
  });

  it('kunci parameter tanpa sufiks satuan (ISS-006)', () => {
    for (const f of forms) for (const k of Object.keys(f.params)) expect(k).not.toMatch(/_(cm|g|kg|pct|kg_m3|cm3)(\.|$)/);
  });
});

it('profil keyakinan = baseline PRD §8 (45 parameter: A=6, B=9, C=30)', () => {
  expect(confidenceProfile(rawDataset)).toEqual({ A: 6, B: 9, C: 30 });
});

describe('konversi SI (ADR-004)', () => {
  it('container cm → m, volume nominal dipertahankan', () => {
    const c20 = ds.containers.find((c) => c.id === '20GP')!;
    expect(c20.L).toBeCloseTo(5.898, 9);
    expect(c20.volumeM3).toBe(33.2);
  });
  it('massa g → kg; persen tetap pct', () => {
    const f = getForm(ds, 'kelapa_jambul', 'bagged');
    expect(f.params.mass_per_unit).toMatchObject({ min: 0.45, typ: 0.575, max: 0.85, unit: 'kg', confidence: 'B' });
    expect(getForm(ds, 'kopra_asalan', 'bagged_jute').params.moisture).toMatchObject({ unit: 'pct', typ: 12 });
  });
  it('keyakinan campuran "A/C" dihitung C (DEC-008)', () => {
    expect(getForm(ds, 'kelapa_jambul', 'loose').params['geometry.body.length_polar']!.confidence).toBe('C');
  });
});

describe('golden cases lewat dataset (engine + pemetaan form + default utilisasi)', () => {
  const golden = JSON.parse(readFileSync(arch('tests/fixtures/golden_cases.json'), 'utf8')).cases as Array<
    Record<string, any>
  >;
  const byCase = Object.fromEntries(golden.map((c) => [c.case, c]));
  const close = (a: number, e: number) => expect(Math.abs(a - e) / e).toBeLessThanOrEqual(0.005);
  const run = (commodityId: string, formCode: string, containerId: string, mode?: 'BULK' | 'PIECE' | 'PACKAGE') =>
    containerCapacity(buildContainerInput(ds, { commodityId, formCode, containerId, ...(mode && { mode }) }));

  it.each([
    ['jambul_20GP', 'kelapa_jambul', 'bagged', '20GP', 'PIECE'],
    ['jambul_40GP', 'kelapa_jambul', 'bagged', '40GP', 'PIECE'],
  ] as const)('%s', (name, cm, form, cont, mode) => {
    const out = run(cm, form, cont, mode);
    close(out.result.typ.pieces!, byCase[name].expect_pcs);
    expect(out.binding).toBe(byCase[name].expect_binding);
  });

  it.each([
    ['arang_charcoal_broken_lumps_20GP', 'arang_batok_belah2', 'lumps', '20GP'],
    ['arang_charcoal_broken_lumps_40HC', 'arang_batok_belah2', 'lumps', '40HC'],
    ['arang_raw_halves_loose_20GP', 'arang_batok_belah2', 'raw_halves', '20GP'],
    ['arang_raw_halves_loose_40HC', 'arang_batok_belah2', 'raw_halves', '40HC'],
    ['edible_20GP', 'kopra_edible', 'bagged', '20GP'],
    ['edible_40HC', 'kopra_edible', 'bagged', '40HC'],
    ['asalan_bagged_20GP', 'kopra_asalan', 'bagged_jute', '20GP'],
  ] as const)('%s', (name, cm, form, cont) => {
    const out = run(cm, form, cont, 'BULK');
    close(out.result.typ.massKg / 1000, byCase[name].expect_t);
    expect(out.binding).toBe(byCase[name].expect_binding);
  });

  it.each([
    ['grid_fit_arang_batok_belah2_bag_20GP', 'arang_batok_belah2', 'lumps', '20GP'],
    ['grid_fit_arang_batok_belah2_bag_40HC', 'arang_batok_belah2', 'lumps', '40HC'],
    ['grid_fit_kopra_edible_bag_20GP', 'kopra_edible', 'bagged', '20GP'],
    ['grid_fit_kopra_edible_bag_40HC', 'kopra_edible', 'bagged', '40HC'],
  ] as const)('%s', (name, cm, form, cont) => {
    const out = run(cm, form, cont, 'PACKAGE');
    close(out.result.typ.massKg / 1000, byCase[name].expect.load_t);
    expect(out.binding).toBe(byCase[name].expect.binding);
  });

  it('grid_fit_bags_20GP: 924 karung jambul (mode default form bagged = PACKAGE)', () => {
    const out = run('kelapa_jambul', 'bagged', '20GP');
    expect(out.result.typ.packs).toBe(byCase.grid_fit_bags_20GP.expect.bags);
    expect(out.result.typ.pieces).toBe(924 * 25);
  });
});

describe('perakitan skenario', () => {
  it('kopra asalan: SELF_HEATING_RISK + trace versi dataset', () => {
    const out = containerCapacity(
      buildContainerInput(ds, { commodityId: 'kopra_asalan', formCode: 'bagged_jute', containerId: '20GP' }),
    );
    expect(out.warnings.map((w) => w.code)).toContain('SELF_HEATING_RISK');
    expect(out.trace.datasetVersion).toBe(ds.version);
  });

  it('jambul 20GP: peringatan benchmark konservatif 10–11 rb butir (DEC-007)', () => {
    const out = containerCapacity(
      buildContainerInput(ds, { commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE' }),
    );
    expect(out.warnings.map((w) => w.code)).toContain('CONSERVATIVE_BENCHMARK_GAP');
  });

  it('override valid tercatat; di luar rentang ditolak', () => {
    const ok = buildContainerInput(ds, {
      commodityId: 'arang_batok_belah2',
      formCode: 'halves_loose',
      containerId: '20GP',
      overrides: { bulk_density: 100 },
    });
    expect(ok.form.rho).toMatchObject({ typ: 100, source: 'override' });
    expect(() =>
      buildContainerInput(ds, {
        commodityId: 'arang_batok_belah2',
        formCode: 'halves_loose',
        containerId: '20GP',
        overrides: { bulk_density: 1000 },
      }),
    ).toThrow(OverrideOutOfRangeError);
  });

  it('kode tak dikenal → DatasetError', () => {
    expect(() => buildContainerInput(ds, { commodityId: 'x', formCode: 'y', containerId: '20GP' })).toThrow(DatasetError);
    expect(() =>
      buildContainerInput(ds, { commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '99XX' }),
    ).toThrow(DatasetError);
  });
});

it('dataset rusak ditolak dengan jalur field', () => {
  const broken = structuredClone(rawDataset) as any;
  broken.commodities[0].mass_per_unit_g = { min: 900, typ: 575, max: 850 };
  broken.commodities[0].container_benchmarks[0].source_ids = ['S99'];
  expect(() => loadDataset(broken)).toThrow(/S99/);
});
