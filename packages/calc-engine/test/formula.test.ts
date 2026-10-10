import { describe, expect, it } from 'vitest';
import {
  bioleatherBatch,
  brixAfterAdding,
  briquetteMix,
  charcoalPlan,
  charcoalYieldStatus,
  checkSpec,
  copraFromNuts,
  dryingCheck,
  fixedCarbonPct,
  fractionShares,
  gradeForMoisture,
  greenhouseCapacityNuts,
  legacySugarKg,
  param,
  pieceVolumeCm3,
  shiftPlan,
  splitDelayCheck,
  sugarToBrixKg,
  sulfurDose,
  titrationAcidity,
  trayMediaL,
  trialDesign,
  unitFactor,
  vinegarBatch,
  type BriquetteInput,
  type Unit,
} from '../src/index.ts';

const P = (key: string, unit: Unit, v: number | { min: number; typ: number; max: number }, c: 'A' | 'B' | 'C' = 'B') => param(key, unit, v, c);

describe('cuka — gula must (FND-021)', () => {
  it('neraca massa: 100 L, ρ 1,02, 4 → 15 °Brix = 102·11/85 kg', () => {
    expect(sugarToBrixKg(102, 4, 15)).toBeCloseTo((102 * 11) / 85, 9);
    expect(brixAfterAdding(102, 4, sugarToBrixKg(102, 4, 15))).toBeCloseTo(15, 9);
  });
  it('rumus lama SOP kurang ±16,7% dan hanya mencapai 13,35 °Brix', () => {
    const legacy = legacySugarKg(100, 4, 15);
    expect(legacy).toBe(11);
    expect(brixAfterAdding(102, 4, legacy)).toBeCloseTo(13.35, 2);
    expect(1 - legacy / sugarToBrixKg(102, 4, 15)).toBeCloseTo(0.1667, 3);
  });
  it('contoh SOP Ronde 1: 1,5 L 4,5 → 15 °Brix: SOP ±158 g; benar ±189 g', () => {
    expect(legacySugarKg(1.5, 4.5, 15) * 1000).toBeCloseTo(157.5, 6);
    expect(sugarToBrixKg(1.5 * 1.02, 4.5, 15) * 1000).toBeCloseTo(189.0, 0);
  });
  it('target ≤ awal → 0 gula', () => expect(sugarToBrixKg(10, 15, 14)).toBe(0));
});

describe('cuka — titrasi (FND-022)', () => {
  it('0,1 N & 10 mL: 70 mL → 4,2035% (contoh SOP); rumus ringkas sah', () => {
    const r = titrationAcidity({ naohMl: 70, normality: 0.1, sampleMl: 10 });
    expect(r.acidityPct).toBeCloseTo(4.2035, 4);
    expect(r.shortcutPct).toBeCloseTo(4.2035, 4);
    expect(r.shortcutInvalid).toBe(false);
  });
  it('NaOH 0,5 N & pipet 5 mL (daftar belanja): 14 mL → 8,407%; rumus ringkas meleset 10×', () => {
    const r = titrationAcidity({ naohMl: 14, normality: 0.5, sampleMl: 5 });
    expect(r.acidityPct).toBeCloseTo(8.407, 3);
    expect(r.shortcutPct).toBeCloseTo(0.8407, 4);
    expect(r.shortcutInvalid).toBe(true);
  });
});

