'use client';

/**
 * Dataset di client (NFR-03 offline + ADR-008 versi kalibrasi):
 * 1. render pertama = dataset ter-bundle (sama dengan server → hidrasi aman);
 * 2. setelah mount, pakai override versi aktif yang tersimpan di perangkat (offline);
 * 3. bila online, ambil `/api/v1/datasets/active` → simpan & pakai.
 * Satu store bersama (useSyncExternalStore) → semua komponen memakai versi yang sama.
 */
import { applyParameterOverrides, bundledDataset, type DatasetSI, type ParameterOverride } from '@gemas/dataset';
import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'gemas.dataset.active.v1';

interface Cached {
  version: string;
  base: string;
  overrides: ParameterOverride[];
}

let current: DatasetSI = bundledDataset();
let started = false;
const listeners = new Set<() => void>();

function set(next: DatasetSI) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function fromPayload(p: Cached): DatasetSI | undefined {
  const base = bundledDataset();
  if (p.base !== base.version) return undefined; // override untuk basis lain tidak berlaku
  if (p.version === base.version && !p.overrides.length) return base;
  try {
    return applyParameterOverrides(base, p.version, p.overrides);
  } catch {
    return undefined;
  }
}

function start() {
  if (started) return;
  started = true;
  try {
    const raw = localStorage.getItem(KEY);
    const c = raw ? fromPayload(JSON.parse(raw) as Cached) : undefined;
    if (c) set(c);
  } catch {
    /* penyimpanan diblokir → tetap pakai dataset ter-bundle */
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  fetch('/api/v1/datasets/active')
    .then((r) => (r.ok ? r.json() : undefined))
    .then((j: (Cached & { status: string }) | undefined) => {
      if (!j) return;
      const payload: Cached = { version: j.version, base: j.base, overrides: j.overrides ?? [] };
      const ds = fromPayload(payload);
      if (!ds) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(payload));
      } catch {
        /* abaikan */
      }
      set(ds);
    })
    .catch(() => undefined); // offline / server mati → dataset ter-bundle / cache
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDataset(): DatasetSI {
  const ds = useSyncExternalStore(subscribe, () => current, () => bundledDataset());
  useEffect(start, []);
  return ds;
}

/** Untuk test: paksa dataset tertentu. */
export const __setDatasetForTest = set;
