import { describe, expect, it } from 'vitest';
import {
  blendRawMaterial,
  celluloseAdditive,
  feasibleDtShare,
  formatLotCode,
  dryingLoadPlan,
  greenhouseServices,
  kilnPlan,
  originBlend,
  originClass,
  param,
  rackRoomDesign,
  sievePlan,
  splitPlan,
  sunDryingArea,
  tripsNeeded,
  vehicleLoad,
  meters,
  type Unit,
} from '../src/index.ts';

/** Fase G (ADR-010). Semua angka harapan dihitung tangan di komentar. */
const P = (key: string, unit: Unit, v: number | { min: number; typ: number; max: number }, c: 'A' | 'B' | 'C' = 'C') => param(key, unit, v, c);

describe('asal lot', () => {
  it('DR ≤500 mdpl, DT >500 mdpl; kode lot dari pola dataset', () => {
    expect(originClass(500, 500)).toBe('DR');
    expect(originClass(501, 500)).toBe('DT');
    expect(originClass(0, 500)).toBe('DR');
    expect(formatLotCode('{KELAS}-{YYMMDD}-{NNN}', 'DT', '2026-10-10', 1)).toBe('DT-261010-001');
    expect(() => formatLotCode('{KELAS}-{YYMMDD}-{NNN}', 'DR', '10/10/2026', 1)).toThrow(/YYYY-MM-DD/);
  });
});

describe('angkut', () => {
  const bag = { l: meters(0.49), w: meters(0.34), h: meters(0.21), netKg: P('bag', 'kg', { min: 13, typ: 14, max: 14.5 }), pcs: 25 };
  const cdd = { L: 4.4, W: 2.0, H: 1.9, kind: 'truck' as const, payload: P('cdd', 'kg', { min: 3500, typ: 5000, max: 5000 }) };

  it('CDD box + karung 25 butir: dibatasi berat (5.000 ÷ 14 = 357 karung = 8.925 butir)', () => {
    const r = vehicleLoad(cdd, { mode: 'bag', pack: bag });
    expect(r.binding).toBe('WEIGHT');
    expect(r.result.typ.packs).toBe(357);
    expect(r.result.typ.pieces).toBe(357 * 25);
    expect(r.result.min.packs).toBe(Math.floor(3500 / 14.5)); // sudut payload & kemasan terburuk
    expect(r.warnings.map((w) => w.code)).toContain('PAYLOAD_LEGAL_CHECK');
  });

  it('container tidak memberi peringatan KIR; curah butir lepas memakai densitas tumpukan', () => {
    const c = { L: 5.898, W: 2.352, H: 2.393, kind: 'container' as const, payload: P('20gp', 'kg', 28200, 'B') };
    const r = vehicleLoad(c, { mode: 'bulk', rho: P('rho', 'kg_m3', 483), unitMass: P('m', 'kg', 0.575) });
    expect(r.warnings.map((w) => w.code)).not.toContain('PAYLOAD_LEGAL_CHECK');
    // V = 5,898×2,352×2,393 = 33,196 m³ → 33,196×483/0,575 = 27.884 butir
    expect(r.result.typ.pieces).toBe(Math.floor((5.898 * 2.352 * 2.393 * 483) / 0.575));
  });

  it('jumlah rit: 22.500 butir dengan 6.250–8.925 butir/rit → 3 (typ) s/d 4 rit', () => {
    expect(tripsNeeded(22500, { min: 6250, typ: 8925, max: 8925 })).toEqual({ min: 3, typ: 3, max: 4 });
    expect(() => tripsNeeded(100, { min: 0, typ: 0, max: 0 })).toThrow(/tidak muat/);
  });
});

