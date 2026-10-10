'use client';

import { meters, point, tripsNeeded, vehicleLoad, warehouseSpace, type Meters, type PackSpec, type Param } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { BigResult, CalcError, ChainSources, getForm, paramText, safe, SopList, Table, useChain, useDataset, useFormula } from './shared';

export interface PackOption {
  id: string;
  label: string;
  pack: PackSpec;
  commodityCode?: string;
  sourceIds: string[];
}

/** Pilihan kemasan dari dataset: kopra & arang (inventory), master box briket (dataset rantai). */
export function usePackOptions(): PackOption[] {
  const ds = useDataset();
  const c = useChain();
  return useMemo(() => {
    const fromInv = (commodity: string, form: string, label: string): PackOption | undefined => {
      const pk = getForm(ds, commodity, form).packaging.find((p) => p.dims);
      return pk ? { id: `${commodity}.${form}`, label: `${label} (${paramText(pk.netKg, 0)} kg)`, pack: { l: pk.dims!.l, w: pk.dims!.w, h: pk.dims!.h, netKg: pk.netKg }, commodityCode: commodity, sourceIds: [] } : undefined;
    };
    const cartons: PackOption[] = c.raw.packing.briquette_cartons.map((b) => ({
      id: b.id,
      label: b.name_id,
      pack: { l: meters(b.dims_mm.L / 1000), w: meters(b.dims_mm.W / 1000), h: meters(b.dims_mm.H / 1000), netKg: { ...point(b.net_kg), key: `${b.id}.net`, unit: 'kg', confidence: 'C', sourceIds: c.raw.packing.briquette_cartons_source_ids, source: 'dataset' } as Param },
      sourceIds: c.raw.packing.briquette_cartons_source_ids,
    }));
    return [
      fromInv('kopra_edible', 'bagged', 'Kopra edible — karung'),
      fromInv('kopra_asalan', 'bagged_jute', 'Kopra asalan/reguler — karung goni'),
      fromInv('arang_batok_belah2', 'lumps', 'Arang batok — karung PP'),
      ...cartons,
    ].filter((x): x is PackOption => !!x);
  }, [ds, c]);
}

type Dest = 'gudang' | 'kendaraan';

/** Kalkulator kemas: jumlah kemasan + ruang gudang atau muat kendaraan/container. Dipakai tab Kemas, Arang, Briket. */
export function PackCalculator({ options, defaultKg, prefix }: { options: PackOption[]; defaultKg?: number; prefix: string }) {
  const c = useChain();
  const [optId, setOptId] = useState(options[0]!.id);
  const [kg, setKg] = useState<number | undefined>(defaultKg);
  const [dest, setDest] = useState<Dest>('kendaraan');
  const [veh, setVeh] = useState('20GP');
  const [stackH, setStackH] = useState<number | undefined>(c.receiving.max_stack_height_m.typ);
  const opt = options.find((o) => o.id === optId) ?? options[0]!;
  const packs = kg ? Math.ceil(kg / opt.pack.netKg.typ) : undefined;
  const v = c.vehicles.find((x) => x.id === veh) ?? c.vehicles[0]!;

  const load = useMemo(() => (dest === 'kendaraan' ? safe(() => vehicleLoad(v, { mode: 'bag', pack: opt.pack }, `rantai.${c.version}`)) : undefined), [dest, v, opt, c.version]);
  const trips = load?.ok && kg && load.v.result.min.packs > 0 ? safe(() => tripsNeeded(kg, { min: load.v.result.min.massKg, typ: load.v.result.typ.massKg, max: load.v.result.max.massKg })) : undefined;
  const wh = useMemo(
    () =>
      dest === 'gudang' && kg && stackH
        ? safe(() => warehouseSpace({ stock: { massKg: kg }, pack: opt.pack, stackHeightM: stackH as Meters, ...(opt.commodityCode && { context: { commodityCode: opt.commodityCode } }) }))
        : undefined,
    [dest, kg, stackH, opt],
  );

  return (
    <section className="card flex flex-col gap-3" aria-label="Kalkulator kemas" data-testid={`${prefix}-pack`}>
      <h3 className="text-xl">Kalkulator kemas & muat</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label-mono">Kemasan</span>
          <select className="field" value={optId} onChange={(e) => setOptId(e.target.value)} data-testid={`${prefix}-pack-opt`}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <NumberField label="Jumlah produk" unit="kg" min={1} max={10_000_000} value={kg} onValue={setKg} testId={`${prefix}-pack-kg`} />
      </div>
      <p className="font-mono text-xs">
        Ukuran kemasan terisi {fmt(opt.pack.l * 100, 0)} × {fmt(opt.pack.w * 100, 0)} × {fmt(opt.pack.h * 100, 0)} cm · isi {paramText(opt.pack.netKg, 0)} kg
      </p>
      <ChoiceGroup<Dest>
        legend="Simpan / kirim ke"
        columns={2}
        value={dest}
        onChange={setDest}
        options={[
          { value: 'kendaraan', label: 'Truk / container', testId: `${prefix}-dest-veh` },
          { value: 'gudang', label: 'Gudang', testId: `${prefix}-dest-wh` },
        ]}
      />
      {packs !== undefined && <BigResult label="JUMLAH KEMASAN" value={fmt(packs, 0)} unit="KEMASAN" sub={`${fmt(kg!, 0)} kg ÷ ${fmt(opt.pack.netKg.typ, 1)} kg`} testId={`${prefix}-packs`} />}
      {dest === 'kendaraan' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Kendaraan / container</span>
            <select className="field" value={veh} onChange={(e) => setVeh(e.target.value)} data-testid={`${prefix}-veh`}>
              {c.vehicles.map((x) => (
                <option key={x.id} value={x.id}>{x.nameId}</option>
              ))}
            </select>
          </label>
          {load && !load.ok && <CalcError message={load.message} />}
          {load?.ok && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Kemasan / unit" value={fmt(load.v.result.typ.packs, 0)} accent testId={`${prefix}-perveh`} />
              <Stat label="Berat / unit" value={`${fmt(load.v.result.typ.massKg / 1000, 2)} t`} />
              <Stat label="Pembatas" value={load.v.binding === 'WEIGHT' ? 'Berat' : load.v.binding === 'VOLUME' ? 'Ruang' : '—'} />
              <Stat label="Unit dibutuhkan" value={trips?.ok ? fmt(trips.v.typ, 0) : '—'} sub={trips?.ok ? `${fmt(trips.v.min, 0)}–${fmt(trips.v.max, 0)}` : undefined} testId={`${prefix}-units`} />
            </div>
          )}
          {load?.ok && <WarningList warnings={load.v.warnings} />}
        </>
      )}
      {dest === 'gudang' && (
        <>
          <NumberField label="Tinggi tumpuk" unit="m" min={0.3} max={10} value={stackH} onValue={setStackH} hint={`SOP KORA tumpukan di atas palet ≤${fmt(c.receiving.max_stack_height_m.typ, 1)} m`} />
          {wh && !wh.ok && <CalcError message={wh.message} />}
          {wh?.ok && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Luas lantai" value={`${fmt(wh.v.result.typ.floorAreaM2, 1)} m²`} accent testId={`${prefix}-floor`} />
                <Stat label="Tapak tumpukan" value={`${fmt(wh.v.result.typ.footprintM2, 1)} m²`} />
                <Stat label="Tumpukan" value={fmt(wh.v.result.typ.stacks ?? 0, 0)} />
                <Stat label="Beban lantai" value={`${fmt(wh.v.result.typ.floorLoadKgM2, 0)} kg/m²`} />
              </div>
              <WarningList warnings={wh.v.warnings} />
            </>
          )}
        </>
      )}
      <ChainSources ids={[...opt.sourceIds, ...v.sourceIds]} />
    </section>
  );
}

