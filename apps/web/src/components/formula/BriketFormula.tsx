'use client';

import { briquetteMix, checkSpec, fixedCarbonPct, type BriquetteSpec, type CalcWarning, type PieceShape, type SpecMeasurement } from '@gemas/calc-engine';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Hint } from '@/components/ui/Hint';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt, fmtMass } from '@/lib/format';
import { BigResult, Bom, CalcError, Note, paramText, rangeText, safe, Sources, useFormula, Wizard } from './shared';

type VariantId = 'shisha' | 'bbq' | 'custom';
type Basis = 'charcoal' | 'target';
type ShapeKind = 'cube' | 'box' | 'mass';

const SPEC_LABEL: Record<keyof BriquetteSpec, { label: string; unit: string; min: boolean }> = {
  moisture_max_pct: { label: 'Kadar air', unit: '%', min: false },
  ash_max_pct: { label: 'Kadar abu', unit: '%', min: false },
  vm_max_pct: { label: 'Zat terbang (VM)', unit: '%', min: false },
  fc_min_pct: { label: 'Karbon terikat (FC)', unit: '%', min: true },
  calorific_min_kcal_kg: { label: 'Nilai kalor', unit: 'kkal/kg', min: true },
  burn_min_min: { label: 'Waktu bakar', unit: 'menit', min: true },
  ignition_max_min: { label: 'Waktu nyala', unit: 'menit', min: false },
  broken_max_pct: { label: 'Pecah / cacat', unit: '%', min: false },
};