describe('belah, sortir & air kelapa', () => {
  it('1.000 butir 15/60/25: air 127,5 L (edible+reguler), batok 170 kg, 2 orang 10 jam, pendingin 25,5 L per 2 jam', () => {
    const r = splitPlan({
      nuts: 1000,
      share: { edible: 15, reguler: 60, asalan: 25 },
      rejectPct: 0,
      waterPerNutL: P('w', 'L', { min: 0.15, typ: 0.17, max: 0.2 }),
      meatPerNutKg: P('m', 'kg', { min: 0.25, typ: 0.3, max: 0.4 }),
      halfShellKg: P('s', 'kg', { min: 0.06, typ: 0.085, max: 0.12 }),
      splitRatePerPersonH: P('rate', 'count_h', { min: 37.5, typ: 50, max: 875 }),
      workers: 2,
      chillWithinH: P('chill', 'h', 2),
    }).result.typ;
    expect(r.edibleNuts).toBe(150);
    expect(r.waterL).toBeCloseTo(127.5);
    expect(r.meatEdibleKg).toBeCloseTo(45);
    expect(r.shellKg).toBeCloseTo(170);
    expect(r.splitH).toBeCloseTo(10);
    expect(r.chillBatchL).toBeCloseTo(25.5);
  });

  it('pembagian jalur ≠100% ditolak', () => {
    expect(() =>
      splitPlan({
        nuts: 10,
        share: { edible: 50, reguler: 60, asalan: 0 },
        rejectPct: 0,
        waterPerNutL: P('w', 'L', 0.17),
        meatPerNutKg: P('m', 'kg', 0.3),
        halfShellKg: P('s', 'kg', 0.085),
        splitRatePerPersonH: P('r', 'count_h', 50),
        workers: 1,
        chillWithinH: P('c', 'h', 2),
      }),
    ).toThrow(/100%/);
  });
});

describe('desainer greenhouse (contoh KORA 3×10×3,5 m)', () => {
  const base = {
    rackDepth: P('d', 'm', 0.65),
    tierPitch: P('p', 'm', 0.5),
    aisleMin: P('a', 'm', { min: 0.5, typ: 0.5, max: 0.525 }),
    roofClearance: P('r', 'm', 0.5),
    halvesPerM2: P('h', 'count', { min: 25, typ: 28, max: 30 }),
  };

  it('3 rak × 6 tingkat = 117 m², lorong 0,525 m, 1.638 butir (luasan) — sama dengan dokumen KORA', () => {
    const r = rackRoomDesign({ roomL: 10, roomW: 3, roomH: 3.5, ...base });
    expect(r.result.typ.racks).toBe(3);
    expect(r.result.typ.aisles).toBe(2);
    expect(r.result.typ.aisleM).toBeCloseTo(0.525);
    expect(r.result.typ.tiers).toBe(6);
    expect(r.result.typ.totalAreaM2).toBeCloseTo(117);
    expect(r.result.typ.nutsByArea).toBe(1638); // ⌊117 × 28 ÷ 2⌋
    expect(r.result.min.nutsByArea).toBe(1462);
    expect(r.result.max.nutsByArea).toBe(1755);
  });

  it('tray 0,65×0,65 m: 15 tray/tingkat, 270 tray, 3×3 = 9 belahan/tray → 1.215 butir (sisa tepi tray)', () => {
    const r = rackRoomDesign({ roomL: 10, roomW: 3, roomH: 3.5, ...base }).result.typ;
    expect(r.traysPerTier).toBe(15);
    expect(r.trays).toBe(270);
    expect(r.halvesPerTray).toBe(9);
    expect(r.nutsPerTray).toBe(4.5);
    expect(r.nutsByTrays).toBe(1215);
  });

  it('ruang terlalu sempit/pendek & tray lebih lebar dari rak ditolak', () => {
    expect(() => rackRoomDesign({ roomL: 10, roomW: 1, roomH: 3.5, ...base })).toThrow(/terlalu sempit/);
    expect(() => rackRoomDesign({ roomL: 10, roomW: 3, roomH: 0.8, ...base })).toThrow(/tidak cukup/);
    expect(() => rackRoomDesign({ roomL: 10, roomW: 3, roomH: 3.5, ...base, trayW: 0.8 })).toThrow(/lebih lebar/);
  });

  it('kipas: 105 m³ → 2–4 kipas; 210 m³ → 4–8 kipas + peringatan skala; TIDAK ada keluaran sulfur (DEC-048)', () => {
    const svc = (roomM3: number) => greenhouseServices({ roomM3, aisles: 2, refRoomM3: 105, fansPerRefRoom: P('f', 'count', { min: 2, typ: 3, max: 4 }) });
    const a = svc(105);
    expect([a.result.min.fans, a.result.typ.fans, a.result.max.fans]).toEqual([2, 3, 4]);
    expect(a.result.typ.fanPositions).toBe(4);
    expect(Object.keys(a.result.typ).some((k) => /sulfur|burn/i.test(k))).toBe(false);
    expect(a.warnings.map((w) => w.code)).not.toContain('DERIVED_SCALING');
    const b = svc(210);
    expect([b.result.min.fans, b.result.max.fans]).toEqual([4, 8]);
    expect(b.warnings.map((w) => w.code)).toContain('DERIVED_SCALING');
  });

  it('belahan per tray hasil hitung sendiri menggantikan perkiraan kerapatan', () => {
    const r = rackRoomDesign({ roomL: 10, roomW: 3, roomH: 3.5, ...base, trayL: 0.65, halvesPerTrayCounted: 12 }).result;
    expect(r.typ.halvesPerTray).toBe(12);
    expect(r.min.halvesPerTray).toBe(12);
    expect(r.typ.nutsByTrays).toBe(1620); // 270 tray × 12 ÷ 2
    expect(() => rackRoomDesign({ roomL: 10, roomW: 3, roomH: 3.5, ...base, trayL: 0.65, halvesPerTrayCounted: 0 })).toThrow(/belahan per tray/);
  });

  it('muatan aktual vs kapasitas: 2.000 butir dibelah, kapasitas 1.215 → 2 angkatan, sisa 430', () => {
    const r = dryingLoadPlan({ capacityNuts: 1215, splitNuts: 2000, halvesPerTray: 9, trays: 270 });
    expect(r).toEqual({ halves: 4000, batches: 2, firstBatchFillPct: 100, lastBatchNuts: 785, spareNuts: 430, traysUsedFirstBatch: 270 });
    const half = dryingLoadPlan({ capacityNuts: 1215, splitNuts: 600, halvesPerTray: 9 });
    expect(half.batches).toBe(1);
    expect(half.firstBatchFillPct).toBeCloseTo((600 / 1215) * 100);
    expect(half.traysUsedFirstBatch).toBe(134); // ⌈1.200 ÷ 9⌉
    expect(dryingLoadPlan({ capacityNuts: 100, splitNuts: 0 }).batches).toBe(0);
    expect(() => dryingLoadPlan({ capacityNuts: 100, splitNuts: 10.5 })).toThrow(/bulat/);
  });

  it('jemur para-para: 1.000 butir → 2.000 belahan ÷ 25–30/m² = 66,7–80 m²', () => {
    const r = sunDryingArea(1000, P('h', 'count', { min: 25, typ: 28, max: 30 })).result;
    expect(r.min.areaM2).toBeCloseTo(2000 / 30);
    expect(r.max.areaM2).toBeCloseTo(80);
  });
});

