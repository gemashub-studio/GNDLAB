'use client';

import type { CalcMode, CalcOutput, ContainerResult } from '@gemas/calc-engine';
import type { BenchmarkSI } from '@gemas/dataset';
import { ConfidenceBadge, BindingTag } from '@/components/ui/badges';
import { FillBar, RangeBand } from '@/components/ui/bars';
import { Hint } from '@/components/ui/Hint';
import { WarningList } from '@/components/ui/Warnings';
import { benchmarkText, primaryFigure, subline } from '@/lib/present';

export function ContainerResultView({
  out,
  mode,
  commodityId,
  title,
  benchmarks,
  compact = false,
  customContainer = false,
}: {
  out: CalcOutput<ContainerResult>;
  mode: CalcMode;
  commodityId: string;
  title: string;
  benchmarks: BenchmarkSI[];
  compact?: boolean;
  customContainer?: boolean;
}) {
  // US-09: hasil dengan angka ubahan pengguna diberi tanda "custom".
  const overridden = Object.entries(out.trace.params).filter(([, t]) => t.source === 'override').map(([k]) => k);
  const isCustom = overridden.length > 0 || customContainer;
  const p = primaryFigure(out, mode, commodityId);
  const t = out.result.typ;
  const empty = out.binding === 'NONE';
  const main = benchmarks.filter((b) => !b.conservative);
  const conservative = benchmarks.filter((b) => b.conservative);

  return (
    <div className="flex flex-col gap-6" data-testid="container-result">
      {/* Kartu hasil utama — hijau asam (mockup) */}
      <section
        aria-labelledby="hasil-h"
        aria-live="polite"
        className={`flex flex-col gap-[18px] border-3 border-ink p-6 shadow-hard ${empty ? 'bg-surface' : 'bg-acid'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 id="hasil-h" className="flex flex-wrap items-center gap-2 font-mono text-[13px] font-bold normal-case tracking-[0.1em]">
            HASIL · {title}
            {isCustom && (
              <span
                data-testid="custom-tag"
                className="tag-mono"
                title={overridden.length ? `Angka diubah: ${overridden.join(', ')}` : 'Ukuran container sendiri'}
              >
                CUSTOM
              </span>
            )}
          </h2>
          <span className="flex items-center gap-2">
            <BindingTag b={out.binding} />
            <Hint k="binding" />
          </span>
        </div>

        {empty ? (
          <p className="text-lg font-bold">
            Karungnya nggak muat diputar ke arah mana pun. Cek ukuran karungnya atau pilih container yang lebih besar.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-3">
              <span data-testid="primary-value" className="font-display text-[56px] leading-[0.9] sm:text-[72px]">
                {p.text}
              </span>
              <span className="font-mono text-lg font-bold">{p.unit}</span>
              <span className="ml-auto flex items-center gap-2" title="Keyakinan hasil = data terlemah yang dipakai">
                <ConfidenceBadge c={out.confidence} withText />
                <Hint k="confidence" />
              </span>
            </div>
            <span className="font-mono text-sm font-semibold" data-testid="subline">
              {subline(out, mode, commodityId)}
            </span>
            <div className="flex flex-col gap-1.5">
              <RangeBand
                min={p.pick(out.result.min)}
                typ={p.value}
                max={p.pick(out.result.max)}
                minLabel={p.fmtRange(p.pick(out.result.min))}
                maxLabel={p.fmtRange(p.pick(out.result.max))}
              />
              <span className="flex items-center gap-2 font-mono text-[11px]">
                Pita = rentang min–maks · garis oranye = tipikal <Hint k="range" />
              </span>
            </div>
          </>
        )}
      </section>

      {!compact && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card flex flex-col gap-3 p-[18px] font-mono text-xs font-bold">
            <span className="tracking-[0.08em]">ISI CONTAINER</span>
            <FillBar label="VOLUME" fraction={t.volumeFill} tone="ink" />
            <FillBar label="BERAT" fraction={t.weightFill} tone="safety" />
          </div>
          <div className="card flex flex-col gap-2 p-[18px]" data-testid="benchmark">
            <span className="flex items-center gap-2 font-mono text-xs font-bold tracking-[0.08em]">
              BENCHMARK PASAR <Hint k="benchmark" />
            </span>
            {main.length ? (
              main.map((b, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="font-display text-[26px] leading-tight">{benchmarkText(b, commodityId)}</span>
                  <span className="text-[13px]">
                    {b.sourceIds.length} sumber ({b.sourceIds.join(', ')})
                  </span>
                </div>
              ))
            ) : (
              <>
                <span className="font-display text-[26px]">Belum ada</span>
                <span className="text-[13px]">
                  Belum ada data muat dari pasar buat kombinasi ini — catat hasil muat pertamamu biar jadi pembanding.
                </span>
              </>
            )}
            {conservative.map((b, i) => (
              <span key={`c${i}`} className="border-t-2 border-dashed border-ink pt-2 text-[12px]">
                Skenario konservatif: {benchmarkText(b, commodityId)} ({b.sourceIds.join(', ')})
              </span>
            ))}
          </div>
        </div>
      )}

      <WarningList warnings={out.warnings} />
    </div>
  );
}
