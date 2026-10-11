'use client';

import { OverrideOutOfRangeError, type CalcMode } from '@gemas/calc-engine';
import { availableModes, getCommodity, getForm, type DatasetSI } from '@gemas/dataset';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { ScenarioActions } from '@/components/scenario/ScenarioActions';
import { CONTAINER_UI, COMMODITY_UI, FORM_UI, MODE_UI, PACK_UI, formLabel } from '@/lib/catalog';
import { defaultFormCode, defaultMode } from '@/lib/defaults';
import { cm, fmt } from '@/lib/format';
import { runContainer, type ContainerState } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';
import { useUrlState } from '@/lib/useUrlState';
import { ContainerResultView } from './ContainerResult';
import { GridStrip } from './GridStrip';
import { ContainerCircleSim } from '@/components/sim/ContainerCircleSim';
import { containerFtName, ftIn } from '@/lib/imperial';

const CUSTOM = 'CUSTOM';

export function initialContainerState(ds: DatasetSI, commodityId = ds.commodities[0]!.id): ContainerState {
  const formCode = defaultFormCode(ds, commodityId);
  return { kind: 'CONTAINER', commodityId, formCode, containerId: ds.containers[0]!.id, mode: defaultMode(ds, commodityId, formCode) };
}

type Computed =
  | { ok: true; out: ReturnType<typeof runContainer> }
  | { ok: false; field?: string; message: string };

function compute(ds: DatasetSI, s: ContainerState): Computed {
  try {
    return { ok: true, out: runContainer(ds, s) };
  } catch (e) {
    if (e instanceof OverrideOutOfRangeError) {
      return {
        ok: false,
        field: e.key,
        message: `Di luar rentang wajar (${fmt(e.accepted.min, 2)}–${fmt(e.accepted.max, 2)})`,
      };
    }
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghitung' };
  }
}

