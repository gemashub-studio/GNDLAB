'use client';

import { blendRawMaterial, BLEND_KEYS, originBlend, type BlendKey, type OriginProps } from '@gemas/calc-engine';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { PackCalculator, usePackOptions } from './KemasTab';
import { BigResult, CalcError, ChainSources, getForm, Note, paramText, safe, SopList, Table, useChain, useDataset, useFormula } from './shared';

const LABEL: Record<BlendKey, { name: string; unit: string }> = {
  moisture_max_pct: { name: 'Kadar air', unit: '%' },
  ash_max_pct: { name: 'Kadar abu', unit: '%' },
  vm_max_pct: { name: 'Zat terbang (VM)', unit: '%' },
  fc_min_pct: { name: 'Karbon terikat (FC)', unit: '%' },
  calorific_min_kcal_kg: { name: 'Nilai kalor', unit: 'kkal/kg' },
};

type VariantId = 'shisha' | 'bbq' | 'custom';

/** Volume 1 biji (cm³) dari ukuran katalog; heksagonal = prisma (lubang tengah diabaikan → batas atas). */
function shapeVolumeCm3(shape: string, d: readonly [number, number, number]): number {
  const [a, b, c] = d;
  if (shape === 'hexagonal') return ((Math.sqrt(3) / 2) * a * a * c) / 1000;
  return (a * b * c) / 1000;
}

