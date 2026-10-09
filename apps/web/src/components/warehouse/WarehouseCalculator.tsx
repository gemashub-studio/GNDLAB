'use client';

import { correctMoisture, DEFAULT_FLOOR_UTIL, floorDiv, OverrideOutOfRangeError } from '@gemas/calc-engine';
import { DatasetError, defaultStackHeightM, getCommodity, getForm, gridPackaging, type DatasetSI } from '@gemas/dataset';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ScenarioActions } from '@/components/scenario/ScenarioActions';
import { ConfidenceBadge } from '@/components/ui/badges';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { WarningList } from '@/components/ui/Warnings';
import { COMMODITY_UI, FORM_UI, formLabel } from '@/lib/catalog';
import { defaultFormCode } from '@/lib/defaults';
import { cm, fmt, fmtM2, fmtM3, fmtPct } from '@/lib/format';
import { runWarehouse, type WarehouseState } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';
import { useUrlState } from '@/lib/useUrlState';

type StockUnit = 'kg' | 't' | 'pcs' | 'packs';
const UTIL_MIN = 0.5;
const UTIL_MAX = 0.85; // rentang slider ux_spec §3.2

export function initialWarehouseState(ds: DatasetSI, commodityId = 'kopra_asalan'): WarehouseState {
  const formCode = defaultFormCode(ds, commodityId);
  const h = defaultStackHeightM(ds, commodityId, formCode);
  const form = getForm(ds, commodityId, formCode);
  const moisture = form.params.moisture?.typ;
  return {
    kind: 'WAREHOUSE',
    commodityId,
    formCode,
    stock: { massKg: 10_000 },
    stackHeightM: h ?? 2,
    floorUtil: DEFAULT_FLOOR_UTIL,
    usePackaging: gridPackaging(form).length > 0,
    ...(moisture !== undefined && { moisturePct: moisture }),
  };
}

/** Target kadar air "setara kering" = batas maks kopra edible di dataset (standar mutu ekspor). */
function dryTargetPct(ds: DatasetSI): number | undefined {
  return getForm(ds, 'kopra_edible', defaultFormCode(ds, 'kopra_edible')).params.moisture?.max;
}