export function ContainerCalculator({ initial, startWizard }: { initial?: ContainerState; startWizard?: boolean }) {
  const ds = useDataset();
  const [s, setS] = useState<ContainerState>(() => initial ?? initialContainerState(ds));
  const [wizard, setWizard] = useState(!!startWizard);
  const [step, setStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(!!initial?.overrides || initial?.volumeUtil !== undefined);

  const commodity = getCommodity(ds, s.commodityId);
  const form = getForm(ds, s.commodityId, s.formCode);
  const modes = availableModes(form);
  const result = useMemo(() => compute(ds, s), [ds, s]);
  // Badge keyakinan per komoditas hanya bergantung pada dataset → hitung sekali.
  const defaultConfidence = useMemo(
    () => Object.fromEntries(ds.commodities.map((c) => [c.id, runContainer(ds, initialContainerState(ds, c.id)).confidence])),
    [ds],
  );
  const containerName = s.custom ? 'CUSTOM' : containerFtName(s.containerId!).toUpperCase();
  const title = `${(COMMODITY_UI[s.commodityId]?.short ?? commodity.nameId).toUpperCase()} @ ${containerName}`;
  const benchmarks = s.custom ? [] : form.benchmarks.filter((b) => b.containerId === s.containerId);

  // `?s=` ↔ state (juga memulihkan tautan bagikan saat halaman disajikan dari cache offline).
  useUrlState('CONTAINER', s, setS, !!initial);

  const pickCommodity = (id: string) => {
    const formCode = defaultFormCode(ds, id);
    setS((p) => ({ ...p, commodityId: id, formCode, mode: defaultMode(ds, id, formCode), overrides: undefined, volumeUtil: undefined, packagingIndex: undefined }));
  };
  const pickForm = (code: string) =>
    setS((p) => ({ ...p, formCode: code, mode: defaultMode(ds, p.commodityId, code), overrides: undefined, volumeUtil: undefined, packagingIndex: undefined }));
  const pickContainer = (id: string) =>
    setS((p) => {
      if (id === CUSTOM) {
        const base = ds.containers.find((c) => c.id === p.containerId) ?? ds.containers[0]!;
        const { containerId: _c, ...rest } = p;
        return { ...rest, custom: p.custom ?? { lengthM: base.L, widthM: base.W, heightM: base.H, payloadKg: base.payloadKg } };
      }
      const { custom: _x, ...rest } = p;
      return { ...rest, containerId: id };
    });
  const setOverride = (key: string, v: number | undefined) =>
    setS((p) => {
      const o = { ...(p.overrides ?? {}) };
      if (v === undefined) delete o[key];
      else o[key] = v;
      return { ...p, overrides: Object.keys(o).length ? o : undefined };
    });

  // ------------------------------------------------------------ bagian input (dipakai wizard & mode lengkap)
  const commodityChoices = (
    <ChoiceGroup
      legend="01 / KOMODITAS"
      value={s.commodityId}
      onChange={pickCommodity}
      options={ds.commodities.map((c) => {
        const conf = defaultConfidence[c.id]!;
        return {
          value: c.id,
          testId: `commodity-${c.id}`,
          label: COMMODITY_UI[c.id]?.short ?? c.nameId,
          aside: <ConfidenceBadge c={conf} />,
        };
      })}
    />
  );

  const formChoices = (
    <div className="flex flex-col gap-2">
      <ChoiceGroup
        legend="02 / BENTUK & KEMASAN"
        legendExtra={<Hint k="density" />}
        value={s.formCode}
        onChange={pickForm}
        options={commodity.forms.map((f) => ({
          value: f.code,
          testId: `form-${f.code}`,
          label: formLabel(s.commodityId, f.code),
          aside: <ConfidenceBadge c={f.params.bulk_density!.confidence} />,
        }))}
      />
      <p className="border-l-4 border-acid bg-paper px-3 py-2 text-[13px]">{FORM_UI[`${s.commodityId}.${s.formCode}`]?.hint}</p>
    </div>
  );

  const containerChoices = (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="label-mono mb-2.5">03 / CONTAINER</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[...ds.containers.map((c) => ({ id: c.id, sub: `${c.id} · ${fmt(c.volumeM3 ?? 0, 1)} m³` })), { id: CUSTOM, sub: 'ukuran sendiri' }].map((k) => {
            const on = k.id === (s.custom ? CUSTOM : s.containerId);
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={on}
                data-testid={`container-${k.id}`}
                title={CONTAINER_UI[k.id] ?? 'Truk, reefer, atau container lain'}
                onClick={() => pickContainer(k.id)}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 border-3 border-ink ${
                  on ? 'bg-ink text-acid shadow-[4px_4px_0_#F5A524]' : 'bg-surface'
                }`}
              >
                <span className="font-display text-lg">{k.id === CUSTOM ? 'CUSTOM' : containerFtName(k.id).replace(' High Cube', ' HC')}</span>
                <span className="font-mono text-[11px] font-semibold">{k.sub}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {!s.custom && (() => {
        const c = ds.containers.find((x) => x.id === s.containerId)!;
        return (
          <p className="font-mono text-xs" data-testid="container-ft">
            Ruang dalam: {ftIn(c.L)} × {ftIn(c.W)} × {ftIn(c.H)} · muatan maks {fmt(c.payloadKg)} kg
          </p>
        );
      })()}
      {s.custom && (
        <div className="grid grid-cols-2 gap-3 border-2 border-dashed border-ink p-3">
          <NumberField label="Panjang dalam" unit="cm" value={s.custom.lengthM * 100} min={1} max={2000}
            onValue={(v) => v && setS((p) => ({ ...p, custom: { ...p.custom!, lengthM: v / 100 } }))} />
          <NumberField label="Lebar dalam" unit="cm" value={s.custom.widthM * 100} min={1} max={500}
            onValue={(v) => v && setS((p) => ({ ...p, custom: { ...p.custom!, widthM: v / 100 } }))} />
          <NumberField label="Tinggi dalam" unit="cm" value={s.custom.heightM * 100} min={1} max={500}
            onValue={(v) => v && setS((p) => ({ ...p, custom: { ...p.custom!, heightM: v / 100 } }))} />
          <NumberField label="Muatan maks." unit="kg" value={s.custom.payloadKg} min={1} max={60000}
            hint="Termasuk batas berat truk/jalan bila lebih kecil (RSK-05)."
            onValue={(v) => v && setS((p) => ({ ...p, custom: { ...p.custom!, payloadKg: v } }))} />
        </div>
      )}
    </div>
  );

  const modeChoices = (
    <div className="flex flex-col gap-2">
      <ChoiceGroup
        legend="04 / CARA HITUNG"
        columns={3}
        value={s.mode}
        onChange={(m: CalcMode) => setS((p) => ({ ...p, mode: m }))}
        options={(['BULK', 'PIECE', 'PACKAGE'] as CalcMode[]).map((m) => ({
          value: m,
          testId: `mode-${m}`,
          label: MODE_UI[m].label,
          disabled: !modes.includes(m),
        }))}
      />
      <p className="text-[13px] text-muted">{MODE_UI[s.mode].hint}</p>
    </div>
  );

  const rho = form.params.bulk_density!;
  const unitMass = form.unitMassKey ? form.params[form.unitMassKey] : undefined;
  const pack = form.packaging[s.packagingIndex ?? 0];
  const utilDefault = form.volumeUtilDefault;
  const fieldErr = (key: string) => (!result.ok && result.field === key ? result.message : undefined);

  const paramBox = (
    <div className="flex flex-col gap-2 border-2 border-dashed border-ink p-3 font-mono text-xs" data-testid="param-box">
      <span className="font-bold tracking-[0.08em]">05 / PARAMETER (DATASET v{ds.version})</span>
      <span className="flex items-center gap-2">
        ρ efektif: {fmt(rho.typ)} kg/m³ ({fmt(rho.min)}–{fmt(rho.max)}) <ConfidenceBadge c={rho.confidence} />
      </span>
      {s.mode !== 'PACKAGE' && <span>Utilisasi ruang: {fmt(utilDefault * 100)}% <Hint k="util" /></span>}
      {unitMass && s.mode === 'PIECE' && (
        <span className="flex items-center gap-2">
          Berat per {COMMODITY_UI[s.commodityId]?.pieceUnit}: {fmt(unitMass.typ * 1000)} g ({fmt(unitMass.min * 1000)}–
          {fmt(unitMass.max * 1000)}) <ConfidenceBadge c={unitMass.confidence} />
        </span>
      )}
      {pack?.dims && (
        <span>
          Kemasan: {PACK_UI[pack.type] ?? pack.type} {fmt(pack.netKg.typ)} kg{pack.pcsPerPack ? ` / ${pack.pcsPerPack} ${COMMODITY_UI[s.commodityId]?.pieceUnit}` : ''} ·{' '}
          {cm(pack.dims.l)}×{cm(pack.dims.w)}×{cm(pack.dims.h)} cm
          {pack.dimsConfidence && <> <ConfidenceBadge c={pack.dimsConfidence} /></>}
        </span>
      )}
      {s.mode === 'PACKAGE' && form.packaging.filter((p) => p.dims).length > 1 && (
        <select
          aria-label="Pilih kemasan"
          className="field mt-1 text-sm"
          value={s.packagingIndex ?? 0}
          onChange={(e) => setS((p) => ({ ...p, packagingIndex: Number(e.target.value) }))}
        >
          {form.packaging.map((p, i) =>
            p.dims ? (
              <option key={i} value={i}>
                {PACK_UI[p.type] ?? p.type} · {fmt(p.netKg.typ)} kg
              </option>
            ) : null,
          )}
        </select>
      )}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        className="mt-1 self-start font-sans text-xs font-extrabold uppercase underline"
      >
        {showAdvanced ? '− Tutup' : '+ Ubah angka (hasil ukur sendiri)'}
      </button>
      {showAdvanced && (
        <div className="mt-1 grid gap-3 font-sans sm:grid-cols-2">
          {s.mode !== 'PACKAGE' && (
            <NumberField
              label={<>ρ efektif <Hint k="override" /></>}
              unit="kg/m³"
              testId="ovr-rho"
              value={s.overrides?.bulk_density}
              onValue={(v) => setOverride('bulk_density', v)}
              error={fieldErr('bulk_density')}
              hint={`Kosongkan untuk pakai dataset (${fmt(rho.typ)})`}
            />
          )}
          {unitMass && s.mode === 'PIECE' && (
            <NumberField
              label={`Berat per ${COMMODITY_UI[s.commodityId]?.pieceUnit}`}
              unit="g"
              testId="ovr-mass"
              value={s.overrides?.[form.unitMassKey!] !== undefined ? s.overrides[form.unitMassKey!]! * 1000 : undefined}
              onValue={(v) => setOverride(form.unitMassKey!, v === undefined ? undefined : v / 1000)}
              error={fieldErr(form.unitMassKey!)}
              hint={`Kosongkan untuk pakai dataset (${fmt(unitMass.typ * 1000)} g)`}
            />
          )}
          {s.mode !== 'PACKAGE' && (
            <NumberField
              label={<>Utilisasi ruang <Hint k="util" /></>}
              unit="%"
              testId="ovr-util"
              min={1}
              max={100}
              value={s.volumeUtil !== undefined ? s.volumeUtil * 100 : undefined}
              onValue={(v) => setS((p) => ({ ...p, volumeUtil: v === undefined ? undefined : v / 100 }))}
              hint={`Kosongkan untuk default (${fmt(utilDefault * 100)}%)`}
            />
          )}
        </div>
      )}
    </div>
  );

  const resultBlock = result.ok ? (
    <ContainerResultView out={result.out} mode={s.mode} commodityId={s.commodityId} title={title} benchmarks={benchmarks} compact={wizard} customContainer={!!s.custom} />
  ) : (
    <div role="alert" className="card border-safety">
      <h2 className="text-xl">Hmm, belum bisa dihitung</h2>
      <p className="mt-2">{result.field ? `Angka yang kamu ubah ${result.message.toLowerCase()}. Cek lagi, mungkin salah ketik.` : result.message}</p>
    </div>
  );

  // ------------------------------------------------------------ wizard
  const steps = [
    { title: 'Barang apa yang dimuat?', body: commodityChoices, tip: COMMODITY_UI[s.commodityId]?.blurb },
    { title: 'Bentuk & kemasannya?', body: formChoices, tip: 'Bentuknya ngaruh ke seberapa padat muatannya. Ragu? Pakai pilihan yang sudah terpilih — itu yang ada data pasarnya.' },
    { title: 'Container apa?', body: containerChoices, tip: '40 ft High Cube lebih tinggi dari 40 ft biasa. Barang ringan (kelapa, arang belah 2) untung di High Cube; barang padat cepat mentok beratnya.' },
    { title: 'Hasilnya', body: resultBlock, tip: 'Angka paling besar itu jawabannya. Label "Batas" kasih tahu apa yang habis duluan.' },
  ];

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">
            ← gemasSTUDIO / RINGKASAN
          </Link>
          <h1 className="text-[40px] sm:text-[52px]">
            Muat
            <br />
            Container
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className="tag-mono -rotate-[1.5deg]">EXP-CALC // DATASET v{ds.version}</span>
          <div role="group" aria-label="Tampilan" className="flex border-3 border-ink bg-surface">
            <button type="button" aria-pressed={wizard} data-testid="toggle-wizard"
              onClick={() => { setWizard(true); setStep(0); }}
              className={`min-h-touch px-4 text-sm font-extrabold uppercase ${wizard ? 'bg-acid' : ''}`}>
              Panduan
            </button>
            <button type="button" aria-pressed={!wizard} data-testid="toggle-full"
              onClick={() => setWizard(false)}
              className={`min-h-touch border-l-3 border-ink px-4 text-sm font-extrabold uppercase ${!wizard ? 'bg-acid' : ''}`}>
              Lengkap
            </button>
          </div>
        </div>
      </header>

      {wizard ? (
        <section aria-label="Panduan langkah demi langkah" className="flex flex-col gap-5" data-testid="wizard">
          <ol className="grid grid-cols-4 gap-1.5" aria-label="Langkah">
            {steps.map((st, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={`flex min-h-touch w-full flex-col items-start justify-center border-3 border-ink px-2 text-left ${
                    i === step ? 'bg-acid' : i < step ? 'bg-ink text-paper' : 'bg-surface'
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold">0{i + 1}</span>
                  <span className="hidden text-xs font-extrabold uppercase sm:block">{['Barang', 'Bentuk', 'Container', 'Hasil'][i]}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="card flex flex-col gap-5">
            <h2 className="text-[28px]">{steps[step]!.title}</h2>
            {steps[step]!.body}
            {steps[step]!.tip && (
              <p className="flex gap-2 bg-ink px-3 py-2 text-[13px] text-paper">
                <span className="font-mono font-bold text-acid">TIPS</span> {steps[step]!.tip}
              </p>
            )}
            <div className="flex flex-wrap justify-between gap-3">
              <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                ← Kembali
              </button>
              {step < steps.length - 1 ? (
                <button type="button" className="btn-primary" data-testid="wizard-next" onClick={() => setStep(step + 1)}>
                  Lanjut →
                </button>
              ) : (
                <button type="button" className="btn-acid" onClick={() => setWizard(false)}>
                  Lihat detail lengkap
                </button>
              )}
            </div>
          </div>
          {step === steps.length - 1 && <ScenarioActions state={s} />}
        </section>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-labelledby="in-h" className="card flex min-w-0 flex-[1_1_340px] flex-col gap-[22px]">
            <h2 id="in-h" className="text-[22px]">Input</h2>
            {commodityChoices}
            {formChoices}
            {containerChoices}
            {modeChoices}
            {paramBox}
          </section>
          <section aria-label="Hasil" className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
            {resultBlock}
            {result.ok && result.out.binding !== 'NONE' && (
              s.commodityId === 'kelapa_jambul' && s.mode !== 'BULK' && result.out.result.typ.pieces !== undefined ? (
                // Kelapa digambar sebagai lingkaran; kapasitas = isi penuh volume (pieces ÷ isi volume).
                <div className="card p-[18px]">
                  <ContainerCircleSim
                    containerId={s.custom ? 'CUSTOM' : s.containerId!}
                    innerM={s.custom ? { L: s.custom.lengthM, W: s.custom.widthM, H: s.custom.heightM } : (() => { const c = ds.containers.find((x) => x.id === s.containerId)!; return { L: c.L, W: c.W, H: c.H }; })()}
                    capacity={Math.round(result.out.result.typ.pieces / Math.max(result.out.result.typ.volumeFill, 1e-9))}
                    segments={[{ count: result.out.result.typ.pieces, label: 'Kelapa jambul', tone: 'acid' }]}
                  />
                </div>
              ) : (
                <GridStrip volumeFill={result.out.result.typ.volumeFill} weightFill={result.out.result.typ.weightFill} />
              )
            )}
            <ScenarioActions state={s} />
          </section>
        </div>
      )}
    </div>
  );
}
