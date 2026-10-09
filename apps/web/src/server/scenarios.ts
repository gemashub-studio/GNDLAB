import 'server-only';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { runScenario, ScenarioStateSchema, type ScenarioOutput, type ScenarioState } from '@/lib/scenario';
import { activeDataset, datasetForVersion } from './datasets';
import { prisma } from './db';
import { ApiError, notFound } from './http';
import type { SessionUser } from './auth';

export const SaveScenarioSchema = z.object({
  /** UUID dibuat client (IndexedDB) → dipakai sebagai id skenario agar sinkron ulang idempoten. */
  clientId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  state: ScenarioStateSchema,
});
export type SaveScenarioInput = z.infer<typeof SaveScenarioSchema>;

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newSlug(n = 10): string {
  const b = randomBytes(n);
  return Array.from(b, (x) => SLUG_ALPHABET[x % SLUG_ALPHABET.length]).join('');
}

function calcModeOf(s: ScenarioState): 'BULK' | 'PIECE' | 'PACKAGE' {
  if (s.kind === 'CONTAINER') return s.mode;
  if (s.kind === 'WAREHOUSE') return s.usePackaging || 'packs' in s.stock ? 'PACKAGE' : 'BULK';
  return 'BULK';
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * Simpan skenario: server SELALU menghitung ulang dengan engine (ARD §7) lalu menulis
 * scenario + scenario_override + calc_result dalam satu transaksi.
 */
export async function saveScenario(user: SessionUser, input: SaveScenarioInput) {
  const { ds, versionId } = await activeDataset();
  const { state } = input;
  const out = runScenario(ds, state); // validasi domain (override di luar rentang → 422)

  // Sinkron ulang dengan clientId yang sama → kembalikan skenario TERSIMPAN (bukan state baru).
  const existingResult = async () => {
    if (!input.clientId) return undefined;
    const existing = await prisma.scenario.findUnique({
      where: { id: input.clientId },
      include: { dataset_version: { select: { semver: true } } },
    });
    if (!existing) return undefined;
    if (existing.user_id !== user.id) throw new ApiError(409, 'CONFLICT', 'ID skenario sudah dipakai');
    const stored = ScenarioStateSchema.parse((existing.input as { state?: unknown }).state);
    return { id: existing.id, shareSlug: existing.share_slug!, created: false, out: runScenario((await datasetForVersion(existing.dataset_version.semver)).ds, stored) };
  };
  const found = await existingResult();
  if (found) return found;

  const form = await prisma.commodity_form.findFirst({
    where: { code: state.formCode, commodity: { code: state.commodityId, dataset_version_id: versionId } },
    include: { parameter: { select: { id: true, key: true } } },
  });
  if (!form) throw notFound(`Form ${state.commodityId}.${state.formCode} tidak ada di versi aktif`);

  try {
    return await insertScenario(user, input, out, versionId, form);
  } catch (e) {
    // Dua sinkron paralel dengan clientId sama: yang kalah kena unique violation → kembalikan yang menang.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const winner = await existingResult();
      if (winner) return winner;
    }
    throw e;
  }
}

