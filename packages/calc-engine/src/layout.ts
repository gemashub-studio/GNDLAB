/**
 * Tata letak untuk simulator (ADR-005: representasi grid, bukan posisi fisik eksak).
 * Fungsi murni & deterministik; jumlah yang ditempatkan HARUS sama dengan hasil engine
 * (containerCapacity / warehouseSpace / nestedCapacity) agar simulator = kartu hasil.
 */
import { bestGridFit, floorDiv, type GridFit } from './grid.ts';
import type { Dim3 } from './types.ts';

export interface Placement {
  /** Urutan muat (0 = pertama masuk). */
  index: number;
  /** Pojok minimum (m). Sumbu: x = panjang (dinding depan → pintu), y = lebar, z = tinggi. */
  x: number;
  y: number;
  z: number;
  l: number;
  w: number;
  h: number;
}

export interface ContainerLayout {
  fit: GridFit;
  placements: Placement[];
  /** Jumlah yang diminta tetapi tidak muat di grid (seharusnya 0 bila count = hasil engine). */
  overflow: number;
}

/**
 * Posisi kemasan di container. Urutan muat realistis: dinding depan dulu (x kecil), tiap irisan
 * diisi dari bawah ke atas, kiri ke kanan; pintu (x besar) terakhir.
 */
export function containerPackLayout(inner: Dim3, box: Dim3, count: number): ContainerLayout {
  if (!(Number.isInteger(count) && count >= 0)) throw new RangeError(`Jumlah kemasan harus bulat ≥ 0, didapat ${count}`);
  const fit = bestGridFit(inner, box);
  const { nx, ny, nz } = fit.grid;
  const o = fit.orientation;
  const n = Math.min(count, fit.count);
  const placements: Placement[] = [];
  for (let i = 0; i < n; i++) {
    const perSlab = ny * nz;
    const ix = Math.floor(i / perSlab);
    const rem = i % perSlab;
    const iz = Math.floor(rem / ny);
    const iy = rem % ny;
    placements.push({ index: i, x: ix * o.l, y: iy * o.w, z: iz * o.h, l: o.l, w: o.w, h: o.h });
  }
  // Sanity: grid tidak pernah melebihi dimensi dalam.
  if (nx * o.l > inner.l + 1e-9 || ny * o.w > inner.w + 1e-9 || nz * o.h > inner.h + 1e-9) {
    throw new Error('Grid melebihi ruang dalam (bug)');
  }
  return { fit, placements, overflow: count - n };
}

export interface Rect {
  x: number;
  y: number;
  l: number;
  w: number;
}

export interface WarehouseStack extends Rect {
  index: number;
  /** Jumlah kemasan di tumpukan ini. */
  packs: number;
}

export interface WarehouseLayout {
  stacks: WarehouseStack[];
  aisles: Rect[];
  /** Lebar lorong (m) yang diturunkan dari utilisasi lantai. */
  aisleWidthM: number;
  /** Kapasitas tumpukan yang muat di zona. */
  capacityStacks: number;
  overflowStacks: number;
}

/**
 * Denah zona gudang: tumpukan disusun dalam blok 2 baris (punggung-ke-punggung) dengan lorong di antaranya.
 * Lebar lorong dipilih agar porsi lantai untuk tumpukan ≈ utilisasi lantai u_f yang dipakai engine:
 *   u_f = 2w / (2w + a)  →  a = 2w·(1 − u_f) / u_f
 * Tumpukan terakhir boleh tidak penuh (sisa kemasan).
 */
export function warehouseStackLayout(
  zone: { L: number; W: number },
  stack: { l: number; w: number },
  stacks: number,
  packsTotal: number,
  packsPerStack: number,
  floorUtil: number,
): WarehouseLayout {
  for (const v of [zone.L, zone.W, stack.l, stack.w]) if (!(v > 0)) throw new RangeError('Dimensi zona & tumpukan harus > 0');
  if (!(floorUtil > 0 && floorUtil <= 1)) throw new RangeError('Utilisasi lantai harus 0 < u ≤ 1');
  if (!(Number.isInteger(stacks) && stacks >= 0)) throw new RangeError('Jumlah tumpukan harus bulat ≥ 0');

  const aisleWidthM = (2 * stack.w * (1 - floorUtil)) / floorUtil;
  const perRow = floorDiv(zone.L, stack.l);
  const stacksOut: WarehouseStack[] = [];
  const aisles: Rect[] = [];
  let y = 0;
  let rowsCap = 0;
  // Blok: baris A, baris B, lalu lorong — ulangi selama muat.
  const rowYs: number[] = [];
  while (y + stack.w <= zone.W + 1e-9) {
    rowYs.push(y);
    y += stack.w;
    if (rowYs.length % 2 === 0) {
      if (y + aisleWidthM <= zone.W + 1e-9 && aisleWidthM > 0) aisles.push({ x: 0, y, l: zone.L, w: aisleWidthM });
      y += aisleWidthM;
    }
  }
  rowsCap = rowYs.length;
  const capacityStacks = perRow * rowsCap;
  const placed = Math.min(stacks, capacityStacks);
  let packsLeft = packsTotal;
  for (let i = 0; i < placed; i++) {
    const row = Math.floor(i / Math.max(1, perRow));
    const col = i % Math.max(1, perRow);
    const p = Math.min(packsPerStack, Math.max(0, packsLeft));
    packsLeft -= p;
    stacksOut.push({ index: i, x: col * stack.l, y: rowYs[row]!, l: stack.l, w: stack.w, packs: p });
  }
  return { stacks: stacksOut, aisles, aisleWidthM, capacityStacks, overflowStacks: stacks - placed };
}

export interface NestedColumn extends Rect {
  index: number;
  pieces: number;
  heightM: number;
}

/** Kolom arang belah 2 bersarang dalam grid persegi selebar diameter mulut (calc_spec §3.4). */
export function nestedColumnLayout(
  space: { L: number; W: number },
  rimDiameterM: number,
  perColumn: number,
  totalPieces: number,
  cupHeightM: number,
  pitchM: number,
): NestedColumn[] {
  if (!(rimDiameterM > 0 && cupHeightM > 0 && pitchM > 0)) throw new RangeError('Diameter, tinggi cup, pitch harus > 0');
  const nx = floorDiv(space.L, rimDiameterM);
  const ny = floorDiv(space.W, rimDiameterM);
  const cols: NestedColumn[] = [];
  let left = totalPieces;
  for (let i = 0; i < nx * ny && left > 0; i++) {
    const pieces = Math.min(perColumn, left);
    left -= pieces;
    cols.push({
      index: i,
      x: Math.floor(i / ny) * rimDiameterM,
      y: (i % ny) * rimDiameterM,
      l: rimDiameterM,
      w: rimDiameterM,
      pieces,
      heightM: cupHeightM + (pieces - 1) * pitchM,
    });
  }
  return cols;
}

/** Jumlah yang terlihat untuk slider "isi %" (pembulatan ke bawah agar 100% = semua). */
export const visibleCount = (total: number, fillFraction: number) =>
  Math.min(total, Math.floor(total * Math.max(0, Math.min(1, fillFraction)) + 1e-9));

export type { Dim3 };
