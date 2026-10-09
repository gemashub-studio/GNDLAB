import 'server-only';
import type { Prisma } from '@prisma/client';
import type { SessionUser } from './auth';
import { forbidden, setActor } from './calibration';
import { clearDatasetCache } from './datasets';
import { prisma } from './db';
import { ApiError } from './http';

/**
 * Persetujuan kalibrasi (ADR-002, ADR-008, IR-02, IR-03, IR-07, IR-08):
 * setujui → versi patch baru = salinan versi aktif + nilai usulan (keyakinan A), PUBLISHED & aktif;
 * versi lama tetap PUBLISHED & utuh (skenario lama reproducible).
 */
type Tx = Prisma.TransactionClient;

/** 1.0.4 → 1.0.5 (patch = koreksi nilai, ADR-002). */
export function bumpPatch(semver: string): string {
  const [a, b, c] = semver.split('.').map(Number) as [number, number, number];
  return `${a}.${b}.${c + 1}`;
}

const uuid = () => crypto.randomUUID();

interface Target {
  paramId: string;
  min: number;
  typ: number;
  max: number;
  note: string;
}

/** Salin data referensi versi `fromId` → versi DRAFT `toId`. Peta id parameter lama → baru. */
async function cloneVersion(tx: Tx, fromId: string, toId: string, target: Target) {
  const sources = await tx.source.findMany({ where: { dataset_version_id: fromId } });
  const srcMap = new Map(sources.map((s) => [s.id, uuid()]));
  await tx.source.createMany({ data: sources.map((s) => ({ ...s, id: srcMap.get(s.id)!, dataset_version_id: toId })) });

  const conts = await tx.container_type.findMany({ where: { dataset_version_id: fromId, is_custom: false } });
  const contMap = new Map(conts.map((c) => [c.id, uuid()]));
  await tx.container_type.createMany({ data: conts.map((c) => ({ ...c, id: contMap.get(c.id)!, dataset_version_id: toId })) });

  const comms = await tx.commodity.findMany({ where: { dataset_version_id: fromId } });
  const commMap = new Map(comms.map((c) => [c.id, uuid()]));
  await tx.commodity.createMany({ data: comms.map((c) => ({ ...c, id: commMap.get(c.id)!, dataset_version_id: toId })) });

  const forms = await tx.commodity_form.findMany({ where: { commodity_id: { in: comms.map((c) => c.id) } } });
  const formMap = new Map(forms.map((f) => [f.id, uuid()]));
  await tx.commodity_form.createMany({ data: forms.map((f) => ({ ...f, id: formMap.get(f.id)!, commodity_id: commMap.get(f.commodity_id)! })) });

  const params = await tx.parameter.findMany({ where: { commodity_form_id: { in: forms.map((f) => f.id) } } });
  const paramMap = new Map(params.map((p) => [p.id, uuid()]));
  await tx.parameter.createMany({
    data: params.map((p) => {
      const base = { ...p, id: paramMap.get(p.id)!, commodity_form_id: formMap.get(p.commodity_form_id)! };
      return p.id === target.paramId
        ? { ...base, v_min: target.min, v_typ: target.typ, v_max: target.max, confidence: 'A' as const, note: target.note }
        : base;
    }),
  });
  const ps = await tx.parameter_source.findMany({ where: { parameter_id: { in: params.map((p) => p.id) } } });
  if (ps.length) {
    await tx.parameter_source.createMany({ data: ps.map((x) => ({ parameter_id: paramMap.get(x.parameter_id)!, source_id: srcMap.get(x.source_id)! })) });
  }

  const packs = await tx.packaging_type.findMany({ where: { commodity_form_id: { in: forms.map((f) => f.id) } } });
  await tx.packaging_type.createMany({ data: packs.map((p) => ({ ...p, id: uuid(), commodity_form_id: formMap.get(p.commodity_form_id)! })) });

  const bench = await tx.container_benchmark.findMany({ where: { commodity_form_id: { in: forms.map((f) => f.id) } } });
  const benchMap = new Map(bench.map((b) => [b.id, uuid()]));
  await tx.container_benchmark.createMany({
    data: bench.map((b) => ({ ...b, id: benchMap.get(b.id)!, commodity_form_id: formMap.get(b.commodity_form_id)!, container_type_id: contMap.get(b.container_type_id)! })),
  });
  const bs = await tx.benchmark_source.findMany({ where: { benchmark_id: { in: bench.map((b) => b.id) } } });
  if (bs.length) {
    await tx.benchmark_source.createMany({ data: bs.map((x) => ({ benchmark_id: benchMap.get(x.benchmark_id)!, source_id: srcMap.get(x.source_id)! })) });
  }
  return paramMap;
}

const fmt4 = (v: unknown) => Number(v).toPrecision(4);

