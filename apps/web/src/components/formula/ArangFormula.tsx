'use client';

import { charcoalPlan, charcoalYieldStatus, fractionShares, point, type CalcWarning, type Param } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt, fmtMass } from '@/lib/format';
import { fmtDuration } from '@/components/process/ProcessCalculator';
import { BigResult, Bom, CalcError, Note, paramText, rangeText, safe, Sources, useFormula, Wizard } from './shared';

type YieldSource = 'reference' | 'kora' | 'own';
type Basis = 'shell' | 'target';

export function ArangFormula() {
  const f = useFormula();
  const a = f.arang;
  const [methodId, setMethodId] = useState(a.methods[0]!.id);
  const [basis, setBasis] = useState<Basis>('shell');
  const [amount, setAmount] = useState(1000);
  const [kilns, setKilns] = useState(2);
  const [batchKg, setBatchKg] = useState<number | undefined>();
  const [ySrc, setYSrc] = useState<YieldSource>('reference');
  const [ownYield, setOwnYield] = useState<number | undefined>();
  const [meas, setMeas] = useState<{ shellIn?: number; out?: number; raw?: number }>({});
  const [frac, setFrac] = useState<Record<string, number | undefined>>({});
  const [shellMc, setShellMc] = useState<number | undefined>();

  const method = a.methods.find((m) => m.id === methodId)!;
  const yieldP: Param = ySrc === 'reference' ? a.yield_reference_pct : ySrc === 'kora' ? a.yield_kora_actual_pct : { ...a.yield_reference_pct, ...point(ownYield ?? a.yield_reference_pct.typ), confidence: 'A', source: 'override' };

  const plan = useMemo(
    () =>
      safe(() =>
        charcoalPlan({
          ...(basis === 'shell' ? { shellKg: amount } : { targetCharcoalKg: amount }),
          yieldPct: yieldP,
          batchShellKg: batchKg ? { ...method.batchShellKg, ...point(batchKg), source: 'override' } : method.batchShellKg,
          burnH: method.burnH,
          coolingH: method.coolingH,
          kilns,
          ...(method.liquidSmoke && { liquidSmokeLPerKg: a.liquid_smoke_l_per_kg_shell }),
          referenceYieldMinPct: a.yield_reference_pct.min,
          datasetVersion: `formula.${f.version}`,
        }),
      ),
    [basis, amount, yieldP, batchKg, method, kilns, a, f.version],
  );
  const status = meas.shellIn && meas.out !== undefined ? safe(() => charcoalYieldStatus({ shellInKg: meas.shellIn!, charcoalOutKg: meas.out!, ...(meas.raw !== undefined && { rawKg: meas.raw }) }, a.yield_reference_pct, a.yield_target_3m_pct.typ, a.yield_target_6m_pct.typ)) : undefined;
  const fracFilled = Object.fromEntries(Object.entries(frac).filter(([, v]) => v !== undefined && v > 0)) as Record<string, number>;
  const shares = Object.keys(fracFilled).length ? safe(() => fractionShares(fracFilled)) : undefined;

  const inputs = (
    <div className="flex flex-col gap-3">
      <ChoiceGroup legend="Metode karbonisasi" columns={2} value={methodId} onChange={setMethodId} options={a.methods.map((m) => ({ value: m.id, label: m.nameId, testId: `arang-method-${m.id}` }))} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ChoiceGroup legend="Hitung dari" columns={1} value={basis} onChange={setBasis} options={[{ value: 'shell', label: 'Batok yang ada', testId: 'arang-basis-shell' }, { value: 'target', label: 'Target arang', testId: 'arang-basis-target' }]} />
        <NumberField label={basis === 'shell' ? 'Batok masuk' : 'Target arang'} unit="kg" min={1} max={10_000_000} value={amount} onValue={(v) => v && setAmount(v)} testId="arang-amount" />
        <NumberField label="Jumlah tungku/drum" unit="unit" integer min={1} max={1000} value={kilns} onValue={(v) => v && setKilns(v)} testId="arang-kilns" />
        <NumberField label="Isi per tungku" unit="kg" min={1} max={100000} value={batchKg} onValue={setBatchKg} hint={`Kosong = ${paramText(method.batchShellKg, 0, 'kg')} (C)`} testId="arang-batch" />
      </div>
      <ChoiceGroup
        legend={<>Rendemen yang dipakai <Hint k="rendemen" /></>}
        columns={3}
        value={ySrc}
        onChange={setYSrc}
        options={[
          { value: 'reference', label: `Acuan literatur ${paramText(a.yield_reference_pct, 0, '%')}`, testId: 'arang-y-ref' },
          { value: 'kora', label: `Data KORA saat ini ±${fmt(a.yield_kora_actual_pct.typ)}%`, testId: 'arang-y-kora' },
          { value: 'own', label: 'Isi sendiri', testId: 'arang-y-own' },
        ]}
      />
      {ySrc === 'own' && <NumberField label="Rendemen hasil ukurmu" unit="%" min={1} max={80} value={ownYield} onValue={setOwnYield} testId="arang-y-value" />}
    </div>
  );

  if (!plan.ok) {
    return (
      <div className="flex flex-col gap-4">
        {inputs}
        <CalcError message={plan.message} />
      </div>
    );
  }
  const out = plan.v;
  const t = out.result.typ;
  const r = out.result;

  return (
    <div className="flex flex-col gap-5" data-testid="formula-arang">
      {inputs}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <BigResult
          label={basis === 'shell' ? 'ARANG JADI' : 'BATOK DIBUTUHKAN'}
          value={fmt(basis === 'shell' ? t.charcoalKg : t.shellKg)}
          unit="KG"
          sub={basis === 'shell' ? `Rentang ${fmt(r.min.charcoalKg)}–${fmt(r.max.charcoalKg)} kg` : `Rentang ${fmt(r.min.shellKg)}–${fmt(r.max.shellKg)} kg batok`}
          confidence={out.confidence}
          testId="arang-result"
        />
        <Bom
          title="Rencana bakar"
          testId="arang-bom"
          rows={[
            { name: 'Angkatan (isi tungku)', amount: `${fmt(t.batches)}×`, note: `${fmt(kilns)} tungku jalan bersamaan` },
            { name: 'Siklus per angkatan', amount: fmtDuration(t.cycleH), note: `bakar ${paramText(method.burnH, 0, 'jam')} + mati hampa ${paramText(method.coolingH, 0, 'jam')}` },
            { name: 'Total waktu', amount: fmtDuration(t.totalH), note: rangeText({ min: r.min.totalH, typ: t.totalH, max: r.max.totalH }, 0, 'jam') },
            ...(method.liquidSmoke ? [{ name: 'Asap cair kasar', amount: `${fmt(t.liquidSmokeL)} L`, note: 'Endapkan 2–4 bulan, pisahkan tar' }] : []),
          ]}
        />
      </div>

      <Wizard
        label="Tahap arang"
        testId="arang-wizard"
        steps={[
          {
            id: 'batok',
            tag: 'A–B',
            title: 'Batok',
            body: (
              <>
                <NumberField label="KA batok (moisture meter, 5 sampel)" unit="%" min={0} max={80} value={shellMc} onValue={setShellMc} hint={`Maks ${fmt(a.shell_moisture_max_pct.typ)}% (standar internal)`} testId="arang-shell-mc" />
                {shellMc !== undefined && (
                  <p className={`border-3 border-ink p-2 font-bold ${shellMc <= a.shell_moisture_max_pct.typ ? 'bg-acid' : 'bg-safety'}`}>
                    {shellMc <= a.shell_moisture_max_pct.typ ? 'Siap bakar' : 'Terlalu basah — jemur di area beratap dulu (batok basah = rendemen turun, asap banyak)'}
                  </p>
                )}
                <p className="text-sm">Bersihkan sisa sabut (sabut = asap & abu tinggi). Satu tungku = satu lot — batok dataran rendah & tinggi tidak dicampur. Drum: cacah ±2,5 cm.</p>
                <Sources ids={a.shell_moisture_max_pct.sourceIds} confidence={a.shell_moisture_max_pct.confidence} />
              </>
            ),
          },
          {
            id: 'bakar',
            tag: 'C',
            title: 'Karbonisasi',
            body: (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Suhu reaktor target" value={paramText(a.reactor_temp_c, 0, '°C')} sub="VM ≤15% butuh 450–600°C" />
                  <Stat label="Lama bakar" value={paramText(method.burnH, 1, 'jam')} />
                  <Stat label="Tanda matang (kombi)" value="Asap tipis kebiruan" sub="tebal putih → menipis → kebiruan" />
                </div>
                {method.liquidSmoke && (
                  <Note tone="warn" title="Izin oli bekas">Jet burner oli bekas = pemanfaatan limbah B3 (B105d) — wajib konfirmasi tertulis DLH/KLHK. Alternatif: biomassa (sabut, bonggol jagung) atau gas pirolisis dibakar ulang.</Note>
                )}
                <Note tone="warn" title="K3">Minimal 2 orang selama tungku menyala; radius 5 m bersih; APAR + pasir + tanah liat siap; berdiri melawan arah angin (CO).</Note>
                <Sources ids={[...a.reactor_temp_c.sourceIds, ...method.burnH.sourceIds]} confidence={method.burnH.confidence} />
              </>
            ),
          },
          {
            id: 'dingin',
            tag: 'D',
            title: 'Mati hampa',
            body: (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label={<>Mati hampa <Hint k="mati_hampa" /></>} value={paramText(method.coolingH, 0, 'jam')} accent sub="Tutup rapat tanah liat basah, TANPA air" />
                  <Stat label={<>Weathering ekspor <Hint k="weathering" /></>} value={`≥ ${fmt(f.raw.arang.weathering_days_export_min)} hari`} sub="IMDG SP 978 (wajib 2026)" />
                  <Stat label="Suhu saat packing" value={`≤ ${fmt(f.raw.arang.packing_temp_max_c)}°C`} />
                </div>
                <Note>Disiram air → KA arang ±29,9% vs 8,5% pendinginan tertutup (studi Unila) dan arang retak. Bongkar di lantai beton, pantau 2 jam pertama (bisa menyala ulang).</Note>
                <Sources ids={method.coolingH.sourceIds} confidence={method.coolingH.confidence} />
              </>
            ),
          },
          {
            id: 'rendemen',
            tag: 'KPI',
            title: 'Rendemen aktual',
            body: (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <NumberField label="Batok masuk" unit="kg" min={0.1} max={1_000_000} value={meas.shellIn} onValue={(v) => setMeas((m) => ({ ...m, shellIn: v }))} testId="arang-meas-in" />
                  <NumberField label="Arang keluar" unit="kg" min={0} max={1_000_000} value={meas.out} onValue={(v) => setMeas((m) => ({ ...m, out: v }))} testId="arang-meas-out" />
                  <NumberField label="Arang mentah tersortir" unit="kg" min={0} max={1_000_000} value={meas.raw} onValue={(v) => setMeas((m) => ({ ...m, raw: v }))} />
                </div>
                {status?.ok && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="arang-status">
                    <Stat label="Rendemen" value={`${fmt(status.v.yieldPct, 1)}%`} accent={status.v.vsReference !== 'below'} testId="arang-yield" />
                    <Stat label="vs acuan" value={status.v.vsReference === 'below' ? 'Di bawah' : status.v.vsReference === 'within' ? 'Dalam rentang' : 'Di atas — cek timbangan'} sub={paramText(a.yield_reference_pct, 0, '%')} />
                    <Stat label="Target 3 / 6 bulan" value={`${status.v.meetsTarget3m ? '✓' : '✗'} / ${status.v.meetsTarget6m ? '✓' : '✗'}`} sub={`≥${fmt(a.yield_target_3m_pct.typ)}% → ≥${fmt(a.yield_target_6m_pct.typ)}%`} />
                    <Stat label="% mentah" value={status.v.rawPct !== undefined ? `${fmt(status.v.rawPct, 1)}%` : '—'} sub={`Target ≤${fmt(a.raw_max_pct.typ)}%`} />
                  </div>
                )}
                <Note>Dugaan penyebab rendemen KORA ±20%: batok basah, udara terlalu banyak (jadi abu), granul laku ikut terbuang saat ayak, penimbangan tidak konsisten — uji satu per satu.</Note>
                <Sources ids={[...a.yield_reference_pct.sourceIds, ...a.yield_kora_actual_pct.sourceIds]} confidence={a.yield_kora_actual_pct.confidence} />
              </>
            ),
          },
          {
            id: 'fraksi',
            tag: 'E–F',
            title: 'Ayak & fraksi',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {f.raw.arang.fractions.map((x) => (
                    <NumberField
                      key={x.id}
                      label={`${x.name_id} (${x.min_mm !== undefined && x.max_mm !== undefined ? `${fmt(x.min_mm, 1)}–${fmt(x.max_mm, 1)}` : x.min_mm !== undefined ? `> ${fmt(x.min_mm, 1)}` : `< ${fmt(x.max_mm!, 1)}`} mm)`}
                      unit="kg"
                      min={0}
                      max={1_000_000}
                      value={frac[x.id]}
                      onValue={(v) => setFrac((s) => ({ ...s, [x.id]: v }))}
                      hint={x.use}
                      testId={`arang-frac-${x.id}`}
                    />
                  ))}
                </div>
                {shares?.ok && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="arang-shares">
                    {Object.entries(shares.v.pct).map(([id, pct]) => (
                      <Stat key={id} label={f.raw.arang.fractions.find((x) => x.id === id)?.name_id ?? id} value={`${fmt(pct, 1)}%`} sub={fmtMass(fracFilled[id]!)} />
                    ))}
                  </div>
                )}
                <Note>Definisi fraksi masih USULAN KORA — konfirmasi dengan pembeli/lini briket. Halus BUKAN limbah: jadi bahan briket.</Note>
                <Sources ids={a.hammer_mill_kg_h.sourceIds} confidence="C" />
              </>
            ),
          },
          {
            id: 'qc',
            tag: 'E2',
            title: 'Standar mutu',
            body: (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm" data-testid="arang-standards">
                    <thead>
                      <tr className="bg-ink text-left font-mono text-[11px] text-paper">
                        <th className="p-2">STANDAR</th><th className="p-2">KA</th><th className="p-2">ABU</th><th className="p-2">VM</th><th className="p-2">FC</th><th className="p-2">LOLOS 6,3 MM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.raw.arang.standards.map((s) => (
                        <tr key={s.id} className="border-b-2 border-ink">
                          <th className="p-2 text-left">{s.name_id}</th>
                          <td className="p-2 font-mono">≤{fmt(s.moisture_max_pct)}%</td>
                          <td className="p-2 font-mono">≤{fmt(s.ash_max_pct)}%</td>
                          <td className="p-2 font-mono">≤{fmt(s.vm_max_pct)}%</td>
                          <td className="p-2 font-mono">{s.fc_min_pct !== undefined ? `≥${fmt(s.fc_min_pct)}%` : '—'}</td>
                          <td className="p-2 font-mono">{s.fines_max_pct !== undefined ? `≤${fmt(s.fines_max_pct)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Note>Angka lama &quot;KA 6–8%, abu 8%, FC 77%, 5.000 kal&quot; adalah standar BRIKET (SNI 01-6235-2000), bukan arang batok — sudah dipisah.</Note>
                <Sources ids={f.raw.arang.standards.flatMap((s) => s.source_ids)} confidence="B" />
              </>
            ),
          },
        ]}
      />
      <WarningList warnings={out.warnings as CalcWarning[]} />
    </div>
  );
}
