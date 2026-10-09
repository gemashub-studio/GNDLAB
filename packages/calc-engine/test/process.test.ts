import { describe, expect, it } from 'vitest';
import { param, processChain, type ProcessInput } from '../src/index.ts';

const P = (key: string, unit: Parameters<typeof param>[1], v: number) => param(key, unit, v, 'B');

/** Angka titik agar bisa dihitung tangan; nilai = typ dataset proses v1.0.0 dataran rendah. */
const base = (): ProcessInput => ({
  lots: [{ key: 'dataran_rendah', nuts: 1000, wholeMassKg: P('m', 'kg', 1.75), huskFraction: P('h', 'fraction', 0.42) }],
  shellFraction: P('s', 'fraction', 0.12),
  kernelFraction: P('k', 'fraction', 0.28),
  coirPerNutKg: P('c', 'kg', 0.085),
  kernelMoisture: P('w0', 'fraction', 0.5),
  targetMoisture: P('w1', 'fraction', 0.06),
});

describe('processChain — neraca massa', () => {
  const out = processChain(base());
  const t = out.total.mass.typ;

  it('1.000 butir × 1,75 kg: sabut 42%, batok 12%, daging 28%, air = sisa 18%', () => {
    expect(t.incomingKg).toBeCloseTo(1750);
    expect(t.huskKg).toBeCloseTo(735);
    expect(t.dehuskedKg).toBeCloseTo(1015);
    expect(t.shellKg).toBeCloseTo(210);
    expect(t.kernelFreshKg).toBeCloseTo(490);
    expect(t.waterKg).toBeCloseTo(315);
    expect(t.halves).toBe(2000);
    expect(t.coirKg).toBeCloseTo(85);
  });

  it('kopra @6% = 490 × 0,5 / 0,94 ≈ 260,6 kg (≈ 260 g/butir — cocok dataset inventory 200–285 g)', () => {
    expect(t.copraKg).toBeCloseTo(260.638, 2);
    expect(t.copraKg / 1000).toBeGreaterThanOrEqual(0.2);
    expect(t.copraKg / 1000).toBeLessThanOrEqual(0.285);
  });

  it('neraca: sabut + batok + daging + air = masuk', () => {
    expect(t.huskKg + t.shellKg + t.kernelFreshKg + t.waterKg).toBeCloseTo(t.incomingKg);
  });
});

describe('processChain — rentang & dua asal', () => {
  it('rentang berat buah & sabut menghasilkan min ≤ typ ≤ max per lot dan total = jumlah lot', () => {
    const i = base();
    i.lots = [
      { key: 'dataran_rendah', nuts: 1000, wholeMassKg: param('m', 'kg', { min: 1.73, typ: 1.75, max: 1.8 }, 'C'), huskFraction: param('h', 'fraction', { min: 0.406, typ: 0.42, max: 0.439 }, 'C') },
      { key: 'dataran_tinggi', nuts: 500, wholeMassKg: param('m', 'kg', 1.45, 'C'), huskFraction: param('h', 'fraction', { min: 0.33, typ: 0.35, max: 0.5 }, 'C') },
    ];
    const out = processChain(i);
    for (const l of out.lots) {
      expect(l.mass.min.copraKg).toBeLessThanOrEqual(l.mass.typ.copraKg);
      expect(l.mass.typ.copraKg).toBeLessThanOrEqual(l.mass.max.copraKg);
    }
    const [a, b] = out.lots;
    expect(out.total.mass.typ.incomingKg).toBeCloseTo(a!.mass.typ.incomingKg + b!.mass.typ.incomingKg);
    expect(out.total.mass.typ.incomingKg).toBeCloseTo(1000 * 1.75 + 500 * 1.45);
    expect(out.confidence).toBe('C');
    expect(out.warnings.map((w) => w.code)).toContain('LOW_CONFIDENCE_PARAM');
  });

  it('fraksi > 100% → air 0 + WATER_REMAINDER_CLAMPED', () => {
    const i = base();
    i.lots[0]!.huskFraction = P('h', 'fraction', 0.7);
    const out = processChain(i);
    expect(out.total.mass.typ.waterKg).toBe(0);
    expect(out.warnings.map((w) => w.code)).toContain('WATER_REMAINDER_CLAMPED');
  });
});

