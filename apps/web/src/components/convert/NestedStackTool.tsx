'use client';

import { cmToM, kg, nestedCapacity, overrideParam, OverrideOutOfRangeError } from '@gemas/calc-engine';
import { getForm } from '@gemas/dataset';
import { useMemo, useState } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { NumberField } from '@/components/ui/fields';
import { fmt } from '@/lib/format';
import { useDataset } from '@/lib/useDataset';

/** US-05 / calc_spec §3.4 — tumpukan bersarang arang belah 2. Parameter dari dataset (form halves_nested). */
export function NestedStackTool() {
  const ds = useDataset();
  const p = getForm(ds, 'arang_batok_belah2', 'halves_nested').params;
  const depth = p['geometry.charcoal_half.depth']!;
  const pitch = p['geometry.nest_pitch']!;
  const rim = p['geometry.charcoal_half.rim_diameter']!;
  const mass = p['mass_per_unit.charcoal_half']!;

  const [heightCm, setHeightCm] = useState<number | undefined>(100);
  const [depthCm, setDepthCm] = useState<number>();
  const [pitchCm, setPitchCm] = useState<number>();

  const r = useMemo(() => {
    if (!heightCm) return undefined;
    try {
      const cup = depthCm !== undefined ? overrideParam(depth, depthCm / 100) : depth;
      const pit = pitchCm !== undefined ? overrideParam(pitch, pitchCm / 100) : pitch;
      // Satu kolom: ruang selebar satu diameter mulut (columns = 1).
      const d = cmToM(rim.typ * 100);
      const out = nestedCapacity({
        space: { L: d, W: d, H: cmToM(heightCm), payloadKg: kg(Number.MAX_SAFE_INTEGER) },
        rimDiameter: { ...rim, min: rim.typ, max: rim.typ },
        cupHeight: cup,
        pitch: pit,
        unitMass: mass,
        context: { commodityCode: 'arang_batok_belah2' },
      });
      return { ok: true as const, out };
    } catch (e) {
      return { ok: false as const, msg: e instanceof OverrideOutOfRangeError ? `Di luar rentang wajar (${fmt(e.accepted.min * 100, 2)}–${fmt(e.accepted.max * 100, 2)} cm)` : String(e) };
    }
  }, [heightCm, depthCm, pitchCm, depth, pitch, rim, mass]);

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="nest-h">
      <h2 id="nest-h" className="text-xl">Tumpukan arang bersarang</h2>
      <p className="text-[13px]">Arang belah 2 utuh disusun saling masuk. Berapa keping dalam satu kolom?</p>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Tinggi kolom" unit="cm" value={heightCm} min={1} max={500} onValue={setHeightCm} testId="nest-height" />
        <NumberField label="Tinggi cup" unit="cm" value={depthCm} min={0.1} onValue={setDepthCm} hint={`Dataset ${fmt(depth.typ * 100, 1)}`} testId="nest-depth"
          error={r && !r.ok && depthCm !== undefined ? r.msg : undefined} />
        <NumberField label="Tambah / keping" unit="cm" value={pitchCm} min={0.1} onValue={setPitchCm} hint={`Dataset ${fmt(pitch.typ * 100, 1)}`} testId="nest-pitch"
          error={r && !r.ok && pitchCm !== undefined ? r.msg : undefined} />
      </div>
      {r?.ok && (
        <div className="flex flex-col gap-1 bg-acid p-2 font-mono text-sm" data-testid="nest-result">
          <span className="font-bold">= {fmt(r.out.result.typ.perColumn)} keping / kolom</span>
          <span className="text-xs">
            Rentang {fmt(r.out.result.min.perColumn)}–{fmt(r.out.result.max.perColumn)} keping · ≈ {fmt(r.out.result.typ.massKg, 2)} kg/kolom{' '}
            <ConfidenceBadge c={r.out.confidence} />
          </span>
        </div>
      )}
    </section>
  );
}
