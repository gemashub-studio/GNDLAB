'use client';

import { kilnPlan, point, sievePlan, type Param } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { StepFlow } from '@/components/ui/StepFlow';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { PackCalculator, usePackOptions } from './KemasTab';
import { BigResult, CalcError, ChainSources, getForm, Note, OriginPicker, paramText, safe, SopList, Table, useChain, useDataset, useFormula } from './shared';

type Kiln = 'drum' | 'kolam';
type Output = 'batok' | 'tepung';

/** Rentang kecil hanya bila min ≠ max. */
const spread = (min: number, max: number, unit = ''): string | undefined => (Math.round(min) === Math.round(max) ? undefined : `${fmt(min, 0)}–${fmt(max, 0)}${unit}`);

const userParam = (key: string, unit: Param['unit'], v: number): Param => ({ ...point(v), key, unit, confidence: 'A', sourceIds: [], source: 'override' });

export function ArangTab() {
  const c = useChain();
  const f = useFormula();
  const ds = useDataset();
  const ch = c.charcoal;
  const rawBulk = getForm(ds, 'arang_batok_belah2', 'raw_halves').params.bulk_density!;
  const drumMethod = f.arang.methods.find((m) => m.id === 'pirolisis') ?? f.arang.methods[0]!;
  const [origin, setOrigin] = useState<'DR' | 'DT'>('DR');
  const [shellKg, setShellKg] = useState<number | undefined>(1000);
  const [kiln, setKiln] = useState<Kiln>('drum');
  const [drums, setDrums] = useState<number | undefined>(1);
  const [pit, setPit] = useState<{ L?: number; W?: number; D?: number; burn?: number }>({});
  const [passes, setPasses] = useState<(number | undefined)[]>(Array.from({ length: ch.sieve_passes.typ }, () => undefined));
  const [unburnt, setUnburnt] = useState<number | undefined>(0);
  const [output, setOutput] = useState<Output>('batok');
  const [millRate, setMillRate] = useState<number | undefined>();

  const plan = useMemo(() => {
    if (!shellKg) return undefined;
    if (kiln === 'drum') {
      if (!drums) return undefined;
      return safe(() =>
        kilnPlan({
          shellKg,
          kiln: { method: 'drum', drumBatchKg: drumMethod.batchShellKg, drumCount: drums },
          yieldPct: f.arang.yield_reference_pct,
          burnH: drumMethod.burnH,
          sealH: ch.kiln_seal_h,
          coolH: drumMethod.coolingH,
          spreadH: ch.spread_cool_h,
          datasetVersion: `rantai.${c.version}`,
        }),
      );
    }
    if (!pit.L || !pit.W || !pit.D || !pit.burn) return { ok: false as const, message: 'isi ukuran kolam (panjang, lebar, dalam) dan lama bakar kolam kamu' };
    return safe(() =>
      kilnPlan({
        shellKg,
        kiln: { method: 'kolam', L: pit.L!, W: pit.W!, D: pit.D!, fillFraction: ch.pit_fill_fraction, rawBulkDensity: rawBulk },
        yieldPct: ch.pit_yield_pct,
        burnH: userParam('kolam.burn_h', 'h', pit.burn!),
        sealH: ch.kiln_seal_h,
        coolH: ch.kolam_cool_h,
        spreadH: ch.spread_cool_h,
        datasetVersion: `rantai.${c.version}`,
      }),
    );
  }, [shellKg, kiln, drums, pit, drumMethod, f, ch, rawBulk, c.version]);

  const charcoalKg = plan?.ok ? plan.v.result.typ.charcoalKg : undefined;
  const millP: Param = millRate ? userParam('hammer_mill.rate', 'kg_h', millRate) : f.arang.hammer_mill_kg_h;
  const sieve = useMemo(
    () =>
      charcoalKg
        ? safe(() => sievePlan({ charcoalKg, finesPctPerPass: passes.map((p) => p ?? 0), unburntPct: unburnt ?? 0, grindLumps: output === 'tepung', hammerMillKgH: millP, datasetVersion: `rantai.${c.version}` }))
        : undefined,
    [charcoalKg, passes, unburnt, output, millP, c.version],
  );
  const s = sieve?.ok ? sieve.v.result : undefined;
  const productKg = s ? (output === 'tepung' ? s.typ.powderKg : s.typ.lumpsKg) : undefined;
  const options = usePackOptions().filter((o) => o.id.startsWith('arang'));

  return (
    <div className="flex flex-col gap-5" data-testid="chain-arang">
      <OriginPicker value={origin} onChange={setOrigin} testId="arang-origin" />
      <Note title={`Batok ${origin} saja`}>Satu angkatan tungku = satu kelas asal. Batok DR dan DT tidak boleh dicampur di tungku, ayakan, maupun karung — supaya mutu arang per asal bisa dibandingkan.</Note>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label={`Batok kering ${origin}`} unit="kg" min={1} max={10_000_000} value={shellKg} onValue={setShellKg} testId="arang-shell" />
        <ChoiceGroup<Kiln>
          legend="Tempat pembakaran"
          columns={2}
          value={kiln}
          onChange={setKiln}
          options={[
            { value: 'drum', label: 'Drum pirolisis', testId: 'arang-kiln-drum' },
            { value: 'kolam', label: 'Kolam (bata)', testId: 'arang-kiln-kolam' },
          ]}
        />
      </div>

      {kiln === 'drum' ? (
        <NumberField label="Jumlah drum" unit="drum" integer min={1} max={500} value={drums} onValue={setDrums}
          hint={`Isi ${paramText(drumMethod.batchShellKg, 0)} kg batok/drum (SOP); pecah batok ±${fmt(ch.drum_piece_mm.typ / 10, 1)} cm`} testId="arang-drums" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Panjang kolam" unit="m" min={0.3} max={50} value={pit.L} onValue={(v) => setPit((p) => ({ ...p, L: v }))} testId="arang-pit-L" />
          <NumberField label="Lebar kolam" unit="m" min={0.3} max={50} value={pit.W} onValue={(v) => setPit((p) => ({ ...p, W: v }))} testId="arang-pit-W" />
          <NumberField label="Dalam kolam" unit="m" min={0.2} max={10} value={pit.D} onValue={(v) => setPit((p) => ({ ...p, D: v }))} testId="arang-pit-D" />
          <NumberField label="Lama bakar kolam" unit="jam" min={1} max={240} value={pit.burn} onValue={(v) => setPit((p) => ({ ...p, burn: v }))} hint="GAP: catat dari angkatan kamu (patokan = warna asap)" testId="arang-pit-burn" />
        </div>
      )}

      {plan && !plan.ok && <CalcError message={plan.message} />}
      {plan?.ok && (
        <>
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <BigResult
              label={`ARANG ${origin} (PERKIRAAN)`}
              value={fmt(plan.v.result.typ.charcoalKg, 0)}
              unit="KG"
              sub={`Rentang ${fmt(plan.v.result.min.charcoalKg, 0)}–${fmt(plan.v.result.max.charcoalKg, 0)} kg · rendemen ${kiln === 'drum' ? paramText(f.arang.yield_reference_pct, 0) : paramText(ch.pit_yield_pct, 0)} %`}
              confidence={plan.v.confidence}
              testId="arang-yield"
            />
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Isi per angkatan" value={`${fmt(plan.v.result.typ.batchShellKg, 0)} kg`} sub={spread(plan.v.result.min.batchShellKg, plan.v.result.max.batchShellKg, ' kg')} testId="arang-batch" />
              <Stat label="Angkatan" value={fmt(plan.v.result.typ.batches, 0)} sub={spread(plan.v.result.min.batches, plan.v.result.max.batches)} accent testId="arang-batches" />
              <Stat label="Siklus / angkatan" value={`${fmt(plan.v.result.typ.cycleH, 1)} jam`} sub="bakar + tutup + dingin + hampar" />
              <Stat label="Total waktu (1 tungku)" value={`${fmt(plan.v.result.typ.totalH / 24, 1)} hari`} />
            </div>
          </div>
          <WarningList warnings={plan.v.warnings} />
          <ChainSources ids={kiln === 'drum' ? [...drumMethod.batchShellKg.sourceIds, ...f.arang.yield_reference_pct.sourceIds] : [...ch.pit_yield_pct.sourceIds, ...ch.pit_fill_fraction.sourceIds, ...ch.kolam_cool_h.sourceIds]} confidence={plan.v.confidence} />
        </>
      )}

      <section className="flex flex-col gap-2" aria-label="Fase karbonisasi">
        <h3 className="text-xl">Fase bakar — patokan warna asap</h3>
        <StepFlow
          testId="arang-phases"
          steps={c.raw.charcoal.phases.map((p, i) => ({
            icon: i === 0 ? 'fire' : i === c.raw.charcoal.phases.length - 1 ? 'cover' : 'smoke',
            text: (
              <>
                <strong>{p.name_id.replace(/^\d+\.\s*/, '')}</strong> — asap: {p.smoke}. <em>{p.action}.</em>
              </>
            ),
          }))}
        />
        <ChainSources ids={c.raw.charcoal.phases_source_ids} confidence="C" />
      </section>

      <section className="card flex flex-col gap-3" aria-label="Ayak & giling">
        <h3 className="text-xl">Ayak rotari {passes.length}× → sortir → output</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {passes.map((p, i) => (
            <NumberField key={i} label={`Lolos ayakan ke-${i + 1}`} unit="%" min={0} max={99} value={p} onValue={(v) => setPasses((xs) => xs.map((x, j) => (j === i ? v : x)))}
              hint="Timbang hasil uji ayak" testId={`arang-pass-${i + 1}`} />
          ))}
          <NumberField label="Belum matang (bakar ulang)" unit="%" min={0} max={99} value={unburnt} onValue={setUnburnt} testId="arang-unburnt" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setPasses((xs) => [...xs, undefined])} disabled={passes.length >= ch.sieve_passes.max}>+ lintasan</button>
          <button type="button" className="btn-ghost" onClick={() => setPasses((xs) => xs.slice(0, -1))} disabled={passes.length <= 1}>− lintasan</button>
        </div>
        <ChoiceGroup<Output>
          legend="Output yang diinginkan"
          columns={2}
          value={output}
          onChange={setOutput}
          options={[
            { value: 'batok', label: 'Arang batok (lump) + serbuk sisa ayak', testId: 'arang-out-batok' },
            { value: 'tepung', label: 'Tepung arang (giling hammer mill)', testId: 'arang-out-tepung' },
          ]}
        />
        {output === 'tepung' && (
          <NumberField label="Kapasitas hammer mill kamu" unit="kg/jam" min={1} max={100_000} value={millRate} onValue={setMillRate} hint={`Kosong = rentang literatur ${paramText(f.arang.hammer_mill_kg_h, 0)} kg/jam`} testId="arang-mill" />
        )}
        {sieve && !sieve.ok && <CalcError message={sieve.message} />}
        {s && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="arang-sieve">
            <Stat label="Arang batok" value={`${fmt(s.typ.lumpsKg, 0)} kg`} accent={output === 'batok'} testId="arang-lumps" />
            <Stat label="Serbuk/tepung" value={`${fmt(s.typ.powderKg, 0)} kg`} accent={output === 'tepung'} testId="arang-powder" />
            <Stat label="Bakar ulang" value={`${fmt(s.typ.unburntKg, 0)} kg`} />
            <Stat label="Waktu giling" value={output === 'tepung' ? `${fmt(s.min.millH, 1)}–${fmt(s.max.millH, 1)} jam` : '—'} testId="arang-millh" />
          </div>
        )}
        <p className="font-mono text-[11px] text-muted">
          Fraksi ukuran (oversize/granul/mesh/powder) & standar ICC/SNI: Formula R&amp;D → Arang. Jumlah lintasan: {paramText(ch.sieve_passes, 0)} (owner 2×, SOP KORA 2–3×).
        </p>
      </section>

      {productKg !== undefined && options.length > 0 && <PackCalculator key={`${output}-${Math.round(productKg)}`} options={options} defaultKg={Math.round(productKg)} prefix="arang" />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="arang-bags">
        {productKg !== undefined &&
          c.raw.packing.charcoal_bag_kg.map((b) => <Stat key={b.id} label={b.kg >= 1000 ? 'Jumbo bag 1 t' : `Karung ${b.kg} kg`} value={fmt(Math.ceil(productKg / b.kg), 0)} />)}
        {productKg !== undefined &&
          c.raw.packing.charcoal_container_net_kg.map((x) => (
            <Stat key={x.container} label={`Container ${x.container} (±${fmt(x.net.typ / 1000, 0)} t)`} value={fmt(productKg / x.net.typ, 2)} sub="container (acuan vendor)" />
          ))}
      </div>

      <SopList
        title={`Arang batok ${origin}: siapkan → bakar → dingin → ayak → sortir`}
        testId="sop-arang"
        steps={[
          `Cuci batok dari sisa daging/sabut/tanah, tiriskan ${fmt(ch.shell_wash_drain_h.min, 0)}–${fmt(ch.shell_wash_drain_h.max, 0)} jam, jemur di para-para ${fmt(ch.shell_sun_dry_days.min, 0)}–${fmt(ch.shell_sun_dry_days.max, 0)} hari sampai KA ≤ ${paramText(f.arang.shell_moisture_max_pct, 0)}% (cek moisture meter).`,
          kiln === 'drum'
            ? `Drum: pecah batok ±${fmt(ch.drum_piece_mm.typ / 10, 1)} cm, isi padat, nyalakan dari atas; atur lubang udara sesuai warna asap.`
            : 'Kolam: susun batok berlapis (cekung menghadap bawah), lapisan atas lebih longgar sebagai titik nyala; atur ventilasi sesuai warna asap.',
          `Asap tipis kebiruan → tutup SEMUA celah dengan tanah liat basah (${fmt(ch.kiln_seal_h.min * 60, 0)}–${fmt(ch.kiln_seal_h.max * 60, 0)} menit), biarkan kedap — ${kiln === 'drum' ? `minimal ${paramText(drumMethod.coolingH, 0)} jam` : `${fmt(ch.kolam_cool_h.min, 0)}–${fmt(ch.kolam_cool_h.max, 0)} jam (semalam–2 hari)`}. JANGAN disiram air.`,
          `Bongkar setelah dinding dingin disentuh; hamparkan di lantai beratap ${fmt(ch.spread_cool_h.min, 0)}–${fmt(ch.spread_cool_h.max, 0)} jam sebelum ditumpuk.`,
          `Ayak rotari ${passes.length}× (kasar → halus); sortir manual: yang masih coklat/bunyi tumpul dibakar ulang.`,
          output === 'tepung' ? 'Giling arang batok dengan hammer mill → tepung; pakai masker debu & exhaust di ruang giling.' : 'Arang batok bersih ke karung; serbuk sisa ayak ke jalur briket.',
          `Kemas setelah suhu ≤ ${f.raw.arang.packing_temp_max_c} °C; karung berlabel kode lot ${origin}, simpan kering (arang menyerap uap air).`,
        ]}
        tools={[kiln === 'drum' ? 'Drum pirolisis + tutup' : 'Kolam bata/tanah', 'Tanah liat basah', 'Pengungkit besi panjang', 'Moisture meter', 'Ayakan rotari', 'Hammer mill', 'Timbangan', 'Karung PP / jumbo bag', 'APAR + bak pasir/air']}
        safety="Risiko CO & luka bakar: minimal 2 orang, respirator gas, sarung tangan tahan panas, sepatu safety; jangan buka tungku sebelum masa dingin selesai (backdraft)."
      />
      <ChainSources ids={[...ch.shell_sun_dry_days.sourceIds, ...ch.kolam_cool_h.sourceIds, ...c.raw.packing.charcoal_bag_source_ids]} confidence="C" />
    </div>
  );
}
