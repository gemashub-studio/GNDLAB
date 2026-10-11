/**
 * Perakit lini produksi untuk rencana per shift (ADR-009 §7). Fungsi murni — semua laju, isi
 * angkatan, siklus, dan faktor konversi diambil dari dataset formula/proses; nilai yang belum ada
 * datanya (kapasitas press & oven briket, volume tong cuka) WAJIB diisi pengguna (tidak diberi default).
 */
import { briquetteMix, greenhouseCapacityNuts, point, unitFactor, vinegarBatch, type Param, type ShiftStation } from '@gemas/calc-engine';
import type { FormulaDatasetSI, ProcessDatasetSI } from '@gemas/dataset';

export type LineId = 'kopra' | 'arang' | 'briket' | 'cuka' | 'bioleather';

export interface LineOptions {
  /** Kopra: pengering. */
  dryer?: 'oven' | 'greenhouse';
  ovenProfileId?: string;
  /** Arang: metode & sumber rendemen. */
  kilnMethodId?: string;
  kilnYield?: 'reference' | 'kora';
  /** Briket: varian. */
  briquette?: 'shisha' | 'bbq' | 'custom';
  /** Isian pengguna per stasiun: jumlah, laju/isi override. */
  counts: Record<string, number>;
  overrides: Record<string, { rate?: number; batch?: number; cycleH?: number }>;
}

export interface LineStation extends ShiftStation {
  /** true bila stasiun butuh angka dari pengguna yang belum diisi → dikecualikan dari hitungan. */
  missing?: string;
  note?: string;
}

export interface Line {
  id: LineId;
  nameId: string;
  productUnit: string;
  stations: LineStation[];
}

const mul = (key: string, a: Param, b: Param | number): Param => {
  const bb = typeof b === 'number' ? point(b) : b;
  return { ...a, key, min: a.min * bb.min, typ: a.typ * bb.typ, max: a.max * bb.max, confidence: typeof b === 'number' ? a.confidence : a.confidence > b.confidence ? a.confidence : b.confidence };
};

const withOverride = (p: Param, v: number | undefined): Param => (v && v > 0 ? { ...p, ...point(v), source: 'override' } : p);

/** Kopra per kg daging segar = (1 − KA daging) / (1 − KA kopra). Rentang ikut KA daging (dataset proses). */
function copraPerMeat(proc: ProcessDatasetSI, targetPct: number): Param {
  const w = proc.kernelMoisture; // fraksi
  const t = 1 - targetPct / 100;
  return { ...w, key: 'kopra.copra_per_meat', unit: 'fraction', min: (1 - w.max) / t, typ: (1 - w.typ) / t, max: (1 - w.min) / t };
}

