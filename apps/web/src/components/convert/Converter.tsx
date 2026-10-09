'use client';

import { correctMoisture, tradeInchToDiameterM, type QuantityUnit } from '@gemas/calc-engine';
import { getCommodity, getForm } from '@gemas/dataset';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ScenarioActions } from '@/components/scenario/ScenarioActions';
import { ConfidenceBadge } from '@/components/ui/badges';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { WarningList } from '@/components/ui/Warnings';
import { COMMODITY_UI, formLabel } from '@/lib/catalog';
import { defaultFormCode } from '@/lib/defaults';
import { fmt } from '@/lib/format';
import { runConvert, type ConvertState } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';
import { useUrlState } from '@/lib/useUrlState';
import { NestedStackTool } from './NestedStackTool';

const UNITS: QuantityUnit[] = ['pcs', 'pack', 'kg', 't', 'm3'];

export function Converter({ initial }: { initial?: ConvertState }) {
  const ds = useDataset();
  const [s, setS] = useState<ConvertState>(
    () =>
      initial ?? {
        kind: 'CONVERT',
        commodityId: 'kelapa_jambul',
        formCode: defaultFormCode(ds, 'kelapa_jambul'),
        from: { unit: 'pack', value: 100 },
        to: 'pcs',
      },
  );
  const form = getForm(ds, s.commodityId, s.formCode);
  const pieceUnit = COMMODITY_UI[s.commodityId]?.pieceUnit ?? 'butir';
  const label = (u: QuantityUnit) => ({ pcs: pieceUnit, pack: 'karung', kg: 'kg', t: 'ton', m3: 'm³' })[u];
  const hasPieces = !!(form.unitMassKey && form.params[form.unitMassKey]);
  const hasPack = form.packaging.length > 0;
  const enabled = (u: QuantityUnit) => (u === 'pcs' ? hasPieces : u === 'pack' ? hasPack : true);

  const result = useMemo(() => {
    try {
      return { ok: true as const, out: runConvert(ds, s) };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Gagal' };
    }
  }, [ds, s]);

  // `?s=` ↔ state (juga memulihkan tautan bagikan saat halaman disajikan dari cache offline).
  useUrlState('CONVERT', s, setS, !!initial);

  const pickCommodity = (id: string) => {
    const formCode = defaultFormCode(ds, id);
    const f = getForm(ds, id, formCode);
    const ok = (u: QuantityUnit) => (u === 'pcs' ? !!(f.unitMassKey && f.params[f.unitMassKey]) : u === 'pack' ? f.packaging.length > 0 : true);
    setS((p) => ({
      ...p,
      commodityId: id,
      formCode,
      from: ok(p.from.unit) ? p.from : { unit: 'kg', value: p.from.value },
      to: ok(p.to) ? p.to : 't',
    }));
  };

  // Alat cepat: spek dagang inch (keliling) & koreksi kadar air
  const [inch, setInch] = useState<number | undefined>(12);
  const [mc, setMc] = useState<{ m?: number; w1?: number; w2?: number }>({ m: 1000, w1: 15, w2: 6 });
  const moistureOut =
    mc.m !== undefined && mc.w1 !== undefined && mc.w2 !== undefined && mc.w1 < 100 && mc.w2 < 100
      ? correctMoisture(mc.m, mc.w1 / 100, mc.w2 / 100)
      : undefined;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">Konversi<br />Satuan</h1>
        </div>
        <span className="tag-mono -rotate-[1.5deg]">EXP-CONV // DATASET v{ds.version}</span>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <section className="card flex min-w-0 flex-[1_1_340px] flex-col gap-5" aria-label="Input konversi">
          <ChoiceGroup
            legend="01 / KOMODITAS"
            columns={2}
            value={s.commodityId}
            onChange={pickCommodity}
            options={ds.commodities.map((c) => ({ value: c.id, label: COMMODITY_UI[c.id]?.short ?? c.nameId }))}
          />
          <ChoiceGroup
            legend="02 / BENTUK"
            value={s.formCode}
            onChange={(formCode) => setS((p) => ({ ...p, formCode }))}
            options={getCommodity(ds, s.commodityId).forms.map((f) => ({
              value: f.code,
              label: formLabel(s.commodityId, f.code),
              aside: <ConfidenceBadge c={f.params.bulk_density!.confidence} />,
            }))}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="flex flex-col gap-2">
              <NumberField
                label="03 / DARI"
                value={s.from.value}
                min={0}
                onValue={(v) => setS((p) => ({ ...p, from: { ...p.from, value: v ?? 0 } }))}
                testId="conv-value"
              />
              <select aria-label="Satuan asal" className="field text-base" value={s.from.unit}
                onChange={(e) => setS((p) => ({ ...p, from: { ...p.from, unit: e.target.value as QuantityUnit } }))}>
                {UNITS.map((u) => <option key={u} value={u} disabled={!enabled(u)}>{label(u)}</option>)}
              </select>
            </div>
            <button type="button" aria-label="Tukar arah" className="btn-ghost px-3"
              onClick={() => setS((p) => ({ ...p, from: { unit: p.to, value: result.ok ? Number(result.out.result.typ.value.toFixed(4)) : p.from.value }, to: p.from.unit }))}>
              ⇄
            </button>
            <div className="flex flex-col gap-2">
              <span className="label-mono">04 / KE</span>
              <select aria-label="Satuan tujuan" className="field text-base" value={s.to}
                onChange={(e) => setS((p) => ({ ...p, to: e.target.value as QuantityUnit }))}>
                {UNITS.map((u) => <option key={u} value={u} disabled={!enabled(u)}>{label(u)}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-[2_1_420px] flex-col gap-6" aria-live="polite" aria-label="Hasil konversi">
          {result.ok ? (
            <>
              <div className="flex flex-col gap-3 border-3 border-ink bg-acid p-6 shadow-hard" data-testid="convert-result">
                <span className="font-mono text-[13px] font-bold tracking-[0.1em]">
                  {fmt(s.from.value, 2)} {label(s.from.unit).toUpperCase()} =
                </span>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-[56px] leading-[0.9]">{fmt(result.out.result.typ.value, s.to === 'pcs' || s.to === 'pack' ? 0 : 2)}</span>
                  <span className="font-mono text-lg font-bold">{label(s.to).toUpperCase()}</span>
                  <span className="ml-auto flex items-center gap-2"><ConfidenceBadge c={result.out.confidence} withText /><Hint k="confidence" /></span>
                </div>
                <span className="font-mono text-xs">
                  Rentang {fmt(result.out.result.min.value, 2)} – {fmt(result.out.result.max.value, 2)} {label(s.to)} <Hint k="range" />
                </span>
                <span className="font-mono text-[11px]">
                  Dipakai: {Object.entries(result.out.trace.params).map(([k, t]) => `${k} ${fmt(t.value.typ, 3)}`).join(' · ') || 'tanpa parameter (konversi pasti)'}
                </span>
              </div>
              <WarningList warnings={result.out.warnings.filter((w) => w.code === 'LOW_CONFIDENCE_PARAM')} />
              <ScenarioActions state={s} />
            </>
          ) : (
            <div role="alert" className="card"><h2 className="text-xl">Hmm, belum bisa dikonversi</h2><p className="mt-2">{result.message}</p></div>
          )}
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section className="card flex flex-col gap-3" aria-labelledby="inch-h">
          <h2 id="inch-h" className="text-xl">Spek dagang &quot;inch&quot; kelapa</h2>
          <p className="text-[13px]">Spek &quot;12–14 inch&quot; adalah <b>keliling</b>, bukan diameter (DEC-006).</p>
          <NumberField label="Keliling" unit="inch" value={inch} min={1} max={60} onValue={setInch} />
          {inch !== undefined && (
            <p className="font-mono text-sm font-bold" data-testid="inch-result">
              ≈ diameter {fmt(tradeInchToDiameterM(inch) * 100, 1)} cm · keliling {fmt(inch * 2.54, 1)} cm
            </p>
          )}
        </section>
        <section className="card flex flex-col gap-3" aria-labelledby="mc-h">
          <h2 id="mc-h" className="flex items-center gap-2 text-xl">Koreksi kadar air <Hint k="moisture" /></h2>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Berat" unit="kg" value={mc.m} min={0} onValue={(m) => setMc((p) => ({ ...p, m }))} testId="mc-mass" />
            <NumberField label="Air awal" unit="%" value={mc.w1} min={0} max={99} onValue={(w1) => setMc((p) => ({ ...p, w1 }))} testId="mc-w1" />
            <NumberField label="Air target" unit="%" value={mc.w2} min={0} max={99} onValue={(w2) => setMc((p) => ({ ...p, w2 }))} testId="mc-w2" />
          </div>
          {moistureOut !== undefined && (
            <p className="bg-acid p-2 font-mono text-sm font-bold" data-testid="mc-result">
              = {fmt(moistureOut, 2)} kg setelah dikeringkan
            </p>
          )}
        </section>
        <NestedStackTool />
      </div>
    </div>
  );
}