export async function approveProposal(admin: SessionUser, proposalId: string) {
  if (admin.role !== 'data_admin') throw forbidden('Hanya data_admin yang boleh menyetujui kalibrasi');
  const result = await prisma.$transaction(
    async (tx) => {
      await setActor(tx, admin.id);
      const prop = await tx.calibration_proposal.findUnique({
        where: { id: proposalId },
        include: { parameter: { include: { commodity_form: { include: { commodity: true } } } } },
      });
      if (!prop) throw new ApiError(404, 'NOT_FOUND', 'Usulan tidak ditemukan');
      if (prop.status !== 'PENDING') throw new ApiError(409, 'CONFLICT', `Usulan sudah ${prop.status}`);
      const active = await tx.dataset_version.findFirst({ where: { is_active: true } });
      if (!active || prop.parameter.commodity_form.commodity.dataset_version_id !== active.id) {
        throw new ApiError(409, 'CONFLICT', 'Usulan ini untuk versi dataset yang sudah tidak aktif');
      }
      let semver = bumpPatch(active.semver);
      while (await tx.dataset_version.findUnique({ where: { semver } })) semver = bumpPatch(semver);

      const p = prop.parameter;
      const label = `${p.commodity_form.commodity.code}.${p.commodity_form.code}.${p.key}`;
      const created = await tx.dataset_version.create({
        data: {
          semver,
          parent_version_id: active.id,
          changelog:
            `Kalibrasi ${label}: ${fmt4(p.v_min)}/${fmt4(p.v_typ)}/${fmt4(p.v_max)} (${p.confidence}) → ` +
            `${fmt4(prop.proposed_min)}/${fmt4(prop.proposed_typ)}/${fmt4(prop.proposed_max)} (A), n=${prop.sample_n}`,
        },
      });
      const paramMap = await cloneVersion(tx, active.id, created.id, {
        paramId: p.id,
        min: Number(prop.proposed_min),
        typ: Number(prop.proposed_typ),
        max: Number(prop.proposed_max),
        note: `Kalibrasi lapangan n=${prop.sample_n} (P5/median/P95), usulan ${prop.id.slice(0, 8)}`,
      });
      // Versi lama tetap PUBLISHED & utuh (IR-02); hanya satu versi aktif (IR-03).
      await tx.dataset_version.update({ where: { id: active.id }, data: { is_active: false } });
      await tx.dataset_version.update({ where: { id: created.id }, data: { status: 'PUBLISHED', published_at: new Date(), is_active: true } });
      await tx.calibration_proposal.update({ where: { id: prop.id }, data: { status: 'APPROVED', reviewed_by: admin.id, resulting_version_id: created.id } });
      // Usulan PENDING lain ikut pindah ke parameter versi baru (kunci alami sama).
      const others = await tx.calibration_proposal.findMany({ where: { status: 'PENDING', parameter_id: { in: [...paramMap.keys()] } } });
      for (const o of others) {
        await tx.calibration_proposal.update({ where: { id: o.id }, data: { parameter_id: paramMap.get(o.parameter_id)! } });
      }
      return { version: semver, versionId: created.id, parameter: label };
    },
    { timeout: 30_000 },
  );
  clearDatasetCache();
  return result;
}

export async function rejectProposal(admin: SessionUser, proposalId: string) {
  if (admin.role !== 'data_admin') throw forbidden('Hanya data_admin yang boleh menolak kalibrasi');
  return prisma.$transaction(async (tx) => {
    await setActor(tx, admin.id);
    const prop = await tx.calibration_proposal.findUnique({ where: { id: proposalId } });
    if (!prop) throw new ApiError(404, 'NOT_FOUND', 'Usulan tidak ditemukan');
    if (prop.status !== 'PENDING') throw new ApiError(409, 'CONFLICT', `Usulan sudah ${prop.status}`);
    await tx.calibration_proposal.update({ where: { id: prop.id }, data: { status: 'REJECTED', reviewed_by: admin.id } });
    return { id: prop.id, status: 'REJECTED' as const };
  });
}

export async function listProposals(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
  const rows = await prisma.calibration_proposal.findMany({
    where: status ? { status } : {},
    orderBy: { created_at: 'desc' },
    take: 200,
    include: {
      parameter: { include: { commodity_form: { include: { commodity: { include: { dataset_version: { select: { semver: true } } } } } } } },
      app_user: { select: { email: true } },
      dataset_version: { select: { semver: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    commodityId: r.parameter.commodity_form.commodity.code,
    formCode: r.parameter.commodity_form.code,
    key: r.parameter.key,
    unit: r.parameter.unit,
    forVersion: r.parameter.commodity_form.commodity.dataset_version.semver,
    current: { min: Number(r.parameter.v_min), typ: Number(r.parameter.v_typ), max: Number(r.parameter.v_max), confidence: r.parameter.confidence },
    proposed: { min: Number(r.proposed_min), typ: Number(r.proposed_typ), max: Number(r.proposed_max) },
    sampleN: r.sample_n,
    createdAt: r.created_at.toISOString(),
    reviewedBy: r.app_user?.email ?? null,
    resultingVersion: r.dataset_version?.semver ?? null,
  }));
}
