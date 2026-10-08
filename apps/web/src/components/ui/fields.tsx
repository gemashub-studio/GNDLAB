'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { fmt, parseNum } from '@/lib/format';

/**
 * Input angka yang menerima format Indonesia ("1.250,5"). Memanggil onValue hanya bila valid;
 * teks mentah tetap di field agar pengguna bebas mengetik.
 */
export function NumberField({
  label,
  value,
  onValue,
  unit,
  hint,
  error,
  min,
  max,
  integer = false,
  testId,
}: {
  label: ReactNode;
  value: number | undefined;
  onValue: (v: number | undefined) => void;
  unit?: string;
  hint?: ReactNode;
  error?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  testId?: string;
}) {
  const id = useId();
  const [raw, setRaw] = useState(value === undefined ? '' : fmt(value, integer ? 0 : 2).replace(/,00$/, ''));
  const [local, setLocal] = useState<string>();

  // Sinkron bila nilai berubah dari luar (mis. ganti komoditas).
  useEffect(() => {
    const cur = parseNum(raw);
    if (value === undefined ? raw !== '' : cur !== value) {
      setRaw(value === undefined ? '' : fmt(value, integer ? 0 : 2).replace(/,00$/, ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onChange = (s: string) => {
    setRaw(s);
    if (!s.trim()) {
      setLocal(undefined);
      onValue(undefined);
      return;
    }
    const n = parseNum(s);
    if (!Number.isFinite(n)) return setLocal('Bukan angka');
    if (integer && !Number.isInteger(n)) return setLocal('Harus bilangan bulat');
    if (min !== undefined && n < min) return setLocal(`Minimal ${fmt(min, 2).replace(/,00$/, '')}`);
    if (max !== undefined && n > max) return setLocal(`Maksimal ${fmt(max, 2).replace(/,00$/, '')}`);
    setLocal(undefined);
    onValue(n);
  };

  const msg = local ?? error;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label-mono flex items-center gap-2">
        {label}
      </label>
      <div className="flex items-stretch">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={msg ? 'true' : undefined}
          aria-describedby={msg || hint ? `${id}-d` : undefined}
          data-testid={testId}
          className="field min-w-0 flex-1"
        />
        {unit && (
          <span className="flex items-center border-3 border-l-0 border-ink bg-paper px-2.5 font-mono text-sm font-bold">{unit}</span>
        )}
      </div>
      {(msg || hint) && (
        <span id={`${id}-d`} className={`text-[12px] ${msg ? 'font-bold text-ink' : 'text-muted'}`} role={msg ? 'alert' : undefined}>
          {msg ? <span className="bg-safety px-1">{msg}</span> : hint}
        </span>
      )}
    </div>
  );
}

/** Kelompok pilihan bergaya chip (role radio) — target sentuh ≥ 44 px. */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 1,
  ink = false,
  legendExtra,
}: {
  legend: ReactNode;
  options: { value: T; label: ReactNode; aside?: ReactNode; disabled?: boolean; testId?: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4;
  ink?: boolean;
  legendExtra?: ReactNode;
}) {
  const cols = { 1: '', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[columns];
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="label-mono mb-2.5 flex items-center gap-2">
        {legend}
        {legendExtra}
      </legend>
      <div role="radiogroup" className={`grid gap-2.5 ${cols}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={o.disabled}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={`chip ${ink ? 'chip-ink' : ''} disabled:opacity-40`}
          >
            <span className="min-w-0">{o.label}</span>
            {o.aside}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