describe('cuka — batch', () => {
  const base = {
    waterL: 100,
    brixStart: 4,
    brixTarget: 15,
    density: P('rho', 'kg_L', 1.02),
    naturalSugarPct: P('sug', 'pct', 2),
    ethanolEfficiency: P('effE', 'fraction', 0.9),
    aceticEfficiency: P('effA', 'fraction', 0.75),
    yeastGPerL: 2,
    starterPct: 20,
    eggWhiteGPerL: 8,
    eggWhitePerEggG: 30,
    mustBrixRange: { min: 14, typ: 15, max: 17 },
    aceticMinPct: 4,
  };
  it('BOM & potensi dihitung tangan', () => {
    const t = vinegarBatch(base).result.typ;
    const sugar = (102 * 11) / 85;
    expect(t.sugarKg).toBeCloseTo(sugar, 9);
    expect(t.mustL).toBeCloseTo(100 + sugar * 0.63, 9);
    expect(t.yeastG).toBeCloseTo(2 * t.mustL, 9);
    expect(t.starterL).toBeCloseTo(0.2 * t.mustL, 9);
    const ethanolG = (sugar * 1000 * (360 / 342) * 0.511 + 102 * 1000 * 0.02 * 0.511) * 0.9;
    expect(t.ethanolPctV).toBeCloseTo((ethanolG / 789 / t.mustL) * 100, 9);
    expect(t.aceticPotentialPct).toBeCloseTo((ethanolG * (60.05 / 46.07) * 0.75) / (t.mustL * 1.2) / 10, 9);
    expect(t.eggs).toBe(Math.ceil((8 * t.acetifyL) / 30));
  });
  it('peringatan Brix di luar 14–17 & potensi asam rendah', () => {
    const out = vinegarBatch({ ...base, brixTarget: 8, aceticEfficiency: P('effA', 'fraction', 0.3) });
    const codes = out.warnings.map((w) => w.code);
    expect(codes).toContain('MUST_BRIX_OUT_OF_RANGE');
    expect(codes).toContain('ACETIC_POTENTIAL_LOW');
  });
  it('rentang efisiensi → min < typ < max', () => {
    const r = vinegarBatch({ ...base, ethanolEfficiency: P('effE', 'fraction', { min: 0.8, typ: 0.88, max: 0.95 }, 'C') });
    expect(r.result.min.ethanolPctV).toBeLessThan(r.result.typ.ethanolPctV);
    expect(r.result.max.ethanolPctV).toBeGreaterThan(r.result.typ.ethanolPctV);
    expect(r.confidence).toBe('C');
  });
});

describe('bioleather', () => {
  it('baki 4 × 30×40 cm, kedalaman 3 cm → 14,4 L', () => expect(trayMediaL({ count: 4, lengthCm: 30, widthCm: 40, depthCm: 3 })).toBeCloseTo(14.4, 9));
  it('media 2 L (Tracker: 4 × 0,5 L) → sukrosa 200 g, ZA 10 g, starter 200 mL', () => {
    const t = bioleatherBatch({
      mediaL: 2,
      sucroseGPerL: 100,
      zaGPerL: 5,
      starterPct: 10,
      cultureDays: P('d', 'd', 14),
      wetYieldGPerLDay: P('y', 'g_L_d', 12.4),
      dryFraction: P('f', 'fraction', 0.013),
      naohM: 0.1,
      naohSolutionL: 2,
      glycerolPct: 1,
      plastSolutionL: 2,
    }).result.typ;
    expect(t.sucroseG).toBe(200);
    expect(t.zaG).toBe(10);
    expect(t.starterMl).toBe(200);
    expect(t.naohG).toBeCloseTo(8, 9); // Tracker: 0,1 M × 40 × 2 L
    expect(t.glycerolMl).toBeCloseTo(20, 9); // Tracker: 1% × 2 L
    expect(t.wetSheetG).toBeCloseTo(12.4 * 2 * 14, 9);
    expect(t.drySheetG).toBeCloseTo(12.4 * 2 * 14 * 0.013, 9);
  });
  it('NaOH > 0,1 M → peringatan', () => {
    const out = bioleatherBatch({
      mediaL: 1, sucroseGPerL: 100, zaGPerL: 5, starterPct: 10,
      cultureDays: P('d', 'd', 7), wetYieldGPerLDay: P('y', 'g_L_d', 12.4), dryFraction: P('f', 'fraction', 0.013),
      naohM: 0.5, naohSolutionL: 1, glycerolPct: 1, plastSolutionL: 1,
    });
    expect(out.warnings.map((w) => w.code)).toContain('NAOH_TOO_STRONG');
  });
});

