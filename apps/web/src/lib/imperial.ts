/** Tampilan satuan imperial (ADR-004/ADR-007: hanya di lapisan presentasi; engine tetap SI). */
export const M_PER_INCH = 0.0254;

/** 5,898 m → "19 ft 4 in". */
export function ftIn(m: number): string {
  const totalIn = m / M_PER_INCH;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return inch ? `${ft} ft ${inch} in` : `${ft} ft`;
}

/** Nama dagang container dalam ft (20GP → "20 ft", 40HC → "40 ft High Cube"). */
export function containerFtName(id: string): string {
  const m = /^(\d+)(GP|HC)$/.exec(id);
  if (!m) return id;
  return m[2] === 'HC' ? `${m[1]} ft High Cube` : `${m[1]} ft`;
}
