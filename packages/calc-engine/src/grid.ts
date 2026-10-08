/**
 * Grid kemasan (Mode C, calculation_spec §3.3): jumlah kotak terbanyak di 6 orientasi.
 */
import type { Dim3 } from './types.ts';

/**
 * Toleransi floor dalam meter. Data sumber dalam cm; setelah dibagi 100,
 * pembagian pas (mis. 2,352 / 0,336 = 7) bisa jatuh ke 6,9999999 di IEEE-754.
 */
const FLOOR_EPS = 1e-9;

export const floorDiv = (a: number, b: number): number => Math.floor(a / b + FLOOR_EPS);

export interface GridFit {
  count: number;
  /** Dimensi kotak sesuai orientasi terpilih, sejajar sumbu (l ↔ L, w ↔ W, h ↔ H). */
  orientation: Dim3;
  /** Jumlah kotak per sumbu; dipakai simulator 2D/3D. */
  grid: { nx: number; ny: number; nz: number };
}

/** Urutan sama dengan itertools.permutations di validate_dataset.py → tie-break identik. */
function permutations(b: Dim3): Dim3[] {
  const { l, w, h } = b;
  return [
    { l, w, h },
    { l, w: h, h: w },
    { l: w, w: l, h },
    { l: w, w: h, h: l },
    { l: h, w: l, h: w },
    { l: h, w, h: l },
  ];
}

export function bestGridFit(inner: Dim3, box: Dim3): GridFit {
  for (const v of [inner.l, inner.w, inner.h, box.l, box.w, box.h]) {
    if (!(v > 0)) throw new RangeError(`Dimensi harus > 0, didapat ${v}`);
  }
  let best: GridFit | undefined;
  for (const o of permutations(box)) {
    const nx = floorDiv(inner.l, o.l);
    const ny = floorDiv(inner.w, o.w);
    const nz = floorDiv(inner.h, o.h);
    const count = nx * ny * nz;
    if (!best || count > best.count) best = { count, orientation: o, grid: { nx, ny, nz } };
  }
  return best!;
}