export function KemasTab() {
  const c = useChain();
  const f = useFormula();
  const options = usePackOptions();
  const congkel = f.stations.find((s) => s.id === 'congkel')!;
  const testa = f.stations.find((s) => s.id === 'kupas_testa');
  const grades = f.raw.kopra.grades;
  return (
    <div className="flex flex-col gap-5" data-testid="chain-kemas">
      <section className="flex flex-col gap-2" aria-label="Grade kopra">
        <h3 className="text-xl">Klasifikasi grade kopra putih</h3>
        <Table
          testId="kemas-grades"
          head={['Grade', 'KA maks', 'Minyak min', 'FFA maks', 'Benda asing maks', 'Berjamur maks', 'Aflatoksin maks']}
          rows={grades.map((g) => [<strong key="n">{g.name_id}</strong>, `${fmt(g.moisture_max_pct, 1)}%`, `${fmt(g.oil_min_pct, 0)}%`, `${fmt(g.ffa_max_pct, 1)}%`, `${fmt(g.foreign_max_pct, 1)}%`, `${fmt(g.mould_max_pct, 0)}%`, `${fmt(g.aflatoxin_max_ppb, 0)} ppb`])}
        />
        <ChainSources ids={grades[0]!.source_ids} confidence="A" />
        <p className="text-sm">Kopra yang gagal Edible tidak dibuang — turun ke Reguler/Asalan sesuai hasil uji. Hitung grade dari kadar air ukur di Formula R&amp;D → Kopra.</p>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Laju congkel" value={`${paramText(congkel.rate, 0)} butir/jam/orang`} />
        {testa && <Stat label="Kupas kulit ari (edible)" value={`${paramText(testa.rate, 0)} butir/jam/orang`} />}
        <Stat label="Karung kopra" value={`${paramText(c.packing.copra_sack_kg, 0)} kg`} sub="ikuti kontrak buyer" />
      </div>

      <PackCalculator options={options} defaultKg={1000} prefix="kemas" />

      <SopList
        title="Congkel → QC → grade → kemas"
        testId="sop-kemas"
        steps={[
          'Congkel daging dari tempurung setelah kering setengah (lebih mudah lepas); tempurung masuk jalur arang per lot asal.',
          'Edible: kupas kulit ari (testa) bila diminta buyer; buang bagian gosong/berjamur.',
          'QC per lot: kadar air (moisture meter/oven 105 °C), warna, jamur, benda asing; sampel minyak & FFA ke lab berkala. Tetapkan grade (tabel di atas).',
          'Dinginkan sampai suhu ruang sebelum dikemas; karung food-grade berlabel kode lot, grade, berat, tanggal.',
          `Gudang kering berventilasi, RH < ${fmt(c.packing.warehouse_rh_max_pct.min, 0)}–${fmt(c.packing.warehouse_rh_max_pct.max, 0)}%; karung di atas palet, tidak menempel dinding, FIFO; ukur ulang KA tiap 1–2 minggu.`,
          'Jangan simpan kopra edible bersama kopra asalan/asap (bau terserap).',
        ]}
        tools={['Alat congkel', 'Pisau kupas kulit ari', 'Moisture meter', 'Timbangan', 'Karung food-grade + liner', 'Palet', 'Higrometer gudang', 'Label lot/grade']}
      />
      <ChainSources ids={[...c.packing.copra_sack_kg.sourceIds, ...c.packing.warehouse_rh_max_pct.sourceIds]} confidence="C" />
    </div>
  );
}