describe('briket — neraca adonan (E5)', () => {
  const base: BriquetteInput = {
    charcoalKg: 100,
    charcoalMoisturePct: 6,
    binderPct: 5,
    binderMoisturePct: 13,
    doughMoisturePct: 25,
    finalMoisturePct: 6,
    hotWaterSharePct: 70,
    piece: { kind: 'cube', sideMm: 25 },
    density: P('rho', 'g_cm3', { min: 0.9, typ: 1.0, max: 1.1 }, 'C'),
    binderRange: { min: 4, typ: 6, max: 8 },
    doughMoistureRange: { min: 22, typ: 25, max: 28 },
    specMoistureMaxPct: 8,
  };
  it('100 kg arang KA 6% + tapioka 5% → air ±26,1 kg, briket ±104,6 kg', () => {
    const t = briquetteMix(base).result.typ;
    const dry = 100 * 0.94 + 5 * 0.87;
    expect(t.binderKg).toBe(5);
    expect(t.doughKg).toBeCloseTo(dry / 0.75, 9);
    expect(t.waterKg).toBeCloseTo(dry / 0.75 - 105, 9);
    expect(t.hotWaterKg).toBeCloseTo(t.waterKg * 0.7, 9);
    expect(t.productKg).toBeCloseTo(dry / 0.94, 9);
    expect(t.pieceG).toBeCloseTo(15.625, 9);
    expect(t.pieces).toBe(Math.floor((t.productKg * 1000) / 15.625));
  });
  it('kubus 25 mm ρ 0,9–1,1 → 14,06–17,19 g (58–71 butir/kg) (E6)', () => {
    const r = briquetteMix(base).result;
    expect(r.min.pieceG).toBeCloseTo(14.0625, 6);
    expect(r.max.pieceG).toBeCloseTo(17.1875, 6);
    expect(r.max.piecesPerKg).toBeCloseTo(1000 / 14.0625, 6);
  });
  it('hitung mundur: target produk → arang yang dibutuhkan konsisten', () => {
    const fwd = briquetteMix(base).result.typ;
    const back = briquetteMix({ ...base, charcoalKg: undefined, targetProductKg: fwd.productKg }).result.typ;
    expect(back.charcoalKg).toBeCloseTo(100, 9);
  });
  it('peringatan: perekat > 8%, adonan di luar 22–28%, KA akhir > spesifikasi, bahan terlalu basah', () => {
    const codes = briquetteMix({ ...base, binderPct: 12, doughMoisturePct: 5, finalMoisturePct: 10 }).warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['BINDER_ABOVE_RANGE', 'DOUGH_MOISTURE_OUT_OF_RANGE', 'DOUGH_TOO_WET', 'FINAL_MOISTURE_ABOVE_SPEC']));
  });
  it('bentuk balok & massa terukur', () => {
    expect(pieceVolumeCm3({ kind: 'box', lengthMm: 100, widthMm: 50, heightMm: 30 })).toBeCloseTo(150, 9);
    const t = briquetteMix({ ...base, piece: { kind: 'mass', grams: 40 } });
    expect(t.result.typ.pieceG).toBe(40);
    expect(t.trace.params.rho).toBeUndefined();
  });
  it('FC proksimat & cek spesifikasi', () => {
    expect(fixedCarbonPct(5, 2, 13)).toBe(80);
    const c = checkSpec({ moisture_max_pct: 8, fc_min_pct: 75, burn_min_min: 60, ignition_max_min: 10 }, { moisture_max_pct: 9, fc_min_pct: 80, burn_min_min: 55, ignition_max_min: 8 });
    expect(Object.fromEntries(c.map((x) => [x.key, x.pass]))).toEqual({ moisture_max_pct: false, fc_min_pct: true, burn_min_min: false, ignition_max_min: true });
  });
});

