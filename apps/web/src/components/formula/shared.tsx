'use client';

import type { Confidence, Param, Range } from '@gemas/calc-engine';
import { bundledFormulaDataset, type FormulaDatasetSI } from '@gemas/dataset';
import { useState, type ReactNode } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { guessPicto, Picto, type PictoName } from '@/components/ui/StepFlow';
import { fmt } from '@/lib/format';

/** Dataset formula ter-bundle (divalidasi Zod sekali, di-cache paket dataset). */
export const useFormula = (): FormulaDatasetSI => bundledFormulaDataset();

/** Angka typ + rentang kecil: "12,5 (11,2–13,9)". */
export function rangeText(r: Range, digits = 1, unit = ''): string {
  const u = unit ? ` ${unit}` : '';
  if (Math.abs(r.max - r.min) < 1e-9) return `${fmt(r.typ, digits)}${u}`;
  return `${fmt(r.typ, digits)}${u} (${fmt(r.min, digits)}–${fmt(r.max, digits)})`;
}

/** "4–8 % (biasanya 6)" untuk parameter dataset. */
export function paramText(p: Param, digits = 1, unit = ''): string {
  const u = unit ? ` ${unit}` : '';
  if (p.min === p.max) return `${fmt(p.typ, digits)}${u}`;
  return `${fmt(p.min, digits)}–${fmt(p.max, digits)}${u} (biasanya ${fmt(p.typ, digits)})`;
}

