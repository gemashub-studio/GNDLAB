'use client';

import type { Confidence } from '@gemas/calc-engine';
import { bundledChainDataset, bundledProcessDataset, getForm, type ChainDatasetSI } from '@gemas/dataset';
import type { ReactNode } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { Picto, StepFlow, type FlowStep } from '@/components/ui/StepFlow';
import { useFormula } from '@/components/formula/shared';
import { useDataset } from '@/lib/useDataset';

export { BigResult, Bom, CalcError, Note, paramText, rangeText, safe, Wizard } from '@/components/formula/shared';

/** Dataset rantai produksi ter-bundle (ADR-010). */
export const useChain = (): ChainDatasetSI => bundledChainDataset();
export const useProcess = () => bundledProcessDataset();
export { useDataset, useFormula, getForm };

/** Sumber dataset rantai (C01–C20) + keyakinan; kode lain (F/P) dicari di dataset formula/proses. */
export function ChainSources({ ids, confidence }: { ids: readonly string[]; confidence?: Confidence }) {
  const c = useChain();
  const f = useFormula();
  const p = useProcess();
  const all = [...c.sources, ...f.sources, ...p.sources];
  const list = [...new Set(ids)].map((id) => all.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  if (!list.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted">
      {confidence && <ConfidenceBadge c={confidence} />}
      <span>Sumber:</span>
      {list.map((s) => (
        <span key={s.id} title={s.title} className="cursor-help border-b border-dotted border-ink">
          {s.id}
        </span>
      ))}
    </p>
  );
}

/** Daftar langkah SOP bernomor + alat & K3 — teks dari dataset/SOP bersumber. */
export function SopList({ title, steps, tools, safety, testId }: { title: string; steps: FlowStep[]; tools?: ReactNode[]; safety?: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-3 border-3 border-ink bg-surface p-3 shadow-hard-sm" data-testid={testId}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]">SOP · {title}</p>
      <StepFlow steps={steps} {...(testId && { testId: `${testId}-steps` })} />
      {tools && tools.length > 0 && (
        <div>
          <p className="font-mono text-[11px] font-bold uppercase">Alat & bahan</p>
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {tools.map((t, i) => (
              <li key={i} className="border-2 border-ink bg-paper px-2 py-0.5 text-[13px]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      {safety && (
        <div className="flex items-start gap-3 border-l-4 border-safety px-3 py-2 text-[13px]" role="note">
          <Picto name="shield" size="sm" tone="safety" />
          <div>
            <p className="font-extrabold uppercase">K3</p>
            {safety}
          </div>
        </div>
      )}
    </section>
  );
}

/** Pilihan kelas asal DR/DT — dipakai di semua tab agar lot tidak tercampur. */
export function OriginPicker({ value, onChange, testId }: { value: 'DR' | 'DT'; onChange: (v: 'DR' | 'DT') => void; testId?: string }) {
  const c = useChain();
  return (
    <div role="radiogroup" aria-label="Kelas asal" className="grid grid-cols-2 gap-2" data-testid={testId}>
      {c.raw.origin.classes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          data-testid={testId ? `${testId}-${o.id}` : undefined}
          className={`flex min-h-[52px] flex-col items-start justify-center border-3 border-ink px-2 text-left ${value === o.id ? 'bg-ink text-acid' : 'bg-surface'}`}
        >
          <span className="font-mono text-[11px] font-bold">
            {o.id} · {o.rule}
          </span>
          <span className="text-xs font-extrabold uppercase leading-tight">{o.name_id}</span>
        </button>
      ))}
    </div>
  );
}

/** Tabel sederhana bergaya kartu. */
export function Table({ head, rows, testId }: { head: ReactNode[]; rows: ReactNode[][]; testId?: string }) {
  return (
    <div className="overflow-x-auto border-3 border-ink" data-testid={testId}>
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead className="bg-ink text-acid">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="p-2 text-left font-mono text-[11px] uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t-2 border-ink bg-surface">
              {r.map((c, j) => (
                <td key={j} className="p-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
