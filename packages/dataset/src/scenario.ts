/**
 * Perakitan input engine dari dataset + pilihan pengguna (skenario). Dipakai UI (client, offline)
 * dan API (server re-calculate) — satu jalur agar angka keduanya identik (ADR-001).
 */
import {
  meters,
  kg,
  overrideParam,
  point,
  type Benchmark,
  type CalcMode,
  type ContainerInput,
  type ContainerSpec,
  type ConvertInput,
  type Param,
  type QuantityUnit,
  type Range,
  type WarehouseInput,
} from '@gemas/calc-engine';
import {
  DatasetError,
  getCommodity,
  getContainer,
  getForm,
  moistureFraction,
  type DatasetSI,
  type FormSI,
  type PackagingSI,
} from './loader.ts';

export type Overrides = Record<string, number | Range>;

/** Parameter form setelah override (override divalidasi [min·0,5, max·2] — ARD §9). */
export function resolveParams(form: FormSI, overrides: Overrides | undefined, label: string): Record<string, Param> {
  const params: Record<string, Param> = { ...form.params };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const p = params[key];
    if (!p) throw new DatasetError(`override: parameter ${key} tidak ada di ${label}`);
    params[key] = overrideParam(p, value);
  }
  return params;
}

/** Mode hitung yang didukung data form ini (BULK selalu; PIECE butuh massa unit; PACKAGE butuh dimensi kemasan). */
export function availableModes(form: FormSI): CalcMode[] {
  const modes: CalcMode[] = ['BULK'];
  if (form.unitMassKey && form.params[form.unitMassKey]) modes.push('PIECE');
  if (form.packaging.some((p) => p.dims)) modes.push('PACKAGE');
  return modes;
}

/** Kemasan yang punya dimensi terisi (bisa dipakai untuk grid). */
export const gridPackaging = (form: FormSI): PackagingSI[] => form.packaging.filter((p) => p.dims);

/** `index` selalu menunjuk `form.packaging` (sama di container, gudang, konverter). */
function packSpec(form: FormSI, index: number | undefined, label: string) {
  const pk = form.packaging[index ?? 0];
  if (!pk?.dims) throw new DatasetError(`${label} tidak punya dimensi kemasan terisi`);
  return { ...pk.dims, netKg: pk.netKg, ...(pk.pcsPerPack !== undefined && { pcs: pk.pcsPerPack }) };
}

function unitMassOf(form: FormSI, params: Record<string, Param>, label: string): Param {
  const m = form.unitMassKey ? params[form.unitMassKey] : undefined;
  if (!m) throw new DatasetError(`${label} tidak punya massa per unit`);
  return m;
}

// ---------------------------------------------------------------- container

export interface CustomContainer {
  lengthM: number;
  widthM: number;
  heightM: number;
  payloadKg: number;
}

export interface ContainerScenario {
  commodityId: string;
  formCode: string;
  /** Container dataset (20GP/40GP/40HC). Diabaikan bila `customContainer` diisi. */
  containerId?: string;
  customContainer?: CustomContainer;
  mode?: CalcMode;
  /** Indeks di `form.packaging`. */
  packagingIndex?: number;
  /** Utilisasi volume (0–1); default dari DEFAULT_VOLUME_UTIL. */
  volumeUtil?: number;
  overrides?: Overrides;
}

function resolveContainer(ds: DatasetSI, s: ContainerScenario): ContainerSpec {
  if (s.customContainer) {
    const c = s.customContainer;
    return { L: meters(c.lengthM), W: meters(c.widthM), H: meters(c.heightM), payloadKg: kg(c.payloadKg) };
  }
  if (!s.containerId) throw new DatasetError('container wajib dipilih');
  return getContainer(ds, s.containerId);
}

/** Rakit ContainerInput engine dari dataset + skenario. */
export function buildContainerInput(ds: DatasetSI, s: ContainerScenario): ContainerInput {
  const label = `${s.commodityId}.${s.formCode}`;
  const form = getForm(ds, s.commodityId, s.formCode);
  const params = resolveParams(form, s.overrides, label);
  const mode = s.mode ?? form.calcModeDefault;
  const container = resolveContainer(ds, s);
  const moisture = moistureFraction(form);
  const benchmarks: Benchmark[] = s.customContainer
    ? []
    : form.benchmarks
        .filter((b) => b.containerId === s.containerId)
        .map((b) => ({
          conservative: b.conservative,
          ...(b.pieces && { pieces: b.pieces }),
          ...(b.massKg && { massKg: b.massKg }),
        }));

  const formInput: ContainerInput['form'] = { mode, rho: params.bulk_density! };
  if (mode === 'PIECE') formInput.unitMass = unitMassOf(form, params, label);
  if (mode === 'PACKAGE') formInput.pack = packSpec(form, s.packagingIndex, label);

  const util = s.volumeUtil ?? form.volumeUtilDefault;
  if (!(util > 0 && util <= 1)) throw new DatasetError('utilisasi volume harus 0 < u ≤ 1');
  return {
    container,
    form: formInput,
    ...(util !== 1 && {
      // Default utilisasi = asumsi engineering calc_spec §3.1, tidak berlabel → C (aturan seed).
      volumeUtil: {
        key: 'volume_util',
        unit: 'fraction',
        ...point(util),
        confidence: 'C',
        sourceIds: [],
        source: s.volumeUtil === undefined ? 'dataset' : 'override',
      },
    }),
    context: { commodityCode: s.commodityId, ...(moisture && { moisture }), benchmarks },
    datasetVersion: ds.version,
  };
}

