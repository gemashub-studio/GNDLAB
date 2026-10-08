import { Hint } from '@/components/ui/Hint';

/**
 * Simulasi tampak samping sederhana dari mockup Calculator (20×3 sel). Simulator 2D/3D penuh = M3.
 * Selalu berlabel "representasi grid" (ADR-005).
 */
export function GridStrip({ volumeFill, weightFill }: { volumeFill: number; weightFill: number }) {
  const total = 60;
  const filled = Math.round(Math.min(1, volumeFill) * total);
  const full = weightFill >= 0.99;
  const cells = Array.from({ length: total }, (_, i) => {
    const col = i % 20;
    const row = Math.floor(i / 20);
    const order = col * 3 + (2 - row); // isi dari belakang, bawah → atas
    return order < filled;
  });
  return (
    <div className="card flex flex-col gap-3 p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-bold tracking-[0.08em]">SIMULASI · TAMPAK SAMPING</span>
        <span className="flex items-center gap-2 font-mono text-[11px]">
          representasi grid, bukan posisi fisik eksak <Hint k="grid" />
        </span>
      </div>
      <div className="lab-paper grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px] border-3 border-ink p-1.5" aria-hidden>
        {cells.map((on, i) => (
          <div key={i} className={`h-[22px] border-2 border-ink ${on ? (full ? 'bg-safety' : 'bg-acid') : 'bg-surface'}`} />
        ))}
      </div>
    </div>
  );
}