describe('kopra — R&D', () => {
  it('daging KA 50% → kopra 6%: rendemen 0,532 (E3); 30 butir × 0,3 kg', () => {
    const t = copraFromNuts({ nuts: 30, meatPerNutKg: P('m', 'kg', 0.3), meatMoisturePct: P('w', 'pct', 50), targetMoisturePct: 6, waterPerNutL: P('a', 'L', 0.17) }).result.typ;
    expect(t.meatKg).toBeCloseTo(9, 9);
    expect(t.copraPerMeat).toBeCloseTo(0.5 / 0.94, 9);
    expect(t.copraKg).toBeCloseTo(9 * (0.5 / 0.94), 9);
    expect(t.waterL).toBeCloseTo(5.1, 9); // Tracker: 30 × 0,17
  });
  const grades = [
    { id: 'asalan', nameId: 'Asalan', moistureMaxPct: 13.9 },
    { id: 'edible', nameId: 'Edible', moistureMaxPct: 6 },
    { id: 'reguler', nameId: 'Reguler', moistureMaxPct: 8 },
  ];
  it('grade dari KA (ICC)', () => {
    expect(gradeForMoisture(5.5, grades, 4.5)).toEqual({ kind: 'grade', id: 'edible', nameId: 'Edible' });
    expect(gradeForMoisture(6.0, grades, 4.5)).toMatchObject({ id: 'edible' });
    expect(gradeForMoisture(6.1, grades, 4.5)).toMatchObject({ id: 'reguler' });
    expect(gradeForMoisture(13.9, grades, 4.5)).toMatchObject({ id: 'asalan' });
    expect(gradeForMoisture(14, grades, 4.5)).toEqual({ kind: 're_dry' });
    expect(gradeForMoisture(4, grades, 4.5)).toMatchObject({ kind: 'too_dry', id: 'edible' });
  });
  it('alarm KA 24/48 jam & aturan 4 jam', () => {
    expect(dryingCheck({ hours: 12, moisturePct: 50, alarm24MaxPct: 35, alarm48MaxPct: 20 }).onTrack).toBe(true);
    expect(dryingCheck({ hours: 24, moisturePct: 36, alarm24MaxPct: 35, alarm48MaxPct: 20 }).warnings[0]?.code).toBe('DRYING_BEHIND_SCHEDULE');
    expect(dryingCheck({ hours: 48, moisturePct: 20, alarm24MaxPct: 35, alarm48MaxPct: 20 }).onTrack).toBe(true);
    expect(splitDelayCheck(4.5, 4).warnings[0]?.code).toBe('SPLIT_DELAY_EXCEEDED');
  });
  it('belerang 2.000 butir: 3–4 kg penuh; 2 malam = 150%; ≥3 malam wajib uji SO₂', () => {
    const r = sulfurDose({
      nuts: 2000, roomM3: 105,
      gPerNut: P('gn', 'g', { min: 1.5, typ: 1.75, max: 2 }, 'C'), gPerM3: P('gm', 'g_m3', { min: 20, typ: 25, max: 30 }, 'C'),
      nightSchedulePct: [100, 50, 25, 25], nights: 2, maxNights: 4, labTestFromNight: 3,
    });
    expect(r.result.min.fullDoseByNutsG).toBe(3000);
    expect(r.result.max.fullDoseByNutsG).toBe(4000);
    expect(r.result.typ.fullDoseByRoomG).toBe(2625);
    expect(r.result.typ.totalByNutsG).toBeCloseTo(3500 * 1.5, 9);
    expect(r.perNightPct).toEqual([100, 50]);
    expect(r.warnings.map((w) => w.code)).not.toContain('SO2_TEST_REQUIRED');
    const five = sulfurDose({ ...{ nuts: 2000, roomM3: 105, gPerNut: P('gn', 'g', 1.75), gPerM3: P('gm', 'g_m3', 25), nightSchedulePct: [100, 50, 25, 25], maxNights: 4, labTestFromNight: 3 }, nights: 5 });
    expect(five.perNightPct).toEqual([100, 50, 25, 25, 25]);
    expect(five.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['SULFUR_NIGHTS_EXCEEDED', 'SO2_TEST_REQUIRED']));
  });
  it('kapasitas greenhouse 117 m² × 25–30 belahan/m² → 1.462–1.755 butir (E7)', () => {
    const c = greenhouseCapacityNuts(P('a', 'count', 117), P('h', 'count', { min: 25, typ: 28, max: 30 }));
    expect(c).toEqual({ min: 1462, typ: 1638, max: 1755 });
  });
  it('desain Tracker Ronde 1: 20 kg / 0,65 → 30 butir; 4×3×2 = 24; cadangan 6 → ok', () => {
    expect(trialDesign({ treatments: 4, replicates: 3, nutsPerReplicate: 2, availableKg: 20, kgPerNut: 0.65, reserveMin: 5 })).toEqual({ nutsAvailable: 30, nutsNeeded: 24, reserve: 6, status: 'ok' });
    // Rencana 40 kg mengklaim "±60 butir + 5 cadangan", padahal 40/0,65 = 61 butir & perlakuan butuh 60 → cadangan 1 (E8).
    expect(trialDesign({ treatments: 4, replicates: 3, nutsPerReplicate: 5, availableKg: 40, kgPerNut: 0.65, reserveMin: 5 })).toMatchObject({ nutsAvailable: 61, reserve: 1, status: 'reserve_thin' });
    expect(trialDesign({ treatments: 4, replicates: 3, nutsPerReplicate: 3, availableKg: 20, kgPerNut: 0.65, reserveMin: 5 }).status).toBe('short');
  });
});

