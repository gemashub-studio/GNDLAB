'use client';

import { bioleatherBatch, NAOH_MAX_M, point, trayMediaL, type CalcWarning, type Param } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { BioleatherMethods } from './BioleatherMethods';
import { BigResult, Bom, CalcError, Note, paramText, rangeText, safe, Sources, useFormula, Wizard } from './shared';

type Harvest = 'once' | 'weekly';

export function BioleatherFormula() {
  const f = useFormula();
  const b = f.bioleather;
  const [tray, setTray] = useState({ count: 4, lengthCm: 30, widthCm: 40, depthCm: 3 });
  const [sucrose, setSucrose] = useState(b.sucrose_g_l.typ);
  const [starter, setStarter] = useState(b.starter_pct.typ);
  const [days, setDays] = useState(b.culture_days.typ);
  const [harvest, setHarvest] = useState<Harvest>('once');
  const [naohM, setNaohM] = useState(b.naoh_m.typ);
  const [glycerol, setGlycerol] = useState(b.glycerol_pct.typ);

  const mediaL = useMemo(() => safe(() => trayMediaL(tray)), [tray]);
  const yieldP: Param = useMemo(() => {
    const y = b.wet_yield_g_l_day;
    // Sekali panen = batas bawah studi; panen berkala mingguan + media baru = batas atas (SOP AKL C3).
    return { ...y, ...point(harvest === 'once' ? y.min : y.max) };
  }, [b, harvest]);
  const calc = useMemo(
    () =>
      mediaL.ok
        ? safe(() =>
            bioleatherBatch({
              mediaL: mediaL.v,
              surfaceCm2: tray.count * tray.lengthCm * tray.widthCm,
              sucroseGPerL: sucrose,
              zaGPerL: b.za_g_l.typ,
              starterPct: starter,
              cultureDays: { ...b.culture_days, ...point(days) },
              wetYieldGPerLDay: yieldP,
              dryFraction: b.dry_fraction_of_wet,
              naohM,
              naohSolutionL: mediaL.v,
              glycerolPct: glycerol,
              plastSolutionL: mediaL.v,
              datasetVersion: `formula.${f.version}`,
            }),
          )
        : mediaL,
    [mediaL, tray, sucrose, starter, days, yieldP, naohM, glycerol, b, f.version],
  );

  const inputs = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NumberField label="Jumlah baki" unit="baki" integer min={1} max={10000} value={tray.count} onValue={(v) => v && setTray((t) => ({ ...t, count: v }))} testId="blt-trays" />
      <NumberField label="Panjang baki" unit="cm" min={5} max={500} value={tray.lengthCm} onValue={(v) => v && setTray((t) => ({ ...t, lengthCm: v }))} />
      <NumberField label="Lebar baki" unit="cm" min={5} max={500} value={tray.widthCm} onValue={(v) => v && setTray((t) => ({ ...t, widthCm: v }))} />
      <NumberField label="Kedalaman cairan" unit="cm" min={0.5} max={30} value={tray.depthCm} onValue={(v) => v && setTray((t) => ({ ...t, depthCm: v }))}
        hint="Optimum belum diketahui — uji 3 / 5 / 8 cm" testId="blt-depth" />
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
  const media = mediaL.ok ? mediaL.v : 0;

  return (
    <div className="flex flex-col gap-5" data-testid="formula-bioleather">
      {inputs}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <BigResult
          label="LEMBAR KERING (PERKIRAAN)"
          value={fmt(t.drySheetG, t.drySheetG < 100 ? 1 : 0)}
          unit="GRAM"
          sub={`Rentang ${fmt(r.min.drySheetG, 1)}–${fmt(r.max.drySheetG, 1)} g · basah ±${fmt(t.wetSheetG, 0)} g dari ${fmt(media, 1)} L media`}
          confidence={out.confidence}
          testId="blt-dry"
        />
        <Bom
          testId="blt-bom"
          rows={[
            { name: 'Air kelapa tersaring', amount: `${fmt(media, 2)} L` },
            { name: 'Gula pasir (sukrosa)', amount: `${fmt(t.sucroseG, 0)} g`, note: `${fmt(sucrose)} g/L` },
            { name: 'ZA (amonium sulfat) food-grade', amount: `${fmt(t.zaG, 1)} g`, note: `${fmt(b.za_g_l.typ)} g/L` },
            { name: 'Cuka / asam asetat', amount: 'secukupnya', note: `sampai pH ${paramText(b.ph, 1)}` },
            { name: 'Starter K. xylinus', amount: `${fmt(t.starterMl, 0)} mL`, note: `${fmt(starter, 1)}% v/v` },
            { name: 'NaOH (pemurnian)', amount: `${fmt(t.naohG, 1)} g`, note: `${fmt(naohM, 2)} M dalam ${fmt(media, 1)} L air` },
            { name: 'Gliserol (plastisasi)', amount: `${fmt(t.glycerolMl, 0)} mL`, note: `${fmt(glycerol, 1)}% dalam ${fmt(media, 1)} L` },
          ]}
        />
      </div>

      <Wizard
        label="Tahap bioleather"
        testId="blt-wizard"
        steps={[
          {
            id: 'starter',
            tag: 'C1',
            title: 'Starter',
            body: (
              <>
                <p className="text-sm">
                  Pakai kultur <em>Komagataeibacter xylinus</em> terkarakterisasi (lab/koleksi kultur). Hindari bibit asal-asalan — dari 13 isolat usaha nata, hanya 1 yang benar A. xylinum (Karuni 2019).
                  Perbanyak statis di media air kelapa 5–7 hari; cairan di bawah lembar = starter cair.
                </p>
                <NumberField label="Dosis starter" unit="% v/v" min={1} max={50} value={starter} onValue={(v) => v && setStarter(v)} hint={`SOP ${paramText(b.starter_pct, 1)} · 15% → kuat tarik terbaik`} testId="blt-starter" />
                <Sources ids={b.starter_pct.sourceIds} confidence={b.starter_pct.confidence} />
              </>
            ),
          },
          {
            id: 'media',
            tag: 'C2',
            title: 'Media',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Gula" unit="g/L" min={0} max={300} value={sucrose} onValue={(v) => v !== undefined && setSucrose(v)} hint={`Optimum ${paramText(b.sucrose_g_l, 0)}`} testId="blt-sucrose" />
                  <Stat label="ZA" value={`${fmt(b.za_g_l.typ)} g/L`} sub="0,5% b/v" />
                  <Stat label="pH target" value={paramText(b.ph, 2)} sub="Atur dengan cuka setelah agak dingin" />
                </div>
                <p className="text-sm">Campur air kelapa + gula + ZA, didihkan / 75°C 15 menit, atur pH, tuang panas ke baki steril dangkal, tutup kain, dinginkan ≤30°C.</p>
                <Sources ids={[...b.sucrose_g_l.sourceIds, ...b.ph.sourceIds]} confidence={b.ph.confidence} />
              </>
            ),
          },
          {
            id: 'kultur',
            tag: 'C3',
            title: 'Kultur statis',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Lama kultur" unit="hari" integer min={1} max={60} value={days} onValue={(v) => v && setDays(v)} hint={`SOP ${paramText(b.culture_days, 0)} hari`} testId="blt-days" />
                  <Stat label="Suhu ruang" value={paramText(b.culture_temp_c, 0, '°C')} />
                  <Stat label="Target tebal basah" value={paramText(b.target_wet_thickness_mm, 0, 'mm')} />
                </div>
                <ChoiceGroup
                  legend="Cara panen"
                  columns={2}
                  value={harvest}
                  onChange={setHarvest}
                  options={[
                    { value: 'once', label: `Sekali panen (${fmt(b.wet_yield_g_l_day.min, 1)} g/L/hari)`, testId: 'blt-once' },
                    { value: 'weekly', label: `Panen tiap minggu + media baru (${fmt(b.wet_yield_g_l_day.max)} g/L/hari)`, testId: 'blt-weekly' },
                  ]}
                />
                <Note tone="warn" title="Jangan digoyang">
                  Baki tidak boleh dipindah/digoyang — lembar jadi berlapis & bakteri berhenti membentuk selulosa. Cek kontaminasi harian TANPA memindah; baki berkapang dibuang seluruhnya.
                </Note>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Lembar basah" value={rangeText({ min: r.min.wetSheetG, typ: t.wetSheetG, max: r.max.wetSheetG }, 0, 'g')} accent />
                  <Stat label="Luas permukaan" value={`${fmt((tray.count * tray.lengthCm * tray.widthCm) / 10000, 2)} m²`} sub="Luas lebih penting dari kedalaman" />
                </div>
                <Sources ids={b.wet_yield_g_l_day.sourceIds} confidence={b.wet_yield_g_l_day.confidence} />
              </>
            ),
          },
          {
            id: 'murni',
            tag: 'C4',
            title: 'Panen & pemurnian',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="NaOH" unit="M" min={0.01} max={2} value={naohM} onValue={(v) => v && setNaohM(v)} hint={`Maks ${fmt(NAOH_MAX_M, 1)} M (4 g/L)`} testId="blt-naoh" />
                  <Stat label="NaOH ditimbang" value={`${fmt(t.naohG, 1)} g`} sub={`dalam ${fmt(media, 1)} L air`} />
                  <Stat label="Proses" value="60–70°C · 1 jam" sub="lalu bilas 3 × 30 mnt, netralkan cuka ±0,5%" />
                </div>
                <Note tone="warn" title="K3 — NaOH korosif">
                  Face shield + kacamata rapat + sarung tangan nitril tebal + apron. Tuang NaOH ke air (bukan sebaliknya). Bilas sampai pH ±7.
                </Note>
                <Sources ids={b.naoh_m.sourceIds} confidence={b.naoh_m.confidence} />
              </>
            ),
          },
          {
            id: 'kulit',
            tag: 'C5',
            title: 'Jadi kulit',
            body: (
              <>
                <NumberField label="Gliserol (pilihan A)" unit="%" min={0} max={50} value={glycerol} onValue={(v) => v !== undefined && setGlycerol(v)} hint="Rendam 33 jam (Rathinamoorthy 2022)" testId="blt-glycerol" />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <caption className="label-mono mb-2 text-left">Pilihan plastisasi (uji di lembar 20 × 20 cm dulu)</caption>
                    <tbody>
                      <tr className="border-b-2 border-ink"><th className="p-2 text-left">A — lentur maksimal</th><td className="p-2">Gliserol 1%, 33 jam, kering 30°C</td></tr>
                      <tr className="border-b-2 border-ink"><th className="p-2 text-left">B — kuat & lentur</th><td className="p-2">Gliserol 30% dari berat BC (+ protein nabati) — riset lanjut</td></tr>
                      <tr><th className="p-2 text-left">C — cepat</th><td className="p-2">Gliserin : etanol 100 : 200 mL, 30 + 30 mnt, kering 60°C 24 jam</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-sm">
                  Kering di rangka {paramText(b.dry_temp_c, 0, '°C')} sampai berat konstan (1–5 hari). Pewarna alami: kulit bawang/delima + tawas, kopi + FeSO₄, atau secang. Finishing: karnauba + minyak 50:50 pada 75°C.
                  Hindari PU + DOP (ftalat).
                </p>
                <Sources ids={b.glycerol_pct.sourceIds} confidence={b.glycerol_pct.confidence} />
              </>
            ),
          },
          {
            id: 'qc',
            tag: 'C6',
            title: 'QC lembar',
            body: (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Kuat tarik" value={`≥ ${fmt(b.tensile_min_mpa.typ)} MPa`} sub="ISO 3376 (lab)" />
                  <Stat label="Uji lipat 180°" value={`≥ ${fmt(b.fold_min.typ)}×`} sub="tanpa retak" />
                  <Stat label="Tebal" value="±10%" sub="5 titik" />
                  <Stat label="Kering / basah" value={paramText({ ...b.dry_fraction_of_wet, min: b.dry_fraction_of_wet.min * 100, typ: b.dry_fraction_of_wet.typ * 100, max: b.dry_fraction_of_wet.max * 100 }, 1, '%')} />
                </div>
                <Note>Lembar dari mother cuka (BLT-M) = grade B sampai terbukti setara (≥5 batch dibandingkan). Umur simpan lembar jadi belum ada data — uji simpan RH 50/60/70% (GAP).</Note>
                <Sources ids={b.tensile_min_mpa.sourceIds} confidence={b.tensile_min_mpa.confidence} />
              </>
            ),
          },
        ]}
      />
      <WarningList warnings={out.warnings as CalcWarning[]} />
      <BioleatherMethods mediaL={media} cultureDays={days} areaCm2={tray.count * tray.lengthCm * tray.widthCm} />
    </div>
  );
}
