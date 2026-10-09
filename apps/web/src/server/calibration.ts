import 'server-only';
import { CALIBRATION_MIN_SAMPLES, proposeCalibration, sampleStats, type SampleStats } from '@gemas/calc-engine';
import type { Prisma } from '@prisma/client';
import { checkAgainstDataset, type MeasurementInput } from '@/lib/sampling';
import type { SessionUser } from './auth';
import { activeDataset } from './datasets';
import { prisma } from './db';
import { ApiError } from './http';

type Tx = Prisma.TransactionClient;
export const forbidden = (msg = 'Peranmu belum boleh melakukan ini') => new ApiError(403, 'FORBIDDEN', msg);

/** Actor untuk trigger audit (IR-08 membaca `app.actor_id`). Berlaku hanya di transaksi ini. */
export async function setActor(tx: Tx, userId: string) {
  await tx.$executeRaw`select set_config('app.actor_id', ${userId}, true)`;
}

export const naturalKey = (commodityId: string, formCode: string, key: string) => `${commodityId}|${formCode}|${key}`;

/** Parameter versi aktif dipetakan per kunci alami komoditas|form|key. */
async function activeParams(versionId: string) {
  const rows = await prisma.parameter.findMany({
    where: { commodity_form: { commodity: { dataset_version_id: versionId } } },
    select: { id: true, key: true, unit: true, v_min: true, v_typ: true, v_max: true, confidence: true, commodity_form_id: true, commodity_form: { select: { code: true, commodity: { select: { code: true } } } } },
  });
  return new Map(rows.map((r) => [naturalKey(r.commodity_form.commodity.code, r.commodity_form.code, r.key), r]));
}

export async function insertMeasurements(user: SessionUser, rows: MeasurementInput[]) {
  if (user.role === 'viewer') throw forbidden('Butuh peran editor untuk mencatat sampel');
  if (!rows.length) throw new ApiError(422, 'VALIDATION', 'Tidak ada baris sampel');
  const { ds, versionId } = await activeDataset();
  const params = await activeParams(versionId);
  const rejected: { index: number; reason: string }[] = [];
  const data: Prisma.measurementCreateManyInput[] = [];
  rows.forEach((r, index) => {
    const reason = checkAgainstDataset(ds, r);
    const p = params.get(naturalKey(r.commodityId, r.formCode, r.key));
    if (reason || !p) return rejected.push({ index, reason: reason ?? 'parameter tidak ada di versi aktif' });
    data.push({
      user_id: user.id,
      commodity_form_id: p.commodity_form_id,
      parameter_id: p.id,
      value: r.value,
      unit: r.unit,
      method: r.method,
      location: r.location ?? null,
      lot_ref: r.lotRef ?? null,
      measured_at: new Date(r.measuredAt),
    });
  });
  if (rejected.length) throw new ApiError(422, 'VALIDATION', `${rejected.length} baris ditolak`, rejected);
  await prisma.measurement.createMany({ data });
  const keys = [...new Set(rows.map((r) => naturalKey(r.commodityId, r.formCode, r.key)))];
  const proposals = await refreshProposals(user, keys);
  return { inserted: data.length, proposals };
}

/** Semua sampel dikelompokkan per kunci alami — lintas versi dataset (data lapangan terus terkumpul). */
async function measurementsByKey(keys?: string[]) {
  const rows = await prisma.measurement.findMany({
    select: { id: true, value: true, unit: true, method: true, parameter: { select: { key: true, commodity_form: { select: { code: true, commodity: { select: { code: true } } } } } } },
    orderBy: { measured_at: 'asc' },
  });
  const groups = new Map<string, { ids: string[]; values: number[]; methods: Set<string> }>();
  for (const r of rows) {
    const k = naturalKey(r.parameter.commodity_form.commodity.code, r.parameter.commodity_form.code, r.parameter.key);
    if (keys && !keys.includes(k)) continue;
    const g = groups.get(k) ?? { ids: [], values: [], methods: new Set<string>() };
    g.ids.push(r.id);
    g.values.push(Number(r.value));
    g.methods.add(r.method);
    groups.set(k, g);
  }
  return groups;
}

export interface ProposalSummary {
  id: string;
  key: string;
  sampleN: number;
  proposed: { min: number; typ: number; max: number };
  created: boolean;
}

/**
 * Buat/perbarui CALIBRATION_PROPOSAL untuk kunci dengan n ≥ 10 (P5 / median / P95).
 * Satu usulan PENDING per parameter versi aktif; data baru memperbarui usulan yang sama.
 */
export async function refreshProposals(actor: SessionUser, keys?: string[]): Promise<ProposalSummary[]> {
  const { versionId } = await activeDataset();
  const params = await activeParams(versionId);
  const groups = await measurementsByKey(keys);
  const out: ProposalSummary[] = [];
  for (const [k, g] of groups) {
    const prop = proposeCalibration(g.values);
    const p = params.get(k);
    if (!prop || !p) continue;
    const res = await prisma.$transaction(async (tx) => {
      await setActor(tx, actor.id);
      const existing = await tx.calibration_proposal.findFirst({ where: { parameter_id: p.id, status: 'PENDING' } });
      const values = { proposed_min: prop.min, proposed_typ: prop.typ, proposed_max: prop.max, sample_n: prop.n };
      const row = existing
        ? await tx.calibration_proposal.update({ where: { id: existing.id }, data: values })
        : await tx.calibration_proposal.create({ data: { parameter_id: p.id, ...values } });
      await tx.proposal_measurement.deleteMany({ where: { proposal_id: row.id } });
      await tx.proposal_measurement.createMany({ data: g.ids.map((measurement_id) => ({ proposal_id: row.id, measurement_id })) });
      return { id: row.id, created: !existing };
    });
    out.push({ id: res.id, key: k, sampleN: prop.n, proposed: { min: prop.min, typ: prop.typ, max: prop.max }, created: res.created });
  }
  return out;
}

export interface ParamStats {
  key: string;
  commodityId: string;
  formCode: string;
  paramKey: string;
  unit: string;
  current: { min: number; typ: number; max: number; confidence: string };
  stats: SampleStats;
  needed: number;
  methods: string[];
  pendingProposalId?: string;
}

export async function samplingStats(): Promise<ParamStats[]> {
  const { versionId } = await activeDataset();
  const params = await activeParams(versionId);
  const groups = await measurementsByKey();
  const pending = await prisma.calibration_proposal.findMany({ where: { status: 'PENDING' }, select: { id: true, parameter_id: true } });
  const out: ParamStats[] = [];
  for (const [k, g] of groups) {
    const p = params.get(k);
    if (!p) continue;
    const [commodityId, formCode, paramKey] = k.split('|') as [string, string, string];
    const prop = pending.find((x) => x.parameter_id === p.id);
    out.push({
      key: k,
      commodityId,
      formCode,
      paramKey,
      unit: p.unit,
      current: { min: Number(p.v_min), typ: Number(p.v_typ), max: Number(p.v_max), confidence: p.confidence },
      stats: sampleStats(g.values),
      needed: Math.max(0, CALIBRATION_MIN_SAMPLES - g.values.length),
      methods: [...g.methods],
      ...(prop && { pendingProposalId: prop.id }),
    });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
