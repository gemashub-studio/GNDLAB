/** Pita rentang min–max dengan penanda typ (mockup Calculator). */
export function RangeBand({
  min,
  typ,
  max,
  minLabel,
  maxLabel,
}: {
  min: number;
  typ: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}) {
  const scale = max > 0 ? max * 1.1 : 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100)).toFixed(1)}%`;
  return (
    <div className="flex flex-col gap-1.5" data-testid="range-band">
      <div className="flex justify-between font-mono text-xs font-bold">
        <span>MIN {minLabel}</span>
        <span>MAX {maxLabel}</span>
      </div>
      <div
        className="relative h-[18px] border-2 border-ink bg-surface"
        role="img"
        aria-label={`Rentang ${minLabel} sampai ${maxLabel}`}
      >
        <div className="absolute inset-y-0 bg-ink" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />
        <div className="absolute -inset-y-1.5 w-1 bg-safety" style={{ left: pct(typ) }} />
      </div>
    </div>
  );
}

/** Bar isi volume / berat (hitam = volume, oranye = berat — mockup). */
export function FillBar({ label, fraction, tone }: { label: string; fraction: number; tone: 'ink' | 'safety' }) {
  const p = Math.max(0, Math.min(1, fraction));
  return (
    <div className="flex flex-col gap-1" data-testid={`fill-${tone === 'ink' ? 'volume' : 'weight'}`}>
      <div className="flex justify-between font-mono text-xs font-bold">
        <span>{label}</span>
        <span>{Math.round(fraction * 100)}%</span>
      </div>
      <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={label}>
        <div className={`h-3 ${tone === 'ink' ? 'bg-ink' : 'bg-safety'}`} style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}
