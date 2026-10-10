'use client';

import { shiftPlan, type CalcWarning, type ShiftPlan } from '@gemas/calc-engine';
import { bundledProcessDataset } from '@gemas/dataset';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { buildLine, type LineId, type LineOptions } from '@/lib/productionLines';
import { BigResult, CalcError, Note, paramText, rangeText, safe, useFormula } from '@/components/formula/shared';

const LINES: { id: LineId; label: string }[] = [
  { id: 'kopra', label: 'Kopra edible' },
  { id: 'arang', label: 'Arang batok' },
  { id: 'briket', label: 'Briket' },
  { id: 'cuka', label: 'Cuka air kelapa' },
  { id: 'bioleather', label: 'Bioleather' },
];

export function ProductionPlanner() {
  const f = useFormula();
  const proc = bundledProcessDataset();
  const prod = f.production;
  const [lineId, setLineId] = useState<LineId>('kopra');
  const [opts, setOpts] = useState<LineOptions>({ dryer: 'oven', ovenProfileId: 'electric', kilnMethodId: f.arang.methods[0]!.id, kilnYield: 'reference', briquette: 'shisha', counts: {}, overrides: {} });
  const [shiftHours, setShiftHours] = useState(prod.shift_hours.typ);
  const [effPct, setEffPct] = useState(100);
  const [shiftsPerDay, setShiftsPerDay] = useState(1);
  const [daysPerWeek, setDaysPerWeek] = useState(prod.work_days_per_week.typ);
  const [target, setTarget] = useState<number>();

  const line = useMemo(() => buildLine(lineId, f, proc, opts), [lineId, f, proc, opts]);
  const usable = line.stations.filter((s) => !s.missing);
  const missing = line.stations.filter((s) => s.missing);
  const plan = useMemo(
    () =>
      usable.length
        ? safe<ShiftPlan>(() =>
            shiftPlan({ stations: usable, shiftHours, efficiency: effPct / 100, shiftsPerDay, ...(target && { targetProduct: target }), datasetVersion: `formula.${f.version}` }),
          )
        : ({ ok: false, message: 'Lengkapi kapasitas stasiun di bawah dulu' } as const),
    [usable, shiftHours, effPct, shiftsPerDay, target, f.version],
  );

  const setCount = (id: string, v: number | undefined) => setOpts((o) => ({ ...o, counts: { ...o.counts, [id]: v ?? 0 } }));
  const setOv = (id: string, k: 'rate' | 'batch' | 'cycleH', v: number | undefined) =>
    setOpts((o) => ({ ...o, overrides: { ...o.overrides, [id]: { ...o.overrides[id], [k]: v } } }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/formula" className="font-mono text-xs font-bold no-underline">← FORMULA R&amp;D</Link>
          <h1 className="text-[40px] sm:text-[52px]">Produksi<br />per Shift</h1>
          <p className="max-w-xl text-[15px]">
            Berapa yang bisa dibuat satu shift, tahap mana yang paling lambat, dan butuh berapa orang/mesin untuk mengejar target.
          </p>
        </div>
        <span className="tag-mono -rotate-[1.5deg]">EXP-SHIFT // DATA FORMULA v{f.version}</span>
      </header>

      <ChoiceGroup legend="Lini produksi" columns={3} value={lineId} onChange={setLineId} options={LINES.map((l) => ({ value: l.id, label: l.label, testId: `line-${l.id}` }))} />

      {lineId === 'kopra' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceGroup legend="Pengering" columns={2} value={opts.dryer ?? 'oven'} onChange={(v) => setOpts((o) => ({ ...o, dryer: v }))}
            options={[{ value: 'oven', label: 'Oven', testId: 'dryer-oven' }, { value: 'greenhouse', label: 'Greenhouse', testId: 'dryer-greenhouse' }]} />
          {opts.dryer !== 'greenhouse' && (
            <ChoiceGroup legend="Tipe oven (data IPB)" columns={1} value={opts.ovenProfileId ?? 'electric'} onChange={(v) => setOpts((o) => ({ ...o, ovenProfileId: v }))}
              options={f.raw.kopra.oven_profiles.filter((p) => p.batch_kg).map((p) => ({ value: p.id, label: `${p.name_id} · ${fmt(p.hours, 1)} jam` }))} />
          )}
        </div>
      )}
      {lineId === 'arang' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceGroup legend="Metode" columns={1} value={opts.kilnMethodId ?? ''} onChange={(v) => setOpts((o) => ({ ...o, kilnMethodId: v }))} options={f.arang.methods.map((m) => ({ value: m.id, label: m.nameId }))} />
          <ChoiceGroup legend="Rendemen" columns={1} value={opts.kilnYield ?? 'reference'} onChange={(v) => setOpts((o) => ({ ...o, kilnYield: v }))}
            options={[{ value: 'reference', label: `Acuan ${paramText(f.arang.yield_reference_pct, 0, '%')}` }, { value: 'kora', label: `KORA saat ini ±${fmt(f.arang.yield_kora_actual_pct.typ)}%` }]} />
        </div>
      )}
      {lineId === 'briket' && (
        <ChoiceGroup legend="Varian" columns={3} value={opts.briquette ?? 'shisha'} onChange={(v) => setOpts((o) => ({ ...o, briquette: v }))} options={f.briket.variants.map((v) => ({ value: v.id, label: v.name_id }))} />
      )}

      <section aria-label="Pengaturan shift" className="card grid grid-cols-2 gap-3 sm:grid-cols-5">
        <NumberField label="Jam per shift" unit="jam" min={1} max={12} value={shiftHours} onValue={(v) => v && setShiftHours(v)} hint={`UU 13/2003: ${paramText(prod.shift_hours, 0)} jam/hari`} testId="shift-hours" />
        <NumberField label={<>Efisiensi <Hint k="shift" /></>} unit="%" min={10} max={100} value={effPct} onValue={(v) => v && setEffPct(v)} hint="100% = tanpa potongan; ukur sendiri" testId="shift-eff" />
        <NumberField label="Shift per hari" unit="shift" integer min={1} max={3} value={shiftsPerDay} onValue={(v) => v && setShiftsPerDay(v)} testId="shift-perday" />
        <NumberField label="Hari kerja / minggu" unit="hari" integer min={1} max={7} value={daysPerWeek} onValue={(v) => v && setDaysPerWeek(v)} hint="5 atau 6 (UU 13/2003)" />
        <NumberField label="Target per shift" unit={line.productUnit} min={0} max={10_000_000} value={target} onValue={setTarget} hint="Opsional — hitung kebutuhan orang/mesin" testId="shift-target" />
      </section>

      <section aria-label="Stasiun" className="flex flex-col gap-3">
        <h2 className="text-2xl">Stasiun di lini {line.nameId}</h2>
        {line.stations.map((s) => (
          <div key={s.id} className={`card grid gap-3 p-[16px] sm:grid-cols-[1.4fr_repeat(3,1fr)] ${s.missing ? 'border-safety' : ''}`} data-testid={`station-${s.id}`}>
            <div className="flex flex-col gap-1">
              <span className="label-mono">{s.kind === 'manual' ? 'MANUAL' : s.kind === 'machine' ? 'MESIN' : 'BATCH'}</span>
              <h3 className="text-lg">{s.nameId}</h3>
              {s.note && <p className="text-[12px] text-muted">{s.note}</p>}
              {s.missing && <p className="bg-safety px-1 text-[13px] font-bold" role="note">{s.missing}</p>}
            </div>
            <NumberField label={s.kind === 'manual' ? 'Orang' : 'Unit'} unit={s.kind === 'manual' ? 'org' : 'unit'} integer min={0} max={1000} value={s.count} onValue={(v) => setCount(s.id, v)} testId={`count-${s.id}`} />
            {s.kind !== 'batch' ? (
              <NumberField
                label={`Laju per ${s.kind === 'manual' ? 'orang' : 'unit'}`}
                unit={`${s.unitLabel}/jam`}
                min={0.01}
                max={100000}
                value={opts.overrides[s.id]?.rate}
                onValue={(v) => setOv(s.id, 'rate', v)}
                hint={s.rate && s.rate.typ > 0 ? `Kosong = ${paramText(s.rate, 0)}` : 'Wajib diisi'}
                testId={`rate-${s.id}`}
              />
            ) : (
              <NumberField
                label="Isi per angkatan"
                unit={s.unitLabel}
                min={0.01}
                max={10_000_000}
                value={opts.overrides[s.id]?.batch}
                onValue={(v) => setOv(s.id, 'batch', v)}
                hint={s.batchSize && s.batchSize.typ > 0 ? `Kosong = ${paramText(s.batchSize, 0)}` : 'Wajib diisi'}
                testId={`batch-${s.id}`}
              />
            )}
            {s.kind === 'batch' ? (
              <NumberField label="Siklus" unit="jam" min={0.1} max={10000} value={opts.overrides[s.id]?.cycleH} onValue={(v) => setOv(s.id, 'cycleH', v)} hint={s.cycleH ? `Kosong = ${paramText(s.cycleH, 0)}` : undefined} testId={`cycle-${s.id}`} />
            ) : (
              <Stat label="Konversi" value={`${fmt(s.toProduct.typ, s.toProduct.typ < 1 ? 3 : 1)}`} sub={`${line.productUnit} per ${s.unitLabel}`} />
            )}
          </div>
        ))}
      </section>

      {!plan.ok ? (
        <CalcError message={plan.message} />
      ) : (
        <PlanResult plan={plan.v} line={line} shiftsPerDay={shiftsPerDay} daysPerWeek={daysPerWeek} target={target} missing={missing.map((m) => m.nameId)} />
      )}
    </div>
  );
}

