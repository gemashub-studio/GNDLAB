import { containerCapacity, convert, warehouseSpace } from '@gemas/calc-engine';
import { describe, expect, it } from 'vitest';
import {
  availableModes,
  buildContainerInput,
  buildConvertInput,
  buildWarehouseInput,
  bundledDataset,
  DatasetError,
  defaultStackHeightM,
  getForm,
} from '../src/index.ts';

const ds = bundledDataset();

describe('availableModes', () => {
  it('jambul karung: BULK, PIECE, PACKAGE', () => {
    expect(availableModes(getForm(ds, 'kelapa_jambul', 'bagged'))).toEqual(['BULK', 'PIECE', 'PACKAGE']);
  });
  it('arang lump: tanpa massa per keping → BULK & PACKAGE', () => {
    expect(availableModes(getForm(ds, 'arang_batok_belah2', 'lumps'))).toEqual(['BULK', 'PACKAGE']);
  });
});

describe('container custom', () => {
  it('memakai L·W·H, tanpa benchmark', () => {
    const input = buildContainerInput(ds, {
      commodityId: 'kopra_edible',
      formCode: 'bagged',
      mode: 'BULK',
      customContainer: { lengthM: 2, widthM: 2, heightM: 2, payloadKg: 100_000 },
    });
    const out = containerCapacity(input);
    expect(out.result.typ.massKg).toBeCloseTo(8 * 320);
    expect(input.context?.benchmarks).toEqual([]);
  });
  it('tanpa container → DatasetError; utilisasi > 1 ditolak', () => {
    expect(() => buildContainerInput(ds, { commodityId: 'kopra_edible', formCode: 'bagged' })).toThrow(DatasetError);
    expect(() =>
      buildContainerInput(ds, { commodityId: 'kopra_edible', formCode: 'bagged', containerId: '20GP', volumeUtil: 1.2 }),
    ).toThrow(/utilisasi/);
  });
});

describe('gudang', () => {
  it('US-03 lewat dataset: kopra asalan curah, override ρ 500', () => {
    const out = warehouseSpace(
      buildWarehouseInput(ds, {
        commodityId: 'kopra_asalan',
        formCode: 'loose_bulk',
        stock: { massKg: 50_000 },
        stackHeightM: 2.5,
        floorUtil: 0.65,
      }),
    );
    // ρ curah kopra asalan typ = 500 kg/m³ di dataset → golden warehouse_floor_area
    expect(out.result.typ.floorAreaM2).toBeCloseTo(61.54, 2);
  });

  it('stok dalam karung → massa rentang dari berat bersih karung', () => {
    const out = warehouseSpace(
      buildWarehouseInput(ds, { commodityId: 'kopra_edible', formCode: 'bagged', stock: { packs: 400 }, stackHeightM: 1.8 }),
    );
    expect(out.result.typ.packs).toBe(400);
    expect(out.result.typ.massKg).toBe(10_000);
  });

  it('kadar air aktual 14% → SELF_HEATING_RISK; 8% → tidak', () => {
    const base = { commodityId: 'kopra_asalan', formCode: 'bagged_jute', stock: { massKg: 6000 }, stackHeightM: 2.5 };
    const wet = warehouseSpace(buildWarehouseInput(ds, { ...base, moisturePct: 14 }));
    const dry = warehouseSpace(buildWarehouseInput(ds, { ...base, moisturePct: 8 }));
    expect(wet.warnings.map((w) => w.code)).toContain('SELF_HEATING_RISK');
    expect(dry.warnings.map((w) => w.code)).not.toContain('SELF_HEATING_RISK');
  });

  it('kopra edible + asalan satu zona → ODOR_CONTAMINATION', () => {
    const out = warehouseSpace(
      buildWarehouseInput(ds, {
        commodityId: 'kopra_edible',
        formCode: 'bagged',
        stock: { massKg: 1000 },
        stackHeightM: 1.8,
        coStored: ['kopra_asalan'],
      }),
    );
    expect(out.warnings.map((w) => w.code)).toContain('ODOR_CONTAMINATION');
  });

  it('kadar air tidak valid ditolak', () => {
    expect(() =>
      buildWarehouseInput(ds, { commodityId: 'kopra_asalan', formCode: 'bagged_jute', stock: { massKg: 1 }, stackHeightM: 1, moisturePct: 100 }),
    ).toThrow(DatasetError);
  });
});

describe('defaultStackHeightM dari dataset storage', () => {
  it('jambul 1,8 m · kopra asalan 2,5 m · kopra edible 10 karung × 0,18 m · arang tidak ada', () => {
    expect(defaultStackHeightM(ds, 'kelapa_jambul', 'bagged')).toBe(1.8);
    expect(defaultStackHeightM(ds, 'kopra_asalan', 'loose_bulk')).toBe(2.5);
    expect(defaultStackHeightM(ds, 'kopra_edible', 'bagged')).toBe(1.8);
    expect(defaultStackHeightM(ds, 'arang_batok_belah2', 'lumps')).toBeUndefined();
  });
});

describe('konverter', () => {
  it('2 karung jambul → 50 butir', () => {
    const out = convert(
      buildConvertInput(ds, { commodityId: 'kelapa_jambul', formCode: 'bagged', from: { unit: 'pack', value: 2 }, to: 'pcs' }),
    );
    expect(out.result.typ.value).toBeCloseTo(50);
  });
  it('1 t kopra edible → 40 karung 25 kg', () => {
    const out = convert(
      buildConvertInput(ds, { commodityId: 'kopra_edible', formCode: 'bagged', from: { unit: 't', value: 1 }, to: 'pack' }),
    );
    expect(out.result.typ.value).toBe(40);
  });
});
