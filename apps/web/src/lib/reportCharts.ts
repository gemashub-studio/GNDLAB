/**
 * Grafik laporan (DEC-058): SATU sumber data & geometri untuk PDF, DOCX, PPTX. `researchCharts` menyusun
 * spesifikasi grafik HANYA dari hasil ukur tercatat; `chartLayout` menghitung bentuk (garis, titik,
 * batang, teks) sekali; `chartSvg` mengubahnya jadi SVG (→ PNG untuk Word/PowerPoint) dan labPdf
 * menggambar bentuk yang sama di PDF. Tidak ada interpolasi, tren, atau uji statistik.
 */
import { dayNumber, measurementSeries, type DailyEntry } from './labStore';

export interface ChartSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

export interface ChartSpec {
  id: string;
  title: string;
  unit: string;
  kind: 'line' | 'bar';
  x: string[];
  xTitle: string;
  series: ChartSeries[];
  note: string;
}

/** Ringkasan satu variabel per kelompok (tabel di halaman Ringkasan). */
export interface MeasureSummary {
  name: string;
  unit: string;
  group: string;
  n: number;
  first: number;
  last: number;
  min: number;
  max: number;
  firstAt: string;
  lastAt: string;
}

export const CHART_COLORS = ['#1FA88F', '#F5A524', '#0E1A1F', '#7C5CBF', '#D9534F', '#3B82F6'];
const NO_GROUP = 'semua';

export const fmtNum = (v: number) => String(Number(v.toPrecision(4))).replace('.', ',');

/**
 * Grafik riset produk: (1) garis tiap variabel terhadap Hari ke-N (atau tanggal bila tanggal mulai kosong),
 * satu garis per kelompok, nilai = ukuran TERAKHIR pada hari itu; (2) batang nilai terakhir per kelompok bila
 * ada ≥ 2 kelompok. Variabel dengan data kurang → `insufficient` (ditulis "data belum cukup").
 */
