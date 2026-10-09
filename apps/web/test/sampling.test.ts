import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundledDataset } from '@gemas/dataset';
import { describe, expect, it } from 'vitest';
import { displayUnit, parseSamplingCsv, SAMPLING_COLUMNS } from '@/lib/sampling';

const ds = bundledDataset();
const template = readFileSync(fileURLToPath(new URL('../../../architecture/logs/field_sampling_template.csv', import.meta.url)), 'utf8');
const HEADER = SAMPLING_COLUMNS.join(',');

describe('parseSamplingCsv — format persis template', () => {
  it('header template dikenali; baris contoh ditolak dengan alasan', () => {
    const r = parseSamplingCsv(template, ds);
    expect(r.fatal).toBeUndefined();
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toEqual([{ line: 2, reason: 'baris contoh dari template — hapus dulu' }]);
  });

  it('baris valid & tidak valid dipisah, alasan per baris jelas', () => {
    const csv = [
      HEADER,
      '2026-10-15T09:00:00+07:00,Gudang Depok,LOT-001,kelapa_jambul,bagged,mass_per_unit,0.612,kg,timbang,Budi,',
      '2026-10-15T09:05:00+07:00,Gudang Depok,LOT-001,kelapa_jambul,bagged,mass_per_unit,abc,kg,timbang,Budi,',
      '15/10/2026,Gudang,LOT,kelapa_jambul,bagged,mass_per_unit,0.6,kg,timbang,Budi,',
      '2026-10-15T09:10:00+07:00,Gudang,LOT,kelapa_jambul,bagged,mass_per_unit,600,g,timbang,Budi,',
      '2026-10-15T09:10:00+07:00,Gudang,LOT,kelapa_jambul,bagged,mass_per_unit,0.6,kg,timbang,Budi,',
      '2026-10-15T09:10:00+07:00,Gudang,LOT,kelapa_jambul,bagged,berat_aneh,0.6,kg,timbang,Budi,',
      '2026-10-15T09:10:00+07:00,Gudang,LOT,kelapa_jambul,bagged,mass_per_unit,0.6,kg,kira_kira,Budi,',
      '2026-10-15T09:10:00+07:00,Gudang,LOT,durian,bagged,mass_per_unit,0.6,kg,timbang,Budi,',
      '2026-10-15T09:10:00+07:00,Gudang,LOT,kelapa_jambul,bagged,mass_per_unit,0.6,kg,timbang',
      '"2026-10-15T09:20:00+07:00","Gudang ""B"", Depok",LOT-2,arang_batok_belah2,halves_loose,bulk_density,92,kg_m3,ember_1m3,Ani,"5 ulangan, kotak 0,2 m³"',
    ].join('\n');
    const r = parseSamplingCsv(csv, ds);
    expect(r.rows.map((x) => x.line)).toEqual([2, 6, 11]);
    expect(r.rows[2]).toMatchObject({ location: 'Gudang "B", Depok', value: 92, note: '5 ulangan, kotak 0,2 m³', officer: 'Ani' });
    const reasons = Object.fromEntries(r.errors.map((e) => [e.line, e.reason]));
    expect(reasons[3]).toMatch(/nilai "abc" harus angka/);
    expect(reasons[4]).toMatch(/tanggal .* tidak valid/);
    expect(reasons[5]).toMatch(/satuan "g" tidak dikenal/);
    expect(reasons[7]).toMatch(/parameter "berat_aneh" tidak ada/);
    expect(reasons[8]).toMatch(/metode "kira_kira" tidak dikenal/);
    expect(reasons[9]).toMatch(/komoditas "durian" tidak dikenal/);
    expect(reasons[10]).toMatch(/jumlah kolom 9, seharusnya 11/);
  });

  it('satuan tidak cocok dengan parameter ditolak', () => {
    const r = parseSamplingCsv(`${HEADER}\n2026-10-15T09:00:00+07:00,,,kelapa_jambul,bagged,mass_per_unit,600,kg_m3,timbang,,`, ds);
    expect(r.errors[0]!.reason).toMatch(/memakai "kg"/);
  });

  it('pemisah titik koma + desimal koma (Excel Indonesia)', () => {
    const r = parseSamplingCsv(`${SAMPLING_COLUMNS.join(';')}\n2026-10-15T09:00:00+07:00;Gudang;L1;kelapa_jambul;bagged;mass_per_unit;0,612;kg;timbang;Budi;`, ds);
    expect(r.rows[0]!.value).toBe(0.612);
  });

  it('header salah / kosong → fatal', () => {
    expect(parseSamplingCsv('a,b,c\n1,2,3', ds).fatal).toMatch(/Kolom harus persis/);
    expect(parseSamplingCsv('', ds).fatal).toBe('File kosong');
  });
});

it('displayUnit: massa butir dalam gram, panjang cm, fraksi %', () => {
  const g = displayUnit('kg', 0.575);
  expect(g.label).toBe('g');
  expect(g.toSi(612)).toBeCloseTo(0.612);
  expect(displayUnit('kg', 25).label).toBe('kg');
  expect(displayUnit('m', 0.1).toSi(10)).toBeCloseTo(0.1);
  expect(displayUnit('fraction', 0.3).fromSi(0.3)).toBeCloseTo(30);
});