async function insertScenario(
  user: SessionUser,
  input: SaveScenarioInput,
  out: ScenarioOutput,
  versionId: string,
  form: { id: string; parameter: { id: string; key: string }[] },
) {
  const { state } = input;
  return prisma.$transaction(async (tx) => {
    let containerTypeId: string | undefined;
    if (state.kind === 'CONTAINER') {
      if (state.custom) {
        const c = await tx.container_type.create({
          data: {
            code: 'CUSTOM',
            name: `Custom ${input.name}`.slice(0, 120),
            inner_l_m: state.custom.lengthM,
            inner_w_m: state.custom.widthM,
            inner_h_m: state.custom.heightM,
            payload_kg: state.custom.payloadKg,
            is_custom: true,
            owner_id: user.id,
            confidence: 'C',
          },
        });
        containerTypeId = c.id;
      } else {
        const c = await tx.container_type.findFirst({ where: { dataset_version_id: versionId, code: state.containerId!, is_custom: false } });
        if (!c) throw notFound(`Container ${state.containerId} tidak dikenal`);
        containerTypeId = c.id;
      }
    }

    const sc = await tx.scenario.create({
      data: {
        ...(input.clientId && { id: input.clientId }),
        user_id: user.id,
        dataset_version_id: versionId,
        commodity_form_id: form.id,
        container_type_id: containerTypeId ?? null,
        calc_kind: state.kind,
        calc_mode: calcModeOf(state),
        input: json({ name: input.name, state }),
        share_slug: newSlug(),
      },
    });

    // Override per skenario → tabel scenario_override (IR-05 dicek trigger DB).
    for (const [key, value] of Object.entries(state.overrides ?? {})) {
      const p = form.parameter.find((x) => x.key === key);
      if (!p) throw new ApiError(422, 'DATASET', `Parameter ${key} tidak ada di form ini`);
      await tx.scenario_override.create({
        data: { scenario_id: sc.id, parameter_id: p.id, v_min: value, v_typ: value, v_max: value, reason: 'override pengguna' },
      });
    }

    await tx.calc_result.create({
      data: {
        scenario_id: sc.id,
        engine_version: out.out.trace.engineVersion,
        binding: out.out.binding,
        result_min: json(out.out.result.min),
        result_typ: json(out.out.result.typ),
        result_max: json(out.out.result.max),
        warnings: json(out.out.warnings),
        trace: json(out.out.trace),
      },
    });
    return { id: sc.id, shareSlug: sc.share_slug!, created: true, out };
  });
}

export interface StoredScenario {
  id: string;
  name: string;
  shareSlug: string;
  createdAt: Date;
  datasetVersion: string;
  state: ScenarioState;
  output: ScenarioOutput;
}

export const isScenarioUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Ambil skenario by share_slug (publik) atau by id (wajib `ownerId` = pemilik, cegah IDOR);
 * hitung ulang dengan versi datasetnya sendiri (reproducible).
 */
export async function getScenario(idOrSlug: string, ownerId?: string): Promise<StoredScenario> {
  const byId = isScenarioUuid(idOrSlug);
  if (byId && !ownerId) throw notFound('Skenario tidak ditemukan');
  const sc = await prisma.scenario.findFirst({
    where: byId ? { id: idOrSlug, user_id: ownerId! } : { share_slug: idOrSlug },
    include: { dataset_version: { select: { semver: true } } },
  });
  if (!sc) throw notFound('Skenario tidak ditemukan');
  const input = sc.input as { name?: string; state?: unknown };
  const state = ScenarioStateSchema.parse(input.state);
  const { ds } = await datasetForVersion(sc.dataset_version.semver);
  return {
    id: sc.id,
    name: input.name ?? 'Skenario',
    shareSlug: sc.share_slug!,
    createdAt: sc.created_at,
    datasetVersion: sc.dataset_version.semver,
    state,
    output: runScenario(ds, state),
  };
}

export async function listScenarios(userId: string) {
  const rows = await prisma.scenario.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { dataset_version: { select: { semver: true } } },
  });
  return rows.map((r) => {
    const input = r.input as { name?: string; state?: ScenarioState };
    return {
      id: r.id,
      name: input.name ?? 'Skenario',
      shareSlug: r.share_slug,
      kind: r.calc_kind,
      createdAt: r.created_at,
      datasetVersion: r.dataset_version.semver,
      state: input.state,
    };
  });
}

export async function deleteScenario(user: SessionUser, id: string) {
  const sc = await prisma.scenario.findUnique({ where: { id } });
  if (!sc || sc.user_id !== user.id) throw notFound('Skenario tidak ditemukan');
  await prisma.scenario.delete({ where: { id } });
}