/** Baris sumber: kode sumber → judul (tooltip) + keyakinan. Traceability NFR-05. */
export function Sources({ ids, confidence }: { ids: readonly string[]; confidence?: Confidence }) {
  const f = useFormula();
  const list = [...new Set(ids)].map((id) => f.sources.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
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

/** Kotak catatan: info (garis acid), awas (safety), atau temuan validasi. */
export function Note({ tone = 'info', title, children, testId }: { tone?: 'info' | 'warn' | 'finding'; title?: ReactNode; children: ReactNode; testId?: string }) {
  const cls = tone === 'warn' ? 'border-safety bg-surface' : tone === 'finding' ? 'border-ink bg-acid' : 'border-acid bg-paper';
  return (
    <div className={`border-l-4 px-3 py-2 text-[13px] ${cls}`} data-testid={testId} role={tone === 'warn' ? 'note' : undefined}>
      {title && <p className="font-extrabold uppercase">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

/** Kelas literal (Tailwind JIT tidak membaca kelas yang dirakit dinamis). */
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-3 sm:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-6',
};

export interface WizardStep {
  id: string;
  title: string;
  tag: string;
  body: ReactNode;
  /** Piktogram tahap; kosong = ditebak dari judul. */
  icon?: PictoName;
}

/**
 * Wizard tahap: tombol tahap bernomor + Kembali/Lanjut. Semua tahap tetap bisa diklik langsung
 * (pengguna lanjutan), tombol Lanjut menuntun pengguna baru.
 */
export function Wizard({ steps, label, testId }: { steps: WizardStep[]; label: string; testId?: string }) {
  const [i, setI] = useState(0);
  const step = steps[i]!;
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <nav aria-label={label} className={`grid gap-1.5 ${COLS[Math.min(steps.length, 6)] ?? COLS[6]}`}>
        {steps.map((s, n) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setI(n)}
            aria-current={n === i ? 'step' : undefined}
            data-testid={`wstep-${s.id}`}
            className={`flex min-h-[52px] flex-col items-start justify-center border-3 border-ink px-2 text-left ${n === i ? 'bg-acid' : 'bg-surface'}`}
          >
            <span className="flex w-full items-center justify-between gap-1">
              <span className="font-mono text-[11px] font-bold">
                {String(n + 1).padStart(2, '0')} · {s.tag}
              </span>
              <span className="hidden sm:inline-flex">
                <Picto name={s.icon ?? guessPicto(s.title)} size="sm" tone={n === i ? 'paper' : 'acid'} />
              </span>
            </span>
            <span className="text-xs font-extrabold uppercase leading-tight">{s.title}</span>
          </button>
        ))}
      </nav>
      <section className="card flex flex-col gap-4" aria-labelledby={`h-${step.id}`}>
        <h3 id={`h-${step.id}`} className="flex items-center gap-3 text-2xl">
          <Picto name={step.icon ?? guessPicto(step.title)} />
          {String(i + 1).padStart(2, '0')} · {step.title}
        </h3>
        {step.body}
        <div className="flex flex-wrap justify-between gap-3 border-t-2 border-ink pt-3">
          <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>
            ← Kembali
          </button>
          {i < steps.length - 1 && (
            <button type="button" className="btn-primary" onClick={() => setI((x) => x + 1)} data-testid="wizard-next">
              Lanjut: {steps[i + 1]!.title} →
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/** Daftar bahan (BOM) — dua kolom nama / jumlah, bisa disalin ke daftar belanja. */
export function Bom({ rows, title = 'Daftar bahan', testId }: { rows: { name: ReactNode; amount: string; note?: string }[]; title?: string; testId?: string }) {
  return (
    <div className="border-3 border-ink bg-surface shadow-hard-sm" data-testid={testId}>
      <p className="bg-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-acid">{title}</p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((r, n) => (
            <tr key={n} className="border-b-2 border-ink last:border-b-0">
              <th className="p-2 text-left font-bold">
                {r.name}
                {r.note && <span className="block font-mono text-[11px] font-normal text-muted">{r.note}</span>}
              </th>
              <td className="p-2 text-right font-mono font-bold">{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Hasil utama besar (kotak acid) — konsisten dengan kartu hasil kalkulator. */
export function BigResult({ label, value, unit, sub, confidence, testId }: { label: string; value: string; unit: string; sub?: ReactNode; confidence?: Confidence; testId?: string }) {
  return (
    <div className="flex flex-col gap-2 border-3 border-ink bg-acid p-4 shadow-hard" data-testid={testId}>
      <span className="font-mono text-[13px] font-bold tracking-[0.1em]">{label}</span>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-display text-[40px] leading-none sm:text-[52px]" data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </span>
        <span className="font-mono text-lg font-bold">{unit}</span>
        {confidence && (
          <span className="ml-auto">
            <ConfidenceBadge c={confidence} withText />
          </span>
        )}
      </div>
      {sub && <span className="font-mono text-xs">{sub}</span>}
    </div>
  );
}

/** Bungkus perhitungan yang bisa melempar (input tidak valid) → pesan ramah. */
export function safe<T>(f: () => T): { ok: true; v: T } | { ok: false; message: string } {
  try {
    return { ok: true, v: f() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghitung' };
  }
}

export function CalcError({ message }: { message: string }) {
  return (
    <div role="alert" className="border-3 border-ink bg-safety p-3 font-bold">
      Belum bisa dihitung: {message}
    </div>
  );
}

/** Jenis angka (permintaan owner 2026-10-11): jangan campur teori, literatur, isian, hasil uji, dan saran AI. */
export type EvidenceKind = 'teoritis' | 'literatur' | 'input' | 'eksperimen' | 'ai';
const EVIDENCE: Record<EvidenceKind, { label: string; cls: string; hint: string }> = {
  teoritis: { label: 'Teoritis', cls: 'bg-ink text-acid', hint: 'Rumus kimia/fisika atau neraca massa dari isianmu — bukan hasil uji' },
  literatur: { label: 'Literatur', cls: 'bg-paper text-ink', hint: 'Angka dari sumber tercatat (lihat kode sumber & keyakinan)' },
  input: { label: 'Isian/resepmu', cls: 'bg-acid text-ink', hint: 'Kamu yang menentukan; angka awal di kolom hanya titik mulai dari literatur' },
  eksperimen: { label: 'Hasil ujimu', cls: 'bg-safety text-ink', hint: 'Diukur di batchmu sendiri — dicatat di GEMA RnD Lab' },
  ai: { label: 'Saran AI', cls: 'bg-surface text-muted', hint: 'Tidak ada saran AI di kalkulator ini' },
};

export function EvidenceTag({ kind }: { kind: EvidenceKind }) {
  const e = EVIDENCE[kind];
  return (
    <span title={e.hint} className={`inline-flex items-center rounded-full border-3 border-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${e.cls}`} data-evidence={kind}>
      {e.label}
    </span>
  );
}

export function EvidenceLegend({ testId }: { testId?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-paper p-3 text-xs" data-testid={testId}>
      <span className="label-mono">Jenis angka di halaman ini</span>
      <ul className="flex flex-col gap-1">
        {(Object.keys(EVIDENCE) as EvidenceKind[]).map((k) => (
          <li key={k} className="flex flex-wrap items-center gap-2">
            <EvidenceTag kind={k} /> <span className="text-muted">{EVIDENCE[k].hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
