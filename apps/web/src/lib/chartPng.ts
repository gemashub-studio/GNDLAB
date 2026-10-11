'use client';

/**
 * Grafik laporan → PNG di browser (DEC-058): SVG dari `chartSvg` digambar ke kanvas lalu ditanam ke
 * Word/PowerPoint. Bentuknya sama persis dengan grafik di PDF. Gagal = grafik dilewati (ada teks pengganti).
 */
import type { ChartPng } from './officeExport';
import { CHART_H, CHART_W, chartSvg, type ChartSpec } from './reportCharts';

const SCALE = 2;

export async function chartPng(spec: ChartSpec): Promise<ChartPng | undefined> {
  const svg = chartSvg(spec, SCALE);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await img.decode();
  } catch {
    return undefined;
  }
  const c = document.createElement('canvas');
  c.width = CHART_W * SCALE;
  c.height = CHART_H * SCALE;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) return undefined;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

export async function chartPngs(specs: readonly ChartSpec[]): Promise<Map<string, ChartPng>> {
  const out = new Map<string, ChartPng>();
  for (const s of specs) {
    const p = await chartPng(s);
    if (p) out.set(s.id, p);
  }
  return out;
}
