'use client';

import { SUCROSE_SPECIFIC_VOLUME_L_KG, titrationAcidity, vinegarBatch, type CalcWarning } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { CukaMethods } from './CukaMethods';
import { SaveProtocol } from './SaveProtocol';
import { BigResult, Bom, CalcError, EvidenceTag, Note, paramText, rangeText, safe, Sources, useFormula, Wizard } from './shared';

export function CukaFormula() {
  const f = useFormula();
  const c = f.cuka;
  const [waterL, setWaterL] = useState(100);
  const [brixStart, setBrixStart] = useState(c.water_brix.typ);
  const [ph, setPh] = useState<number | undefined>(c.water_ph.typ);
  const [brixTarget, setBrixTarget] = useState(c.must_brix.typ);
  const [yeast, setYeast] = useState(c.yeast_g_l.typ);
  const [starter, setStarter] = useState(c.starter_pct.typ);
  const [egg, setEgg] = useState(c.egg_white_g_l.typ);
  const [bottleMl, setBottleMl] = useState(250);
  const [tit, setTit] = useState({ v: 70, n: f.raw.cuka.titration.naoh_n_default, vs: f.raw.cuka.titration.sample_ml_default });

  const calc = useMemo(
    () =>
      safe(() =>
        vinegarBatch({
          waterL,
          brixStart,
          brixTarget,
          density: c.water_density_kg_l,
          naturalSugarPct: c.water_sugar_pct,
          ethanolEfficiency: c.ethanol_efficiency,
          aceticEfficiency: c.acetic_efficiency,
          yeastGPerL: yeast,
          starterPct: starter,
          eggWhiteGPerL: egg,
          eggWhitePerEggG: c.egg_white_per_egg_g.typ,
          mustBrixRange: c.must_brix,
          aceticMinPct: c.acetic_min_pct.typ,
          datasetVersion: `formula.${f.version}`,
        }),
      ),
    [waterL, brixStart, brixTarget, yeast, starter, egg, c, f.version],
  );
  const titr = useMemo(() => safe(() => titrationAcidity({ naohMl: tit.v, normality: tit.n, sampleMl: tit.vs })), [tit]);

  const inputs = (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Air kelapa tersaring" unit="L" min={0.1} max={100000} value={waterL} onValue={(v) => v && setWaterL(v)} testId="cuka-water" />
        <NumberField label={<>°Brix awal <Hint k="brix" /></>} unit="°Bx" min={0} max={30} value={brixStart} onValue={(v) => v !== undefined && setBrixStart(v)}
          hint={`Ukur refraktometer. Umumnya ${paramText(c.water_brix)}`} testId="cuka-brix0" />
        <NumberField label={<>°Brix target must <Hint k="must" /></>} unit="°Bx" min={1} max={30} value={brixTarget} onValue={(v) => v && setBrixTarget(v)}
          hint={`Resep: ${paramText(c.must_brix, 0)}`} testId="cuka-brix1" />
        <NumberField label="pH air kelapa" unit="pH" min={0} max={14} value={ph} onValue={setPh} hint="Harus > 5 (segar)" testId="cuka-ph" />
      </div>
    );

  if (!calc.ok) {
    return (
      <div className="flex flex-col gap-4">
        {inputs}
        <CalcError message={calc.message} />
      </div>
    );
  }
  const out = calc.v;
  const t = out.result.typ;
  const r = out.result;
  const days = {
    min: c.alcohol_days.min + (c.acetify_weeks.min + c.aging_weeks.min) * 7,
    max: c.alcohol_days.max + (c.acetify_weeks.max + c.aging_weeks.max) * 7,
  };

  const phBad = ph !== undefined && ph <= 5;

  return (
    <div className="flex flex-col gap-5" data-testid="formula-cuka">
      {inputs}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <BigResult
          label="GULA PASIR DITAMBAH"
          value={fmt(t.sugarKg, t.sugarKg < 10 ? 2 : 1)}
          unit="KG"
          sub={`Rentang ${fmt(r.min.sugarKg, 2)}–${fmt(r.max.sugarKg, 2)} kg (massa jenis air kelapa). Must ±${fmt(t.mustL, 1)} L`}
          confidence={out.confidence}
          testId="cuka-sugar"
        />
        <Bom
          testId="cuka-bom"
          rows={[
            { name: 'Gula pasir', amount: `${fmt(t.sugarKg, 2)} kg` },
            { name: 'Ragi S. cerevisiae', amount: `${fmt(t.yeastG, 0)} g`, note: `${fmt(yeast, 1)} g/L must` },
            { name: 'Starter cuka hidup', amount: `${fmt(t.starterL, 1)} L`, note: `${fmt(starter)}% v/v` },
            ...(egg > 0 ? [{ name: 'Putih telur (klarifikasi)', amount: `${fmt(t.eggs)} butir`, note: `${fmt(t.eggWhiteG, 0)} g — alergen, wajib di label` }] : []),
            { name: `Botol ${fmt(bottleMl)} mL`, amount: `± ${fmt(Math.floor((t.acetifyL * 1000) / bottleMl))} botol`, note: 'Sebelum susut & endapan' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2 text-xs" data-testid="cuka-evidence">
        <p className="flex flex-wrap items-center gap-2"><EvidenceTag kind="teoritis" /> Gula ditambah & volume must = neraca massa dari isianmu (volume, °Brix awal & target).</p>
        <p className="flex flex-wrap items-center gap-2"><EvidenceTag kind="input" /> Ragi g/L, starter %, putih telur g/L & ukuran botol = resepmu; angka awal di kolom berasal dari literatur, ubah sesuai keputusanmu.</p>
        <p className="flex flex-wrap items-center gap-2"><EvidenceTag kind="eksperimen" /> pH, °Brix & keasaman titrasi batchmu dicatat di <a href="/lab" className="underline">GEMA RnD Lab</a> → catatan harian.</p>
      </div>
      <SaveProtocol
        product="CK"
        testId="cuka-proto"
        defaultName={`Cuka air kelapa ${fmt(waterL)} L · ${fmt(brixTarget)} °Brix`}
        context={`air ${fmt(waterL)} L, °Brix ${fmt(brixStart)}→${fmt(brixTarget)}, ragi ${fmt(yeast)} g/L, starter ${fmt(starter)}% v/v, putih telur ${fmt(egg)} g/L`}
        ingredients={[
          { name: 'Air kelapa tersaring', amount: fmt(waterL), unit: 'L' },
          { name: 'Gula pasir (hitung neraca massa)', amount: fmt(t.sugarKg, 2), unit: 'kg' },
          { name: 'Ragi S. cerevisiae', amount: fmt(t.yeastG, 0), unit: 'g' },
          { name: 'Starter cuka hidup', amount: fmt(t.starterL, 1), unit: 'L' },
          ...(egg > 0 ? [{ name: 'Putih telur (klarifikasi)', amount: fmt(t.eggWhiteG, 0), unit: 'g' }] : []),
        ]}
      />
      {phBad && (
        <Note tone="warn" title="Air kelapa tidak layak untuk cuka">
          pH ≤ 5 berarti sudah mulai asam/terfermentasi liar. Buang — jangan diselamatkan (SOP AKL A2). Boleh untuk bioleather hanya bila masih segar.
        </Note>
      )}
      <Note tone="finding" title="Temuan validasi: rumus gula lama kurang ±16%" testId="cuka-legacy">
        Rumus di SOP/tracker lama <code>(Brix target − Brix awal) × L ÷ 100</code> memberi <strong>{fmt(t.legacySugarKg, 2)} kg</strong> dan must hanya naik ke{' '}
        <strong>{fmt(t.legacyBrix, 2)} °Brix</strong>. Rumus neraca massa di sini memperhitungkan gula yang ikut menambah berat larutan.
      </Note>

      <Wizard
        label="Tahap cuka air kelapa"
        testId="cuka-wizard"
        steps={[
          {
            id: 'air',
            tag: 'BAHAN',
            title: 'Air kelapa',
            body: (
              <>
                <ul className="list-disc pl-5 text-sm">
                  <li>Tampung di wadah food-grade (bukan logam biasa), saring kain bersih.</li>
                  <li>Dinginkan ≤10°C dalam ≤2 jam sejak keluar dari buah; olah hari itu juga (batas darurat {fmt(c.water_max_cold_h.typ)} jam dingin).</li>
                  <li>Ukur pH & °Brix setiap jerigen (form F-C01). Asam, berbusa, keruh, bau busuk → buang.</li>
                </ul>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="pH normal" value={paramText(c.water_ph, 2)} />
                  <Stat label="°Brix normal" value={paramText(c.water_brix)} />
                  <Stat label="Massa air kelapa" value={`${fmt(waterL * c.water_density_kg_l.typ, 1)} kg`} sub={`ρ ${paramText(c.water_density_kg_l, 3)} kg/L`} />
                </div>
                <Sources ids={[...c.water_ph.sourceIds, ...c.water_density_kg_l.sourceIds]} confidence={c.water_density_kg_l.confidence} />
              </>
            ),
          },
          {
            id: 'must',
            tag: 'B1',
            title: 'Must & gula',
            body: (
              <>
                <p className="text-sm">
                  Larutkan gula dalam sebagian air kelapa hangat, campur, lalu pasteurisasi <strong>{paramText(c.must_pasteurize_c, 0, '°C')}</strong> selama 10–15 menit.
                  Dinginkan cepat ke ≤30°C (ragi mati di atas ±40°C), ukur ulang °Brix.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Gula" value={`${fmt(t.sugarKg, 2)} kg`} accent testId="cuka-sugar-stat" />
                  <Stat label="Massa must" value={`${fmt(t.mustKg, 1)} kg`} />
                  <Stat label="Volume must" value={`± ${fmt(t.mustL, 1)} L`} sub={`+${fmt(SUCROSE_SPECIFIC_VOLUME_L_KG, 2)} L per kg gula`} />
                  <Stat label="Rumus lama" value={`${fmt(t.legacySugarKg, 2)} kg`} sub={`→ ${fmt(t.legacyBrix, 2)} °Brix`} />
                </div>
                <Note>Rumus: gula = M·(B − b) / (100 − B), M = liter × massa jenis. Dosis nutrisi (DAP/ZA) untuk must tidak ada sumber kredibel — KORA tidak menambahkan (GAP).</Note>
                <Sources ids={c.must_brix.sourceIds} confidence={c.must_brix.confidence} />
              </>
            ),
          },
          {
            id: 'alkohol',
            tag: 'B2',
            title: 'Fermentasi alkohol',
            body: (
              <>
                <Note tone="warn" title="Bahan antara — BUKAN untuk dikonsumsi">
                  Cairan alkohol tahap ini DILARANG dijual/dibagikan/diminum (Perpres 49/2021). Wadah berlabel, ruang terkunci, volume dicatat (F-C02). Tanpa api terbuka.
                </Note>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Dosis ragi" unit="g/L" min={0.1} max={20} value={yeast} onValue={(v) => v && setYeast(v)} hint={`Literatur ${paramText(c.yeast_g_l)}`} testId="cuka-yeast" />
                  <Stat label="Ragi total" value={`${fmt(t.yeastG, 0)} g`} sub="Aktifkan dulu 10–15 mnt di must hangat" />
                  <Stat label="Perkiraan alkohol" value={rangeText({ min: r.min.ethanolPctV, typ: t.ethanolPctV, max: r.max.ethanolPctV }, 1, '% v/v')} sub="Teoritis (Gay-Lussac) × efisiensi ragi dari literatur — bukan hasil ukur" testId="cuka-ethanol" />
                </div>
                <p className="text-sm">
                  Suhu {paramText(c.ferment_temp_c, 0, '°C')}, {paramText(c.alcohol_days, 0, 'hari')}. Selesai bila gelembung CO₂ berhenti DAN °Brix stabil 2 hari. Wadah diisi ⅔–¾.
                </p>
                <Sources ids={[...c.yeast_g_l.sourceIds, ...c.ethanol_efficiency.sourceIds]} confidence={c.ethanol_efficiency.confidence} />
              </>
            ),
          },
          {
            id: 'asetat',
            tag: 'B3',
            title: 'Asetifikasi & titrasi',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Starter cuka hidup" unit="% v/v" min={1} max={50} value={starter} onValue={(v) => v && setStarter(v)} hint={`FAO 10% · PCA 20%`} testId="cuka-starter" />
                  <Stat label="Starter" value={`${fmt(t.starterL, 1)} L`} sub={`Total cairan ${fmt(t.acetifyL, 1)} L`} />
                  <Stat
                    label="Potensi asam asetat"
                    value={rangeText({ min: r.min.aceticPotentialPct, typ: t.aceticPotentialPct, max: r.max.aceticPotentialPct }, 1, '%')}
                    sub={`Teoritis × efisiensi literatur. Target ≥${fmt(c.acetic_min_pct.typ)}% (keyakinan ${c.acetic_min_pct.confidence}) · KORA ${fmt(c.acetic_target_pct.typ)}%`}
                    accent={t.aceticPotentialPct >= c.acetic_min_pct.typ}
                    testId="cuka-acetic"
                  />
                </div>
                <p className="text-sm">
                  Statis (Orleans) {paramText(c.acetify_weeks, 0, 'minggu')}, {paramText(c.acetify_temp_c, 0, '°C')}, wadah ⅔–¾ ditutup kain, JANGAN diaduk. Setelah ≥4%: angkat mother (bahan bioleather), sisakan ¼–⅓ sebagai starter batch berikut.
                </p>
                <div className="flex flex-col gap-3 border-3 border-ink p-3" data-testid="titration">
                  <span className="label-mono flex items-center gap-2">Kalkulator titrasi mingguan <Hint k="titrasi" /></span>
                  <div className="grid grid-cols-3 gap-3">
                    <NumberField label="NaOH terpakai" unit="mL" min={0} max={500} value={tit.v} onValue={(v) => v !== undefined && setTit((x) => ({ ...x, v }))} testId="tit-v" />
                    <NumberField label="Kekuatan NaOH" unit="N" min={0.001} max={5} value={tit.n} onValue={(v) => v && setTit((x) => ({ ...x, n: v }))} hint="Lihat label larutan standar" testId="tit-n" />
                    <NumberField label="Sampel cuka" unit="mL" min={0.1} max={100} value={tit.vs} onValue={(v) => v && setTit((x) => ({ ...x, vs: v }))} testId="tit-vs" />
                  </div>
                  {titr.ok ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Stat
                          label="Asam asetat"
                          value={`${fmt(titr.v.acidityPct, 2)}%`}
                          sub={titr.v.acidityPct >= c.acetic_min_pct.typ ? 'Lolos ≥4% — ukur sisa alkohol ≤0,5%' : 'Belum — lanjut asetifikasi'}
                          accent={titr.v.acidityPct >= c.acetic_min_pct.typ}
                          testId="tit-result"
                        />
                        <Stat label="Rumus singkat 0,06005 × V" value={`${fmt(titr.v.shortcutPct, 2)}%`} sub={titr.v.shortcutInvalid ? 'TIDAK berlaku untuk N/sampel ini' : 'Berlaku (0,1 N & 10 mL)'} />
                      </div>
                      {titr.v.shortcutInvalid && (
                        <Note tone="finding" title="Awas salah rumus" testId="tit-warning">
                          Rumus singkat hanya benar untuk NaOH 0,1 N dan sampel 10 mL. Dengan {fmt(tit.n, 2)} N dan {fmt(tit.vs)} mL, hasil benar = V × N × 6,005 ÷ sampel.
                        </Note>
                      )}
                    </>
                  ) : (
                    <CalcError message={titr.message} />
                  )}
                </div>
                <Sources ids={[...c.starter_pct.sourceIds, ...c.acetic_efficiency.sourceIds]} confidence={c.acetic_efficiency.confidence} />
              </>
            ),
          },
          {
            id: 'botol',
            tag: 'B4–B5',
            title: 'Klarifikasi & botol',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Putih telur" unit="g/L" min={0} max={20} value={egg} onValue={(v) => v !== undefined && setEgg(v)} hint="0 = tanpa (saring berlapis, tanpa alergen)" testId="cuka-egg" />
                  <NumberField label="Ukuran botol" unit="mL" integer min={10} max={5000} value={bottleMl} onValue={(v) => v && setBottleMl(v)} testId="cuka-bottle" />
                  <Stat label="Botol" value={`± ${fmt(Math.floor((t.acetifyL * 1000) / bottleMl))}`} sub="Simpan 2 botol arsip per batch" />
                </div>
                <ul className="list-disc pl-5 text-sm">
                  <li>Klarifikasi: aduk putih telur kocok, panaskan sampai menggumpal, diamkan 1 hari, saring.</li>
                  <li>Pematangan {paramText(c.aging_weeks, 0, 'minggu')} tertutup penuh (tanpa ruang udara), saring halus.</li>
                  <li>Pasteurisasi {paramText(c.bottle_pasteurize_c, 0, '°C')} ≥30 menit — jangan mendidih. Isi panas, tutup segera.</li>
                  <li>Label: keasaman (angka bulat), volume, batch, tanggal, izin edar (konfirmasi BPOM/Dinkes), alergen bila putih telur.</li>
                </ul>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Lama total" value={`± ${fmt(days.min / 7, 0)}–${fmt(days.max / 7, 0)} minggu`} sub="Fermentasi + asetifikasi + pematangan" />
                  <Stat label="Sisa alkohol maks" value={`${fmt(c.residual_alcohol_max_pct.typ, 1)}% v/v`} sub="Codex CXS 162" />
                  <Stat label="Asam asetat min" value={`${fmt(c.acetic_min_pct.typ)}%`} sub={`Target KORA ${fmt(c.acetic_target_pct.typ)}%`} />
                </div>
                <Sources ids={[...c.egg_white_g_l.sourceIds, ...c.residual_alcohol_max_pct.sourceIds]} confidence={c.egg_white_g_l.confidence} />
              </>
            ),
          },
        ]}
      />
      <WarningList warnings={out.warnings as CalcWarning[]} />
      <CukaMethods acetifyL={t.acetifyL} aceticPct={{ min: out.result.min.aceticPotentialPct, typ: t.aceticPotentialPct, max: out.result.max.aceticPotentialPct }} waterL={waterL} starterPct={starter} />
    </div>
  );
}