describe('arang', () => {
  const base = {
    yieldPct: P('y', 'pct', 32),
    batchShellKg: P('b', 'kg', 80, 'C'),
    burnH: P('burn', 'h', 6),
    coolingH: P('cool', 'h', 10),
    kilns: 2,
    referenceYieldMinPct: 28,
  };
  it('1.000 kg batok × 32% = 320 kg; 13 angkatan / 2 tungku = 7 siklus × 16 jam', () => {
    const t = charcoalPlan({ ...base, shellKg: 1000 }).result.typ;
    expect(t.charcoalKg).toBeCloseTo(320, 9);
    expect(t.batches).toBe(13);
    expect(t.cycleH).toBe(16);
    expect(t.totalH).toBe(7 * 16);
  });
  it('hitung mundur: 300 kg arang @20% (KORA aktual) → 1.500 kg batok + peringatan rendemen', () => {
    const out = charcoalPlan({ ...base, yieldPct: P('y', 'pct', 20, 'C'), targetCharcoalKg: 300 });
    expect(out.result.typ.shellKg).toBeCloseTo(1500, 9);
    expect(out.warnings.map((w) => w.code)).toContain('YIELD_BELOW_REFERENCE');
  });
  it('pendinginan < 8 jam → peringatan (K-01); pirolisis menghasilkan asap cair', () => {
    const out = charcoalPlan({ ...base, coolingH: P('cool', 'h', 1), shellKg: 100, liquidSmokeLPerKg: P('s', 'L', 0.275, 'C') });
    expect(out.warnings.map((w) => w.code)).toContain('COOLING_TOO_SHORT');
    expect(out.result.typ.liquidSmokeL).toBeCloseTo(27.5, 9);
  });
  it('status rendemen terukur & fraksi', () => {
    const s = charcoalYieldStatus({ shellInKg: 500, charcoalOutKg: 130, rawKg: 5 }, { min: 28, max: 36 }, 25, 28);
    expect(s).toEqual({ yieldPct: 26, rawPct: (5 / 130) * 100, vsReference: 'below', meetsTarget3m: true, meetsTarget6m: false });
    const f = fractionShares({ granule: 20, mesh2: 30, powder: 50 });
    expect(f.totalKg).toBe(100);
    expect(f.pct.powder).toBe(50);
  });
});

describe('produksi per shift', () => {
  it('pembatas = stasiun terkecil; kebutuhan orang untuk target', () => {
    const plan = shiftPlan({
      shiftHours: 8,
      efficiency: 0.85,
      shiftsPerDay: 1,
      targetProduct: 300,
      stations: [
        { id: 'belah', nameId: 'Belah', kind: 'manual', rate: P('r1', 'count_h', 50, 'C'), count: 2, toProduct: P('k', 'kg', 0.2), unitLabel: 'butir' },
        { id: 'oven', nameId: 'Oven', kind: 'batch', batchSize: P('b', 'kg', 280), cycleH: P('c', 'h', 13), count: 1, toProduct: unitFactor('kg'), unitLabel: 'kg' },
      ],
    });
    // belah: 50 × 2 × 6,8 × 0,2 = 136 kg; oven: 280 × 24/13 = 516,9 kg
    expect(plan.stations[0]!.capacity.typ).toBeCloseTo(136, 9);
    expect(plan.stations[1]!.capacity.typ).toBeCloseTo((280 * 24) / 13, 9);
    expect(plan.bottleneckId).toBe('belah');
    expect(plan.output.typ).toBeCloseTo(136, 9);
    expect(plan.stations[0]!.neededCount).toBe(Math.ceil(300 / (50 * 6.8 * 0.2)));
    expect(plan.stations[1]!.utilization).toBeCloseTo(136 / ((280 * 24) / 13), 9);
  });
  it('validasi input', () => {
    expect(() => shiftPlan({ shiftHours: 10, efficiency: 1, shiftsPerDay: 3, stations: [] })).toThrow();
    expect(() => shiftPlan({ shiftHours: 10, efficiency: 1, shiftsPerDay: 3, stations: [{ id: 'x', nameId: 'x', kind: 'manual', rate: P('r', 'count_h', 1), count: 1, toProduct: unitFactor('u'), unitLabel: 'u' }] })).toThrow(/24/);
  });
});