describe('karbonisasi, ayak & hammer mill', () => {
  const common = {
    yieldPct: P('y', 'pct', 30),
    burnH: P('b', 'h', 5),
    sealH: P('s', 'h', { min: 0.5, typ: 0.75, max: 1 }),
    coolH: P('c', 'h', { min: 12, typ: 24, max: 48 }),
    spreadH: P('sp', 'h', { min: 2, typ: 3, max: 4 }),
  };

  it('kolam 2×2×1,5 m isi 90% × 195 kg/m³ = 1.053 kg/angkatan → 5.000 kg batok = 5 angkatan, 1.500 kg arang', () => {
    const r = kilnPlan({ shellKg: 5000, kiln: { method: 'kolam', L: 2, W: 2, D: 1.5, fillFraction: P('f', 'fraction', 0.9), rawBulkDensity: P('rho', 'kg_m3', { min: 150, typ: 195, max: 240 }) }, ...common }).result;
    expect(r.typ.batchShellKg).toBeCloseTo(1053);
    expect(r.typ.batches).toBe(5);
    expect(r.typ.charcoalKg).toBeCloseTo(1500);
    expect(r.typ.cycleH).toBeCloseTo(32.75);
    expect(r.max.batches).toBe(Math.ceil(5000 / (6 * 0.9 * 150)));
  });

  it('drum 80 kg × 3 = 240 kg/angkatan → 21 angkatan; pendinginan <8 jam → peringatan', () => {
    const r = kilnPlan({ shellKg: 5000, kiln: { method: 'drum', drumBatchKg: P('d', 'kg', 80), drumCount: 3 }, ...common, coolH: P('c', 'h', { min: 6, typ: 8, max: 10 }) });
    expect(r.result.typ.batches).toBe(21);
    expect(r.warnings.map((w) => w.code)).toContain('COOLING_TOO_SHORT');
  });

  it('ayak 2× (10% lalu 5% lolos), 2% belum matang: arang batok 837,9 kg, serbuk 142,1 kg; digiling → 39,9 jam pada 21 kg/jam', () => {
    const mill = P('mill', 'kg_h', { min: 21, typ: 21, max: 157 });
    const a = sievePlan({ charcoalKg: 1000, finesPctPerPass: [10, 5], unburntPct: 2, grindLumps: false, hammerMillKgH: mill }).result.typ;
    expect(a.unburntKg).toBeCloseTo(20);
    expect(a.lumpsKg).toBeCloseTo(837.9);
    expect(a.finesKg).toBeCloseTo(142.1);
    expect(a.millKg).toBe(0);
    const b = sievePlan({ charcoalKg: 1000, finesPctPerPass: [10, 5], unburntPct: 2, grindLumps: true, hammerMillKgH: mill }).result;
    expect(b.typ.millKg).toBeCloseTo(837.9);
    expect(b.typ.powderKg).toBeCloseTo(980);
    expect(b.typ.millH).toBeCloseTo(837.9 / 21);
    expect(b.min.millH).toBeCloseTo(837.9 / 157);
  });
});

