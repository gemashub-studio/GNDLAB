'use client';

import { containerCapacity, processChain, type CalcWarning, type ProcessOutput } from '@gemas/calc-engine';
import {
  buildContainerInput,
  buildProcessInput,
  bundledProcessDataset,
  getForm,
  type ProcessScenario,
  type ProductTarget,
} from '@gemas/dataset';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt, fmtMass } from '@/lib/format';
import { useDataset } from '@/lib/useDataset';
import { CoconutLoadSim } from './CoconutLoadSim';

/** Jam → teks santai: < 48 jam ditulis jam, selebihnya hari. */
export const fmtDuration = (h: number) => (h < 48 ? `${fmt(h)} jam` : `${fmt(h / 24, 1)} hari`);

const STEPS = [
  { n: '01', id: 'masuk', title: 'Kelapa masuk', tag: 'LOADING' },
  { n: '02', id: 'kupas', title: 'Kupas sabut', tag: 'DEHUSK' },
  { n: '03', id: 'belah', title: 'Belah', tag: 'SPLIT' },
  { n: '04', id: 'jemur', title: 'Jemur di rak', tag: 'DRY' },
  { n: '05', id: 'cungkil', title: 'Cungkil & kumpulkan batok', tag: 'SCOOP' },
  { n: '06', id: 'jadi', title: 'Produk jadi', tag: 'OUTPUT' },
] as const;

const METHOD_TIPS: Record<string, string> = {
  sun: 'Paling murah, tapi tergantung cuaca. Kalau hujan, angkat & tutup — hari jemurnya bertambah.',
  greenhouse: 'Terlindung hujan & debu, kira-kira 2× lebih cepat dari jemur biasa. Kopra lebih bersih.',
  oven: 'Paling cepat & tidak tergantung cuaca. Butuh bahan bakar (batok/sabut bisa dipakai).',
};

const PRODUCT_FORM: Record<ProductTarget, { formCode: string; mode: 'BULK' | 'PACKAGE' }> = {
  kopra_edible: { formCode: 'bagged', mode: 'PACKAGE' },
  kopra_asalan: { formCode: 'bagged_jute', mode: 'BULK' },
};