export function BriketTab() {
  const c = useChain();
  const f = useFormula();
  const ds = useDataset();
  const halfShell = getForm(ds, 'arang_batok_belah2', 'raw_halves').params['mass_per_unit.raw_half_shell']!;
  const [variant, setVariant] = useState<VariantId>('shisha');
  const v = f.briket.variants.find((x) => x.id === variant)!;
  const [dt, setDt] = useState<OriginProps>({});
  const [dr, setDr] = useState<OriginProps>({});
  const [share, setShare] = useState<number | undefined>(50);
  const [powder, setPowder] = useState<number | undefined>(100);

  const blend = useMemo(() => (share !== undefined ? safe(() => originBlend(dt, dr, share, v.spec)) : undefined), [dt, dr, share, v]);
  const raw = useMemo(
    () => (powder && share !== undefined ? safe(() => blendRawMaterial({ charcoalKg: powder, dtSharePct: share, yieldPct: f.arang.yield_reference_pct, datasetVersion: `rantai.${c.version}` })) : undefined),
    [powder, share, f, c.version],
  );
  const shellPerNut = 2 * halfShell.typ;
  const options = usePackOptions().filter((o) => o.id.startsWith('mb'));
  const keys = BLEND_KEYS.filter((k) => k in v.spec);

  return (
    <div className="flex flex-col gap-5" data-testid="chain-briket">
      <ChoiceGroup<VariantId>
        legend="Produk briket"
        columns={3}
        value={variant}
        onChange={setVariant}
        options={f.briket.variants.map((x) => ({ value: x.id as VariantId, label: x.name_id, testId: `briket-v-${x.id}` }))}
      />
      <Note tone="finding" title="Campuran batok DT : DR">{c.raw.briquette.origin_blend_note}</Note>

      <section className="card flex flex-col gap-3" aria-label="Hasil lab per asal">
        <h3 className="text-xl">Hasil lab arang per asal (proksimat)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="font-mono text-[11px] uppercase">
                <th className="p-1 text-left">Parameter</th>
                <th className="p-1 text-left">DT (&gt;500 mdpl)</th>
                <th className="p-1 text-left">DR (≤500 mdpl)</th>
                <th className="p-1 text-left">Spek {v.name_id}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className="border-t-2 border-ink">
                  <th className="p-1 text-left">{LABEL[k].name}</th>
                  <td className="p-1">
                    <NumberField label={<span className="sr-only">{LABEL[k].name} DT</span>} unit={LABEL[k].unit} min={0} max={10000} value={dt[k]} onValue={(x) => setDt((p) => ({ ...p, [k]: x }))} testId={`briket-dt-${k}`} />
                  </td>
                  <td className="p-1">
                    <NumberField label={<span className="sr-only">{LABEL[k].name} DR</span>} unit={LABEL[k].unit} min={0} max={10000} value={dr[k]} onValue={(x) => setDr((p) => ({ ...p, [k]: x }))} testId={`briket-dr-${k}`} />
                  </td>
                  <td className="p-1 font-mono">{k.includes('_min_') ? '≥' : '≤'} {fmt(v.spec[k]!, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NumberField label="Porsi batok DT dalam campuran" unit="%" min={0} max={100} value={share} onValue={setShare} hint={`DR = ${share === undefined ? '—' : fmt(100 - share, 0)}%`} testId="briket-share" />
        {blend && !blend.ok && <CalcError message={blend.message} />}
        {blend?.ok && (
          <>
            {blend.v.checks.length ? (
              <Table
                testId="briket-blend"
                head={['Parameter', 'Campuran', 'Batas', 'Status']}
                rows={blend.v.checks.map((x) => [
                  LABEL[x.key as BlendKey]?.name ?? x.key,
                  fmt(x.value, 2),
                  `${x.key.includes('_min_') ? '≥' : '≤'} ${fmt(x.limit, 0)}`,
                  <span key="s" className={`px-1 font-bold ${x.pass ? 'bg-acid' : 'bg-safety'}`} data-testid={`briket-status-${x.key}`}>{x.pass ? 'LOLOS' : 'GAGAL'}</span>,
                ])}
              />
            ) : (
              <p className="text-sm text-muted">Isi hasil lab DT & DR (minimal satu parameter yang sama) untuk melihat campuran.</p>
            )}
            {blend.v.checks.length > 0 && (
              <p className="font-bold" data-testid="briket-feasible">
                {blend.v.feasible ? `Porsi DT yang memenuhi spek: ${fmt(blend.v.feasible.lo, 0)}–${fmt(blend.v.feasible.hi, 0)}%` : 'Tidak ada rasio DT:DR yang memenuhi semua batas — ganti lot batok.'}
              </p>
            )}
            <WarningList warnings={blend.v.warnings} />
          </>
        )}
        <p className="font-mono text-[11px] text-muted">
          Kadar air, abu, VM, FC & kalor bercampur linear menurut massa. Kekuatan tekan & warna abu TIDAK linear — uji bakar & uji tekan campuran final (Ceklis QC briket).
        </p>
      </section>

      <section className="card flex flex-col gap-3" aria-label="Bahan baku per asal">
        <h3 className="text-xl">Bahan baku per asal</h3>
        <NumberField label="Serbuk arang dibutuhkan" unit="kg" min={1} max={10_000_000} value={powder} onValue={setPowder}
          hint={<>Dari resep di <Link href={`/formula?p=${variant}`}>Formula R&amp;D → {v.name_id}</Link> (perekat {paramText(f.briket.binder_pct, 0)}%, adonan {paramText(f.briket.dough_moisture_pct, 0)}% air)</>} testId="briket-powder" />
        {raw && !raw.ok && <CalcError message={raw.message} />}
        {raw?.ok && (
          <>
            <BigResult label="BATOK DT + DR" value={fmt(raw.v.result.typ.dtShellKg + raw.v.result.typ.drShellKg, 0)} unit="KG BATOK" sub={`rendemen arang ${paramText(f.arang.yield_reference_pct, 0)}%`} confidence={raw.v.confidence} testId="briket-shell" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Arang DT" value={`${fmt(raw.v.result.typ.dtCharcoalKg, 1)} kg`} />
              <Stat label="Batok DT" value={`${fmt(raw.v.result.typ.dtShellKg, 0)} kg`} sub={`±${fmt(raw.v.result.typ.dtShellKg / shellPerNut, 0)} butir kelapa`} testId="briket-dt-shell" />
              <Stat label="Arang DR" value={`${fmt(raw.v.result.typ.drCharcoalKg, 1)} kg`} />
              <Stat label="Batok DR" value={`${fmt(raw.v.result.typ.drShellKg, 0)} kg`} sub={`±${fmt(raw.v.result.typ.drShellKg / shellPerNut, 0)} butir kelapa`} />
            </div>
          </>
        )}
        <ChainSources ids={f.arang.yield_reference_pct.sourceIds} confidence={f.arang.yield_reference_pct.confidence} />
      </section>

      <section className="flex flex-col gap-2" aria-label="Bentuk briket">
        <h3 className="text-xl">Bentuk & ukuran pasar</h3>
        <Table
          testId="briket-shapes"
          head={['Bentuk', 'Ukuran (mm)', 'Volume/biji', `Biji per kg (ρ ${paramText(v.density, 2)} g/cm³)`]}
          rows={c.raw.briquette.shapes.flatMap((s) =>
            s.dims_mm.length
              ? s.dims_mm.map((d, i) => {
                  const vol = shapeVolumeCm3(s.id, d);
                  return [i === 0 ? <strong key="n">{s.name_id}</strong> : '', d.join(' × '), `${fmt(vol, 1)} cm³`, `±${fmt(1000 / (vol * v.density.typ), 0)}`];
                })
              : [[<strong key="n">{s.name_id}</strong>, s.note ?? '—', '—', '—']],
          )}
        />
        <ChainSources ids={c.raw.briquette.shapes_source_ids} confidence="C" />
      </section>

      <PackCalculator options={options} defaultKg={c.packing.briquette_20ft_net_kg.typ} prefix="briket" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Acuan 20ft (master box, lepas)" value={`${fmt(c.packing.briquette_20ft_net_kg.min / 1000, 1)}–${fmt(c.packing.briquette_20ft_net_kg.max / 1000, 1)} t`} />
        {c.raw.packing.bbq_20ft_net_kg.map((b) => (
          <Stat key={b.shape} label={`BBQ ${b.shape} per 20ft`} value={`${fmt(b.net.min / 1000, 1)}–${fmt(b.net.max / 1000, 1)} t`} />
        ))}
      </div>

      <SopList
        title={`Briket ${v.name_id}`}
        testId="sop-briket"
        steps={[
          'Pilih lot arang per asal yang sudah diuji proksimat; tentukan porsi DT:DR dari kalkulator di atas.',
          'Giling & ayak arang (lihat tab Arang); timbang serbuk DT dan DR terpisah, catat kode lotnya di form batch.',
          `Masak perekat tapioka (gelatinisasi ≥ ${paramText(f.briket.gelatinization_min_c, 0)} °C) — takaran di Formula R&D.`,
          `Aduk serbuk + perekat + air sampai KA adonan ${paramText(f.briket.dough_moisture_pct, 0)}%; uji kepal.`,
          'Cetak (press) sesuai bentuk; buang yang retak/rompal kembali ke adonan.',
          `Angin-anginkan ${paramText(f.briket.predry_h, 0)} jam, oven ${paramText(f.briket.oven_temp_c, 0)} °C selama ${paramText(f.briket.oven_h, 0)} jam sampai KA ≤ spek.`,
          'Uji mutu per batch (KA, abu, kalor, waktu bakar, warna abu, kuat jatuh) → kemas inner box/plastik → master box berlabel lot & asal.',
        ]}
        tools={['Hammer mill + ayakan', 'Mixer adonan', 'Kompor/panci perekat', 'Mesin cetak (press)', 'Rak angin-angin', 'Oven briket', 'Timbangan', 'Inner box/plastik + master box']}
      />
    </div>
  );
}
