'use client';

import { useMemo, useState } from 'react';
import { ContainerCircleSim, type SimSegment } from '@/components/sim/ContainerCircleSim';
import { fmt } from '@/lib/format';
import { containerFtName } from '@/lib/imperial';
import { runContainer } from '@/lib/scenario';
import { useDataset } from '@/lib/useDataset';

const TONES: SimSegment['tone'][] = ['acid', 'safety', 'ink'];
const MAX_DRAWN = 3;

/**
 * Simulasi muat: kalau kelapa dikirim sebagai kelapa jambul (dikupas, dalam karung jaring),
 * butuh berapa container & seperti apa isinya. Kapasitas = engine (golden jambul).
 */
export function CoconutLoadSim({ lanes }: { nuts: number; lanes: { key: string; nuts: number; name: string }[] }) {
  const ds = useDataset();
  const [containerId, setContainerId] = useState(ds.containers[0]!.id);
  const c = ds.containers.find((x) => x.id === containerId)!;
  const capacity = useMemo(
    () =>
      runContainer(ds, { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId, mode: 'PIECE' }).result.typ.pieces ?? 0,
    [ds, containerId],
  );
  const total = lanes.reduce((n, l) => n + l.nuts, 0);
  const needed = capacity > 0 ? Math.ceil(total / capacity) : 0;

  // Bagi kelapa ke container berurutan (asal pertama dulu → dipisah per asal sejauh mungkin).
  const boxes: SimSegment[][] = [];
  const queue = lanes.map((l, i) => ({ label: l.name, left: l.nuts, tone: TONES[i % TONES.length]! }));
  for (let b = 0; b < Math.min(needed, MAX_DRAWN); b++) {
    let space = capacity;
    const segs: SimSegment[] = [];
    for (const q of queue) {
      if (space <= 0) break;
      const take = Math.min(space, q.left);
      if (take > 0) {
        segs.push({ count: take, label: q.label, tone: q.tone });
        q.left -= take;
        space -= take;
      }
    }
    boxes.push(segs);
  }

  return (
    <div className="flex flex-col gap-3 border-t-2 border-dashed border-ink pt-4" data-testid="load-sim">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="label-mono">Kalau dikirim sebagai kelapa jambul</span>
          <p className="text-sm">
            Butuh <b data-testid="containers-needed">{fmt(needed)}</b> container {containerFtName(containerId)} (muat ±{fmt(capacity)} butir per container).
          </p>
        </div>
        <div role="radiogroup" aria-label="Ukuran container" className="flex border-3 border-ink bg-surface">
          {ds.containers.map((k, i) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={k.id === containerId}
              onClick={() => setContainerId(k.id)}
              className={`min-h-touch px-3 font-mono text-xs font-bold ${i ? 'border-l-3 border-ink' : ''} ${k.id === containerId ? 'bg-ink text-acid' : ''}`}
            >
              {containerFtName(k.id)}
            </button>
          ))}
        </div>
      </div>
      {boxes.map((segs, i) => (
        <ContainerCircleSim
          key={`${containerId}-${i}`}
          containerId={containerId}
          innerM={{ L: c.L, W: c.W, H: c.H }}
          capacity={capacity}
          segments={segs}
          title={`CONTAINER #${i + 1} · ${containerFtName(containerId).toUpperCase()}`}
        />
      ))}
      {needed > MAX_DRAWN && <p className="font-mono text-xs">+ {fmt(needed - MAX_DRAWN)} container lagi (tidak digambar)</p>}
    </div>
  );
}
