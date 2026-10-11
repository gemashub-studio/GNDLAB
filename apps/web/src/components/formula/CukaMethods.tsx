'use client';

import { naturalVinegarPotential, vinegarMethodPlan, type Range } from '@gemas/calc-engine';
import type { MethodSI, VinegarMethodRaw } from '@gemas/dataset';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { StepFlow, type FlowStep, type PictoName } from '@/components/ui/StepFlow';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { Note, paramText, safe, Sources, useFormula } from './shared';

type Horizon = '30' | '90' | '365';
const HORIZON_TEXT: Record<Horizon, string> = { '30': '1 bulan', '90': '3 bulan', '365': '1 tahun' };

/** Langkah kerja khusus tiap metode (dari sumber metode di dataset). */
function steps(m: MethodSI<VinegarMethodRaw>, tempText: string): FlowStep[] {
  const st = (icon: PictoName, text: string): FlowStep => ({ icon, text });
  const f = m.p.withdraw_fraction;
  const pct = f ? `${fmt(f.min * 100, 0)}–${fmt(f.max * 100, 0)}%` : '';
  switch (m.id) {
    case 'statis':
      return [
        st('cover', 'Cairan alkohol (B2) disaring ke wadah ⅔–¾ penuh, tambah starter cuka hidup, tutup kain rapat.'),
        st('thermo', `Diamkan ${tempText} — JANGAN diaduk (mother tenggelam/pecah). Titrasi tiap minggu.`),
        st('tap', 'Asam ≥4% → angkat mother (bahan bioleather BLT-M / starter), tarik semua cuka ke klarifikasi.'),
      ];
    case 'semikontinu':
      return [
        st('vessel', 'Siklus pertama sama dengan statis sampai asam ≥4%.'),
        st('tap', `Tarik ${pct} volume lewat keran bawah (mother tetap utuh di permukaan); sisanya = starter siklus berikut.`),
        st('drop', 'Isi ulang pelan dengan cairan alkohol baru sebanyak yang ditarik — tuang lewat tepi/selang agar mother tidak pecah.'),
        st('burette', 'Titrasi tiap tarikan; bila keasaman sisa turun atau ada bau busuk, hentikan siklus & mulai ulang dari statis.'),
      ];
    case 'generator':
      return [
        st('cob', 'Isi tabung acetifier dengan tongkol jagung/serutan kayu bersih; rendam dengan mother vinegar (cuka hidup) sampai basah merata.'),
        st('drop', 'Teteskan cairan alkohol dari atas (alat penetes), tampung di bak bawah, ulangi (sirkulasi). Udara masuk lewat lubang bawah.'),
        st('clock', `Run kondisi ${paramText(m.p.startup_runs!, 0)}× sampai bakteri menempel; setelahnya ±${paramText(m.p.acetify_h!, 0)} jam per run ke ≥4%.`),
        st('burette', 'Titrasi tiap run; jaga suhu cairan keluar; bersihkan & ganti isian bila berlendir/berbau.'),
      ];
    case 'aerasi':
      return [
        st('bubbles', 'Tangki food-grade dengan difuser (batu aerator) & pompa udara food-grade; tutup berkasa.'),
        st('thermo', `Isi cairan alkohol + starter cuka hidup, aerasi terus-menerus, suhu ${tempText}.`),
        st('burette', `Tiap ${paramText(m.p.acetify_d!, 0)} hari: titrasi; bila ≥4% tarik ${pct} volume, isi ulang cairan alkohol baru.`),
        st('shield', 'Aerasi jangan berlebihan (alkohol ikut menguap → rendemen turun); catat busa & bau.'),
      ];
    default:
      return [st('check', 'Hanya sebagai KONTROL R&D: air kelapa tanpa gula difermentasi seperti metode statis untuk membuktikan keasamannya di bawah standar.')];
  }
}

