'use client';

import { correctMoisture, DEFAULT_FLOOR_UTIL, floorDiv, meters, OverrideOutOfRangeError, point, warehouseSpace, type CalcOutput, type Meters, type PackSpec, type Param, type WarehouseResult } from '@gemas/calc-engine';
import { bundledChainDataset, DatasetError, defaultStackHeightM, getForm, type DatasetSI } from '@gemas/dataset';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Dropdown } from '@/components/lab/Dropdown';
import { ScenarioActions } from '@/components/scenario/ScenarioActions';
import { ConfidenceBadge } from '@/components/ui/badges';
import { NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { WarningList } from '@/components/ui/Warnings';
import { COMMODITY_UI, formLabel } from '@/lib/catalog';
import { cm, fmt, fmtM2, fmtM3, fmtPct } from '@/lib/format';
import { DEFAULT_CARTON, GUDANG, gudangOf, selectionFor, type GudangItem } from '@/lib/gudangItems';
import { runWarehouse, type WarehouseState } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';
import { useUrlState } from '@/lib/useUrlState';

const UTIL_MIN = 0.5;
const UTIL_MAX = 0.85; // rentang slider ux_spec §3.2
const START_KG = 10_000;

/** State engine untuk barang ber-densitas dataset (curah: volume = berat ÷ densitas curah). */
export function initialWarehouseState(ds: DatasetSI, commodityId = 'kelapa_jambul', formCode = 'loose', massKg = START_KG): WarehouseState {
  const h = defaultStackHeightM(ds, commodityId, formCode);
  return { kind: 'WAREHOUSE', commodityId, formCode, stock: { massKg }, stackHeightM: h ?? 2, floorUtil: DEFAULT_FLOOR_UTIL, usePackaging: false };
}

/** Target kadar air "setara kering" = batas maks kopra edible di dataset (standar mutu ekspor). */
function dryTargetPct(ds: DatasetSI): number | undefined {
  return getForm(ds, 'kopra_edible', 'bagged').params.moisture?.max;
}

type Calc = { ok: true; out: CalcOutput<WarehouseResult> } | { ok: false; message: string };

/**
 * Halaman Gudang (DEC-128 → DEC-130): satu kartu landscape — form "Input barang masuk dan barang keluar" (pilih gudang →
 * barang/item → asal → berat total kg → volume otomatis) di kiri, luas lantai dibutuhkan di kanan.
 */
export function WarehouseCalculator({ initial }: { initial?: WarehouseState }) {
  const ds = useDataset();
  const chain = bundledChainDataset();
  const [s, setS] = useState<WarehouseState>(() => initial ?? initialWarehouseState(ds));
  // tautan bagikan lama (?s=) dengan komoditas di luar daftar → barang tambahan di gudangnya
  const [extra] = useState<{ gudang: string; item: GudangItem } | undefined>(() => {
    if (!initial) return undefined;
    const sel = selectionFor(initial.commodityId, initial.formCode, `${COMMODITY_UI[initial.commodityId]?.short ?? initial.commodityId} — ${formLabel(initial.commodityId, initial.formCode)}`);
    return gudangOf(sel.gudang).items.some((i) => i.id === sel.item.id) ? undefined : sel;
  });
  const [gudangId, setGudangId] = useState(() => (initial ? selectionFor(initial.commodityId, initial.formCode, '').gudang : 'kopra'));
  const items = [...gudangOf(gudangId).items, ...(extra && extra.gudang === gudangId ? [extra.item] : [])];
  const [itemId, setItemId] = useState(() => (initial ? (extra?.item.id ?? selectionFor(initial.commodityId, initial.formCode, '').item.id) : 'kelapa_jambul'));
  const item = items.find((i) => i.id === itemId) ?? items[0]!;
  const [asal, setAsal] = useState('');
  const [cartonId, setCartonId] = useState(DEFAULT_CARTON);
  const massKg = 'massKg' in s.stock ? s.stock.massKg : 0;

  const cartons = chain.raw.packing.briquette_cartons;
  const box = cartons.find((b) => b.id === cartonId) ?? cartons[0]!;
  const boxPack: PackSpec = useMemo(
    () => ({
      l: meters(box.dims_mm.L / 1000),
      w: meters(box.dims_mm.W / 1000),
      h: meters(box.dims_mm.H / 1000),
      netKg: { ...point(box.net_kg), key: `${box.id}.net`, unit: 'kg', confidence: 'C', sourceIds: chain.raw.packing.briquette_cartons_source_ids, source: 'dataset' } as Param,
    }),
    [box, chain],
  );

  const result: Calc | undefined = useMemo(() => {
    try {
      if (item.calc.kind === 'inv') return { ok: true, out: runWarehouse(ds, s) };
      if (item.calc.kind === 'carton') {
        return {
          ok: true,
          out: warehouseSpace({
            stock: { massKg },
            pack: boxPack,
            stackHeightM: s.stackHeightM as Meters,
            floorUtil: { key: 'floor_util', unit: 'fraction', ...point(s.floorUtil ?? DEFAULT_FLOOR_UTIL), confidence: 'C', sourceIds: [], source: 'override' },
            ...(s.floorLoadKgM2 !== undefined && { floorLoadKgM2: s.floorLoadKgM2 }),
            ...(s.zone && { zone: { L: s.zone.lengthM as Meters, W: s.zone.widthM as Meters } }),
          }),
        };
      }
      return undefined;
    } catch (e) {
      const msg = e instanceof OverrideOutOfRangeError || e instanceof DatasetError || e instanceof RangeError ? e.message : 'Gagal menghitung';
      return { ok: false, message: msg };
    }
  }, [ds, s, item, massKg, boxPack]);

  // `?s=` ↔ state (juga memulihkan tautan bagikan saat halaman disajikan dari cache offline).
  useUrlState('WAREHOUSE', s, setS, !!initial);

  const pickItem = (it: GudangItem) => {
    setItemId(it.id);
    if (it.calc.kind === 'inv') {
      const { commodityId, formCode } = it.calc;
      const h = defaultStackHeightM(ds, commodityId, formCode);
      setS((p) => ({ ...p, commodityId, formCode, usePackaging: false, stock: { massKg: 'massKg' in p.stock ? p.stock.massKg : START_KG }, ...(h !== undefined && { stackHeightM: h }) }));
    }
  };
  const pickGudang = (id: string) => {
    setGudangId(id);
    pickItem([...gudangOf(id).items, ...(extra && extra.gudang === id ? [extra.item] : [])][0]!);
  };
  const setMass = (v: number | undefined) => setS((p) => ({ ...p, stock: { massKg: Math.max(0, v ?? 0) } }));

  const r = result?.ok ? result.out.result : undefined;
  const isKopra = s.commodityId.startsWith('kopra') && item.calc.kind === 'inv';
  const dryPct = dryTargetPct(ds);
  const dry = r && isKopra && s.moisturePct !== undefined && dryPct !== undefined && s.moisturePct > dryPct ? correctMoisture(r.typ.massKg, s.moisturePct / 100, dryPct / 100) : undefined;
  const form = item.calc.kind === 'inv' ? getForm(ds, item.calc.commodityId, item.calc.formCode) : undefined;
  const rho = form?.params.bulk_density;
  const dataStackH = item.calc.kind === 'inv' ? defaultStackHeightM(ds, item.calc.commodityId, item.calc.formCode) : undefined;

  // dasar perhitungan volume (ditampilkan di bawah kolom volume)
  const volumeBasis =
    item.calc.kind === 'inv' && rho ? (
      <>
        ρ curah {fmt(rho.typ)} kg/m³ ({formLabel(item.calc.commodityId, item.calc.formCode).toLowerCase()}, rata-rata dataset) <ConfidenceBadge c={rho.confidence} />
      </>
    ) : item.calc.kind === 'carton' ? (
      <>
        {box.name_id}: {cm(boxPack.l)}×{cm(boxPack.w)}×{cm(boxPack.h)} cm per {fmt(box.net_kg)} kg <ConfidenceBadge c="C" />
      </>
    ) : item.calc.kind === 'none' ? (
      item.calc.reason
    ) : null;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">Hitung<br />Gudang</h1>
        </div>
      </header>

      {/* satu kartu landscape: form isian (kiri) + luas lantai dibutuhkan (kanan); peringatan & aksi di bawahnya */}
      <div className="card card-data flex flex-col gap-6 lg:flex-row lg:items-start" data-testid="warehouse-card">
        <section aria-labelledby="wh-form-h" className="flex min-w-0 flex-col gap-4 lg:flex-[1.2_1_0%]">
          <h2 id="wh-form-h" className="text-xl" data-testid="wh-form-title">Input barang masuk dan barang keluar</h2>
          <Dropdown label="Pilih Gudang" required testId="wh-gudang" value={gudangId} onChange={pickGudang} options={GUDANG.map((g) => ({ value: g.id, label: g.label }))} />
          <Dropdown label="Barang / Item" required testId="wh-item" value={item.id} onChange={(v) => pickItem(items.find((i) => i.id === v)!)} options={items.map((i) => ({ value: i.id, label: i.label }))} />
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Asal Barang / Item</span>
            <input className="field" value={asal} onChange={(e) => setAsal(e.target.value)} placeholder="mis. petani Desa …, pemasok, gudang lain" maxLength={120} data-testid="wh-asal" />
          </label>
          <NumberField label="Berat total barang / item" unit="kg" value={massKg} onValue={setMass} min={0} testId="wh-stock" />
          <div className="flex flex-col gap-1.5" data-testid="wh-volume-box">
            <span className="label-mono">Volume (otomatis)</span>
            <output className="field flex items-center bg-paper font-mono font-semibold" data-testid="wh-volume" aria-live="polite">
              {r ? fmtM3(r.typ.volumeM3) : '—'}
            </output>
            <span className="text-[12px] text-muted" data-testid="wh-volume-basis">{volumeBasis}</span>
          </div>

          <details className="border-2 border-dashed border-ink p-3">
            <summary className="cursor-pointer font-mono text-xs font-bold uppercase">Pengaturan tumpuk, lantai & zona (opsional)</summary>
            <div className="mt-3 flex flex-col gap-3">
              {item.calc.kind === 'carton' && (
                <Dropdown
                  label="Kemasan acuan (dataset rantai)"
                  testId="wh-carton"
                  value={cartonId}
                  onChange={setCartonId}
                  options={cartons.map((b) => ({ value: b.id, label: b.name_id, note: `${fmt(b.net_kg)} kg · ${b.dims_mm.L}×${b.dims_mm.W}×${b.dims_mm.H} mm` }))}
                />
              )}
              <NumberField
                label={<>Tinggi tumpuk <Hint k="stackHeight" /></>}
                unit="m"
                min={0.1}
                max={30}
                value={s.stackHeightM}
                onValue={(v) => v !== undefined && setS((p) => ({ ...p, stackHeightM: v }))}
                hint={dataStackH !== undefined ? `Saran dataset: maks ${fmt(dataStackH, 2)} m` : 'Dataset belum punya batas tinggi untuk barang ini — isi sesuai SOP gudang.'}
                testId="wh-height"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="wh-util" className="label-mono flex items-center gap-2">
                  Utilisasi lantai: {fmt(s.floorUtil ?? DEFAULT_FLOOR_UTIL, 2)} <Hint k="floorUtil" />
                </label>
                <input id="wh-util" type="range" min={UTIL_MIN} max={UTIL_MAX} step={0.01} value={s.floorUtil ?? DEFAULT_FLOOR_UTIL} onChange={(e) => setS((p) => ({ ...p, floorUtil: Number(e.target.value) }))} className="h-11 w-full cursor-pointer accent-ink" />
                <span className="flex justify-between font-mono text-[11px]"><span>{fmt(UTIL_MIN, 2)} banyak lorong</span><span>{fmt(UTIL_MAX, 2)} padat</span></span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Panjang zona" unit="m" min={0.1} value={s.zone?.lengthM}
                  onValue={(v) => setS((p) => (v && p.zone?.widthM ? { ...p, zone: { lengthM: v, widthM: p.zone.widthM } } : v ? { ...p, zone: { lengthM: v, widthM: p.zone?.widthM ?? v } } : { ...p, zone: undefined }))} />
                <NumberField label="Lebar zona" unit="m" min={0.1} value={s.zone?.widthM}
                  onValue={(v) => setS((p) => (v ? { ...p, zone: { lengthM: p.zone?.lengthM ?? v, widthM: v } } : { ...p, zone: undefined }))} />
                <NumberField label="Kapasitas lantai" unit="kg/m²" min={1} value={s.floorLoadKgM2}
                  onValue={(v) => setS((p) => ({ ...p, floorLoadKgM2: v }))} hint="Dari spesifikasi bangunan" />
              </div>
            </div>
          </details>
        </section>

        <section aria-label="Hasil gudang" aria-live="polite" className="flex min-w-0 flex-col gap-3 border-t-2 border-dashed border-ink pt-5 lg:sticky lg:top-24 lg:flex-[1_1_0%] lg:border-l-2 lg:border-t-0 lg:pl-6 lg:pt-0" data-testid="warehouse-result">
          {r && result?.ok ? (
            <div className="flex flex-col gap-2.5">
              <span className="label-mono">LUAS LANTAI DIBUTUHKAN</span>
              <span className="text-[12px] font-semibold" data-testid="wh-result-item">
                {gudangOf(gudangId).label} · {item.label}{asal.trim() ? ` · asal ${asal.trim()}` : ''}
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-[38px] leading-none" data-testid="floor-area">{fmt(r.typ.floorAreaM2, 2)}</span>
                <span className="font-mono text-sm font-bold">M²</span>
                <span className="ml-auto"><ConfidenceBadge c={result.out.confidence} withText /></span>
              </div>
              <span className="font-mono text-[11px]">
                Rentang {fmtM2(r.min.floorAreaM2)} – {fmtM2(r.max.floorAreaM2)} · termasuk lorong (utilisasi {fmt(s.floorUtil ?? DEFAULT_FLOOR_UTIL, 2)})
              </span>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <Tile label="Berat" value={`${fmt(r.typ.massKg)} kg`} />
                <Tile label="Volume" value={fmtM3(r.typ.volumeM3)} />
                <Tile label="Tapak tumpukan" value={fmtM2(r.typ.footprintM2)} />
                <Tile label="Beban lantai" value={`${fmt(r.typ.floorLoadKgM2)} kg/m²`} />
                {r.typ.stacks !== undefined && r.typ.stacks > 0 && (
                  <Tile label="Tumpukan" value={`${fmt(r.typ.stacks)} tumpuk · maks ${fmt(floorDiv(s.stackHeightM, item.calc.kind === 'carton' ? boxPack.h : s.stackHeightM))} box/tumpuk`} />
                )}
                {r.typ.packs !== undefined && <Tile label={item.calc.kind === 'carton' ? 'Jumlah master box' : 'Jumlah karung'} value={`${fmt(r.typ.packs)} ${item.calc.kind === 'carton' ? 'box' : 'krg'}`} />}
                {r.typ.zoneUsedFraction !== undefined && <Tile label="Zona terpakai" value={fmtPct(r.typ.zoneUsedFraction)} danger={r.typ.zoneUsedFraction > 1} />}
                {dry !== undefined && <Tile wide accent label={`Berat setara kering ${fmt(dryPct!)}%`} value={`${fmt(dry)} kg`} />}
              </div>
              <span className="font-mono text-[10px] text-muted">tumpuk {fmt(s.stackHeightM, 2)} m · util lantai {fmt(s.floorUtil ?? DEFAULT_FLOOR_UTIL, 2)}</span>
            </div>
          ) : (
            <div role="alert" data-testid="wh-no-result">
              <span className="label-mono">LUAS LANTAI DIBUTUHKAN</span>
              <h3 className="mt-2 text-lg">Belum bisa dihitung</h3>
              <p className="mt-1 text-sm">{result && !result.ok ? result.message : item.calc.kind === 'none' ? item.calc.reason : 'Isi berat total barang.'}</p>
            </div>
          )}
        </section>
      </div>
      {r && result?.ok && (
        <div className="flex flex-col gap-6">
          <WarningList warnings={result.out.warnings} />
          {item.calc.kind === 'inv' && <ScenarioActions state={s} />}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, wide, accent, danger }: { label: string; value: string; wide?: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 border-2 border-ink px-2 py-1.5 ${wide ? 'col-span-2' : ''} ${accent ? 'bg-acid' : danger ? 'bg-safety' : 'bg-surface'}`}>
      <span className="uppercase">{label}</span>
      <span className="text-[13px] font-bold">{value}</span>
    </div>
  );
}
