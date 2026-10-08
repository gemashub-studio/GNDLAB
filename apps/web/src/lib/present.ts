/** Fungsi presentasi murni (aman dipakai server & client component). */
import type { CalcMode, CalcOutput, ContainerResult } from '@gemas/calc-engine';
import type { BenchmarkSI } from '@gemas/dataset';
import { COMMODITY_UI } from './catalog';
import { fmt, fmtTon } from './format';

export interface PrimaryFigure {
  value: number;
  text: string;
  unit: string;
  fmtRange: (v: number) => string;
  pick: (r: ContainerResult) => number;
}

const pieceUnitOf = (commodityId: string) => COMMODITY_UI[commodityId]?.pieceUnit ?? 'butir';

/** Angka utama sesuai mode: PIECE → butir, PACKAGE → karung, BULK → ton (ux_spec §3.1). */
export function primaryFigure(out: CalcOutput<ContainerResult>, mode: CalcMode, commodityId: string): PrimaryFigure {
  if (mode === 'PIECE') {
    const pick = (r: ContainerResult) => r.pieces ?? 0;
    return { value: pick(out.result.typ), text: fmt(pick(out.result.typ)), unit: pieceUnitOf(commodityId).toUpperCase(), fmtRange: (v) => fmt(v), pick };
  }
  if (mode === 'PACKAGE') {
    const pick = (r: ContainerResult) => r.packs ?? 0;
    return { value: pick(out.result.typ), text: fmt(pick(out.result.typ)), unit: 'KARUNG', fmtRange: (v) => fmt(v), pick };
  }
  const pick = (r: ContainerResult) => r.massKg;
  return { value: pick(out.result.typ), text: fmt(out.result.typ.massKg / 1000, 2), unit: 'TON', fmtRange: fmtTon, pick };
}

export function subline(out: CalcOutput<ContainerResult>, mode: CalcMode, commodityId: string): string {
  const t = out.result.typ;
  if (mode === 'PIECE') return `≈ ${fmtTon(t.massKg)} muatan bersih`;
  if (mode === 'PACKAGE') {
    const pcs = t.pieces !== undefined ? ` · ${fmt(t.pieces)} ${pieceUnitOf(commodityId)}` : '';
    return `= ${fmtTon(t.massKg)} muatan bersih${pcs}`;
  }
  return `${fmt(t.massKg)} kg muatan bersih`;
}

export function benchmarkText(b: BenchmarkSI, commodityId: string): string {
  const rng = (r: { min: number; max: number }, f: (v: number) => string) => (r.min === r.max ? f(r.min) : `${f(r.min)}–${f(r.max)}`);
  const parts: string[] = [];
  if (b.pieces) parts.push(`${rng(b.pieces, (v) => fmt(v))} ${pieceUnitOf(commodityId)}`);
  if (b.packs) parts.push(`${rng(b.packs, (v) => fmt(v))} karung`);
  if (b.massKg) parts.push(`${rng(b.massKg, (v) => fmt(v / 1000, 1))} t`);
  return parts.join(' · ');
}