export function CukaMethods({ acetifyL, aceticPct, waterL, starterPct }: { acetifyL: number; aceticPct: Range; waterL: number; starterPct: number }) {
  const f = useFormula();
  const c = f.cuka;
  const [id, setId] = useState(c.methods[0]!.id);
  const [workingL, setWorkingL] = useState<number | undefined>(Math.round(acetifyL));
  const [horizon, setHorizon] = useState<Horizon>('90');
  const m = c.methods.find((x) => x.id === id)!;

  const natural = useMemo(
    () =>
      safe(() =>
        naturalVinegarPotential({
          waterL,
          density: c.water_density_kg_l,
          naturalSugarPct: c.water_sugar_pct,
          ethanolEfficiency: c.ethanol_efficiency,
          aceticEfficiency: c.acetic_efficiency,
          starterPct,
          aceticMinPct: c.acetic_min_pct.typ,
          datasetVersion: `formula.${f.version}`,
        }),
      ),
    [waterL, starterPct, c, f.version],
  );

  const rows = useMemo(
    () =>
      c.methods.map((x) => {
        const plan = workingL
          ? safe(() =>
              vinegarMethodPlan({
                kind: x.kind,
                workingL,
                ...(x.p.acetify_d && { acetifyDays: x.p.acetify_d }),
                ...(x.p.acetify_h && { acetifyHours: x.p.acetify_h }),
                ...(x.p.withdraw_fraction && { withdrawFraction: x.p.withdraw_fraction }),
                ...(x.p.startup_runs && { startupRuns: x.p.startup_runs }),
                alcoholDays: c.alcohol_days,
                horizonDays: Number(horizon),
                datasetVersion: `formula.${f.version}`,
              }),
            )
          : undefined;
        const acid: Range | undefined = x.id === 'alami' ? (natural.ok ? { min: natural.v.result.min.aceticPotentialPct, typ: natural.v.result.typ.aceticPotentialPct, max: natural.v.result.max.aceticPotentialPct } : undefined) : aceticPct;
        return { x, plan, acid };
      }),
    [c, workingL, horizon, natural, aceticPct, f.version],
  );
  const sel = rows.find((r) => r.x.id === id)!;
  const tempText = `${paramText(c.acetify_temp_c, 0)} °C`;
  const minAcid = c.acetic_min_pct.typ;

  return (
    <section className="card flex flex-col gap-4" aria-label="Metode cuka" data-testid="cuka-methods">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xl">Bandingkan metode asetifikasi</h3>
        <span className="tag-mono">R&amp;D · {c.methods.length} METODE</span>
      </div>
      <p className="text-sm">
        Semua metode (kecuali kontrol tanpa gula) memakai cairan alkohol yang sama dari tahap B1–B2 di atas. Yang berbeda: cara mengubah alkohol → asam asetat, lamanya, dan berapa liter cuka yang bisa ditarik.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Volume kerja wadah / tangki" unit="L" min={1} max={1_000_000} value={workingL} onValue={setWorkingL} hint="Generator: volume cairan per run" testId="cm-volume" />
        <ChoiceGroup<Horizon>
          legend="Hitung keluaran selama"
          columns={3}
          value={horizon}
          onChange={setHorizon}
          options={(Object.keys(HORIZON_TEXT) as Horizon[]).map((h) => ({ value: h, label: HORIZON_TEXT[h], testId: `cm-h-${h}` }))}
        />
      </div>

      <div className="overflow-x-auto border-3 border-ink" data-testid="cm-table">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-ink text-acid">
            <tr className="font-mono text-[11px] uppercase">
              <th className="p-2 text-left">Metode</th>
              <th className="p-2 text-left">Cuka pertama</th>
              <th className="p-2 text-left">Siklus</th>
              <th className="p-2 text-left">L / siklus</th>
              <th className="p-2 text-left">L / {HORIZON_TEXT[horizon]}</th>
              <th className="p-2 text-left">Asam asetat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ x, plan, acid }) => {
              const p = plan?.ok ? plan.v.result : undefined;
              const pass = acid ? acid.typ >= minAcid : undefined;
              return (
                <tr key={x.id} className={`border-t-2 border-ink ${x.id === id ? 'bg-acid' : 'bg-surface'}`} data-testid={`cm-row-${x.id}`}>
                  <td className="p-2">
                    <button type="button" className="text-left font-bold underline" onClick={() => setId(x.id)} data-testid={`cm-pick-${x.id}`}>
                      {x.name_id}
                    </button>
                  </td>
                  <td className="p-2">{p ? `±${fmt(p.typ.firstVinegarDays, 0)} hari` : '—'}</td>
                  <td className="p-2">{p ? (p.typ.cycleDays < 2 ? `${fmt(p.typ.cycleDays * 24, 0)} jam` : `${fmt(p.typ.cycleDays, 0)} hari`) : '—'}</td>
                  <td className="p-2">{p ? fmt(p.typ.perCycleL, 0) : '—'}</td>
                  <td className="p-2 font-bold" data-testid={`cm-liters-${x.id}`}>{p ? fmt(p.typ.litersInHorizon, 0) : '—'}</td>
                  <td className="p-2">
                    {acid ? (
                      <span className={`px-1 font-bold ${pass ? 'bg-acid' : 'bg-safety'}`} data-testid={`cm-acid-${x.id}`}>
                        {fmt(acid.typ, 1)}% {pass ? '✓' : '✗'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[11px] text-muted">
        Asam asetat = potensi dari must di atas (sama untuk semua metode; generator/aerasi bisa sedikit lebih rendah karena alkohol menguap). Batas minimum {fmt(minAcid, 0)}%. Waktu & fraksi tarik dari sumber tiap metode. Liter per periode menganggap cairan alkohol baru selalu siap (kebutuhan alkohol ≈ liter cuka ditarik); metode statis di sini sudah memakai starter cuka hidup.
      </p>

      <div className="flex flex-col gap-4" data-testid="cm-detail">
        <div className="flex flex-col gap-2">
          <h4 className="text-xl">{m.name_id}</h4>
          <div className="grid grid-cols-2 gap-2">
            {m.p.acetify_d && <Stat label="Asetifikasi / siklus" value={`${paramText(m.p.acetify_d, 0)} hari`} />}
            {m.p.acetify_h && <Stat label="Per run" value={`${paramText(m.p.acetify_h, 0)} jam`} />}
            {m.p.withdraw_fraction && (
              <Stat
                label="Ditarik / siklus"
                value={m.p.withdraw_fraction.min === m.p.withdraw_fraction.max ? `${fmt(m.p.withdraw_fraction.typ * 100, 0)}%` : `${fmt(m.p.withdraw_fraction.min * 100, 0)}–${fmt(m.p.withdraw_fraction.max * 100, 0)}%`}
              />
            )}
            {m.p.startup_runs && <Stat label="Run kondisi awal" value={paramText(m.p.startup_runs, 0)} />}
            <Stat label="Suhu" value={tempText} />
          </div>
          <p className="text-sm"><strong>Alat:</strong> {m.equipment}</p>
          <p className="text-sm"><strong>Plus:</strong> {m.pros}</p>
          <p className="text-sm"><strong>Minus:</strong> {m.cons}</p>
          <Sources ids={m.source_ids} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] font-bold uppercase">Langkah kerja metode</p>
          <StepFlow steps={steps(m, tempText)} testId="cm-steps" />
          {sel.plan && !sel.plan.ok && <p className="bg-safety p-2 text-sm font-bold">{sel.plan.message}</p>}
          {m.id === 'alami' && natural.ok && <WarningList warnings={natural.v.warnings} />}
        </div>
      </div>
      <Note title="Ceklis R&D">
        Uji banding metode pakai <Link href="/ceklis?id=rnd-cuka-metode" data-testid="cm-checklist">Ceklis R&amp;D → Uji banding metode cuka</Link> — satu must dibagi ke semua metode supaya hasilnya adil.
      </Note>
    </section>
  );
}