// ---------------------------------------------------------------- gudang

export type WarehouseStockInput = { massKg: number } | { pieces: number } | { packs: number };

export interface WarehouseScenario {
  commodityId: string;
  formCode: string;
  stock: WarehouseStockInput;
  /** true → hitung per tumpukan karung (Mode C gudang); false → curah. */
  usePackaging?: boolean;
  packagingIndex?: number;
  stackHeightM: number;
  floorUtil?: number;
  zone?: { lengthM: number; widthM: number };
  floorLoadKgM2?: number;
  /** Kadar air aktual stok (%), untuk peringatan self-heating. */
  moisturePct?: number;
  /** Komoditas lain di zona yang sama (peringatan kontaminasi bau). */
  coStored?: string[];
  overrides?: Overrides;
}

export function buildWarehouseInput(ds: DatasetSI, s: WarehouseScenario): WarehouseInput {
  const label = `${s.commodityId}.${s.formCode}`;
  const form = getForm(ds, s.commodityId, s.formCode);
  const params = resolveParams(form, s.overrides, label);
  const pack = s.usePackaging || 'packs' in s.stock ? packSpec(form, s.packagingIndex, label) : undefined;

  let stock: WarehouseInput['stock'];
  if ('massKg' in s.stock) stock = { massKg: s.stock.massKg };
  else if ('pieces' in s.stock) stock = { pieces: s.stock.pieces, unitMass: unitMassOf(form, params, label) };
  else {
    const n = s.stock.packs;
    if (!(Number.isInteger(n) && n >= 0)) throw new DatasetError('jumlah karung harus bilangan bulat ≥ 0');
    stock = { massKg: { min: n * pack!.netKg.min, typ: n * pack!.netKg.typ, max: n * pack!.netKg.max } };
  }

  if (s.moisturePct !== undefined && !(s.moisturePct >= 0 && s.moisturePct < 100)) {
    throw new DatasetError('kadar air harus 0–<100%');
  }
  const moisture = s.moisturePct !== undefined ? point(s.moisturePct / 100) : moistureFraction(form);
  return {
    stock,
    rho: params.bulk_density!,
    stackHeightM: meters(s.stackHeightM),
    ...(s.floorUtil !== undefined && {
      floorUtil: { key: 'floor_util', unit: 'fraction', ...point(s.floorUtil), confidence: 'C', sourceIds: [], source: 'override' },
    }),
    ...(pack && { pack }),
    ...(s.floorLoadKgM2 !== undefined && { floorLoadKgM2: s.floorLoadKgM2 }),
    ...(s.zone && { zone: { L: meters(s.zone.lengthM), W: meters(s.zone.widthM) } }),
    context: {
      commodityCode: s.commodityId,
      ...(moisture && { moisture }),
      ...(s.coStored && { coStoredCommodities: s.coStored }),
    },
    datasetVersion: ds.version,
  };
}

/**
 * Tinggi tumpuk default dari dataset `storage` (m), atau undefined bila tidak ada.
 * Untuk batas berbasis jumlah karung (kopra edible: 10 karung) dikalikan tinggi karung terisi.
 */
export function defaultStackHeightM(ds: DatasetSI, commodityId: string, formCode: string): number | undefined {
  // `storage.*` hanya punya `typ` (bukan rentang) → tidak menjadi parameter; dibaca dari blok storage (FND-014).
  const storage = getCommodity(ds, commodityId).storage ?? {};
  const typOf = (k: string): number | undefined => {
    const v = storage[k];
    return typeof v === 'object' && v !== null && typeof (v as { typ?: unknown }).typ === 'number'
      ? (v as { typ: number }).typ
      : undefined;
  };
  const metres = typOf('max_stack_height_m') ?? typOf('max_pile_height_m');
  if (metres !== undefined) return metres;
  const bags = typOf('max_stack_height_bags');
  const h = gridPackaging(getForm(ds, commodityId, formCode))[0]?.dims?.h;
  return bags !== undefined && h ? Number((bags * h).toFixed(3)) : undefined;
}

// ---------------------------------------------------------------- konverter

export interface ConvertScenario {
  commodityId: string;
  formCode: string;
  from: { unit: QuantityUnit; value: number };
  to: QuantityUnit;
  packagingIndex?: number;
  overrides?: Overrides;
}

export function buildConvertInput(ds: DatasetSI, s: ConvertScenario): ConvertInput {
  const label = `${s.commodityId}.${s.formCode}`;
  const form = getForm(ds, s.commodityId, s.formCode);
  const params = resolveParams(form, s.overrides, label);
  const pk = form.packaging[s.packagingIndex ?? 0];
  const m = form.unitMassKey ? params[form.unitMassKey] : undefined;
  return {
    from: s.from,
    to: s.to,
    params: {
      rho: params.bulk_density!,
      ...(m && { unitMass: m }),
      ...(pk && { packNetKg: pk.netKg }),
      ...(pk?.pcsPerPack !== undefined && { pcsPerPack: pk.pcsPerPack }),
    },
    context: { commodityCode: s.commodityId },
    datasetVersion: ds.version,
  };
}
