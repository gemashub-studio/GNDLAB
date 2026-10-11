'use client';

import { bioleatherBatch, dyeRecipe, finishRecipe, plasticizerRecipe, point, type PlasticizerBasis } from '@gemas/calc-engine';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { fmt } from '@/lib/format';
import { Bom, CalcError, Note, paramText, safe, Sources, useFormula } from './shared';

/**
 * Pilihan metode bioleather (dataset formula v1.1.0): kultur, plastisasi A/B/C, pewarna alami,
 * finishing tahan air — takaran dihitung dari ukuran batch di atas.
 */
export function BioleatherMethods({ mediaL, cultureDays, areaCm2 }: { mediaL: number; cultureDays: number; areaCm2: number }) {
  const f = useFormula();
  const b = f.bioleather;
  const [plastId, setPlastId] = useState(b.plasticizers[0]!.id);
  const [dyeId, setDyeId] = useState<string>('none');
  const [finishId, setFinishId] = useState(b.finishes[0]!.id);
  const [bathL, setBathL] = useState<number | undefined>(Math.max(1, Math.round(mediaL)));
  const [coverage, setCoverage] = useState<number | undefined>();

  // Kultur: tiap metode dihitung dengan mesin bioleather yang sama, hanya hasil basah/hari yang beda.
  const culture = useMemo(
    () =>
      b.cultureMethods.map((m) => {
        const y = m.p.wet_yield_g_l_day;
        const r = y
          ? safe(() =>
              bioleatherBatch({
                mediaL,
                sucroseGPerL: b.sucrose_g_l.typ,
                zaGPerL: b.za_g_l.typ,
                starterPct: b.starter_pct.typ,
                cultureDays: { ...b.culture_days, ...point(cultureDays) },
                wetYieldGPerLDay: y,
                dryFraction: b.dry_fraction_of_wet,
                naohM: b.naoh_m.typ,
                naohSolutionL: mediaL,
                glycerolPct: b.glycerol_pct.typ,
                plastSolutionL: mediaL,
                datasetVersion: `formula.${f.version}`,
              }),
            )
          : undefined;
        return { m, r };
      }),
    [b, mediaL, cultureDays, f.version],
  );
  const dryTyp = culture.find((x) => x.m.id === 'sekali')?.r;
  const bcDryG = dryTyp?.ok ? dryTyp.v.result.typ.drySheetG : 0;

  const plast = b.plasticizers.find((x) => x.id === plastId)!;
  const basis: PlasticizerBasis = plast.p.glycerol_pct_bath
    ? { kind: 'bath_pct', glycerolPct: plast.p.glycerol_pct_bath }
    : plast.p.glycerol_pct_of_bc
      ? { kind: 'bc_pct', glycerolPctOfBc: plast.p.glycerol_pct_of_bc }
      : { kind: 'glycerin_ethanol', glycerinFraction: plast.p.glycerin_ethanol_ratio! };
  const pr = useMemo(() => safe(() => plasticizerRecipe({ basis, bathL: bathL ?? 0, bcDryG, datasetVersion: `formula.${f.version}` })), [basis, bathL, bcDryG, f.version]);

  const dye = b.dyes.find((x) => x.id === dyeId);
  const dr = useMemo(
    () =>
      dye
        ? safe(() =>
            dyeRecipe({
              bathL: bathL ?? 0,
              fiberDryG: bcDryG,
              ...(dye.p.mordant_g_l && { mordantGPerL: dye.p.mordant_g_l }),
              ...(dye.p.salt_g_l && { saltGPerL: dye.p.salt_g_l }),
              ...(dye.p.dye_pct_of_fiber && { dyePctOfFiber: dye.p.dye_pct_of_fiber }),
            }),
          )
        : undefined,
    [dye, bathL, bcDryG],
  );

  const fin = b.finishes.find((x) => x.id === finishId)!;
  const areaM2 = areaCm2 / 10_000;
  const fr = useMemo(
    () => (coverage && areaM2 > 0 ? safe(() => finishRecipe({ areaM2, coverageGPerM2: coverage, ...(fin.p.wax_share_pct && { waxSharePct: fin.p.wax_share_pct }) })) : undefined),
    [coverage, areaM2, fin],
  );

  return (
    <section className="card flex flex-col gap-5" aria-label="Metode bioleather" data-testid="bl-methods">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xl">Metode R&amp;D bioleather</h3>
        <span className="tag-mono">KULTUR · PLASTISASI · WARNA · FINISHING</span>
      </div>

      {/* 1. Kultur */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xl">1 · Metode kultur ({fmt(mediaL, 1)} L media, {fmt(cultureDays, 0)} hari)</h4>
        <div className="grid gap-2 sm:grid-cols-3" data-testid="bl-culture">
          {culture.map(({ m, r }) => (
            <div key={m.id} className="flex flex-col gap-1 border-3 border-ink p-3" data-testid={`bl-culture-${m.id}`}>
              <p className="font-extrabold">{m.name_id}</p>
              <span className="tag-mono self-start">GRADE {m.grade}</span>
              {r?.ok ? (
                <>
                  <Stat label="Lembar kering" value={`${fmt(r.v.result.typ.drySheetG, 1)} g`} sub={`basah ±${fmt(r.v.result.typ.wetSheetG, 0)} g · ${paramText(m.p.wet_yield_g_l_day!, 1)} g/L/hari`} accent />
                </>
              ) : (
                <Stat label="Lembar kering" value="belum ada data" sub="GAP — timbang sendiri" />
              )}
              {m.note && <p className="text-[13px]">{m.note}</p>}
            </div>
          ))}
        </div>
        <Sources ids={b.cultureMethods[0]!.source_ids} confidence="B" />
      </div>

      {/* 2. Plastisasi */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xl">2 · Plastisasi (agar lentur)</h4>
        <ChoiceGroup
          legend="Resep"
          columns={3}
          value={plastId}
          onChange={setPlastId}
          options={b.plasticizers.map((x) => ({ value: x.id, label: x.name_id, testId: `bl-plast-${x.id}` }))}
        />
        <NumberField label="Volume larutan rendam / celup" unit="L" min={0.1} max={10_000} value={bathL} onValue={setBathL} hint="Cukup merendam semua lembar" testId="bl-bath" />
        {!pr.ok ? (
          <CalcError message={pr.message} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <Bom
              testId="bl-plast-bom"
              title={`Resep ${plast.id}`}
              rows={[
                ...(pr.v.result.typ.glycerolG > 0 ? [{ name: 'Gliserol', amount: `${fmt(pr.v.result.typ.glycerolG, 1)} g`, note: plast.p.glycerol_pct_bath ? `${paramText(plast.p.glycerol_pct_bath, 0)}% dari larutan` : `${paramText(plast.p.glycerol_pct_of_bc!, 0)}% dari ${fmt(bcDryG, 1)} g BC kering` }] : []),
                ...(pr.v.result.typ.glycerinMl > 0
                  ? [
                      { name: 'Gliserin', amount: `${fmt(pr.v.result.typ.glycerinMl, 0)} mL` },
                      { name: 'Etanol', amount: `${fmt(pr.v.result.typ.ethanolMl, 0)} mL`, note: 'mudah terbakar' },
                    ]
                  : []),
                ...(plast.p.glycerol_pct_bath ? [{ name: 'Air bersih', amount: `${fmt(bathL ?? 0, 1)} L` }] : []),
              ]}
            />
            <div className="grid grid-cols-2 gap-2">
              {plast.p.soak_h && <Stat label="Rendam" value={plast.p.soak_h.typ < 1 ? `${fmt(plast.p.soak_h.typ * 60, 0)} menit` : `${paramText(plast.p.soak_h, 0)} jam`} />}
              {plast.p.dry_c && <Stat label="Keringkan" value={`${paramText(plast.p.dry_c, 0)} °C`} sub={plast.p.dry_h ? `${paramText(plast.p.dry_h, 0)} jam` : 'sampai berat konstan'} />}
            </div>
          </div>
        )}
        {plast.note && <p className="text-[13px]">{plast.note}</p>}
        <Sources ids={plast.source_ids} confidence="A" />
      </div>

      {/* 3. Pewarnaan */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xl">3 · Pewarnaan alami (opsional)</h4>
        <ChoiceGroup
          legend="Pewarna"
          columns={4}
          value={dyeId}
          onChange={setDyeId}
          options={[{ value: 'none', label: 'Tanpa warna', testId: 'bl-dye-none' }, ...b.dyes.map((x) => ({ value: x.id, label: x.name_id, testId: `bl-dye-${x.id}` }))]}
        />
        {dye && dr && !dr.ok && <CalcError message={dr.message} />}
        {dye && dr?.ok && (
          <div className="grid gap-3 md:grid-cols-2">
            <Bom
              testId="bl-dye-bom"
              title={dye.name_id}
              rows={[
                ...(dr.v.result.typ.dyeG > 0 ? [{ name: 'Bubuk kopi', amount: `${fmt(dr.v.result.typ.dyeG, 1)} g`, note: `${paramText(dye.p.dye_pct_of_fiber!, 0)}% dari ${fmt(bcDryG, 1)} g lembar kering` }] : []),
                ...(dr.v.result.typ.mordantG > 0 ? [{ name: `Mordan ${dye.mordant}`, amount: `${fmt(dr.v.result.typ.mordantG, 0)} g`, note: `${paramText(dye.p.mordant_g_l!, 0)} g/L` }] : [{ name: 'Mordan', amount: '—', note: dye.mordant }]),
                ...(dr.v.result.typ.saltG > 0 ? [{ name: 'Garam (NaCl)', amount: `${fmt(dr.v.result.typ.saltG, 0)} g`, note: `${paramText(dye.p.salt_g_l!, 0)} g/L, 30 menit` }] : []),
              ]}
            />
            <div className="grid grid-cols-2 gap-2">
              {dye.p.temp_c && <Stat label="Suhu celup" value={`${paramText(dye.p.temp_c, 0)} °C`} />}
              {dye.p.time_h && <Stat label="Lama celup" value={`${fmt(dye.p.time_h.typ * 60, 0)} menit`} />}
            </div>
          </div>
        )}
        {dye?.note && <Note tone="warn">{dye.note}</Note>}
        <p className="text-[13px]">Penyamakan tanin (gambir/mimosa/asam tanat): dosis belum dipublikasikan → uji 3 tingkat + kontrol (Ceklis R&amp;D warna &amp; finishing).</p>
      </div>

      {/* 4. Finishing */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xl">4 · Finishing tahan air</h4>
        <ChoiceGroup legend="Bahan" columns={2} value={finishId} onChange={setFinishId} options={b.finishes.map((x) => ({ value: x.id, label: x.name_id, testId: `bl-fin-${x.id}` }))} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Luas lembar" value={`${fmt(areaM2, 2)} m²`} sub="dari ukuran baki di atas" />
          <Stat label="Suhu" value={`${paramText(fin.p.apply_c!, 0)} °C`} sub={`lalu ${paramText(fin.p.cure_h!, 0)} jam`} />
          <NumberField label="Takaran oles" unit="g/m²" min={1} max={2000} value={coverage} onValue={setCoverage} hint="GAP: timbang sebelum & sesudah oles di lembar uji" testId="bl-coverage" />
        </div>
        {fr && !fr.ok && <CalcError message={fr.message} />}
        {fr?.ok && (
          <Bom
            testId="bl-fin-bom"
            title={fin.name_id}
            rows={
              fin.p.wax_share_pct
                ? [
                    { name: 'Lilin karnauba', amount: `${fmt(fr.v.result.typ.waxG, 1)} g` },
                    { name: 'Minyak (tea tree)', amount: `${fmt(fr.v.result.typ.oilG, 1)} g` },
                  ]
                : [{ name: 'Resin AESO', amount: `${fmt(fr.v.result.typ.totalG, 1)} g` }]
            }
          />
        )}
        {fin.note && <p className="text-[13px]">{fin.note}</p>}
        <Note tone="warn" title="K3">Jangan memakai PU + DOP (ftalat). Etanol & minyak panas: ruang berventilasi, jauh dari api, sarung tangan tahan panas.</Note>
      </div>

      <Note title="Ceklis R&D bioleather">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/ceklis?id=rnd-blt-kultur" data-testid="bl-cl-kultur">Uji metode kultur</Link>
          <Link href="/ceklis?id=rnd-blt-plastis">Uji plastisasi A/B/C</Link>
          <Link href="/ceklis?id=rnd-blt-finish">Uji warna &amp; finishing</Link>
        </span>
      </Note>
    </section>
  );
}