export function BriketFormula({ variantId }: { variantId: VariantId }) {
  const f = useFormula();
  const b = f.briket;
  const variant = b.variants.find((v) => v.id === variantId)!;

  const [basis, setBasis] = useState<Basis>('charcoal');
  const [amount, setAmount] = useState(100);
  const [mcCharcoal, setMcCharcoal] = useState(b.charcoal_powder_moisture_pct.typ);
  const [binder, setBinder] = useState(b.binder_pct.typ);
  const [mcBinder, setMcBinder] = useState(b.binder_moisture_pct.typ);
  const [mcDough, setMcDough] = useState(b.dough_moisture_pct.typ);
  const [mcFinal, setMcFinal] = useState(b.final_moisture_pct.typ);
  const [shapeKind, setShapeKind] = useState<ShapeKind>(variant.shape === 'cube' ? 'cube' : variant.shape === 'pillow' ? 'box' : 'cube');
  // Varian custom tanpa dimensi → mulai dari kubus varian shisha (dataset), bisa diubah.
  const [side, setSide] = useState(variant.dims_mm?.side ?? b.variants.find((v) => v.id === 'shisha')!.dims_mm!.side!);
  const [box, setBox] = useState<{ l?: number; w?: number; h?: number }>({ l: variant.dims_mm?.length, w: variant.dims_mm?.width, h: undefined });
  const [pieceG, setPieceG] = useState<number>();
  const [spec, setSpec] = useState<BriquetteSpec>(variant.spec);
  const [lab, setLab] = useState<SpecMeasurement & { vm?: number }>({});

  const piece: PieceShape | undefined =
    shapeKind === 'cube' ? { kind: 'cube', sideMm: side } : shapeKind === 'box' ? (box.l && box.w && box.h ? { kind: 'box', lengthMm: box.l, widthMm: box.w, heightMm: box.h } : undefined) : pieceG ? { kind: 'mass', grams: pieceG } : undefined;

  const calc = useMemo(
    () =>
      safe(() =>
        briquetteMix({
          ...(basis === 'charcoal' ? { charcoalKg: amount } : { targetProductKg: amount }),
          charcoalMoisturePct: mcCharcoal,
          binderPct: binder,
          binderMoisturePct: mcBinder,
          doughMoisturePct: mcDough,
          finalMoisturePct: mcFinal,
          hotWaterSharePct: b.binder_hot_water_share_pct.typ,
          ...(piece && { piece }),
          density: variant.density,
          binderRange: b.binder_pct,
          doughMoistureRange: b.dough_moisture_pct,
          ...(spec.moisture_max_pct !== undefined && { specMoistureMaxPct: spec.moisture_max_pct }),
          datasetVersion: `formula.${f.version}`,
        }),
      ),
    [basis, amount, mcCharcoal, binder, mcBinder, mcDough, mcFinal, piece?.kind, side, box, pieceG, spec, b, variant, f.version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // FC dihitung proksimat bila KA, abu, VM diisi.
  const labWithFc: SpecMeasurement = { ...lab };
  if (lab.moisture_max_pct !== undefined && lab.ash_max_pct !== undefined && lab.vm !== undefined) {
    labWithFc.fc_min_pct = fixedCarbonPct(lab.moisture_max_pct, lab.ash_max_pct, lab.vm);
  }
  if (lab.vm !== undefined) labWithFc.vm_max_pct = lab.vm;
  const checks = checkSpec(spec, labWithFc);

  const water = f.raw.briket.process_water;
  const powder = f.raw.arang.fractions.find((x) => x.id === 'powder')!;
  const mesh2 = f.raw.arang.fractions.find((x) => x.id === 'mesh2')!;
  const wellPhLow = water.kora_well.ph < water.ph_min;

  const inputs = (
    <div className="flex flex-col gap-3">
      <ChoiceGroup
        legend="Hitung dari"
        columns={2}
        value={basis}
        onChange={setBasis}
        options={[
          { value: 'charcoal', label: 'Serbuk arang yang ada', testId: `${variantId}-basis-charcoal` },
          { value: 'target', label: 'Target briket jadi', testId: `${variantId}-basis-target` },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label={basis === 'charcoal' ? 'Serbuk arang' : 'Target briket'} unit="kg" min={0.1} max={10_000_000} value={amount} onValue={(v) => v && setAmount(v)} testId={`${variantId}-amount`} />
        <NumberField label={<>Perekat tapioka <Hint k="perekat" /></>} unit="%" min={0} max={40} value={binder} onValue={(v) => v !== undefined && setBinder(v)} hint={`FAO ${paramText(b.binder_pct, 0)}`} testId={`${variantId}-binder`} />
        <NumberField label={<>KA adonan <Hint k="adonan" /></>} unit="%" min={1} max={80} value={mcDough} onValue={(v) => v && setMcDough(v)} hint={`SOP ${paramText(b.dough_moisture_pct, 0)}`} testId={`${variantId}-dough`} />
        <NumberField label="KA briket jadi" unit="%" min={0.5} max={30} value={mcFinal} onValue={(v) => v && setMcFinal(v)} hint={spec.moisture_max_pct !== undefined ? `Spesifikasi maks ${fmt(spec.moisture_max_pct)}%` : undefined} testId={`${variantId}-final`} />
      </div>
    </div>
  );

  if (!calc.ok) {
    return (
      <div className="flex flex-col gap-4">
        {inputs}
        <CalcError message={calc.message} />
      </div>
    );
  }
  const out = calc.v;
  const t = out.result.typ;
  const r = out.result;

  return (
    <div className="flex flex-col gap-5" data-testid={`formula-${variantId}`}>
      {inputs}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <BigResult
          label={basis === 'charcoal' ? 'BRIKET JADI' : 'SERBUK ARANG DIBUTUHKAN'}
          value={fmt(basis === 'charcoal' ? t.productKg : t.charcoalKg, 1)}
          unit="KG"
          sub={
            t.pieces > 0
              ? `≈ ${fmt(t.pieces)} biji · ${rangeText({ min: r.min.pieceG, typ: t.pieceG, max: r.max.pieceG }, 1, 'g')}/biji · ${fmt(t.piecesPerKg, 0)} biji/kg`
              : 'Isi ukuran / berat per biji untuk menghitung jumlah biji'
          }
          confidence={out.confidence}
          testId={`${variantId}-result`}
        />
        <Bom
          testId={`${variantId}-bom`}
          rows={[
            { name: 'Serbuk arang', amount: fmtMass(t.charcoalKg), note: `KA ${fmt(mcCharcoal)}% · fraksi powder/mesh-2` },
            { name: 'Tepung tapioka', amount: fmtMass(t.binderKg), note: `${fmt(binder, 1)}% dari arang` },
            { name: 'Air panas (masak perekat)', amount: `${fmt(t.hotWaterKg, 1)} L`, note: `≥${fmt(b.gelatinization_min_c.typ)}°C` },
            { name: 'Air dingin', amount: `${fmt(t.coldWaterKg, 1)} L` },
            { name: 'Adonan', amount: fmtMass(t.doughKg) },
            { name: 'Air diuapkan di oven', amount: `${fmt(t.evaporatedKg, 1)} kg` },
          ]}
        />
      </div>

      <Wizard
        label={`Tahap ${variant.name_id}`}
        testId={`${variantId}-wizard`}
        steps={[
          {
            id: 'serbuk',
            tag: 'BAHAN',
            title: 'Serbuk arang',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="KA serbuk arang" unit="%" min={0} max={40} value={mcCharcoal} onValue={(v) => v !== undefined && setMcCharcoal(v)} hint={`Umum ${paramText(b.charcoal_powder_moisture_pct, 0)}`} testId={`${variantId}-mc-charcoal`} />
                  <Stat label={`Fraksi ${powder.name_id}`} value={`< ${fmt(powder.max_mm!, 1)} mm`} sub={`+ ${mesh2.name_id} ${fmt(mesh2.min_mm!, 1)}–${fmt(mesh2.max_mm!, 1)} mm (usulan KORA)`} />
                  <Stat label="Arang tempurung" value="Lolos QC" sub="Abu rendah = abu briket rendah" />
                </div>
                <p className="text-sm">Gunakan arang yang sudah matang (VM ≤15%) dan dingin. Arang mentah → bau & asap; abu tinggi dari arang terbawa ke briket.</p>
                <Sources ids={b.charcoal_powder_moisture_pct.sourceIds} confidence={b.charcoal_powder_moisture_pct.confidence} />
              </>
            ),
          },
          {
            id: 'perekat',
            tag: 'BINDER',
            title: 'Masak perekat',
            body: (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="KA tepung tapioka" unit="%" min={0} max={20} value={mcBinder} onValue={(v) => v !== undefined && setMcBinder(v)} hint="SNI 3451:2011 maks 14%" testId={`${variantId}-mc-binder`} />
                  <Stat label="Tapioka" value={fmtMass(t.binderKg)} accent />
                  <Stat label="Air panas : dingin" value={`${fmt(b.binder_hot_water_share_pct.typ)} : ${fmt(100 - b.binder_hot_water_share_pct.typ)}`} sub={`${fmt(t.hotWaterKg, 1)} L : ${fmt(t.coldWaterKg, 1)} L`} />
                </div>
                <p className="text-sm">
                  Larutkan tapioka dengan air dingin dulu, lalu tuang air panas sambil diaduk sampai bening-kental (tergelatinisasi ≥{fmt(b.gelatinization_min_c.typ)}°C). Perekat kurang matang → briket rapuh.
                </p>
                <Note>
                  Air proses: TDS &lt;{fmt(water.tds_max_ppm)} ppm, pH {fmt(water.ph_min, 1)}–{fmt(water.ph_max, 1)}, besi &lt;{fmt(water.fe_max_mg_l, 1)} mg/L. Sumur bor KORA: TDS {fmt(water.kora_well.tds_ppm)} ppm ✓, pH{' '}
                  <strong>{fmt(water.kora_well.ph, 2)}</strong> {wellPhLow ? '— sedikit asam, pantau (bisa memperlambat gelatinisasi)' : '✓'}. Fe belum diukur — besi tinggi membuat abu tidak putih.
                </Note>
                <Sources ids={[...b.binder_pct.sourceIds, ...water.source_ids]} confidence={b.binder_pct.confidence} />
              </>
            ),
          },
          {
            id: 'adonan',
            tag: 'MIX',
            title: 'Adonan & aging',
            body: (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Adonan" value={fmtMass(t.doughKg)} accent />
                  <Stat label="Air total" value={`${fmt(t.waterKg, 1)} L`} />
                  <Stat label="Aging" value={paramText(b.aging_h, 0, 'jam')} sub="'Semalam' sebelum cetak" />
                </div>
                <p className="text-sm">Aduk sampai rata, kadar air {paramText(b.dough_moisture_pct, 0, '%')} merata (ukur, jangan dikira). Diamkan tertutup sebelum cetak agar ikatan antarpartikel kuat.</p>
                <Sources ids={b.dough_moisture_pct.sourceIds} confidence={b.dough_moisture_pct.confidence} />
              </>
            ),
          },
          {
            id: 'cetak',
            tag: 'PRESS',
            title: 'Cetak',
            body: (
              <>
                <ChoiceGroup
                  legend="Ukuran biji"
                  columns={3}
                  value={shapeKind}
                  onChange={setShapeKind}
                  options={[
                    { value: 'cube', label: 'Kubus', testId: `${variantId}-shape-cube` },
                    { value: 'box', label: 'Balok / pillow', testId: `${variantId}-shape-box` },
                    { value: 'mass', label: 'Timbang per biji', testId: `${variantId}-shape-mass` },
                  ]}
                />
                {shapeKind === 'cube' && (
                  <NumberField label="Sisi kubus" unit="mm" min={5} max={200} value={side} onValue={(v) => v && setSide(v)} hint={variant.dim_tolerance_mm ? `Toleransi ±${fmt(variant.dim_tolerance_mm)} mm` : undefined} testId={`${variantId}-side`} />
                )}
                {shapeKind === 'box' && (
                  <div className="grid grid-cols-3 gap-3">
                    <NumberField label="Panjang" unit="mm" min={5} max={500} value={box.l} onValue={(v) => setBox((x) => ({ ...x, l: v }))} />
                    <NumberField label="Lebar" unit="mm" min={5} max={500} value={box.w} onValue={(v) => setBox((x) => ({ ...x, w: v }))} />
                    <NumberField label="Tebal" unit="mm" min={2} max={200} value={box.h} onValue={(v) => setBox((x) => ({ ...x, h: v }))} hint={variant.shape === 'pillow' ? 'Belum ada di SOP — ukur' : undefined} testId={`${variantId}-thick`} />
                  </div>
                )}
                {shapeKind === 'mass' && <NumberField label="Berat per biji (setelah kering)" unit="g" min={0.5} max={5000} value={pieceG} onValue={setPieceG} testId={`${variantId}-piece-g`} />}
                {variant.shape === 'pillow' && shapeKind === 'box' && <Note>Pillow tidak persis balok — hitungan balok sedikit berlebih. Paling akurat: timbang 10 biji kering, pakai &quot;Timbang per biji&quot;.</Note>}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Berat per biji" value={t.pieceG > 0 ? rangeText({ min: r.min.pieceG, typ: t.pieceG, max: r.max.pieceG }, 1, 'g') : '—'} sub={`Densitas ${paramText(variant.density, 2, 'g/cm³')}`} />
                  <Stat label="Jumlah biji" value={t.pieces > 0 ? fmt(t.pieces) : '—'} accent testId={`${variantId}-pieces`} />
                  <Stat label="Biji per kg" value={t.piecesPerKg > 0 ? fmt(t.piecesPerKg, 0) : '—'} />
                </div>
                <Sources ids={variant.density.sourceIds} confidence={variant.density.confidence} />
              </>
            ),
          },
          {
            id: 'oven',
            tag: 'DRY',
            title: 'Angin & oven',
            body: (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Angin-anginkan" value={paramText(b.predry_h, 0, 'jam')} sub="Cegah kulit keras (case hardening)" />
                  <Stat label="Suhu oven" value={paramText(b.oven_temp_c, 0, '°C')} sub="Naik bertahap" />
                  <Stat label="Lama oven" value={paramText(b.oven_h, 0, 'jam')} />
                  <Stat label="Air diuapkan" value={`${fmt(t.evaporatedKg, 1)} kg`} accent />
                </div>
                <Note>Kering sampai KA ≤{fmt(spec.moisture_max_pct ?? mcFinal)}% sebelum kemas; jangan kemas hangat. Abu belang/hitam = cek sumber kontaminasi (besi, liat, air tidak tersaring).</Note>
                <Sources ids={[...b.oven_temp_c.sourceIds, ...b.oven_h.sourceIds]} confidence={b.oven_h.confidence} />
              </>
            ),
          },
          {
            id: 'uji',
            tag: 'QC',
            title: 'Uji mutu',
            body: (
              <>
                <p className="text-sm">{variant.spec_note}</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm" data-testid={`${variantId}-spec`}>
                    <thead>
                      <tr className="bg-ink text-left font-mono text-[11px] text-paper">
                        <th className="p-2">PARAMETER</th>
                        <th className="p-2">BATAS</th>
                        <th className="p-2">HASIL UJI</th>
                        <th className="p-2">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.keys(SPEC_LABEL) as (keyof BriquetteSpec)[])
                        .filter((k) => spec[k] !== undefined || variantId === 'custom')
                        .map((k) => {
                          const meta = SPEC_LABEL[k];
                          const check = checks.find((c) => c.key === k);
                          const labKey = k === 'vm_max_pct' ? 'vm' : k;
                          const isFc = k === 'fc_min_pct';
                          return (
                            <tr key={k} className="border-b-2 border-ink">
                              <th className="p-2 text-left">{meta.label}</th>
                              <td className="p-2">
                                {variantId === 'custom' ? (
                                  <NumberField
                                    label={<span className="sr-only">Batas {meta.label}</span>}
                                    unit={`${meta.min ? '≥' : '≤'} ${meta.unit}`}
                                    min={0}
                                    max={100000}
                                    value={spec[k]}
                                    onValue={(v) => setSpec((s) => ({ ...s, [k]: v }))}
                                  />
                                ) : (
                                  <span className="font-mono">{meta.min ? '≥' : '≤'} {fmt(spec[k] ?? 0)} {meta.unit}</span>
                                )}
                              </td>
                              <td className="p-2">
                                {isFc ? (
                                  <span className="font-mono text-xs">{labWithFc.fc_min_pct !== undefined ? `${fmt(labWithFc.fc_min_pct, 1)}% (100 − KA − abu − VM)` : 'otomatis dari KA, abu, VM'}</span>
                                ) : (
                                  <NumberField
                                    label={<span className="sr-only">Hasil {meta.label}</span>}
                                    unit={meta.unit}
                                    min={0}
                                    max={100000}
                                    value={labKey === 'vm' ? lab.vm : lab[k]}
                                    onValue={(v) => setLab((x) => ({ ...x, [labKey]: v }))}
                                    testId={`${variantId}-lab-${k}`}
                                  />
                                )}
                              </td>
                              <td className="p-2 font-bold" data-testid={`${variantId}-status-${k}`}>
                                {check ? (check.pass ? <span className="bg-acid px-1">LOLOS</span> : <span className="bg-safety px-1">GAGAL</span>) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <Note>
                  Data jurnal briket tempurung + tapioka: {paramText(b.literature_calorific_cal_g, 0, 'kal/g')}. Perekat makin banyak → kalor turun. Spesifikasi pembeli (mis. ≥7.000 kkal/kg) wajib dicek ke lab terakreditasi.
                </Note>
                <Sources ids={[...variant.source_ids, ...b.literature_calorific_cal_g.sourceIds]} confidence={b.literature_calorific_cal_g.confidence} />
              </>
            ),
          },
        ]}
      />
      <WarningList warnings={out.warnings as CalcWarning[]} />
    </div>
  );
}