export function WarehouseCalculator({ initial }: { initial?: WarehouseState }) {
  const ds = useDataset();
  const [s, setS] = useState<WarehouseState>(() => initial ?? initialWarehouseState(ds));
  const [stockUnit, setStockUnit] = useState<StockUnit>(() =>
    'pieces' in s.stock ? 'pcs' : 'packs' in s.stock ? 'packs' : s.stock.massKg >= 1000 ? 't' : 'kg',
  );
  // Satuan field harus mengikuti jenis stok, termasuk saat state dipulihkan dari tautan (?s=) di client.
  useEffect(() => {
    if ('pieces' in s.stock && stockUnit !== 'pcs') setStockUnit('pcs');
    else if ('packs' in s.stock && stockUnit !== 'packs') setStockUnit('packs');
    else if ('massKg' in s.stock && (stockUnit === 'pcs' || stockUnit === 'packs')) setStockUnit('t');
  }, [s.stock, stockUnit]);
  const commodity = getCommodity(ds, s.commodityId);
  const form = getForm(ds, s.commodityId, s.formCode);
  const packs = gridPackaging(form);
  const pack = packs[0];
  const hasPieces = !!(form.unitMassKey && form.params[form.unitMassKey]);
  const isKopra = s.commodityId.startsWith('kopra');
  const dryPct = dryTargetPct(ds);
  const dataStackH = defaultStackHeightM(ds, s.commodityId, s.formCode);

  const result = useMemo(() => {
    try {
      return { ok: true as const, out: runWarehouse(ds, s) };
    } catch (e) {
      const msg = e instanceof OverrideOutOfRangeError || e instanceof DatasetError || e instanceof RangeError ? e.message : 'Gagal menghitung';
      return { ok: false as const, message: msg };
    }
  }, [ds, s]);

  // `?s=` ↔ state (juga memulihkan tautan bagikan saat halaman disajikan dari cache offline).
  useUrlState('WAREHOUSE', s, setS, !!initial);

  const pick = (commodityId: string) => {
    const next = initialWarehouseState(ds, commodityId);
    setS((p) => ({ ...next, stock: 'massKg' in p.stock ? p.stock : next.stock, floorUtil: p.floorUtil, zone: p.zone, floorLoadKgM2: p.floorLoadKgM2 }));
    if (stockUnit === 'pcs' || stockUnit === 'packs') setStockUnit('t');
  };
  const pickForm = (formCode: string) => {
    const f = getForm(ds, s.commodityId, formCode);
    const h = defaultStackHeightM(ds, s.commodityId, formCode);
    setS((p) => ({ ...p, formCode, usePackaging: gridPackaging(f).length > 0 && p.usePackaging, ...(h !== undefined && { stackHeightM: h }) }));
  };

  const stockValue =
    'massKg' in s.stock ? (stockUnit === 't' ? s.stock.massKg / 1000 : s.stock.massKg) : 'pieces' in s.stock ? s.stock.pieces : s.stock.packs;
  const setStock = (v: number | undefined, unit = stockUnit) => {
    const n = v ?? 0;
    setS((p) => ({
      ...p,
      stock: unit === 'pcs' ? { pieces: Math.round(n) } : unit === 'packs' ? { packs: Math.round(n) } : { massKg: unit === 't' ? n * 1000 : n },
      ...(unit === 'packs' && { usePackaging: true }),
    }));
  };
  const changeUnit = (u: StockUnit) => {
    // Konversi nilai lama seadanya agar field tidak kosong; pcs/packs mulai dari 0.
    const kgNow = 'massKg' in s.stock ? s.stock.massKg : 0;
    setStockUnit(u);
    if (u === 'kg') setStock(kgNow, 'kg');
    else if (u === 't') setStock(kgNow / 1000, 't');
    else setStock(0, u);
  };

  const r = result.ok ? result.out.result : undefined;
  const dry = r && isKopra && s.moisturePct !== undefined && dryPct !== undefined && s.moisturePct > dryPct
    ? correctMoisture(r.typ.massKg, s.moisturePct / 100, dryPct / 100)
    : undefined;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">Hitung<br />Gudang</h1>
        </div>
        <span className="tag-mono -rotate-[1.5deg]">EXP-WH // DATASET v{ds.version}</span>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Input gudang" className="card flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <ChoiceGroup
            legend="01 / KOMODITAS"
            columns={2}
            value={s.commodityId}
            onChange={pick}
            options={ds.commodities.map((c) => ({ value: c.id, testId: `wh-commodity-${c.id}`, label: COMMODITY_UI[c.id]?.short ?? c.nameId }))}
          />
          <div className="flex flex-col gap-2">
            <ChoiceGroup
              legend="02 / BENTUK"
              value={s.formCode}
              onChange={pickForm}
              options={commodity.forms.map((f) => ({
                value: f.code,
                label: formLabel(s.commodityId, f.code),
                aside: <ConfidenceBadge c={f.params.bulk_density!.confidence} />,
              }))}
            />
            <p className="text-[13px] text-muted">{FORM_UI[`${s.commodityId}.${s.formCode}`]?.hint}</p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="label-mono mb-2.5">03 / STOK</legend>
            <div role="radiogroup" aria-label="Satuan stok" className="grid grid-cols-4 gap-2">
              {(
                [
                  ['t', 'Ton'],
                  ['kg', 'Kg'],
                  ['pcs', COMMODITY_UI[s.commodityId]?.pieceUnit ?? 'butir'],
                  ['packs', 'Karung'],
                ] as [StockUnit, string][]
              ).map(([u, label]) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={stockUnit === u}
                  disabled={(u === 'pcs' && !hasPieces) || (u === 'packs' && !pack)}
                  onClick={() => changeUnit(u)}
                  className="chip justify-center text-xs disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
            <NumberField
              label={`Jumlah stok (${stockUnit === 't' ? 'ton' : stockUnit === 'kg' ? 'kg' : stockUnit === 'pcs' ? COMMODITY_UI[s.commodityId]?.pieceUnit : 'karung'})`}
              value={stockValue}
              onValue={(v) => setStock(v)}
              min={0}
              integer={stockUnit === 'pcs' || stockUnit === 'packs'}
              testId="wh-stock"
            />
            {isKopra && (
              <NumberField
                label={<>Kadar air saat ini <Hint k="moisture" /></>}
                unit="%"
                min={0}
                max={99}
                value={s.moisturePct}
                onValue={(v) => setS((p) => ({ ...p, ...(v === undefined ? { moisturePct: undefined } : { moisturePct: v }) }))}
                hint={form.params.moisture ? `Dataset: tipikal ${fmt(form.params.moisture.typ)}% (${fmt(form.params.moisture.min)}–${fmt(form.params.moisture.max)}%)` : undefined}
                testId="wh-moisture"
              />
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="label-mono mb-2.5">04 / CARA TUMPUK</legend>
            {pack?.dims ? (
              <div role="radiogroup" className="grid grid-cols-2 gap-2">
                <button type="button" role="radio" aria-checked={!s.usePackaging} disabled={'packs' in s.stock}
                  onClick={() => setS((p) => ({ ...p, usePackaging: false }))} className="chip text-xs disabled:opacity-40">
                  Curah (densitas)
                </button>
                <button type="button" role="radio" aria-checked={!!s.usePackaging}
                  onClick={() => setS((p) => ({ ...p, usePackaging: true }))} className="chip text-xs">
                  Tumpukan karung
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-muted">Belum ada dimensi kemasan untuk bentuk ini — dihitung sebagai curah.</p>
            )}
            {s.usePackaging && pack?.dims && (
              <p className="font-mono text-xs">
                Karung {fmt(pack.netKg.typ)} kg · {cm(pack.dims.l)}×{cm(pack.dims.w)}×{cm(pack.dims.h)} cm{' '}
                {pack.dimsConfidence && <ConfidenceBadge c={pack.dimsConfidence} />}
              </p>
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
              <input
                id="wh-util"
                type="range"
                min={UTIL_MIN}
                max={UTIL_MAX}
                step={0.01}
                value={s.floorUtil ?? DEFAULT_FLOOR_UTIL}
                onChange={(e) => setS((p) => ({ ...p, floorUtil: Number(e.target.value) }))}
                className="h-11 w-full cursor-pointer accent-ink"
              />
              <span className="flex justify-between font-mono text-[11px]"><span>{fmt(UTIL_MIN, 2)} banyak lorong</span><span>{fmt(UTIL_MAX, 2)} padat</span></span>
            </div>
          </fieldset>

          <details className="border-2 border-dashed border-ink p-3">
            <summary className="cursor-pointer font-mono text-xs font-bold uppercase">05 / Zona & lantai (opsional)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField label="Panjang zona" unit="m" min={0.1} value={s.zone?.lengthM}
                onValue={(v) => setS((p) => (v && p.zone?.widthM ? { ...p, zone: { lengthM: v, widthM: p.zone.widthM } } : v ? { ...p, zone: { lengthM: v, widthM: p.zone?.widthM ?? v } } : { ...p, zone: undefined }))} />
              <NumberField label="Lebar zona" unit="m" min={0.1} value={s.zone?.widthM}
                onValue={(v) => setS((p) => (v ? { ...p, zone: { lengthM: p.zone?.lengthM ?? v, widthM: v } } : { ...p, zone: undefined }))} />
              <NumberField label="Kapasitas lantai" unit="kg/m²" min={1} value={s.floorLoadKgM2}
                onValue={(v) => setS((p) => ({ ...p, floorLoadKgM2: v }))} hint="Dari spesifikasi bangunan" />
            </div>
            <fieldset className="mt-3">
              <legend className="label-mono mb-2">Disimpan bersama di zona ini</legend>
              <div className="flex flex-wrap gap-2">
                {ds.commodities.filter((c) => c.id !== s.commodityId).map((c) => {
                  const on = s.coStored?.includes(c.id) ?? false;
                  return (
                    <button key={c.id} type="button" aria-pressed={on} className="chip text-xs"
                      onClick={() => setS((p) => {
                        const list = new Set(p.coStored ?? []);
                        if (on) list.delete(c.id); else list.add(c.id);
                        return { ...p, coStored: list.size ? [...list] : undefined };
                      })}>
                      {COMMODITY_UI[c.id]?.short}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </details>
        </section>

        <section aria-label="Hasil gudang" aria-live="polite" className="flex min-w-0 flex-[2_1_480px] flex-col gap-6" data-testid="warehouse-result">
          {r ? (
            <>
              <div className="card flex flex-col gap-3 p-[18px]">
                <span className="label-mono">LUAS LANTAI DIBUTUHKAN</span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-[56px] leading-none" data-testid="floor-area">{fmt(r.typ.floorAreaM2, 2)}</span>
                  <span className="font-mono text-lg font-bold">M²</span>
                  <span className="ml-auto"><ConfidenceBadge c={result.ok ? result.out.confidence : 'C'} withText /></span>
                </div>
                <span className="font-mono text-xs">
                  Rentang {fmtM2(r.min.floorAreaM2)} – {fmtM2(r.max.floorAreaM2)} · termasuk lorong (utilisasi {fmt(s.floorUtil ?? DEFAULT_FLOOR_UTIL, 2)})
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
                  <Tile label="Massa" value={`${fmt(r.typ.massKg)} kg`} />
                  <Tile label="Volume" value={fmtM3(r.typ.volumeM3)} />
                  <Tile label="Tapak tumpukan" value={fmtM2(r.typ.footprintM2)} />
                  <Tile label="Beban lantai" value={`${fmt(r.typ.floorLoadKgM2)} kg/m²`} />
                  {r.typ.stacks !== undefined && r.typ.stacks > 0 && (
                    <Tile label="Tumpukan" value={`${fmt(r.typ.stacks)} tumpuk · maks ${fmt(floorDiv(s.stackHeightM, pack?.dims?.h ?? s.stackHeightM))} krg/tumpuk`} />
                  )}
                  {r.typ.packs !== undefined && <Tile label="Jumlah karung" value={`${fmt(r.typ.packs)} krg`} />}
                  {r.typ.zoneUsedFraction !== undefined && (
                    <Tile label="Zona terpakai" value={fmtPct(r.typ.zoneUsedFraction)} danger={r.typ.zoneUsedFraction > 1} />
                  )}
                  {dry !== undefined && (
                    <Tile wide accent label={`Berat setara kering ${fmt(dryPct!)}%`} value={`${fmt(dry)} kg`} />
                  )}
                </div>
                <span className="font-mono text-[11px]">
                  ρ {fmt(form.params.bulk_density!.typ)} kg/m³ · tumpuk {fmt(s.stackHeightM, 2)} m · util lantai {fmt(s.floorUtil ?? DEFAULT_FLOOR_UTIL, 2)}
                </span>
              </div>
              {result.ok && <WarningList warnings={result.out.warnings} />}
              <ScenarioActions state={s} />
            </>
          ) : (
            <div role="alert" className="card"><h2 className="text-xl">Hmm, belum bisa dihitung</h2><p className="mt-2">{!result.ok && result.message}</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, wide, accent, danger }: { label: string; value: string; wide?: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 border-2 border-ink p-2 ${wide ? 'col-span-2 sm:col-span-3' : ''} ${accent ? 'bg-acid' : danger ? 'bg-safety' : 'bg-surface'}`}>
      <span className="uppercase">{label}</span>
      <span className="text-base font-bold">{value}</span>
    </div>
  );
}