export function researchCharts(start: string | undefined, days: readonly DailyEntry[]): { charts: ChartSpec[]; summary: MeasureSummary[]; insufficient: string[] } {
  const charts: ChartSpec[] = [];
  const summary: MeasureSummary[] = [];
  const insufficient: string[] = [];
  measurementSeries(days).forEach((se, si) => {
    const label = `${se.name}${se.unit ? ` (${se.unit})` : ''}`;
    const xOf = (at: string) => {
      const n = dayNumber(start, at.slice(0, 10));
      return n ? { key: String(n).padStart(5, '0'), label: `Hari ${n}` } : { key: at.slice(0, 10), label: at.slice(5, 10).split('-').reverse().join('/') };
    };
    const pts = [...se.points].sort((a, b) => a.at.localeCompare(b.at)).map((p) => ({ ...p, group: p.group || NO_GROUP, x: xOf(p.at) }));
    const groups = [...new Set(pts.map((p) => p.group))];
    for (const g of groups) {
      const gp = pts.filter((p) => p.group === g);
      if (!gp.length) continue;
      const vals = gp.map((p) => p.value);
      summary.push({ name: se.name, unit: se.unit, group: g, n: gp.length, first: gp[0]!.value, last: gp[gp.length - 1]!.value, min: Math.min(...vals), max: Math.max(...vals), firstAt: gp[0]!.x.label, lastAt: gp[gp.length - 1]!.x.label });
    }
    const xs = [...new Map(pts.map((p) => [p.x.key, p.x.label])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const nonNum = se.nonNumeric ? ` · ${se.nonNumeric} nilai bukan angka tidak digambar` : '';
    if (xs.length >= 2) {
      charts.push({
        id: `c${si + 1}-line`,
        title: `${label} per hari`,
        unit: se.unit,
        kind: 'line',
        x: xs.map(([, l]) => l),
        xTitle: start ? 'Hari ke-' : 'Tanggal',
        series: groups.map((g, gi) => ({
          name: g,
          color: CHART_COLORS[gi % CHART_COLORS.length]!,
          values: xs.map(([k]) => {
            const hit = pts.filter((p) => p.group === g && p.x.key === k);
            return hit.length ? hit[hit.length - 1]!.value : null;
          }),
        })),
        note: `Titik = nilai terakhir tercatat tiap hari per kelompok; hari tanpa data dibiarkan kosong (tidak ditarik garis). n = ${pts.length} titik${nonNum}.`,
      });
    }
    if (groups.length >= 2) {
      charts.push({
        id: `c${si + 1}-bar`,
        title: `${label} — nilai terakhir per kelompok`,
        unit: se.unit,
        kind: 'bar',
        x: groups,
        xTitle: 'Kelompok',
        series: [{ name: 'Nilai terakhir', color: CHART_COLORS[0]!, values: groups.map((g) => summary.find((s) => s.name === se.name && s.unit === se.unit && s.group === g)?.last ?? null) }],
        note: `Nilai terakhir yang tercatat di tiap kelompok (bisa beda hari). Deskriptif, tanpa uji beda nyata${nonNum}.`,
      });
    }
    if (xs.length < 2 && groups.length < 2) insufficient.push(`${label}: data belum cukup untuk grafik (${pts.length} titik angka${nonNum})`);
  });
  return { charts, summary, insufficient };
}

// ------------------------------------------------------------------ geometri

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string; stroke?: string; rx?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; w: number; dash?: boolean }
  | { t: 'poly'; pts: [number, number][]; stroke: string; w: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string }
  | { t: 'text'; x: number; y: number; s: string; size: number; fill: string; anchor: 'start' | 'middle' | 'end'; bold?: boolean };

export const CHART_W = 640;
export const CHART_H = 300;
const INK = '#0E1A1F';
const GRID = '#E2E8EA';
const MUTED = '#5B6B72';

/** Garis bantu sumbu Y yang "enak dibaca" (1, 2, 2,5, 5 × 10^n). */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) {
    const d = Math.abs(lo) * 0.1 || 1;
    lo -= d;
    hi += d;
  }
  const raw = (hi - lo) / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  if (out[out.length - 1]! < hi) out.push(Number((out[out.length - 1]! + step).toPrecision(12)));
  return out;
}

