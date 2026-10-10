'use client';

import { tripsNeeded, vehicleLoad, type Range } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { BindingTag } from '@/components/ui/badges';
import { FillBar } from '@/components/ui/bars';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { BigResult, ChainSources, getForm, Note, safe, SopList, Table, useChain, useDataset } from './shared';

type Mode = 'bag' | 'bulk';

export function AngkutTab() {
  const c = useChain();
  const ds = useDataset();
  const bagged = getForm(ds, 'kelapa_jambul', 'bagged');
  const loose = getForm(ds, 'kelapa_jambul', 'loose');
  const pack = bagged.packaging[0]!;
  const bench = bagged.benchmarks.find((b) => b.containerId === '20GP' && !b.conservative);
  const [nuts, setNuts] = useState<number | undefined>(bench?.pieces?.min);
  const [mode, setMode] = useState<Mode>('bag');
  const [pick, setPick] = useState('cdd_box');

  const rows = useMemo(
    () =>
      c.vehicles.map((v) => {
        const r = safe(() =>
          vehicleLoad(
            v,
            mode === 'bag'
              ? { mode: 'bag', pack: { l: pack.dims!.l, w: pack.dims!.w, h: pack.dims!.h, netKg: pack.netKg, ...(pack.pcsPerPack && { pcs: pack.pcsPerPack }) } }
              : { mode: 'bulk', rho: loose.params.bulk_density!, unitMass: loose.params.mass_per_unit! },
            `rantai.${c.version}`,
          ),
        );
        const per: Range | undefined = r.ok ? { min: r.v.result.min.pieces, typ: r.v.result.typ.pieces, max: r.v.result.max.pieces } : undefined;
        const trips = r.ok && nuts && per && per.min > 0 ? safe(() => tripsNeeded(nuts, per)) : undefined;
        return { v, r, per, trips: trips?.ok ? trips.v : undefined };
      }),
    [c, mode, pack, loose, nuts],
  );
  // Bahan baku datang dengan truk: pilih truk dengan rit paling sedikit, lalu kapasitas paling pas (sisa ruang terkecil).
  const best = rows
    .filter((x) => x.trips && x.v.kind === 'truck')
    .sort((a, b) => a.trips!.typ - b.trips!.typ || a.per!.typ - b.per!.typ)[0];
  const sel = rows.find((x) => x.v.id === pick) ?? rows[0]!;

  return (
    <div className="flex flex-col gap-5" data-testid="chain-angkut">
      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <NumberField
          label="Jumlah kelapa jambul"
          unit="butir"
          integer
          min={1}
          max={10_000_000}
          value={nuts}
          onValue={setNuts}
          hint={bench?.pieces ? `Acuan: 1 container 20ft ±${fmt(bench.pieces.min, 0)} butir (dataset inventory)` : undefined}
          testId="angkut-nuts"
        />
        <ChoiceGroup<Mode>
          legend="Cara muat"
          columns={2}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'bag', label: `Karung jaring ${pack.pcsPerPack ?? ''} butir`, testId: 'angkut-mode-bag' },
            { value: 'bulk', label: 'Curah (lepas)', testId: 'angkut-mode-bulk' },
          ]}
        />
      </div>
      <Note>
        Kelapa tua jambul rata-rata <strong>{fmt(loose.params.mass_per_unit!.typ * 1000, 0)} g</strong> (
        {fmt(loose.params.mass_per_unit!.min * 1000, 0)}–{fmt(loose.params.mass_per_unit!.max * 1000, 0)} g), diameter ±
        {fmt((loose.params['geometry.body.diameter_equatorial']?.typ ?? 0) * 100, 1)} cm. Muatan per kendaraan = yang lebih kecil antara{' '}
        <strong>batas ruang</strong> (susunan karung) dan <strong>batas berat</strong> (payload).
      </Note>

      {best && nuts && (
        <BigResult
          label={`TRUK PALING EFISIEN — ${best.v.nameId.toUpperCase()}`}
          value={fmt(best.trips!.typ, 0)}
          unit="RIT"
          sub={`${fmt(best.per!.typ, 0)} butir/rit (${fmt(best.per!.min, 0)}–${fmt(best.per!.max, 0)}) untuk ${fmt(nuts, 0)} butir`}
          confidence={best.r.ok ? best.r.v.confidence : undefined}
          testId="angkut-best"
        />
      )}

      <Table
        testId="angkut-table"
        head={['Kendaraan', 'Ruang dalam (m)', 'Payload', 'Butir / rit', 'Pembatas', 'Rit']}
        rows={rows.map(({ v, r, per, trips }) => [
          <button key="n" type="button" className={`text-left font-bold underline ${pick === v.id ? 'bg-acid' : ''}`} onClick={() => setPick(v.id)} data-testid={`veh-${v.id}`}>
            {v.nameId}
          </button>,
          `${fmt(v.L, 2)} × ${fmt(v.W, 2)} × ${fmt(v.H, 2)}`,
          v.payload.min === v.payload.max ? `${fmt(v.payload.typ / 1000, 1)} t` : `${fmt(v.payload.min / 1000, 1)}–${fmt(v.payload.max / 1000, 1)} t`,
          r.ok && per ? <span data-testid={`veh-${v.id}-pcs`}>{fmt(per.typ, 0)}</span> : '—',
          r.ok ? <BindingTag b={r.v.binding} /> : '—',
          trips ? (trips.min === trips.max ? fmt(trips.typ, 0) : `${fmt(trips.typ, 0)} (${fmt(trips.min, 0)}–${fmt(trips.max, 0)})`) : '—',
        ])}
      />

      {sel.r.ok && (
        <section className="card flex flex-col gap-3" aria-label="Simulasi kendaraan" data-testid="angkut-sim">
          <h3 className="text-xl">Simulasi · {sel.v.nameId}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Butir" value={fmt(sel.r.v.result.typ.pieces, 0)} accent />
            {mode === 'bag' && <Stat label="Karung" value={fmt(sel.r.v.result.typ.packs, 0)} />}
            <Stat label="Berat muatan" value={`${fmt(sel.r.v.result.typ.massKg / 1000, 2)} t`} />
            <Stat label="Volume ruang" value={`${fmt(sel.v.L * sel.v.W * sel.v.H, 1)} m³`} />
          </div>
          <FillBar label="Isi ruang" fraction={sel.r.v.result.typ.volumeFill} tone="ink" />
          <FillBar label="Isi berat" fraction={sel.r.v.result.typ.weightFill} tone="safety" />
          <WarningList warnings={sel.r.v.warnings} />
          <ChainSources ids={sel.v.sourceIds} confidence={sel.v.payload.confidence} />
          {sel.v.note && <p className="font-mono text-[11px] text-muted">{sel.v.note}</p>}
        </section>
      )}

      <SopList
        title="Muat & angkut kelapa"
        testId="sop-angkut"
        steps={[
          'Satu kendaraan = satu lot asal (DR atau DT). Jangan campur kelapa pesisir & gunung dalam satu rit — tempel label kode lot di bak/pintu.',
          'Karung jaring diisi penuh sesuai jumlah butir standar, diikat; susun berlapis rapat dari dinding depan, berat merata kiri–kanan.',
          'Bak terbuka wajib ditutup terpal (hujan & panas) tapi tetap ada celah udara; jangan dibanting saat bongkar — retak = air bocor & busuk.',
          'Timbang di jembatan timbang/timbangan gantung: catat bruto, tara, neto per rit di form penerimaan.',
          'Cek batas muat legal kendaraan (JBI di buku KIR) — angka payload di tabel adalah data vendor.',
        ]}
        tools={['Karung jaring PP', 'Terpal', 'Tali pengikat', 'Label lot', 'Timbangan', 'Form surat jalan']}
      />
      <p className="font-mono text-[11px] text-muted">{c.raw.vehicles_note}</p>
    </div>
  );
}