describe('campuran briket DT:DR (hasil lab per lot)', () => {
  const dt = { ash_max_pct: 2.0, fc_min_pct: 80 };
  const dr = { ash_max_pct: 3.5, fc_min_pct: 74 };
  const spec = { ash_max_pct: 3, fc_min_pct: 75 };

  it('50:50 → abu 2,75%, FC 77% lolos; DT minimal 33,3% agar abu ≤3%', () => {
    const r = originBlend(dt, dr, 50, spec);
    expect(r.blended.ash_max_pct).toBeCloseTo(2.75);
    expect(r.blended.fc_min_pct).toBeCloseTo(77);
    expect(r.checks.every((c) => c.pass)).toBe(true);
    expect(r.feasible!.lo).toBeCloseTo(100 / 3);
    expect(r.feasible!.hi).toBe(100);
  });

  it('DT 20% → abu 3,2% gagal + peringatan; dua lot sama-sama di atas batas → tidak ada rasio layak', () => {
    const r = originBlend(dt, dr, 20, spec);
    expect(r.blended.ash_max_pct).toBeCloseTo(3.2);
    expect(r.warnings.map((w) => w.code)).toContain('BLEND_OUT_OF_SPEC');
    expect(feasibleDtShare({ ash_max_pct: 3.4 }, { ash_max_pct: 3.6 }, { ash_max_pct: 3 })).toBeNull();
  });

  it('100 kg serbuk, DT 40%, rendemen 28–36% → batok DT 111–143 kg (typ 125)', () => {
    const r = blendRawMaterial({ charcoalKg: 100, dtSharePct: 40, yieldPct: P('y', 'pct', { min: 28, typ: 32, max: 36 }) }).result;
    expect(r.typ.dtShellKg).toBeCloseTo(125);
    expect(r.min.dtShellKg).toBeCloseTo(4000 / 36);
    expect(r.max.dtShellKg).toBeCloseTo(4000 / 28);
    expect(r.typ.drCharcoalKg).toBeCloseTo(60);
  });
});

describe('aditif selulosa bioleather', () => {
  it('10 L × 5 g/L serat (KA 10%) + BC 20 g → komposit 70 g, serat 71,4%; NaOH 5% rasio 15 → 0,75 L, 37,5 g', () => {
    const r = celluloseAdditive({
      mediaL: 10,
      dryGPerL: 5,
      moisturePct: 10,
      bcDryG: { min: 10, typ: 20, max: 30 },
      alkali: { naohPct: P('n', 'pct', 5, 'A'), liquorRatio: P('q', 'count', 15, 'A') },
    }).result;
    expect(r.typ.additiveDryG).toBe(50);
    expect(r.typ.additiveWetG).toBeCloseTo(55.56, 1);
    expect(r.typ.compositeDryG).toBeCloseTo(70);
    expect(r.typ.additiveSharePct).toBeCloseTo(71.43, 1);
    expect(r.min.additiveSharePct).toBeLessThan(r.max.additiveSharePct);
    expect(r.typ.naohSolutionL).toBeCloseTo(0.75);
    expect(r.typ.naohG).toBeCloseTo(37.5);
  });
});