export function chartLayout(spec: ChartSpec, W = CHART_W, H = CHART_H): Prim[] {
  const P: Prim[] = [{ t: 'rect', x: 0, y: 0, w: W, h: H, fill: '#FFFFFF' }];
  const pad = { l: 58, r: 20, t: 36, b: 44 };
  const vals = spec.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (!vals.length) return P;
  const lo0 = spec.kind === 'bar' ? Math.min(0, ...vals) : Math.min(...vals);
  const hi0 = spec.kind === 'bar' ? Math.max(0, ...vals) : Math.max(...vals);
  const ticks = niceTicks(lo0, hi0);
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * ph;

  // legenda
  let lx = pad.l;
  for (const s of spec.series) {
    P.push({ t: 'rect', x: lx, y: 12, w: 10, h: 10, fill: s.color, rx: 2 });
    P.push({ t: 'text', x: lx + 15, y: 21, s: s.name, size: 11, fill: INK, anchor: 'start' });
    lx += 30 + s.name.length * 6.5;
  }
  if (spec.unit) P.push({ t: 'text', x: W - pad.r, y: 21, s: `satuan: ${spec.unit}`, size: 10, fill: MUTED, anchor: 'end' });

  // grid + label Y
  for (const v of ticks) {
    P.push({ t: 'line', x1: pad.l, y1: y(v), x2: W - pad.r, y2: y(v), stroke: GRID, w: 1, ...(v !== 0 && { dash: true }) });
    P.push({ t: 'text', x: pad.l - 8, y: y(v) + 4, s: fmtNum(v), size: 10, fill: MUTED, anchor: 'end' });
  }
  P.push({ t: 'line', x1: pad.l, y1: pad.t + ph, x2: W - pad.r, y2: pad.t + ph, stroke: INK, w: 1.2 });

  // label X (dijarangkan bila padat)
  const n = spec.x.length;
  const cw = pw / n;
  const cx = (i: number) => pad.l + cw * (i + 0.5);
  const every = Math.max(1, Math.ceil(n / 12));
  spec.x.forEach((l, i) => {
    if (i % every === 0 || i === n - 1) P.push({ t: 'text', x: cx(i), y: pad.t + ph + 16, s: l, size: 10, fill: INK, anchor: 'middle' });
  });
  P.push({ t: 'text', x: pad.l + pw / 2, y: H - 8, s: spec.xTitle, size: 10, fill: MUTED, anchor: 'middle' });

  if (spec.kind === 'bar') {
    const k = spec.series.length;
    const bw = Math.min(56, (cw * 0.7) / k);
    spec.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        if (v === null) return;
        const x = cx(i) - (bw * k) / 2 + si * bw;
        const top = Math.min(y(v), y(0));
        P.push({ t: 'rect', x, y: top, w: bw - 4, h: Math.max(1, Math.abs(y(0) - y(v))), fill: s.color, rx: 3 });
        P.push({ t: 'text', x: x + (bw - 4) / 2, y: top - 5, s: fmtNum(v), size: 10, fill: INK, anchor: 'middle', bold: true });
      });
    });
    return P;
  }

  const ends: { x: number; y: number; v: number }[] = [];
  for (const s of spec.series) {
    let seg: [number, number][] = [];
    const flush = () => {
      if (seg.length > 1) P.push({ t: 'poly', pts: seg, stroke: s.color, w: 2.5 });
      seg = [];
    };
    s.values.forEach((v, i) => (v === null ? flush() : seg.push([cx(i), y(v)])));
    flush();
    s.values.forEach((v, i) => v !== null && P.push({ t: 'circle', cx: cx(i), cy: y(v), r: 4, fill: '#FFFFFF', stroke: s.color }));
    const lastI = s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop();
    if (lastI !== undefined) ends.push({ x: cx(lastI) + 8, y: y(s.values[lastI]!) + 4, v: s.values[lastI]! });
  }
  // label nilai akhir di kanan titik; didorong agar tidak bertumpuk (jarak min. 12 px)
  ends.sort((a, b) => a.y - b.y).forEach((e, i, arr) => {
    if (i && e.y - arr[i - 1]!.y < 12) e.y = arr[i - 1]!.y + 12;
    P.push({ t: 'text', x: e.x, y: e.y, s: fmtNum(e.v), size: 10, fill: INK, anchor: 'start', bold: true });
  });
  return P;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** SVG mandiri (font sistem sans-serif); `scale` memperbesar resolusi untuk PNG yang tajam. */
export function chartSvg(spec: ChartSpec, scale = 1, W = CHART_W, H = CHART_H): string {
  const body = chartLayout(spec, W, H)
    .map((p) => {
      switch (p.t) {
        case 'rect':
          return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}"${p.rx ? ` rx="${p.rx}"` : ''}${p.stroke ? ` stroke="${p.stroke}"` : ''}/>`;
        case 'line':
          return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.w}"${p.dash ? ' stroke-dasharray="4 4"' : ''}/>`;
        case 'poly':
          return `<polyline points="${p.pts.map(([a, b]) => `${a},${b}`).join(' ')}" fill="none" stroke="${p.stroke}" stroke-width="${p.w}" stroke-linejoin="round" stroke-linecap="round"/>`;
        case 'circle':
          return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="2"` : ''}/>`;
        case 'text':
          return `<text x="${p.x}" y="${p.y}" font-size="${p.size}" fill="${p.fill}" text-anchor="${p.anchor}"${p.bold ? ' font-weight="bold"' : ''}>${esc(p.s)}</text>`;
      }
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">${body}</svg>`;
}
