'use client';

import {
  copraFromNuts,
  dedupeWarnings,
  dryingCheck,
  gradeForMoisture,
  greenhouseCapacityNuts,
  splitDelayCheck,
  trialDesign,
  type CalcWarning,
} from '@gemas/calc-engine';
import { bundledProcessDataset } from '@gemas/dataset';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { SulfurPanel } from '@/components/chain/SulfurPanel';
import { fmt } from '@/lib/format';
import { BigResult, Bom, CalcError, Note, paramText, rangeText, safe, Sources, useFormula, Wizard } from './shared';

export function KopraFormula() {
  const f = useFormula();
  const k = f.kopra;
  const gradeList = f.raw.kopra.grades.map((g) => ({ id: g.id, nameId: g.name_id, moistureMaxPct: g.moisture_max_pct }));
  const loosestMaxPct = Math.max(...gradeList.map((g) => g.moistureMaxPct));
  const proc = bundledProcessDataset();

  // Desain uji (Tracker R&D Ronde 1)
  const [trial, setTrial] = useState({ kg: 20, kgPerNut: k.nut_dehusked_kg.typ, treatments: 4, replicates: 3, perRep: 2 });
  // Rendemen
  const [gradeId, setGradeId] = useState(f.raw.kopra.grades[0]!.id);
  // Pengeringan
  const [hours, setHours] = useState<number | undefined>(48);
  const [mcNow, setMcNow] = useState<number | undefined>();
  const [delay, setDelay] = useState<number | undefined>();
  // Grading
  const [mcAvg, setMcAvg] = useState<number | undefined>();

  const design = useMemo(
    () => safe(() => trialDesign({ treatments: trial.treatments, replicates: trial.replicates, nutsPerReplicate: trial.perRep, availableKg: trial.kg, kgPerNut: trial.kgPerNut, reserveMin: k.trial_reserve_min_nuts.typ })),
    [trial, k],
  );
  const nuts = design.ok ? Math.max(1, design.v.nutsAvailable) : 1;
  const grade = f.raw.kopra.grades.find((g) => g.id === gradeId)!;
  const yieldOut = useMemo(
    () =>
      safe(() =>
        copraFromNuts({
          nuts,
          meatPerNutKg: k.meat_per_nut_kg,
          meatMoisturePct: k.meatMoisturePct,
          targetMoisturePct: grade.moisture_max_pct,
          waterPerNutL: k.water_per_nut_l,
          datasetVersion: `formula.${f.version}`,
        }),
      ),
    [nuts, k, grade, f.version],
  );
  const capacity = greenhouseCapacityNuts(k.greenhouseArea, k.greenhouseHalves);
  const dry = hours !== undefined && mcNow !== undefined ? dryingCheck({ hours, moisturePct: mcNow, alarm24MaxPct: k.alarm_moisture_24h_max_pct.typ, alarm48MaxPct: k.alarm_moisture_48h_max_pct.typ }) : undefined;
  const split = delay !== undefined ? splitDelayCheck(delay, k.split_to_dryer_max_h.typ) : undefined;
  const decision = mcAvg !== undefined ? gradeForMoisture(mcAvg, gradeList, k.min_final_moisture_pct.typ) : undefined;
  const procDehusked = proc.origins.map((o) => ({ name: o.nameId, kg: o.wholeMassKg.typ * (1 - o.huskFraction.typ) }));

  const warnings: CalcWarning[] = dedupeWarnings([
    ...(yieldOut.ok ? (yieldOut.v.warnings as CalcWarning[]) : []),
    ...(dry?.warnings ?? []),
    ...(split?.warnings ?? []),
  ]);

  return (
    <div className="flex flex-col gap-5" data-testid="formula-kopra">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <NumberField label="Kelapa tersedia" unit="kg" min={0.5} max={1_000_000} value={trial.kg} onValue={(v) => v && setTrial((x) => ({ ...x, kg: v }))} testId="kopra-kg" />
        <NumberField label="Berat per butir (tanpa sabut)" unit="kg" min={0.1} max={5} value={trial.kgPerNut} onValue={(v) => v && setTrial((x) => ({ ...x, kgPerNut: v }))} hint="Timbang 10 butir" testId="kopra-kgnut" />
        <NumberField label="Perlakuan" unit="jenis" integer min={1} max={20} value={trial.treatments} onValue={(v) => v && setTrial((x) => ({ ...x, treatments: v }))} testId="kopra-treat" />
        <NumberField label="Ulangan" unit="×" integer min={1} max={20} value={trial.replicates} onValue={(v) => v && setTrial((x) => ({ ...x, replicates: v }))} testId="kopra-reps" />
        <NumberField label="Butir per ulangan" unit="butir" integer min={1} max={1000} value={trial.perRep} onValue={(v) => v && setTrial((x) => ({ ...x, perRep: v }))} testId="kopra-perrep" />
      </div>
      {design.ok ? (
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <BigResult
            label="BUTIR TERSEDIA vs DIPAKAI UJI"
            value={`${fmt(design.v.nutsAvailable)} / ${fmt(design.v.nutsNeeded)}`}
            unit="BUTIR"
            sub={
              design.v.status === 'ok'
                ? `Cadangan ${fmt(design.v.reserve)} butir — aman`
                : design.v.status === 'reserve_thin'
                  ? `Cadangan cuma ${fmt(design.v.reserve)} butir (saran ≥${fmt(k.trial_reserve_min_nuts.typ)}) — tambah kelapa`
                  : `KURANG ${fmt(-design.v.reserve)} butir — tambah kelapa atau kurangi ulangan`
            }
            testId="kopra-design"
          />
          {yieldOut.ok && (
            <Bom
              title="Perkiraan hasil dari semua butir"
              testId="kopra-bom"
              rows={[
                { name: 'Daging segar', amount: `${fmt(yieldOut.v.result.typ.meatKg, 1)} kg`, note: `${paramText(k.meat_per_nut_kg, 2, 'kg')}/butir` },
                { name: `Kopra ${grade.name_id} (KA ${fmt(grade.moisture_max_pct, 1)}%)`, amount: `${fmt(yieldOut.v.result.typ.copraKg, 1)} kg`, note: rangeText({ min: yieldOut.v.result.min.copraKg, typ: yieldOut.v.result.typ.copraKg, max: yieldOut.v.result.max.copraKg }, 1, 'kg') },
                { name: 'Air kelapa (untuk cuka/bioleather)', amount: `${fmt(yieldOut.v.result.typ.waterL, 1)} L` },
              ]}
            />
          )}
        </div>
      ) : (
        <CalcError message={design.message} />
      )}
      {design.ok && design.v.status !== 'ok' && (
        <Note tone="finding" title="Temuan validasi">
          Rencana R&D Ronde 1 (40 kg) mengklaim ±60 butir + 5 cadangan, padahal 40 ÷ 0,65 = 61 butir dan perlakuan 4 × 3 × 5 = 60 → cadangan hanya 1. Kalkulator ini menandai hal seperti itu otomatis.
        </Note>
      )}

      <Wizard
        label="Tahap R&D kopra"
        testId="kopra-wizard"
        steps={[
          {
            id: 'rendemen',
            tag: 'HASIL',
            title: 'Rendemen',
            body: (
              <>
                <ChoiceGroup
                  legend="Target grade"
                  columns={3}
                  value={gradeId}
                  onChange={setGradeId}
                  options={f.raw.kopra.grades.map((g) => ({ value: g.id, label: `${g.name_id} ≤${fmt(g.moisture_max_pct, 1)}%`, testId: `grade-${g.id}` }))}
                />
                {yieldOut.ok && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Kopra / daging" value={`${fmt(yieldOut.v.result.typ.copraPerMeat * 100, 1)}%`} sub="(1 − KA daging) ÷ (1 − KA kopra)" />
                    <Stat label="Kopra / 1.000 butir" value={`${fmt(yieldOut.v.result.typ.copraPer1000Nuts)} kg`} sub={`Acuan FAO/ILO ${paramText(k.copra_kg_per_1000_nuts, 0, 'kg')}`} accent testId="kopra-per1000" />
                    <Stat label="KA daging segar" value={paramText(k.meatMoisturePct, 0, '%')} sub="Dari dataset proses" />
                    <Stat label="Air kelapa" value={`${fmt(yieldOut.v.result.typ.waterL, 1)} L`} />
                  </div>
                )}
                <Note>
                  Berat butir tanpa sabut di tracker {fmt(k.nut_dehusked_kg.typ, 2)} kg; data Jambi (dataset proses):{' '}
                  {procDehusked.map((o) => `${o.name} ±${fmt(o.kg, 2)} kg`).join(' · ')}. Beda ±50% — timbang 10 butir per lot (K-09).
                </Note>
                <Sources ids={[...k.meat_per_nut_kg.sourceIds, ...k.copra_kg_per_1000_nuts.sourceIds]} confidence={k.meat_per_nut_kg.confidence} />
              </>
            ),
          },
          {
            id: 'kering',
            tag: 'D0–D5',
            title: 'Pengeringan',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Jeda belah → pengering" unit="jam" min={0} max={240} value={delay} onValue={setDelay} hint={`Maks ${fmt(k.split_to_dryer_max_h.typ)} jam (titik kritis)`} testId="kopra-delay" />
                  <NumberField label="Jam sejak masuk pengering" unit="jam" min={0} max={500} value={hours} onValue={setHours} testId="kopra-hours" />
                  <NumberField label="KA sekarang" unit="%" min={0} max={70} value={mcNow} onValue={setMcNow} hint={`≤${fmt(k.alarm_moisture_24h_max_pct.typ)}% @24 j · ≤${fmt(k.alarm_moisture_48h_max_pct.typ)}% @48 j`} testId="kopra-mcnow" />
                </div>
                {dry && (
                  <p className={`border-3 border-ink p-2 font-bold ${dry.onTrack ? 'bg-acid' : 'bg-safety'}`} data-testid="kopra-dry-status">
                    {dry.limitPct === undefined ? 'Belum 24 jam — pantau tiap 12 jam' : dry.onTrack ? `Sesuai jadwal (batas ${fmt(dry.limitPct)}%)` : `Ketinggalan jadwal — batas ${fmt(dry.limitPct)}%. Pindah sebagian ke oven.`}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm" data-testid="oven-profiles">
                    <caption className="label-mono mb-2 text-left">9 cara pengering — data IPB (Yani 2022)</caption>
                    <thead>
                      <tr className="bg-ink text-left font-mono text-[11px] text-paper">
                        <th className="p-2">CARA</th><th className="p-2">SUHU</th><th className="p-2">WAKTU</th><th className="p-2">KA AKHIR</th><th className="p-2">FFA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.raw.kopra.oven_profiles.map((o) => (
                        <tr key={o.id} className={`border-b-2 border-ink ${o.final_moisture_pct <= grade.moisture_max_pct ? '' : 'text-muted'}`}>
                          <th className="p-2 text-left">{o.name_id}</th>
                          <td className="p-2 font-mono">{fmt(o.temp_c)}°C</td>
                          <td className="p-2 font-mono">{fmt(o.hours, 1)} jam</td>
                          <td className="p-2 font-mono">{fmt(o.final_moisture_pct, 2)}%</td>
                          <td className="p-2 font-mono">{fmt(o.ffa_pct, 2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Suhu oven maks" value={`${fmt(k.oven_max_temp_c.typ)}°C`} sub={`Jangan > ${fmt(k.oven_max_temp_c.max)}°C (gosong, FFA naik)`} />
                  <Stat label="Greenhouse 3×10 m" value={`${fmt(capacity.min)}–${fmt(capacity.max)} butir`} sub={`${fmt(k.greenhouseArea.typ)} m² rak × ${paramText(k.greenhouseHalves, 0)} belahan/m²`} testId="kopra-gh" />
                  <Stat label="Siklus greenhouse" value={paramText(k.greenhouseCycleH, 0, 'jam')} />
                </div>
                <Sources ids={[...k.oven_max_temp_c.sourceIds, ...k.greenhouseCycleH.sourceIds]} confidence={k.greenhouseHalves.confidence} />
              </>
            ),
          },
          {
            id: 'belerang',
            tag: 'D3',
            title: 'Perlakuan sulfur',
            body: (
              <>
                <Note tone="warn" title="Tidak ada hitungan dosis" testId="kopra-sulfur-off">
                  Dosis sulfur untuk kopra edibel belum punya dasar resmi/primer, jadi kalkulator ini tidak menghitung dosis, jadwal malam, lama paparan, atau waktu masuk
                  kembali. Kalau kamu memakai perlakuan sulfur, catat apa adanya di log di bawah (tersimpan di perangkat, sama dengan log di Rantai → Pengeringan).
                </Note>
                <SulfurPanel />
              </>
            ),
          },
          {
            id: 'grade',
            tag: 'F',
            title: 'Grade & QC',
            body: (
              <>
                <NumberField label="KA rata-rata 10 sampel" unit="%" min={0} max={70} value={mcAvg} onValue={setMcAvg} hint="Moisture meter: atas-tengah-bawah rak" testId="kopra-mcavg" />
                {decision && (
                  <p className={`border-3 border-ink p-2 font-bold ${decision.kind === 'grade' ? 'bg-acid' : 'bg-safety'}`} data-testid="kopra-grade">
                    {decision.kind === 'grade' && `Grade ${decision.nameId}`}
                    {decision.kind === 're_dry' && `Belum ada grade — KA > ${fmt(loosestMaxPct, 1)}%, keringkan ulang`}
                    {decision.kind === 'too_dry' && `${decision.nameId}, tapi terlalu kering (< ${fmt(k.min_final_moisture_pct.typ, 1)}%) — kopra rapuh & bobot susut`}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm" data-testid="kopra-grades">
                    <caption className="label-mono mb-2 text-left">Spesifikasi grade (ICC; lab untuk minyak, FFA, aflatoksin)</caption>
                    <thead>
                      <tr className="bg-ink text-left font-mono text-[11px] text-paper">
                        <th className="p-2">GRADE</th><th className="p-2">KA MAKS</th><th className="p-2">MINYAK MIN</th><th className="p-2">FFA MAKS</th><th className="p-2">BENDA ASING</th><th className="p-2">AFLATOKSIN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.raw.kopra.grades.map((g) => (
                        <tr key={g.id} className="border-b-2 border-ink">
                          <th className="p-2 text-left">{g.name_id}</th>
                          <td className="p-2 font-mono">{fmt(g.moisture_max_pct, 1)}%</td>
                          <td className="p-2 font-mono">{fmt(g.oil_min_pct)}%</td>
                          <td className="p-2 font-mono">{fmt(g.ffa_max_pct)}%</td>
                          <td className="p-2 font-mono">{fmt(g.foreign_max_pct, 1)}%</td>
                          <td className="p-2 font-mono">≤{fmt(g.aflatoxin_max_ppb)} ppb</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Sources ids={f.raw.kopra.grades[0]!.source_ids} confidence="A" />
              </>
            ),
          },
        ]}
      />
      <WarningList warnings={warnings} />
    </div>
  );
}
