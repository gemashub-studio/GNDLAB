import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processChain } from '@gemas/calc-engine';
import { describe, expect, it } from 'vitest';
import {
  buildProcessInput,
  bundledDataset,
  bundledProcessDataset,
  DatasetError,
  getForm,
  loadProcessDataset,
  provenance,
  rawProcessDataset,
} from '../src/index.ts';

const inv = bundledDataset();
const p = bundledProcessDataset();

describe('dataset proses v1', () => {
  it('salinan identik dengan sumber kebenaran', () => {
    const src = readFileSync(fileURLToPath(new URL('../../../architecture/00-research/data/coconut_process_dataset.json', import.meta.url)));
    expect(createHash('sha256').update(src).digest('hex')).toBe(
      (provenance as { files: Record<string, { sha256: string }> }).files['process-dataset.json']!.sha256,
    );
  });

  it('dua asal: dataran rendah & tinggi, semua angka asal berkeyakinan C', () => {
    expect(p.origins.map((o) => o.id)).toEqual(['dataran_rendah', 'dataran_tinggi']);
    for (const o of p.origins) {
      expect(o.wholeMassKg.confidence).toBe('C');
      expect(o.wholeMassKg.sourceIds.length).toBeGreaterThan(0);
    }
    // Buah dataran tinggi lebih ringan (P07)
    expect(p.origins[1]!.wholeMassKg.typ).toBeLessThan(p.origins[0]!.wholeMassKg.typ);
  });

  it('kadar air daging segar dikonversi % → fraksi', () => {
    expect(p.kernelMoisture).toMatchObject({ min: 0.45, typ: 0.5, max: 0.55, unit: 'fraction' });
  });

  it('kepadatan rak = 1/d² dari diameter mulut batok dataset inventory (dirujuk, bukan disalin)', () => {
    const rim = getForm(inv, 'arang_batok_belah2', 'raw_halves').params['geometry.raw_half_shell.rim_diameter']!;
    expect(p.halvesPerM2.typ).toBeCloseTo(1 / rim.typ ** 2, 6);
    expect(p.halvesPerM2.min).toBeCloseTo(1 / rim.max ** 2, 6);
    expect(p.halvesPerM2.confidence).toBe('C');
  });

  it('rendemen arang = parameter dataset inventory', () => {
    expect(p.charcoal.yieldFraction).toBe(getForm(inv, 'arang_batok_belah2', 'raw_halves').params.charcoal_yield_mass_fraction);
  });

  it('3 metode jemur, oven paling cepat & tidak tergantung cuaca', () => {
    const [sun, gh, oven] = p.dryingMethods;
    expect([sun!.id, gh!.id, oven!.id]).toEqual(['sun', 'greenhouse', 'oven']);
    expect(oven!.duration.typ).toBeLessThan(gh!.duration.typ);
    expect(gh!.duration.typ).toBeLessThan(sun!.duration.typ);
    expect(oven!.weatherDependent).toBe(false);
  });

  it('versi dataset inventory tidak cocok → DatasetError', () => {
    const bad = structuredClone(rawProcessDataset) as { meta: { requires_inventory_dataset: string } };
    bad.meta.requires_inventory_dataset = '9.9.9';
    expect(() => loadProcessDataset(bad, inv)).toThrow(DatasetError);
  });

  it('source_id tak terdaftar ditolak', () => {
    const bad = structuredClone(rawProcessDataset) as { origins: { husk_fraction: { source_ids: string[] } }[] };
    bad.origins[0]!.husk_fraction.source_ids = ['P99'];
    expect(() => loadProcessDataset(bad, inv)).toThrow(/P99/);
  });
});

describe('perakitan & cek silang ke dataset inventory', () => {
  it('kopra edible per butir dataran rendah (typ) masuk rentang copra_per_nut dataset inventory', () => {
    const out = processChain(buildProcessInput(inv, p, { lots: { dataran_rendah: 1000 }, product: 'kopra_edible' }));
    const perNut = out.total.mass.typ.copraKg / 1000;
    const ref = getForm(inv, 'kopra_asalan', 'bagged_jute').params['yield.copra_per_nut']!;
    expect(perNut).toBeGreaterThanOrEqual(ref.min);
    expect(perNut).toBeLessThanOrEqual(ref.max);
  });

  it('dua asal + rak greenhouse + arang', () => {
    const out = processChain(
      buildProcessInput(inv, p, {
        lots: { dataran_rendah: 2000, dataran_tinggi: 800 },
        product: 'kopra_asalan',
        drying: { methodId: 'greenhouse', tierAreaM2: 2, tiers: 6, racksAvailable: 4 },
        charcoal: { drums: 3 },
      }),
    );
    expect(out.lots).toHaveLength(2);
    expect(out.total.drying!.typ.totalHours).toBeGreaterThan(0);
    expect(out.total.charcoal!.typ.charcoalKg).toBeGreaterThan(0);
    expect(out.trace.datasetVersion).toBe(`${inv.version}+proses.${p.version}`);
    expect(out.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['WEATHER_DEPENDENT', 'SELF_HEATING_RISK', 'FLAMMABLE']));
  });

  it('asal tak dikenal / semua kosong ditolak', () => {
    expect(() => buildProcessInput(inv, p, { lots: { gunung: 1 }, product: 'kopra_edible' })).toThrow(DatasetError);
    expect(() => buildProcessInput(inv, p, { lots: { dataran_rendah: 0 }, product: 'kopra_edible' })).toThrow(DatasetError);
  });
});
