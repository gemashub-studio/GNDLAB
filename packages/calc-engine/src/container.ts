/**
 * Kapasitas container — mode BULK / PIECE / PACKAGE (calculation_spec §3, ADR-005).
 * Hasil akhir selalu min(batas volume, batas berat) dengan label `binding`.
 */
import { bestGridFit } from './grid.ts';
import { evaluateRange, point, type Param, type Range } from './range.ts';
import { buildTrace, combinedConfidence, dedupeWarnings, type CalcOutput } from './trace.ts';
import type { Binding, CalcMode, Dim3 } from './types.ts';
import type { Kg, M3, Meters } from './units.ts';
import {
  benchmarkGapWarnings,
  commodityWarnings,
  lowConfidenceWarnings,
  warning,
  type CalcWarning,
  type WarningContext,
} from './warnings.ts';

export interface ContainerSpec {
  L: Meters;
  W: Meters;
  H: Meters;
  payloadKg: Kg;
  /**
   * Volume nominal dari spesifikasi container (dataset `volume_m3`). Bila kosong → L·W·H.
   * Validator Python & golden cases memakai volume nominal (FND-001).
   */
  volumeM3?: M3;
}

export interface PackSpec {
  l: Meters;
  w: Meters;
  h: Meters;
  netKg: Param;
  /** Butir per kemasan (mis. 25 butir kelapa jambul per karung). */
  pcs?: number;
}

export interface ContainerInput {
  container: ContainerSpec;
  form: { mode: CalcMode; rho?: Param; unitMass?: Param; pack?: PackSpec };
  /** Utilisasi volume u (0–1). Default 1 (ρ sudah densitas efektif-dalam-container). */
  volumeUtil?: Param;
  context?: WarningContext;
  datasetVersion?: string;
}

export interface ContainerResult {
  massKg: number;
  /** Volume muatan yang terisi (m³). */
  volumeM3: number;
  /** Isi volume terhadap kapasitas volume (V·u, atau kapasitas grid untuk PACKAGE), 0–1. */
  volumeFill: number;
  /** Isi berat terhadap payload, 0–1. */
  weightFill: number;
  pieces?: number;
  packs?: number;
}

export class MissingInputError extends Error {
  readonly code = 'MISSING_INPUT' as const;
  constructor(what: string) {
    super(`Input wajib tidak ada: ${what}`);
    this.name = 'MissingInputError';
  }
}

export const containerVolume = (c: ContainerSpec): number => c.volumeM3 ?? c.L * c.W * c.H;

function validateContainer(c: ContainerSpec): void {
  for (const [k, v] of Object.entries({ L: c.L, W: c.W, H: c.H, payloadKg: c.payloadKg, volume: containerVolume(c) })) {
    if (!(v > 0)) throw new RangeError(`Container ${k} harus > 0, didapat ${v}`);
  }
}

export const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new MissingInputError(what);
  return v;
};

const UTIL_DEFAULT: Range = point(1);

export function containerCapacity(i: ContainerInput): CalcOutput<ContainerResult> {
  validateContainer(i.container);
  const V = containerVolume(i.container);
  const P: number = i.container.payloadKg;
  const used: Param[] = [];
  const extraWarnings: CalcWarning[] = [];
  let binding: Binding;
  let result: CalcOutput<ContainerResult>['result'];

  switch (i.form.mode) {
    case 'BULK': {
      const rho = need(i.form.rho, 'form.rho');
      const u = i.volumeUtil ?? UTIL_DEFAULT;
      used.push(rho, ...(i.volumeUtil ? [i.volumeUtil] : []));
      result = evaluateRange({ rho, u }, (v) => {
        const byVolume = V * v.u * v.rho;
        const massKg = Math.min(byVolume, P);
        const volumeM3 = massKg / v.rho;
        return { massKg, volumeM3, volumeFill: volumeM3 / (V * v.u), weightFill: massKg / P };
      });
      binding = V * u.typ * rho.typ > P ? 'WEIGHT' : 'VOLUME';
      break;
    }
    case 'PIECE': {
      const rho = need(i.form.rho, 'form.rho');
      const m = need(i.form.unitMass, 'form.unitMass');
      const u = i.volumeUtil ?? UTIL_DEFAULT;
      used.push(rho, m, ...(i.volumeUtil ? [i.volumeUtil] : []));
      result = evaluateRange({ rho, m, u }, (v) => {
        const nByVolume = (V * v.u * v.rho) / v.m;
        const nByWeight = P / v.m;
        const pieces = Math.floor(Math.min(nByVolume, nByWeight));
        const massKg = pieces * v.m;
        const volumeM3 = massKg / v.rho;
        return { pieces, massKg, volumeM3, volumeFill: volumeM3 / (V * v.u), weightFill: massKg / P };
      });
      binding = V * u.typ * rho.typ > P ? 'WEIGHT' : 'VOLUME';
      break;
    }
    case 'PACKAGE': {
      const pack = need(i.form.pack, 'form.pack');
      used.push(pack.netKg);
      const inner: Dim3 = { l: i.container.L, w: i.container.W, h: i.container.H };
      const geom = bestGridFit(inner, { l: pack.l, w: pack.w, h: pack.h }).count;
      const packVolume = pack.l * pack.h * pack.w;
      result = evaluateRange({ net: pack.netKg }, (v) => {
        const packs = Math.min(geom, Math.floor(P / v.net));
        const massKg = packs * v.net;
        const out = {
          packs,
          massKg,
          volumeM3: packs * packVolume,
          volumeFill: geom > 0 ? packs / geom : 0,
          weightFill: massKg / P,
        };
        return pack.pcs ? { ...out, pieces: packs * pack.pcs } : out;
      });
      if (geom === 0) {
        binding = 'NONE';
        extraWarnings.push(warning('ITEM_EXCEEDS_CONTAINER'));
      } else {
        binding = geom * pack.netKg.typ > P ? 'WEIGHT' : 'VOLUME';
      }
      break;
    }
  }

  const warnings = [
    ...extraWarnings,
    ...(binding === 'WEIGHT' ? [warning('WEIGHT_LIMITED')] : []),
    ...lowConfidenceWarnings(used),
    ...commodityWarnings(i.context),
    ...benchmarkGapWarnings(result.typ, i.context?.benchmarks),
  ];
  return {
    result,
    binding,
    confidence: combinedConfidence(used),
    warnings: dedupeWarnings(warnings),
    trace: buildTrace(used, i.datasetVersion),
  };
}
