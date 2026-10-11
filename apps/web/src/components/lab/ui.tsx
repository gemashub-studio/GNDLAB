'use client';

import type { ReactNode } from 'react';
import { LAB_PRODUCTS, LAB_STATUS, NOT_RECORDED, type LabProductId, type LabStatus } from '@/lib/labStore';
import type { SourceStatus } from '@/lib/gemaSources';

export const productName = (id: LabProductId) => LAB_PRODUCTS.find((p) => p.id === id)!.name;
export const statusLabel = (s: LabStatus) => LAB_STATUS.find((x) => x.id === s)!.label;

const STATUS_TONE: Record<LabStatus, string> = {
  rencana: 'bg-paper text-ink',
  berjalan: 'bg-acid text-ink',
  selesai: 'bg-ink text-acid',
  gagal: 'bg-safety text-ink',
};

export function StatusPill({ status }: { status: LabStatus }) {
  return <span className={`rounded-full border-3 border-ink px-2.5 py-0.5 font-mono text-[11px] font-semibold ${STATUS_TONE[status]}`}>{statusLabel(status)}</span>;
}

const SOURCE_TONE: Record<SourceStatus, string> = {
  diperiksa: 'bg-acid text-ink',
  dilaporkan: 'bg-safety text-ink',
  'belum-diperiksa': 'bg-paper text-muted',
};
const SOURCE_TEXT: Record<SourceStatus, string> = { diperiksa: 'Diperiksa', dilaporkan: 'Dilaporkan', 'belum-diperiksa': 'Belum diperiksa' };

export function SourcePill({ status }: { status: SourceStatus }) {
  return <span className={`rounded-full border-3 border-ink px-2.5 py-0.5 font-mono text-[11px] font-semibold ${SOURCE_TONE[status]}`}>{SOURCE_TEXT[status]}</span>;
}

/** Kode produk dalam lingkaran — penanda jalur yang konsisten di semua tab. */
export function ProductMark({ id, active = false }: { id: LabProductId; active?: boolean }) {
  return (
    <span aria-hidden className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border-3 font-mono text-xs font-bold ${active ? 'border-ink bg-ink text-acid' : 'border-ink bg-surface text-ink'}`}>
      {id}
    </span>
  );
}

export function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label-mono">{k}</dt>
      <dd className={`whitespace-pre-wrap text-[15px] ${v.trim() ? '' : 'italic text-muted'}`}>{v.trim() || NOT_RECORDED}</dd>
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-mono">{label}</span>
      <input className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} />
    </label>
  );
}

export function TextArea({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-mono">{label}</span>
      <textarea className="field min-h-[96px] py-2.5 font-sans font-normal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} />
    </label>
  );
}

export function Section({ title, aside, children, testId }: { title: string; aside?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className="card flex flex-col gap-4" aria-label={title} data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
