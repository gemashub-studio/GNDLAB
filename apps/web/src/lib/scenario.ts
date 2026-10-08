/**
 * Skema skenario bersama: URL bagikan, IndexedDB offline, body API, dan kolom `scenario.input`.
 * Satu fungsi `runScenario` dipakai client (offline) & server (re-calculate, ARD §7).
 */
import {
  containerCapacity,
  convert,
  warehouseSpace,
  type CalcOutput,
  type ContainerResult,
  type WarehouseResult,
} from '@gemas/calc-engine';
import {
  buildContainerInput,
  buildConvertInput,
  buildWarehouseInput,
  type DatasetSI,
} from '@gemas/dataset';
import { z } from 'zod';

const positive = z.number().finite().positive();
const overrides = z.record(z.string().regex(/^[a-z0-9_.]+$/), positive).optional();

export const ContainerStateSchema = z
  .object({
    kind: z.literal('CONTAINER'),
    commodityId: z.string().min(1),
    formCode: z.string().min(1),
    containerId: z.string().min(1).optional(),
    custom: z
      .object({ lengthM: positive.max(20), widthM: positive.max(5), heightM: positive.max(5), payloadKg: positive.max(60000) })
      .optional(),
    mode: z.enum(['BULK', 'PIECE', 'PACKAGE']),
    packagingIndex: z.number().int().min(0).optional(),
    volumeUtil: z.number().gt(0).max(1).optional(),
    overrides,
  })
  .refine((s) => !!s.containerId !== !!s.custom, { message: 'pilih satu: container dataset atau custom' });

export const WarehouseStateSchema = z.object({
  kind: z.literal('WAREHOUSE'),
  commodityId: z.string().min(1),
  formCode: z.string().min(1),
  stock: z.union([
    z.object({ massKg: z.number().finite().min(0).max(1e9) }),
    z.object({ pieces: z.number().int().min(0).max(1e9) }),
    z.object({ packs: z.number().int().min(0).max(1e8) }),
  ]),
  usePackaging: z.boolean().optional(),
  packagingIndex: z.number().int().min(0).optional(),
  stackHeightM: positive.max(30),
  floorUtil: z.number().gt(0).max(1).optional(),
  zone: z.object({ lengthM: positive.max(1000), widthM: positive.max(1000) }).optional(),
  floorLoadKgM2: positive.optional(),
  moisturePct: z.number().min(0).lt(100).optional(),
  coStored: z.array(z.string()).max(10).optional(),
  overrides,
});

export const ConvertStateSchema = z.object({
  kind: z.literal('CONVERT'),
  commodityId: z.string().min(1),
  formCode: z.string().min(1),
  from: z.object({ unit: z.enum(['pcs', 'kg', 't', 'm3', 'pack']), value: z.number().finite().min(0).max(1e12) }),
  to: z.enum(['pcs', 'kg', 't', 'm3', 'pack']),
  packagingIndex: z.number().int().min(0).optional(),
  overrides,
});

export const ScenarioStateSchema = z.union([ContainerStateSchema, WarehouseStateSchema, ConvertStateSchema]);

export type ContainerState = z.infer<typeof ContainerStateSchema>;
export type WarehouseState = z.infer<typeof WarehouseStateSchema>;
export type ConvertState = z.infer<typeof ConvertStateSchema>;
export type ScenarioState = z.infer<typeof ScenarioStateSchema>;

export type ScenarioOutput =
  | { kind: 'CONTAINER'; out: CalcOutput<ContainerResult> }
  | { kind: 'WAREHOUSE'; out: CalcOutput<WarehouseResult> }
  | { kind: 'CONVERT'; out: CalcOutput<{ value: number }> };

export function runContainer(ds: DatasetSI, s: ContainerState): CalcOutput<ContainerResult> {
  return containerCapacity(
    buildContainerInput(ds, {
      commodityId: s.commodityId,
      formCode: s.formCode,
      mode: s.mode,
      ...(s.custom ? { customContainer: s.custom } : { containerId: s.containerId! }),
      ...(s.packagingIndex !== undefined && { packagingIndex: s.packagingIndex }),
      ...(s.volumeUtil !== undefined && { volumeUtil: s.volumeUtil }),
      ...(s.overrides && { overrides: s.overrides }),
    }),
  );
}

export function runWarehouse(ds: DatasetSI, s: WarehouseState): CalcOutput<WarehouseResult> {
  const { kind: _k, ...rest } = s;
  return warehouseSpace(buildWarehouseInput(ds, rest));
}

export function runConvert(ds: DatasetSI, s: ConvertState): CalcOutput<{ value: number }> {
  const { kind: _k, ...rest } = s;
  return convert(buildConvertInput(ds, rest));
}

export function runScenario(ds: DatasetSI, s: ScenarioState): ScenarioOutput {
  switch (s.kind) {
    case 'CONTAINER':
      return { kind: s.kind, out: runContainer(ds, s) };
    case 'WAREHOUSE':
      return { kind: s.kind, out: runWarehouse(ds, s) };
    case 'CONVERT':
      return { kind: s.kind, out: runConvert(ds, s) };
  }
}

// ---------------------------------------------------------------- URL (bagikan tanpa login)

/** Kodekan state ke query string ringkas & mudah dibaca (`?s=` JSON base64url). */
export function encodeState(s: ScenarioState): string {
  const json = JSON.stringify(s);
  const b64 = typeof Buffer !== 'undefined' ? Buffer.from(json, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState(token: string | null | undefined): ScenarioState | undefined {
  if (!token) return undefined;
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('utf8') : decodeURIComponent(escape(atob(b64)));
    const parsed = ScenarioStateSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
