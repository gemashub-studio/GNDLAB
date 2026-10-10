import type { ReactNode } from 'react';

/** Kotak angka kecil bergaya mockup (dipakai Alur Proses, Formula, Produksi). */
export function Stat({ label, value, sub, accent, testId }: { label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: boolean; testId?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 border-2 border-ink p-2.5 ${accent ? 'bg-acid' : 'bg-surface'}`} data-testid={testId}>
      <span className="font-mono text-[11px] font-bold uppercase">{label}</span>
      <span className="text-lg font-extrabold">{value}</span>
      {sub && <span className="font-mono text-[11px]">{sub}</span>}
    </div>
  );
}