export function buildLine(id: LineId, f: FormulaDatasetSI, proc: ProcessDatasetSI, o: LineOptions): Line {
  const cnt = (sid: string, def = 1) => o.counts[sid] ?? def;
  const ov = (sid: string) => o.overrides[sid] ?? {};
  const station = (sid: string) => f.stations.find((s) => s.id === sid)!;

  if (id === 'kopra') {
    const edible = f.raw.kopra.grades.find((g) => g.id === 'edible')!;
    const perNut: Param = { ...f.kopra.copra_kg_per_1000_nuts, key: 'kopra.per_nut', unit: 'kg', min: f.kopra.copra_kg_per_1000_nuts.min / 1000, typ: f.kopra.copra_kg_per_1000_nuts.typ / 1000, max: f.kopra.copra_kg_per_1000_nuts.max / 1000 };
    const manual = (sid: string): LineStation => {
      const s = station(sid);
      return { id: sid, nameId: s.nameId, kind: 'manual', rate: withOverride(s.rate, ov(sid).rate), count: cnt(sid, 2), toProduct: perNut, unitLabel: 'butir' };
    };
    const stations: LineStation[] = [manual('belah'), manual('congkel')];
    if ((o.dryer ?? 'oven') === 'oven') {
      const prof = f.raw.kopra.oven_profiles.find((p) => p.id === (o.ovenProfileId ?? 'electric'))!;
      const batch = withOverride({ ...point(prof.batch_kg ?? 0), key: `oven.${prof.id}.batch`, unit: 'kg', confidence: 'C', sourceIds: prof.source_ids }, ov('oven').batch);
      stations.push({
        id: 'oven',
        nameId: `Oven — ${prof.name_id}`,
        kind: 'batch',
        batchSize: batch,
        cycleH: withOverride({ ...point(prof.hours), key: `oven.${prof.id}.hours`, unit: 'h', confidence: 'A', sourceIds: prof.source_ids }, ov('oven').cycleH),
        count: cnt('oven'),
        toProduct: copraPerMeat(proc, edible.moisture_max_pct),
        unitLabel: 'kg daging',
        ...(batch.typ <= 0 && { missing: 'Isi kapasitas oven (kg daging per angkatan)' }),
        note: f.raw.production.oven_load_basis,
      });
    } else {
      const cap = greenhouseCapacityNuts(f.kopra.greenhouseArea, f.kopra.greenhouseHalves);
      stations.push({
        id: 'greenhouse',
        nameId: 'Greenhouse 3×10 m',
        kind: 'batch',
        batchSize: withOverride({ ...f.kopra.greenhouseHalves, key: 'greenhouse.capacity', unit: 'count', ...cap }, ov('greenhouse').batch),
        cycleH: withOverride(f.kopra.greenhouseCycleH, ov('greenhouse').cycleH),
        count: cnt('greenhouse'),
        toProduct: perNut,
        unitLabel: 'butir',
      });
    }
    stations.push(manual('kupas_testa'));
    return { id, nameId: 'Kopra edible', productUnit: 'kg kopra', stations };
  }

  if (id === 'arang') {
    const m = f.arang.methods.find((x) => x.id === (o.kilnMethodId ?? f.arang.methods[0]!.id))!;
    const y = o.kilnYield === 'kora' ? f.arang.yield_kora_actual_pct : f.arang.yield_reference_pct;
    const cycle: Param = { ...m.burnH, key: `arang.${m.id}.cycle`, min: m.burnH.min + m.coolingH.min, typ: m.burnH.typ + m.coolingH.typ, max: m.burnH.max + m.coolingH.max, confidence: m.burnH.confidence > m.coolingH.confidence ? m.burnH.confidence : m.coolingH.confidence };
    return {
      id,
      nameId: `Arang — ${m.nameId}`,
      productUnit: 'kg arang',
      stations: [
        {
          id: 'kiln',
          nameId: m.nameId,
          kind: 'batch',
          batchSize: withOverride(m.batchShellKg, ov('kiln').batch),
          cycleH: withOverride(cycle, ov('kiln').cycleH),
          count: cnt('kiln', 2),
          toProduct: { ...y, key: 'arang.yield', unit: 'fraction', min: y.min / 100, typ: y.typ / 100, max: y.max / 100 },
          unitLabel: 'kg batok',
        },
      ],
    };
  }

  if (id === 'briket') {
    const b = f.briket;
    const v = b.variants.find((x) => x.id === (o.briquette ?? 'shisha'))!;
    const mix = briquetteMix({
      charcoalKg: 100,
      charcoalMoisturePct: b.charcoal_powder_moisture_pct.typ,
      binderPct: b.binder_pct.typ,
      binderMoisturePct: b.binder_moisture_pct.typ,
      doughMoisturePct: b.dough_moisture_pct.typ,
      finalMoisturePct: b.final_moisture_pct.typ,
      hotWaterSharePct: b.binder_hot_water_share_pct.typ,
      density: v.density,
      binderRange: b.binder_pct,
      doughMoistureRange: b.dough_moisture_pct,
    }).result.typ;
    const perCharcoal: Param = { ...b.binder_pct, key: 'briket.product_per_charcoal', unit: 'fraction', ...point(mix.productKg / mix.charcoalKg) };
    const perDough: Param = { ...b.dough_moisture_pct, key: 'briket.product_per_dough', unit: 'fraction', ...point(mix.productKg / mix.doughKg) };
    const hm = station('hammer_mill');
    const pressRate = ov('press').rate;
    const ovenBatch = ov('oven_briket').batch;
    return {
      id,
      nameId: `Briket — ${v.name_id}`,
      productUnit: 'kg briket',
      stations: [
        { id: 'hammer_mill', nameId: hm.nameId, kind: 'machine', rate: withOverride(hm.rate, ov('hammer_mill').rate), count: cnt('hammer_mill'), toProduct: perCharcoal, unitLabel: 'kg arang' },
        {
          id: 'press',
          nameId: 'Cetak / press',
          kind: 'machine',
          rate: { ...point(pressRate ?? 0), key: 'press.rate', unit: 'kg_h', confidence: 'A', sourceIds: [], source: 'override' },
          count: cnt('press'),
          toProduct: perDough,
          unitLabel: 'kg adonan',
          ...(!pressRate && { missing: 'Isi kapasitas mesin cetak (kg adonan/jam) — belum ada di SOP' }),
        },
        {
          id: 'oven_briket',
          nameId: 'Oven briket',
          kind: 'batch',
          batchSize: { ...point(ovenBatch ?? 0), key: 'oven_briket.batch', unit: 'kg', confidence: 'A', sourceIds: [], source: 'override' },
          cycleH: withOverride(b.oven_h, ov('oven_briket').cycleH),
          count: cnt('oven_briket'),
          toProduct: perDough,
          unitLabel: 'kg adonan',
          ...(!ovenBatch && { missing: 'Isi kapasitas oven briket (kg adonan per angkatan)' }),
        },
      ],
    };
  }

  if (id === 'cuka') {
    const c = f.cuka;
    const days: Param = {
      ...c.alcohol_days,
      key: 'cuka.cycle',
      unit: 'h',
      min: (c.alcohol_days.min + (c.acetify_weeks.min + c.aging_weeks.min) * 7) * 24,
      typ: (c.alcohol_days.typ + (c.acetify_weeks.typ + c.aging_weeks.typ) * 7) * 24,
      max: (c.alcohol_days.max + (c.acetify_weeks.max + c.aging_weeks.max) * 7) * 24,
    };
    const tankL = ov('tank').batch;
    const s = station('belah');
    // Rasio volume: air kelapa → must (+gula) → + starter. Dihitung engine cuka dengan nilai typ dataset.
    const ref = vinegarBatch({
      waterL: 100,
      brixStart: c.water_brix.typ,
      brixTarget: c.must_brix.typ,
      density: c.water_density_kg_l,
      naturalSugarPct: c.water_sugar_pct,
      ethanolEfficiency: c.ethanol_efficiency,
      aceticEfficiency: c.acetic_efficiency,
      yeastGPerL: c.yeast_g_l.typ,
      starterPct: c.starter_pct.typ,
      eggWhiteGPerL: 0,
      eggWhitePerEggG: c.egg_white_per_egg_g.typ,
      mustBrixRange: c.must_brix,
      aceticMinPct: c.acetic_min_pct.typ,
    }).result.typ;
    const litresVinegarPerLitreWater = ref.acetifyL / 100;
    return {
      id,
      nameId: 'Cuka air kelapa',
      productUnit: 'L cuka',
      stations: [
        {
          id: 'belah',
          nameId: `${s.nameId} (pasokan air kelapa)`,
          kind: 'manual',
          rate: withOverride(s.rate, ov('belah').rate),
          count: cnt('belah', 2),
          toProduct: mul('cuka.l_per_nut', f.kopra.water_per_nut_l, litresVinegarPerLitreWater),
          unitLabel: 'butir',
          note: 'L cuka per butir = air kelapa per butir × (cairan asetifikasi ÷ air kelapa)',
        },
        {
          id: 'tank',
          nameId: 'Tong fermentasi (statis)',
          kind: 'batch',
          batchSize: { ...point(tankL ?? 0), key: 'tank.volume', unit: 'L', confidence: 'A', sourceIds: [], source: 'override' },
          cycleH: days,
          count: cnt('tank', 4),
          toProduct: unitFactor('cuka.l_per_l'),
          unitLabel: 'L',
          ...(!tankL && { missing: 'Isi volume kerja per tong (L) — SOP: wadah 20–200 L, isi ⅔–¾' }),
        },
      ],
    };
  }

  // bioleather
  const bl = f.bioleather;
  const trayL = ov('tray').batch;
  const perL: Param = {
    ...bl.wet_yield_g_l_day,
    key: 'bioleather.dry_g_per_l',
    unit: 'g',
    min: bl.wet_yield_g_l_day.min * bl.culture_days.typ * bl.dry_fraction_of_wet.min,
    typ: bl.wet_yield_g_l_day.typ * bl.culture_days.typ * bl.dry_fraction_of_wet.typ,
    max: bl.wet_yield_g_l_day.max * bl.culture_days.typ * bl.dry_fraction_of_wet.max,
  };
  return {
    id,
    nameId: 'Bioleather',
    productUnit: 'g lembar kering',
    stations: [
      {
        id: 'tray',
        nameId: 'Baki kultur statis',
        kind: 'batch',
        batchSize: { ...point(trayL ?? 0), key: 'tray.media', unit: 'L', confidence: 'A', sourceIds: [], source: 'override' },
        cycleH: { ...bl.culture_days, key: 'bioleather.cycle', unit: 'h', min: bl.culture_days.typ * 24, typ: bl.culture_days.typ * 24, max: bl.culture_days.typ * 24 },
        count: cnt('tray', 20),
        toProduct: perL,
        unitLabel: 'L media',
        ...(!trayL && { missing: 'Isi volume media per baki (L) — panjang × lebar × kedalaman' }),
      },
    ],
  };
}