function PlanResult({ plan, line, shiftsPerDay, daysPerWeek, target, missing }: { plan: ShiftPlan; line: ReturnType<typeof buildLine>; shiftsPerDay: number; daysPerWeek: number; target?: number; missing: string[] }) {
  const bottleneck = plan.stations.find((s) => s.id === plan.bottleneckId)!;
  const digits = plan.output.typ < 10 ? 2 : plan.output.typ < 100 ? 1 : 0;
  return (
    <section aria-label="Hasil rencana" className="flex flex-col gap-4" data-testid="shift-result">
      {missing.length > 0 && (
        <Note tone="warn" title="Belum lengkap">Stasiun {missing.join(', ')} belum dihitung — hasil di bawah bisa terlalu tinggi.</Note>
      )}
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <BigResult
          label="HASIL PER SHIFT"
          value={fmt(plan.output.typ, digits)}
          unit={line.productUnit.toUpperCase()}
          sub={`${rangeText(plan.output, digits)} · per hari ${fmt(plan.output.typ * shiftsPerDay, digits)} · per minggu ${fmt(plan.output.typ * shiftsPerDay * daysPerWeek, digits)}`}
          confidence={plan.confidence}
          testId="shift-output"
        />
        <div className="card-ink flex flex-col gap-2" data-testid="bottleneck">
          <span className="tag-mono self-start">STASIUN PEMBATAS <Hint k="pembatas" /></span>
          <p className="text-2xl font-extrabold uppercase">{bottleneck.nameId}</p>
          <p className="text-sm">Tambah orang/mesin di sini dulu — tahap lain masih punya sisa kapasitas.</p>
          {target !== undefined && bottleneck.neededCount !== undefined && (
            <p className="font-mono text-sm">
              Untuk {fmt(target)} {line.productUnit}: butuh {fmt(bottleneck.neededCount)} {bottleneck.kind === 'manual' ? 'orang' : 'unit'} (sekarang {fmt(bottleneck.count)}).
            </p>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm" data-testid="station-table">
          <thead>
            <tr className="bg-ink text-left font-mono text-[11px] text-paper">
              <th className="p-2">STASIUN</th>
              <th className="p-2">KAPASITAS / SHIFT</th>
              <th className="p-2">TERPAKAI</th>
              {target !== undefined && <th className="p-2">BUTUH UNTUK TARGET</th>}
            </tr>
          </thead>
          <tbody>
            {plan.stations.map((s) => (
              <tr key={s.id} className={`border-b-2 border-ink ${s.id === plan.bottleneckId ? 'bg-acid' : ''}`}>
                <th className="p-2 text-left">{s.nameId}</th>
                <td className="p-2 font-mono">
                  {fmt(s.capacity.typ, digits)} {line.productUnit}
                  <span className="block text-[11px]">{fmt(s.stationUnits.typ, 0)} {s.unitLabel}</span>
                </td>
                <td className="p-2">
                  <div className="bar w-full max-w-[160px]" role="img" aria-label={`Terpakai ${fmt(s.utilization * 100)}%`}>
                    <div className="h-full bg-ink" style={{ width: `${Math.min(100, s.utilization * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[11px]">{fmt(s.utilization * 100)}%</span>
                </td>
                {target !== undefined && (
                  <td className="p-2 font-mono" data-testid={`need-${s.id}`}>
                    {s.neededCount !== undefined ? `${fmt(s.neededCount)} ${s.kind === 'manual' ? 'org' : 'unit'}` : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-2 font-mono text-[11px] text-muted">
        <ConfidenceBadge c={plan.confidence} /> Laju kerja manual masih C (rentang lebar) — catat waktu kerja 2 minggu (time study) lalu isi lajunya di atas.
      </p>
      <WarningList warnings={plan.warnings as CalcWarning[]} />
    </section>
  );
}
