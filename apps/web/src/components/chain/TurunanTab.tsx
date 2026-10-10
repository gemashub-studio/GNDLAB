'use client';

import { bioleatherBatch, celluloseAdditive } from '@gemas/calc-engine';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { fmt } from '@/lib/format';
import { BigResult, CalcError, ChainSources, Note, paramText, safe, SopList, useChain, useFormula } from './shared';

export function TurunanTab() {
  const c = useChain();
  const f = useFormula();
  const b = f.bioleather;
  const add = c.raw.bioleather_additive;
  const [mediaL, setMediaL] = useState<number | undefined>(10);
  const [mat, setMat] = useState(add.materials[0]!.id);
  const [dose, setDose] = useState<number | undefined>();
  const [moist, setMoist] = useState<number | undefined>();
  const [alkali, setAlkali] = useState(true);
  const material = add.materials.find((m) => m.id === mat)!;

  const bc = useMemo(
    () =>
      mediaL
        ? safe(() =>
            bioleatherBatch({
              mediaL,
              sucroseGPerL: b.sucrose_g_l.typ,
              zaGPerL: b.za_g_l.typ,
              starterPct: b.starter_pct.typ,
              cultureDays: b.culture_days,
              wetYieldGPerLDay: b.wet_yield_g_l_day,
              dryFraction: b.dry_fraction_of_wet,
              naohM: b.naoh_m.typ,
              naohSolutionL: mediaL,
              glycerolPct: b.glycerol_pct.typ,
              plastSolutionL: mediaL,
              datasetVersion: `formula.${f.version}`,
            }),
          )
        : undefined,
    [mediaL, b, f.version],
  );
  const calc = useMemo(
    () =>
      bc?.ok && mediaL
        ? safe(() =>
            celluloseAdditive({
              mediaL,
              dryGPerL: dose ?? 0,
              moisturePct: moist ?? 0,
              bcDryG: { min: bc.v.result.min.drySheetG, typ: bc.v.result.typ.drySheetG, max: bc.v.result.max.drySheetG },
              alkali: alkali ? { naohPct: c.bioleatherAdditive.coir_alkali_naoh_pct, liquorRatio: c.bioleatherAdditive.coir_alkali_liquor_ratio } : null,
              datasetVersion: `rantai.${c.version}`,
            }),
          )
        : undefined,
    [bc, mediaL, dose, moist, alkali, c],
  );
  const t = calc?.ok ? calc.v.result.typ : undefined;
  const r = calc?.ok ? calc.v.result : undefined;

  return (
    <div className="flex flex-col gap-5" data-testid="chain-turunan">
      <section className="card flex flex-col gap-2" aria-label="Cuka air kelapa">
        <h3 className="text-xl">Cuka air kelapa</h3>
        <p className="text-sm">
          Air kelapa dingin dari tab Belah (≤ {paramText(f.cuka.water_max_cold_h, 0)} jam) → must {paramText(f.cuka.must_brix, 0)} °Brix → fermentasi alkohol {paramText(f.cuka.alcohol_days, 0)} hari →
          asetifikasi {paramText(f.cuka.acetify_weeks, 0)} minggu → asam asetat ≥ {paramText(f.cuka.acetic_min_pct, 0)}%. Takaran gula (neraca massa), ragi, starter, titrasi & botol lengkap di{' '}
          <Link href="/formula?p=cuka" data-testid="turunan-cuka-link">Formula R&amp;D → Cuka</Link>.
        </p>
      </section>

      <section className="card flex flex-col gap-3" aria-label="Bioleather + selulosa">
        <h3 className="text-xl">Bioleather + selulosa tambahan</h3>
        <Note tone="finding" title="Komposit in-situ">{add.in_situ_note}</Note>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Volume media air kelapa" unit="L" min={0.1} max={100_000} value={mediaL} onValue={setMediaL} testId="bl-media" />
          <ChoiceGroup
            legend="Bahan selulosa tambahan"
            columns={1}
            value={mat}
            onChange={(m) => {
              setMat(m);
              setAlkali(m === 'cocofiber');
            }}
            options={add.materials.map((m) => ({ value: m.id, label: m.name_id, testId: `bl-mat-${m.id}` }))}
          />
          <NumberField label="Dosis bahan (kering)" unit="g/L" min={0} max={500} value={dose} onValue={setDose} hint="GAP: belum ada dosis acuan — uji bertingkat (mis. 3 level) & catat di Ceklis R&D" testId="bl-dose" />
          <NumberField label="Kadar air bahan saat ditimbang" unit="%" min={0} max={95} value={moist} onValue={setMoist} hint="Kosong = dianggap kering oven" testId="bl-moist" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={alkali} onChange={(e) => setAlkali(e.target.checked)} data-testid="bl-alkali" />
          Perlakuan alkali NaOH {paramText(c.bioleatherAdditive.coir_alkali_naoh_pct, 0)}% (rasio larutan {paramText(c.bioleatherAdditive.coir_alkali_liquor_ratio, 0)}:1) lalu bilas netral
        </label>
        <p className="text-sm"><strong>Persiapan {material.name_id}:</strong> {material.prep}</p>
        {bc && !bc.ok && <CalcError message={bc.message} />}
        {calc && !calc.ok && <CalcError message={calc.message} />}
        {t && r && (
          <>
            <BigResult
              label="LEMBAR KOMPOSIT KERING (PERKIRAAN)"
              value={fmt(t.compositeDryG, 0)}
              unit="GRAM"
              sub={`${fmt(r.min.compositeDryG, 0)}–${fmt(r.max.compositeDryG, 0)} g · BC ${fmt(t.compositeDryG - t.additiveDryG, 0)} g + bahan ${fmt(t.additiveDryG, 0)} g`}
              confidence={calc!.ok ? calc!.v.confidence : undefined}
              testId="bl-composite"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Timbang bahan" value={`${fmt(t.additiveWetG, 1)} g`} sub={`kering ${fmt(t.additiveDryG, 1)} g`} accent testId="bl-wet" />
              <Stat label="Porsi bahan di lembar" value={`${fmt(t.additiveSharePct, 0)}%`} sub={`${fmt(r.min.additiveSharePct, 0)}–${fmt(r.max.additiveSharePct, 0)}%`} testId="bl-share" />
              <Stat label="Larutan NaOH" value={alkali ? `${fmt(t.naohSolutionL, 2)} L` : '—'} />
              <Stat label="NaOH padat" value={alkali ? `${fmt(t.naohG, 1)} g` : '—'} testId="bl-naoh" />
            </div>
          </>
        )}
        <ChainSources ids={add.source_ids} confidence="C" />
        <p className="text-sm">Resep media (gula, ZA, starter, pH), pemurnian & plastisasi lembar: <Link href="/formula?p=bioleather">Formula R&amp;D → Bioleather</Link>.</p>
      </section>

      <SopList
        title="Bioleather + selulosa (uji R&D)"
        testId="sop-turunan"
        steps={[
          'Siapkan media air kelapa sesuai Formula Bioleather; sterilkan wadah.',
          `Siapkan ${material.name_id}: ${material.prep}.`,
          'Timbang bahan sesuai dosis, sebar merata di dasar baki/media sebelum inokulasi starter (in-situ) — atau letakkan lembar tipis serat di permukaan setelah lapisan BC awal terbentuk.',
          'Fermentasi statis, jangan diaduk; catat hari, suhu, tebal lembar basah.',
          'Panen, murnikan (NaOH encer sesuai Formula), bilas netral, plastisasi gliserol, keringkan.',
          'Uji kuat tarik & lipat dibanding kontrol tanpa bahan (minimal 3 dosis + kontrol); catat di Ceklis R&D.',
        ]}
        tools={['Baki/wadah fermentasi', 'Timbangan 0,1 g', 'Ayakan', 'NaOH + sarung tangan & kacamata', 'pH meter/strip', 'Jangka sorong (tebal)', 'Oven pengering suhu rendah']}
        safety="NaOH korosif: sarung tangan nitril, kacamata, larutkan NaOH ke air (bukan sebaliknya), bilas tumpahan dengan banyak air."
      />
    </div>
  );
}