export function ProcessCalculator() {
  const inv = useDataset();
  const p = bundledProcessDataset();
  const [lots, setLots] = useState<Record<string, number>>({ dataran_rendah: 5000, dataran_tinggi: 2000 });
  const [product, setProduct] = useState<ProductTarget>('kopra_edible');
  const [methodId, setMethodId] = useState('sun');
  const [rack, setRack] = useState({ tierAreaM2: 2, tiers: 5, racksAvailable: 10 as number | undefined });
  const [halvesOverride, setHalvesOverride] = useState<number>();
  const [drums, setDrums] = useState(2);
  const [step, setStep] = useState<(typeof STEPS)[number]['id']>('masuk');

  const scenario = (m: string): ProcessScenario => ({
    lots,
    product,
    drying: {
      methodId: m,
      tierAreaM2: rack.tierAreaM2,
      tiers: rack.tiers,
      ...(rack.racksAvailable && { racksAvailable: rack.racksAvailable }),
      ...(halvesOverride && { halvesPerM2: halvesOverride }),
    },
    charcoal: { drums },
  });

  const calc = useMemo(() => {
    try {
      const out = processChain(buildProcessInput(inv, p, scenario(methodId)));
      const compare = p.dryingMethods.map((m) => ({ m, out: processChain(buildProcessInput(inv, p, scenario(m.id))) }));
      return { ok: true as const, out, compare };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Gagal menghitung' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv, p, lots, product, methodId, rack, halvesOverride, drums]);

  const origin = (id: string) => p.origins.find((o) => o.id === id)!;
  const method = p.dryingMethods.find((m) => m.id === methodId)!;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">Alur<br />Proses</h1>
          <p className="max-w-xl text-[15px]">
            Dari kelapa bulat masuk gudang sampai jadi kopra & arang. Isi jumlah kelapanya, sisanya biar aplikasi yang hitung.
          </p>
        </div>
        <span className="tag-mono -rotate-[1.5deg]">EXP-PROSES // DATA PROSES v{p.version}</span>
      </header>

      {/* Kelapa masuk per asal */}
      <section aria-label="Kelapa masuk per asal" className="grid gap-5 md:grid-cols-2">
        {p.origins.map((o) => (
          <div key={o.id} className="card flex flex-col gap-3 p-[18px]" data-testid={`lot-${o.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="tag-mono">{o.altitude.max ? `≤ ${fmt(o.altitude.max)} M DPL` : `> ${fmt(o.altitude.min ?? 0)} M DPL`}</span>
                <h2 className="mt-2 text-2xl">{o.nameId}</h2>
              </div>
              <ConfidenceBadge c={o.wholeMassKg.confidence} tilt />
            </div>
            <NumberField
              label="Jumlah kelapa bulat (bersabut)"
              unit="butir"
              integer
              min={0}
              max={10_000_000}
              value={lots[o.id]}
              onValue={(v) => setLots((x) => ({ ...x, [o.id]: v ?? 0 }))}
              testId={`nuts-${o.id}`}
            />
            <p className="font-mono text-xs">
              Rata-rata {fmt(o.wholeMassKg.typ, 2)} kg/butir · sabut ±{fmt(o.huskFraction.typ * 100)}%
            </p>
            {o.note && <p className="text-[12px] text-muted">{o.note}</p>}
          </div>
        ))}
      </section>

      {/* Langkah */}
      <nav aria-label="Tahap proses" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            aria-current={step === s.id ? 'step' : undefined}
            data-testid={`step-${s.id}`}
            className={`flex min-h-[56px] flex-col items-start justify-center border-3 border-ink px-2 text-left ${step === s.id ? 'bg-acid' : 'bg-surface'}`}
          >
            <span className="font-mono text-[11px] font-bold">{s.n} · {s.tag}</span>
            <span className="text-xs font-extrabold uppercase leading-tight">{s.title}</span>
          </button>
        ))}
      </nav>

      {!calc.ok ? (
        <div role="alert" className="card"><h2 className="text-xl">Hmm, belum bisa dihitung</h2><p className="mt-2">{calc.message}</p></div>
      ) : (
        <StepBody
          step={step}
          out={calc.out}
          compare={calc.compare}
          origin={origin}
          methodId={methodId}
          setMethodId={setMethodId}
          methodName={method.nameId}
          rack={rack}
          setRack={setRack}
          halvesOverride={halvesOverride}
          setHalvesOverride={setHalvesOverride}
          defaultHalves={p.halvesPerM2.typ}
          drums={drums}
          setDrums={setDrums}
          product={product}
          setProduct={setProduct}
          inv={inv}
        />
      )}

      {calc.ok && <WarningList warnings={calc.out.warnings as CalcWarning[]} />}

      <p className="font-mono text-[11px] text-muted">
        Angka dari dataset proses v{p.version} (riset: FAO, CPCRI, TNAU, jurnal Indonesia) + dataset inventory v{inv.version}.
        Data asal kelapa masih estimasi (C) — timbang beberapa butir per kiriman biar makin akurat.
      </p>
    </div>
  );
}

type Calc = ProcessOutput;

function StepBody(props: {
  step: (typeof STEPS)[number]['id'];
  out: Calc;
  compare: { m: { id: string; nameId: string }; out: Calc }[];
  origin: (id: string) => { nameId: string };
  methodId: string;
  setMethodId: (v: string) => void;
  methodName: string;
  rack: { tierAreaM2: number; tiers: number; racksAvailable: number | undefined };
  setRack: (f: (r: { tierAreaM2: number; tiers: number; racksAvailable: number | undefined }) => typeof r) => void;
  halvesOverride: number | undefined;
  setHalvesOverride: (v: number | undefined) => void;
  defaultHalves: number;
  drums: number;
  setDrums: (v: number) => void;
  product: ProductTarget;
  setProduct: (v: ProductTarget) => void;
  inv: ReturnType<typeof useDataset>;
}) {
  const { out } = props;
  const t = out.total.mass.typ;
  const lanes = out.lots;
  const perLane = (render: (l: (typeof lanes)[number]) => ReactNode) => (
    <div className={`grid gap-4 ${lanes.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {lanes.map((l) => (
        <div key={l.key} className="flex flex-col gap-2">
          <span className="label-mono">{props.origin(l.key).nameId} · {fmt(l.nuts)} butir</span>
          {render(l)}
        </div>
      ))}
    </div>
  );

  switch (props.step) {
    case 'masuk':
      return (
        <section className="card flex flex-col gap-4" aria-labelledby="s-masuk">
          <h2 id="s-masuk" className="text-2xl">01 · Kelapa masuk</h2>
          <p className="text-sm">Total kelapa yang datang dan perkiraan beratnya. Ini yang dibongkar dari truk ke gudang.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Total butir" value={fmt(lanes.reduce((n, l) => n + l.nuts, 0))} accent testId="total-nuts" />
            <Stat label="Perkiraan berat" value={fmtMass(t.incomingKg)} sub={`${fmtMass(out.total.mass.min.incomingKg)} – ${fmtMass(out.total.mass.max.incomingKg)}`} testId="incoming-kg" />
          </div>
          {perLane((l) => <Stat label="Berat masuk" value={fmtMass(l.mass.typ.incomingKg)} />)}
          <CoconutLoadSim nuts={lanes.reduce((n, l) => n + l.nuts, 0)} lanes={lanes.map((l) => ({ key: l.key, nuts: l.nuts, name: props.origin(l.key).nameId }))} />
        </section>
      );
    case 'kupas':
      return (
        <section className="card flex flex-col gap-4" aria-labelledby="s-kupas">
          <h2 id="s-kupas" className="text-2xl">02 · Kupas sabut</h2>
          <p className="text-sm">Sabut dilepas. Jangan dibuang — seratnya (coir) bisa dijual atau jadi bahan bakar oven.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Sabut terkumpul" value={fmtMass(t.huskKg)} accent testId="husk-kg" />
            <Stat label="Serat sabut (coir)" value={fmtMass(t.coirKg)} />
            <Stat label="Kelapa sudah dikupas" value={fmtMass(t.dehuskedKg)} />
          </div>
          {perLane((l) => (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Sabut" value={fmtMass(l.mass.typ.huskKg)} />
              <Stat label="Kelapa kupas" value={fmtMass(l.mass.typ.dehuskedKg)} />
            </div>
          ))}
        </section>
      );
    case 'belah':
      return (
        <section className="card flex flex-col gap-4" aria-labelledby="s-belah">
          <h2 id="s-belah" className="text-2xl">03 · Belah</h2>
          <p className="text-sm">Tiap butir dibelah dua. Air kelapanya keluar — bisa ditampung buat cuka atau nata.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Belahan" value={`${fmt(t.halves)} keping`} accent testId="halves" />
            <Stat label="Air kelapa" value={`± ${fmt(t.waterKg)} liter`} sub="anggap 1 kg ≈ 1 liter" />
          </div>
          {perLane((l) => <Stat label="Belahan" value={`${fmt(l.mass.typ.halves)} keping`} />)}
        </section>
      );
    case 'jemur': {
      const d = out.total.drying;
      return (
        <section className="card flex flex-col gap-4" aria-labelledby="s-jemur">
          <h2 id="s-jemur" className="text-2xl">04 · Jemur di rak</h2>
          <ChoiceGroup
            legend="Cara jemur"
            columns={3}
            value={props.methodId}
            onChange={props.setMethodId}
            options={props.compare.map((c) => ({ value: c.m.id, label: c.m.nameId, testId: `method-${c.m.id}` }))}
          />
          <p className="border-l-4 border-acid bg-paper px-3 py-2 text-[13px]">{METHOD_TIPS[props.methodId]}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField label="Luas 1 susun rak" unit="m²" min={0.1} max={100} value={props.rack.tierAreaM2}
              onValue={(v) => v && props.setRack((r) => ({ ...r, tierAreaM2: v }))} testId="rack-area" />
            <NumberField label="Jumlah susun" unit="susun" integer min={1} max={50} value={props.rack.tiers}
              onValue={(v) => v && props.setRack((r) => ({ ...r, tiers: v }))} hint="Para-para di lantai = 1" testId="rack-tiers" />
            <NumberField label="Rak yang dipunya" unit="rak" integer min={1} max={10000} value={props.rack.racksAvailable}
              onValue={(v) => props.setRack((r) => ({ ...r, racksAvailable: v }))} hint="Kosongkan = hitung kebutuhan rak" testId="rack-count" />
            <NumberField label={<>Belahan per m² <Hint k="density" /></>} unit="keping" min={1} max={1000}
              value={props.halvesOverride} onValue={props.setHalvesOverride}
              hint={`Kosong = dari ukuran batok (±${fmt(props.defaultHalves)})`} testId="rack-density" />
          </div>
          {d && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Muat per rak" value={`${fmt(d.typ.capacityPerRack)} belahan`} />
              <Stat label="Rak untuk sekali jemur" value={`${fmt(d.typ.racksForOneBatch)} rak`} testId="racks-needed" />
              <Stat label="Angkatan" value={`${fmt(d.typ.batches)}×`} sub={props.rack.racksAvailable ? `pakai ${fmt(props.rack.racksAvailable)} rak per asal` : 'semua sekaligus'} />
              <Stat label="Total waktu" value={fmtDuration(d.typ.totalHours)} sub={`${fmtDuration(d.min.totalHours)} – ${fmtDuration(d.max.totalHours)}`} accent testId="dry-time" />
            </div>
          )}
          {perLane((l) =>
            l.drying ? (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Rak sekali jemur" value={`${fmt(l.drying.typ.racksForOneBatch)} rak`} />
                <Stat label="Waktu" value={fmtDuration(l.drying.typ.totalHours)} sub={`${fmt(l.drying.typ.batches)} angkatan`} />
              </div>
            ) : null,
          )}
          <p className="text-[12px] text-muted">Kelapa dataran rendah & tinggi dijemur di rak terpisah supaya mutunya bisa dibandingkan.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm" data-testid="method-compare">
              <caption className="label-mono mb-2 text-left">Bandingkan 3 cara jemur (rak yang sama)</caption>
              <thead>
                <tr className="bg-ink text-left font-mono text-[11px] text-paper">
                  <th className="p-2">CARA</th><th className="p-2">WAKTU</th><th className="p-2">ANGKATAN</th><th className="p-2">CUACA</th>
                </tr>
              </thead>
              <tbody>
                {props.compare.map((c) => (
                  <tr key={c.m.id} className={`border-b-2 border-ink ${c.m.id === props.methodId ? 'bg-acid' : ''}`}>
                    <th className="p-2 text-left">{c.m.nameId}</th>
                    <td className="p-2 font-mono">{fmtDuration(c.out.total.drying!.typ.totalHours)}</td>
                    <td className="p-2 font-mono">{fmt(c.out.total.drying!.typ.batches)}×</td>
                    <td className="p-2 text-xs">{c.out.warnings.some((w) => w.code === 'WEATHER_DEPENDENT') ? 'Tergantung cuaca' : 'Aman hujan'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    }
    case 'cungkil':
      return (
        <section className="card flex flex-col gap-4" aria-labelledby="s-cungkil">
          <h2 id="s-cungkil" className="text-2xl">05 · Cungkil & kumpulkan batok</h2>
          <p className="text-sm">Daging dicungkil dari batok. Batoknya dikumpulkan per asal — ini bahan arang.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Daging kelapa segar" value={fmtMass(t.kernelFreshKg)} testId="kernel-kg" />
            <Stat label="Batok terkumpul" value={fmtMass(t.shellKg)} accent testId="shell-kg" sub={`${fmtMass(out.total.mass.min.shellKg)} – ${fmtMass(out.total.mass.max.shellKg)}`} />
          </div>
          {perLane((l) => (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Daging segar" value={fmtMass(l.mass.typ.kernelFreshKg)} />
              <Stat label="Batok" value={fmtMass(l.mass.typ.shellKg)} />
            </div>
          ))}
        </section>
      );
    case 'jadi':
      return <FinishedGoods {...props} />;
  }
}

function FinishedGoods(props: Parameters<typeof StepBody>[0]) {
  const { out, inv, product } = props;
  const t = out.total.mass.typ;
  const c = out.total.charcoal;
  const prodForm = PRODUCT_FORM[product];
  const pack = getForm(inv, product, prodForm.formCode).packaging[0];
  const charcoalPack = getForm(inv, 'arang_batok_belah2', 'lumps').packaging[0];
  const per20 = containerCapacity(buildContainerInput(inv, { commodityId: product, formCode: prodForm.formCode, containerId: '20GP', mode: prodForm.mode })).result.typ.massKg;
  const per20Charcoal = containerCapacity(buildContainerInput(inv, { commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '20GP', mode: 'BULK' })).result.typ.massKg;

  return (
    <section className="card flex flex-col gap-5" aria-labelledby="s-jadi">
      <h2 id="s-jadi" className="text-2xl">06 · Produk jadi</h2>
      <ChoiceGroup
        legend="Mau dijadikan kopra apa?"
        columns={2}
        value={product}
        onChange={props.setProduct}
        options={[
          { value: 'kopra_edible', label: 'Kopra edible (putih)', testId: 'product-edible' },
          { value: 'kopra_asalan', label: 'Kopra asalan', testId: 'product-asalan' },
        ]}
      />
      <div className="flex flex-col gap-3 border-3 border-ink bg-acid p-5 shadow-hard" data-testid="copra-result">
        <span className="font-mono text-[13px] font-bold tracking-[0.1em]">KOPRA SIAP JUAL</span>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[48px] leading-none sm:text-[60px]" data-testid="copra-kg">{fmt(t.copraKg)}</span>
          <span className="font-mono text-lg font-bold">KG</span>
          <span className="ml-auto"><ConfidenceBadge c={out.confidence} withText /></span>
        </div>
        <span className="font-mono text-xs">
          Rentang {fmt(out.total.mass.min.copraKg)} – {fmt(out.total.mass.max.copraKg)} kg ·{' '}
          {pack && `≈ ${fmt(Math.ceil(t.copraKg / pack.netKg.typ))} karung × ${fmt(pack.netKg.typ)} kg`} ·{' '}
          {per20 > 0 && `≈ ${fmt(t.copraKg / per20, 2)} container 20 ft`}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 border-3 border-ink p-4">
          <span className="label-mono">Arang batok</span>
          <NumberField label="Jumlah drum (200 L)" unit="drum" integer min={1} max={500} value={props.drums}
            onValue={(v) => v && props.setDrums(v)} testId="drums" />
          {c && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Arang jadi" value={fmtMass(c.typ.charcoalKg)} sub={`${fmtMass(c.min.charcoalKg)} – ${fmtMass(c.max.charcoalKg)}`} accent testId="charcoal-kg" />
              <Stat label="Pembakaran" value={`${fmt(c.typ.drumBatches)} isi drum`} sub={`${fmt(c.typ.rounds)} putaran · ${fmtDuration(c.typ.totalHours)}`} />
              {charcoalPack && <Stat label="Karung arang" value={`${fmt(Math.ceil(c.typ.charcoalKg / charcoalPack.netKg.typ))} × ${fmt(charcoalPack.netKg.typ)} kg`} />}
              {per20Charcoal > 0 && <Stat label="Container 20 ft" value={fmt(c.typ.charcoalKg / per20Charcoal, 2)} />}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 border-3 border-ink p-4">
          <span className="label-mono">Hasil samping</span>
          <Stat label="Serat sabut (coir)" value={fmtMass(t.coirKg)} />
          <Stat label="Air kelapa" value={`± ${fmt(t.waterKg)} liter`} />
          <Stat label="Sisa sabut (non-serat)" value={fmtMass(Math.max(0, t.huskKg - t.coirKg))} sub="bahan bakar oven / media tanam" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="label-mono">Kopra per asal kelapa</span>
        <div className={`grid gap-2 ${out.lots.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {out.lots.map((l) => (
            <Stat key={l.key} label={props.origin(l.key).nameId} value={`${fmt(l.mass.typ.copraKg)} kg kopra`}
              sub={`${fmt((l.mass.typ.copraKg / Math.max(1, l.nuts)) * 1000)} g per butir`} />
          ))}
        </div>
      </div>
      <Link href="/muat" className="btn-ghost self-start no-underline">Hitung muat container →</Link>
    </section>
  );
}
