/** Format angka gaya Indonesia (titik ribuan, koma desimal). Satuan internal SI (ADR-004). */
const nf = (d: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmt = (x: number, digits = 0): string => (Number.isFinite(x) ? nf(digits).format(x) : '–');

/** Ton dengan 2 desimal. */
export const fmtTon = (kg: number): string => `${fmt(kg / 1000, 2)} t`;

/** Massa otomatis: < 1.000 kg → kg, selain itu ton. */
export const fmtMass = (kg: number): string => (Math.abs(kg) < 1000 ? `${fmt(kg, kg < 10 ? 2 : 0)} kg` : fmtTon(kg));

export const fmtPct = (fraction: number): string => `${fmt(fraction * 100, 0)}%`;

export const fmtM3 = (v: number): string => `${fmt(v, v < 10 ? 2 : 1)} m³`;
export const fmtM2 = (v: number): string => `${fmt(v, 2)} m²`;
export const cm = (m: number): string => fmt(m * 100, m * 100 < 10 ? 1 : 0);

/** Parse input angka Indonesia ("1.250,5") maupun gaya titik ("1250.5"). */
export function parseNum(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  if (!s) return Number.NaN;
  // Bila ada koma → koma desimal, titik ribuan.
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  // Titik ribuan gaya Indonesia ("12.000", "1.250.000"); grup pertama tidak diawali 0,
  // jadi "0.575" tetap desimal.
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}
