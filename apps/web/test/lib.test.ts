import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundledDataset } from '@gemas/dataset';
import { describe, expect, it } from 'vitest';
import { defaultFormCode, defaultMode } from '@/lib/defaults';
import { fmt, parseNum } from '@/lib/format';
import { reportRows, toCsv } from '@/lib/report';
import { decodeState, encodeState, runScenario, ScenarioStateSchema, type ScenarioState } from '@/lib/scenario';

const ds = bundledDataset();
const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

describe('migrasi 0001 = architecture/03-data/schema.sql apa adanya', () => {
  it('isi identik (abaikan CRLF/LF)', () => {
    const norm = (s: string) => s.replace(/\r\n/g, '\n');
    expect(norm(readFileSync(root('apps/web/prisma/migrations/0001_schema/migration.sql'), 'utf8'))).toBe(
      norm(readFileSync(root('architecture/03-data/schema.sql'), 'utf8')),
    );
  });
});

describe('satuan imperial (tampilan)', () => {
  it('meter → ft/in; nama container dalam ft', async () => {
    const { ftIn, containerFtName } = await import('@/lib/imperial');
    expect(ftIn(5.898)).toBe('19 ft 4 in');
    expect(ftIn(2.393)).toBe('7 ft 10 in');
    expect(ftIn(0.3048)).toBe('1 ft');
    expect(containerFtName('20GP')).toBe('20 ft');
    expect(containerFtName('40HC')).toBe('40 ft High Cube');
    expect(containerFtName('CUSTOM')).toBe('CUSTOM');
  });
});

describe('format angka Indonesia', () => {
  it('fmt memakai titik ribuan & koma desimal', () => {
    expect(fmt(22229)).toBe('22.229');
    expect(fmt(12.781, 2)).toBe('12,78');
  });
  it('parseNum menerima gaya Indonesia & gaya titik', () => {
    expect(parseNum('1.250,5')).toBe(1250.5);
    expect(parseNum('12.000')).toBe(12000);
    expect(parseNum('0.575')).toBe(0.575);
    expect(parseNum('1.250.000')).toBe(1250000);
    expect(parseNum('0,8')).toBe(0.8);
    expect(parseNum('12.5')).toBe(12.5);
    expect(parseNum('385')).toBe(385);
    expect(Number.isNaN(parseNum(''))).toBe(true);
    expect(Number.isNaN(parseNum('abc'))).toBe(true);
  });
});

describe('default pilihan (diturunkan dari data)', () => {
  it('US-01: jambul default → karung jaring + PER BUTIR', () => {
    const f = defaultFormCode(ds, 'kelapa_jambul');
    expect(f).toBe('bagged');
    expect(defaultMode(ds, 'kelapa_jambul', f)).toBe('PIECE');
  });
  it('arang → lump; kopra asalan → karung goni (density_ref); kopra edible → karung', () => {
    expect(defaultFormCode(ds, 'arang_batok_belah2')).toBe('lumps');
    expect(defaultFormCode(ds, 'kopra_asalan')).toBe('bagged_jute');
    expect(defaultFormCode(ds, 'kopra_edible')).toBe('bagged');
  });
});

describe('state skenario', () => {
  const s: ScenarioState = { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE', overrides: { bulk_density: 400 } };

  it('encode → decode bolak-balik (URL bagikan)', () => {
    const token = encodeState(s);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState(token)).toEqual(s);
  });
  it('token rusak / tidak valid → undefined (tidak melempar)', () => {
    expect(decodeState('%%%')).toBeUndefined();
    expect(decodeState(encodeState({ ...s, mode: 'XX' } as unknown as ScenarioState))).toBeUndefined();
  });
  it('container dataset & custom tidak boleh dua-duanya', () => {
    const r = ScenarioStateSchema.safeParse({ ...s, custom: { lengthM: 1, widthM: 1, heightM: 1, payloadKg: 1 } });
    expect(r.success).toBe(false);
  });
  it('override ikut dihitung', () => {
    const o = runScenario(ds, s);
    expect(o.kind === 'CONTAINER' && o.out.trace.params.bulk_density?.source).toBe('override');
  });
});

describe('laporan & CSV', () => {
  const s: ScenarioState = { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', containerId: '40HC', mode: 'PACKAGE' };
  const rows = reportRows(ds, s, runScenario(ds, s));

  it('baris memuat input, hasil, jejak versi', () => {
    expect(rows.find((r) => r.label === 'Container')?.value).toBe('40 ft High Cube (40HC)');
    expect(rows.find((r) => r.label === 'Jumlah karung')?.value).toMatch(/^975 /);
    expect(rows.find((r) => r.label === 'Versi dataset')?.value).toBe(ds.version);
  });
  it('CSV: BOM UTF-8, pemisah titik koma, kutip bila perlu', () => {
    const csv = toCsv([...rows, { section: 'Input', label: 'Catatan', value: 'a;b "c"' }]);
    expect(csv.startsWith('﻿Bagian;Label;Nilai\r\n')).toBe(true);
    expect(csv).toContain('Input;Catatan;"a;b ""c"""');
  });
});
