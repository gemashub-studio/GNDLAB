'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  /** Keterangan kecil di kanan/bawah label (mis. nama riset yang memakai varian). */
  note?: string;
  /** Judul kelompok (mis. "Cuka", "Bioleather"); opsi dengan group sama ditampilkan berurutan di bawah judulnya. */
  group?: string;
}

/**
 * Dropdown kustom putih (DEC-071) pengganti <select> bawaan browser: tombol + daftar pilihan (listbox),
 * bisa dengan keyboard (↑ ↓ Home End Enter Esc), klik di luar menutup. `hint` = tooltip keterangan yang
 * muncul saat kolom diklik / difokus.
 */
export function Dropdown({ value, onChange, options, placeholder = '— pilih —', testId, label, hint, required = false, optional = false }: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  testId: string;
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const picked = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    onChange(o.value);
    setOpen(false);
  };
  const openAt = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      return openAt();
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') setOpen(false);
  };

  let lastGroup: string | undefined;
  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <span className="label-mono flex items-center gap-1.5" id={`${id}-l`}>
        {label}
        {required && <span className="text-safety" aria-hidden>*</span>}
        {optional && <span className="normal-case tracking-normal text-muted">(opsional)</span>}
        {hint && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink/30 text-[10px] font-bold normal-case" aria-hidden title={hint}>
            i
          </span>
        )}
      </span>
      {hint && (open || focus) && (
        <div role="tooltip" id={`${id}-tip`} className="absolute bottom-full left-0 z-30 mb-1 max-w-[280px] rounded-lg bg-ink px-3 py-2 text-xs leading-snug text-paper shadow-lg" data-testid={`${testId}-tip`}>
          {hint}
          <span aria-hidden className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-ink" />
        </div>
      )}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-l`}
        {...(hint && { 'aria-describedby': `${id}-tip` })}
        className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-sm text-ink transition ${open ? 'border-acid ring-2 ring-acid/40' : 'border-ink/20 hover:border-ink/40'}`}
        onClick={() => (open ? setOpen(false) : openAt())}
        onKeyDown={onKey}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        data-testid={testId}
      >
        <span className={picked ? 'truncate' : 'truncate text-muted'}>{picked ? picked.label : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-l`}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-ink/15 bg-white py-1 shadow-xl"
          data-testid={`${testId}-list`}
        >
          {options.map((o, i) => {
            const head = o.group && o.group !== lastGroup ? o.group : undefined;
            lastGroup = o.group;
            const sel = o.value === value;
            return (
              <li key={o.value || `empty-${i}`} role="presentation">
                {head && <div className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{head}</div>}
                <div
                  role="option"
                  aria-selected={sel}
                  data-i={i}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 text-sm ${i === active ? 'bg-acid/20' : ''} ${sel ? 'font-semibold' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  data-testid={`${testId}-opt-${o.value || 'none'}`}
                >
                  <span>{o.label}</span>
                  {o.note && <span className="truncate text-xs text-muted">{o.note}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
