'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary';

/** Tombol "?" kecil yang membuka penjelasan istilah dalam bahasa gudang. */
export function Hint({ k, className = '' }: { k: GlossaryKey; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY[k];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={`Apa itu ${entry.term}?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-6 w-6 items-center justify-center border-2 border-ink bg-surface font-mono text-xs font-bold text-ink hover:bg-acid"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-8 z-40 block w-72 max-w-[80vw] border-3 border-ink bg-ink p-3 text-left font-sans text-[13px] normal-case leading-snug tracking-normal text-paper shadow-hard-safety"
        >
          <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-acid">{entry.term}</span>
          <span className="block font-bold">{entry.short}</span>
          {'long' in entry && entry.long && <span className="mt-1.5 block text-muted-ink">{entry.long}</span>}
        </span>
      )}
    </span>
  );
}