describe('processChain — rak jemur', () => {
  it('2.000 belahan, 111 belahan/m², rak 1 m² × 5 susun, 2 rak, 168 jam', () => {
    const out = processChain({
      ...base(),
      drying: { method: 'sun', duration: P('dur', 'h', 168), halvesPerM2: P('dens', 'count', 111), tierAreaM2: 1, tiers: 5, racksAvailable: 2, weatherDependent: true },
    });
    const d = out.total.drying!.typ;
    expect(d.capacityPerRack).toBe(555);
    expect(d.racksForOneBatch).toBe(4); // ⌈2000/555⌉
    expect(d.batches).toBe(2); // ⌈2000/(2×555)⌉
    expect(d.totalHours).toBe(336);
    expect(out.warnings.map((w) => w.code)).toContain('WEATHER_DEPENDENT');
  });

  it('lot per asal dijemur terpisah: rak dijumlah, waktu = lot terlama', () => {
    const i = base();
    i.lots.push({ key: 'dataran_tinggi', nuts: 100, wholeMassKg: P('m', 'kg', 1.45), huskFraction: P('h', 'fraction', 0.35) });
    i.drying = { method: 'oven', duration: P('dur', 'h', 36), halvesPerM2: P('dens', 'count', 100), tierAreaM2: 1, tiers: 10, racksAvailable: 1 };
    const out = processChain(i);
    expect(out.lots[0]!.drying!.typ.batches).toBe(2); // 2000 / 1000
    expect(out.lots[1]!.drying!.typ.batches).toBe(1); // 200 / 1000
    expect(out.total.drying!.typ.racksForOneBatch).toBe(3); // 2 + 1
    expect(out.total.drying!.typ.totalHours).toBe(72); // lot terlama
  });

  it('input rak tidak valid ditolak', () => {
    expect(() =>
      processChain({ ...base(), drying: { method: 'sun', duration: P('d', 'h', 1), halvesPerM2: P('x', 'count', 1), tierAreaM2: 0, tiers: 1 } }),
    ).toThrow(RangeError);
  });
});

describe('processChain — batok → arang', () => {
  it('210 kg batok × 30% = 63 kg arang; drum 25 kg → 9 angkatan; 2 drum → 5 putaran × (5+1) jam', () => {
    const out = processChain({
      ...base(),
      charcoal: { yieldFraction: P('y', 'fraction', 0.3), drumBatchKg: P('b', 'kg', 25), burnH: P('burn', 'h', 5), coolingH: P('cool', 'h', 1), drums: 2 },
    });
    const c = out.total.charcoal!.typ;
    expect(c.charcoalKg).toBeCloseTo(63);
    expect(c.drumBatches).toBe(9);
    expect(c.rounds).toBe(5);
    expect(c.totalHours).toBe(30);
    expect(out.warnings.map((w) => w.code)).toContain('FLAMMABLE');
  });
});

describe('validasi', () => {
  it('butir pecahan, kadar air ≥ 1, tanpa lot → ditolak', () => {
    const a = base();
    a.lots[0]!.nuts = 1.5;
    expect(() => processChain(a)).toThrow(/bulat/);
    expect(() => processChain({ ...base(), targetMoisture: P('w1', 'fraction', 1) })).toThrow();
    expect(() => processChain({ ...base(), lots: [] })).toThrow();
  });
  it('kopra asalan basah (target 12%) → SELF_HEATING_RISK', () => {
    const out = processChain({ ...base(), targetMoisture: P('w1', 'fraction', 0.12), productCode: 'kopra_asalan' });
    expect(out.warnings.map((w) => w.code)).toContain('SELF_HEATING_RISK');
  });
});
