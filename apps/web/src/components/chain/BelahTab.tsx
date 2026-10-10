'use client';

import { splitPlan } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { fmt } from '@/lib/format';
import { BigResult, CalcError, ChainSources, getForm, Note, paramText, safe, SopList, Table, useChain, useDataset, useFormula } from './shared';

export function BelahTab() {
  const c = useChain();
  const f = useFormula();
  const ds = useDataset();
  const shell = getForm(ds, 'arang_batok_belah2', 'raw_halves').params['mass_per_unit.raw_half_shell']!;
  const belah = f.stations.find((s) => s.id === 'belah')!;
  const presets = c.raw.sorting.grade_split_pct;
  const [nuts, setNuts] = useState<number | undefined>(1000);
  const [workers, setWorkers] = useState<number | undefined>(2);
  const [preset, setPreset] = useState(presets[0]!.id);
  const [reject, setReject] = useState<number | undefined>(0);
  const share = presets.find((p) => p.id === preset)!;

  const calc = useMemo(
    () =>
      nuts && workers
        ? safe(() =>
            splitPlan({
              nuts,
              share: { edible: share.edible, reguler: share.reguler, asalan: share.asalan },
              rejectPct: reject ?? 0,
              waterPerNutL: f.kopra.water_per_nut_l,
              meatPerNutKg: f.kopra.meat_per_nut_kg,
              halfShellKg: shell,
              splitRatePerPersonH: belah.rate,
              workers,
              chillWithinH: c.coconutWater.chill_within_h,
              datasetVersion: `rantai.${c.version}`,
            }),
          )
        : undefined,
    [nuts, workers, share, reject, f, shell, belah, c],
  );

  const t = calc?.ok ? calc.v.result.typ : undefined;
  const r = calc?.ok ? calc.v.result : undefined;
  const water = c.coconutWater;

  return (
    <div className="flex flex-col gap-5" data-testid="chain-belah">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label="Kelapa dibelah" unit="butir" integer min={1} max={1_000_000} value={nuts} onValue={setNuts} testId="belah-nuts" />
        <NumberField label="Pekerja belah" unit="orang" integer min={1} max={500} value={workers} onValue={setWorkers}
          hint={`Laju ${paramText(belah.rate, 0)} butir/jam/orang — time study wajib`} testId="belah-workers" />
        <NumberField label="Ditolak (busuk)" unit="%" min={0} max={99} value={reject} onValue={setReject} hint="Dari sortir lot ini; 0 bila belum diukur" testId="belah-reject" />
      </div>
      <ChoiceGroup
        legend="Perkiraan pembagian jalur kopra (edible / reguler / asalan)"
        columns={2}
        value={preset}
        onChange={setPreset}
        options={presets.map((p) => ({ value: p.id, label: `${p.name_id}: ${p.edible} / ${p.reguler} / ${p.asalan} %`, testId: `belah-preset-${p.id}` }))}
      />
      <ChainSources ids={c.raw.sorting.grade_split_source_ids} confidence="A" />

      {calc && !calc.ok && <CalcError message={calc.message} />}
      {t && r && (
        <>
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <BigResult
              label="AIR KELAPA DITAMPUNG"
              value={fmt(t.waterL, 0)}
              unit="LITER"
              sub={`Rentang ${fmt(r.min.waterL, 0)}–${fmt(r.max.waterL, 0)} L · hanya dari jalur edible + reguler (air jernih)`}
              confidence={calc!.ok ? calc!.v.confidence : undefined}
              testId="belah-water"
            />
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Lama belah" value={`${fmt(t.splitH, 1)} jam`} sub={`${fmt(r.min.splitH, 1)}–${fmt(r.max.splitH, 1)} jam`} />
              <Stat label={`Pendingin per ${fmt(water.chill_within_h.typ, 0)} jam`} value={`${fmt(t.chillBatchL, 0)} L`} sub="kapasitas kulkas/cold box minimum" accent testId="belah-chill" />
              <Stat label="Batok mentah" value={`${fmt(t.shellKg, 0)} kg`} sub="→ jalur arang (per asal)" />
              <Stat label="Butir diterima" value={fmt(t.acceptedNuts, 0)} />
            </div>
          </div>
          <Table
            testId="belah-routes"
            head={['Jalur', 'Butir', 'Daging segar (kg)']}
            rows={[
              ['Edible', fmt(t.edibleNuts, 0), `${fmt(t.meatEdibleKg, 0)} (${fmt(r.min.meatEdibleKg, 0)}–${fmt(r.max.meatEdibleKg, 0)})`],
              ['Reguler', fmt(t.regulerNuts, 0), `${fmt(t.meatRegulerKg, 0)} (${fmt(r.min.meatRegulerKg, 0)}–${fmt(r.max.meatRegulerKg, 0)})`],
              ['Asalan', fmt(t.asalanNuts, 0), `${fmt(t.meatAsalanKg, 0)} (${fmt(r.min.meatAsalanKg, 0)}–${fmt(r.max.meatAsalanKg, 0)})`],
            ]}
          />
        </>
      )}

      <section className="flex flex-col gap-2" aria-label="Sortir saat belah">
        <h3 className="text-xl">Sortir kondisi & usia saat belah</h3>
        <Table
          testId="belah-sort"
          head={['Kondisi', 'Ciri', 'Penanganan', 'Jalur']}
          rows={c.raw.sorting.classes.map((k) => [<strong key="n">{k.name_id}</strong>, k.criteria, k.handling, k.route.toUpperCase()])}
        />
        <ChainSources ids={c.raw.sorting.source_ids} confidence="C" />
      </section>

      <Note title="Standar simpan air kelapa">
        Saring, tampung di wadah food-grade tertutup, dinginkan &lt; {fmt(water.chill_target_max_c.typ, 0)} °C paling lambat {fmt(water.chill_within_h.typ, 0)} jam sejak keluar buah.
        Simpan dingin maksimal {paramText(f.cuka.water_max_cold_h, 0)} jam sebelum diolah jadi cuka/bioleather. Air dari butir bertunas, retak, atau berbau tidak ditampung.
      </Note>
      <ChainSources ids={[...water.chill_within_h.sourceIds, ...f.cuka.water_max_cold_h.sourceIds]} confidence="C" />

      <SopList
        title="Bersihkan jambul → belah → tampung air"
        testId="sop-belah"
        steps={[
          'Bersihkan sisa sabut/jambul di sekitar mata kelapa dengan parang/pisau; sabut ke jalur cocofiber/cocopeat.',
          'Belah di atas saringan + corong ke jeriken/ember food-grade bersih (bukan di lantai). Satu lot = satu wadah berlabel kode lot.',
          `Sortir tiap belahan saat itu juga (tabel di atas): edible wajib daging ≥ ${fmt(c.sorting.minMeatThicknessMm.typ / 10, 0)} cm, putih, padat.`,
          `Air jernih & manis langsung ke pendingin < ${fmt(water.chill_target_max_c.typ, 0)} °C dalam ${fmt(water.chill_within_h.typ, 0)} jam; catat jam & suhu.`,
          `Belahan ditiriskan lalu masuk rak/oven maksimal ${paramText(f.kopra.split_to_dryer_max_h, 0)} jam sejak dibelah (aturan 4 jam) — lewat dari itu maksimal grade Reguler.`,
          'Batok yang sudah dicungkil dikumpulkan per lot asal (DR/DT) untuk jalur arang.',
        ]}
        tools={['Parang/alat belah jepit atau mesin belah', 'Saringan + corong', 'Jeriken/ember food-grade bertutup', 'Kulkas/cold box + termometer', 'Label lot', 'Sarung tangan anti-potong']}
        safety="Alat belah jepit/mesin lebih aman untuk pekerja baru dibanding kampak bebas; sarung tangan anti-potong wajib."
      />
    </div>
  );
}
