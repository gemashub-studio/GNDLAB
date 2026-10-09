/**
 * Alur penuh M4 (DB test terpisah): sampling → statistik → usulan otomatis (n ≥ 10) → approval data_admin
 * → versi patch baru PUBLISHED & aktif → skenario BARU memakai nilai baru, skenario LAMA tidak berubah.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MeasurementInput } from '@/lib/sampling';
import { loadEnv } from './env';

loadEnv();
const hasDb = !!process.env.DATABASE_URL;

/** Alur ini butuh DB test yang masih segar (belum ada sampel). Bila sudah terpakai → dilewati. */
async function isFresh() {
  if (!hasDb) return false;
  const { prisma } = await import('@/server/db');
  const fresh = (await prisma.measurement.count()) === 0;
  if (!fresh) console.warn('[calibration.db] DB test sudah terpakai → dilewati. Jalankan scripts/windows/reset-test-db.ps1 untuk mengulang.');
  return fresh;
}
const fresh = await isFresh();

describe.skipIf(!fresh)('kalibrasi lapangan end-to-end (database test)', async () => {
  const { prisma } = await import('@/server/db');
  const { insertMeasurements, samplingStats } = await import('@/server/calibration');
  const { approveProposal, rejectProposal, listProposals, bumpPatch } = await import('@/server/approval');
  const { saveScenario, getScenario } = await import('@/server/scenarios');
  const { activeDataset } = await import('@/server/datasets');

  let editor: { id: string; email: string; role: 'editor' };
  let admin: { id: string; email: string; role: 'data_admin' };
  let viewer: { id: string; email: string; role: 'viewer' };

  const sample = (value: number, i: number): MeasurementInput => ({
    measuredAt: `2026-10-15T09:${String(i).padStart(2, '0')}:00+07:00`,
    location: 'Gudang uji',
    lotRef: 'LOT-T1',
    commodityId: 'kelapa_jambul',
    formCode: 'bagged',
    key: 'bulk_density',
    value,
    unit: 'kg_m3',
    method: 'realisasi_stuffing',
  });
  // 12 realisasi stuffing → densitas efektif ±400 kg/m³ (dataset awal 360/385/410, keyakinan C)
  const VALUES = [396, 398, 399, 400, 400, 401, 402, 403, 404, 405, 397, 401];

  beforeAll(async () => {
    const mk = async <R extends 'editor' | 'data_admin' | 'viewer'>(role: R) => {
      const email = `${role}-${randomUUID()}@gemas.test`;
      const u = await prisma.app_user.create({ data: { email, role } });
      return { id: u.id, email, role };
    };
    editor = await mk('editor');
    admin = await mk('data_admin');
    viewer = await mk('viewer');
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const jambul20 = { kind: 'CONTAINER' as const, commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE' as const };

  it('viewer tidak boleh mencatat sampel; editor boleh', async () => {
    await expect(insertMeasurements(viewer, [sample(400, 0)])).rejects.toThrow(/editor/);
  });

  it('n < 10 → belum ada usulan; statistik tampil', async () => {
    const r = await insertMeasurements(editor, VALUES.slice(0, 9).map(sample));
    expect(r.inserted).toBe(9);
    expect(r.proposals).toEqual([]);
    const st = (await samplingStats()).find((s) => s.key === 'kelapa_jambul|bagged|bulk_density')!;
    expect(st.stats.n).toBe(9);
    expect(st.needed).toBe(1);
  });

  it('baris tidak valid ditolak seluruhnya (tidak ada yang tersimpan sebagian)', async () => {
    await expect(insertMeasurements(editor, [sample(400, 1), { ...sample(400, 2), unit: 'kg' }])).rejects.toThrow(/ditolak/);
    const st = (await samplingStats()).find((s) => s.key === 'kelapa_jambul|bagged|bulk_density')!;
    expect(st.stats.n).toBe(9);
  });

  let oldScenario: { id: string; pieces: number };
  it('skenario disimpan dengan versi awal (sebelum kalibrasi)', async () => {
    const s = await saveScenario(editor, { name: 'Sebelum kalibrasi', state: jambul20 });
    const pieces = s.out.kind === 'CONTAINER' ? s.out.out.result.typ.pieces! : 0;
    expect(pieces).toBe(Math.floor((33.2 * 385) / 0.575));
    oldScenario = { id: s.id, pieces };
  });

  let proposalId = '';
  it('n = 12 → usulan otomatis P5/median/P95', async () => {
    const r = await insertMeasurements(editor, VALUES.slice(9).map((v, i) => sample(v, 10 + i)));
    expect(r.proposals).toHaveLength(1);
    const p = r.proposals[0]!;
    expect(p.sampleN).toBe(12);
    expect(p.proposed.typ).toBeCloseTo(400.5, 6); // median
    expect(p.proposed.min).toBeLessThan(p.proposed.typ);
    proposalId = p.id;
    const links = await prisma.proposal_measurement.count({ where: { proposal_id: p.id } });
    expect(links).toBe(12);
  });

  it('editor tidak boleh menyetujui (IR-07 butuh data_admin)', async () => {
    await expect(approveProposal(editor, proposalId)).rejects.toThrow(/data_admin/);
  });

  let newVersion = '';
  it('data_admin menyetujui → versi patch baru PUBLISHED & aktif, versi lama utuh', async () => {
    const before = await activeDataset();
    const r = await approveProposal(admin, proposalId);
    newVersion = r.version;
    expect(newVersion).toBe(bumpPatch(before.semver));
    const versions = await prisma.dataset_version.findMany({ orderBy: { semver: 'asc' } });
    expect(versions.filter((v) => v.is_active).map((v) => v.semver)).toEqual([newVersion]);
    const old = versions.find((v) => v.semver === before.semver)!;
    expect(old.status).toBe('PUBLISHED');
    // Nilai di versi lama tidak berubah (IR-02).
    const oldParam = await prisma.parameter.findFirstOrThrow({
      where: { key: 'bulk_density', commodity_form: { code: 'bagged', commodity: { code: 'kelapa_jambul', dataset_version_id: old.id } } },
    });
    expect(Number(oldParam.v_typ)).toBe(385);
    // Versi baru: nilai usulan, keyakinan A.
    const after = await activeDataset();
    const p = after.ds.commodities.find((c) => c.id === 'kelapa_jambul')!.forms.find((f) => f.code === 'bagged')!.params.bulk_density!;
    expect(p.typ).toBeCloseTo(400.5, 6);
    expect(p.confidence).toBe('A');
    expect(after.overrides).toHaveLength(1);
    // Usulan tercatat APPROVED + reviewer + versi hasil.
    const list = await listProposals('APPROVED');
    expect(list[0]).toMatchObject({ id: proposalId, reviewedBy: admin.email, resultingVersion: newVersion });
  });

  it('versi lama yang PUBLISHED tetap tidak bisa diubah (trigger IR-02)', async () => {
    const old = await prisma.dataset_version.findFirstOrThrow({ where: { is_active: false, status: 'PUBLISHED' } });
    const param = await prisma.parameter.findFirstOrThrow({ where: { commodity_form: { commodity: { dataset_version_id: old.id } } } });
    await expect(prisma.parameter.update({ where: { id: param.id }, data: { note: 'x' } })).rejects.toThrow(/IR-02/);
  });

  it('audit log mencatat aktor data_admin (IR-08)', async () => {
    const n = await prisma.audit_log.count({ where: { actor_id: admin.id, entity: 'calibration_proposal', action: 'UPDATE' } });
    expect(n).toBeGreaterThanOrEqual(1);
    const v = await prisma.audit_log.count({ where: { actor_id: admin.id, entity: 'dataset_version' } });
    expect(v).toBeGreaterThanOrEqual(2);
  });

  it('skenario BARU memakai nilai kalibrasi; skenario LAMA tetap sama (reproducible)', async () => {
    const s = await saveScenario(editor, { name: 'Sesudah kalibrasi', state: jambul20 });
    const pieces = s.out.kind === 'CONTAINER' ? s.out.out.result.typ.pieces! : 0;
    expect(pieces).toBe(Math.floor((33.2 * 400.5) / 0.575));
    const again = await getScenario(oldScenario.id, editor.id);
    expect(again.datasetVersion).not.toBe(newVersion);
    expect(again.output.kind === 'CONTAINER' && again.output.out.result.typ.pieces).toBe(oldScenario.pieces);
  });

  it('usulan tidak bisa disetujui dua kali; penolakan untuk usulan lain', async () => {
    await expect(approveProposal(admin, proposalId)).rejects.toThrow(/sudah APPROVED/);
    // Kumpulkan 10 sampel parameter lain → usulan → tolak.
    const rows = Array.from({ length: 10 }, (_, i): MeasurementInput => ({
      ...sample(0.6 + i * 0.005, 30 + i),
      key: 'mass_per_unit',
      unit: 'kg',
      method: 'timbang',
    }));
    const r = await insertMeasurements(editor, rows);
    expect(r.proposals).toHaveLength(1);
    const rej = await rejectProposal(admin, r.proposals[0]!.id);
    expect(rej.status).toBe('REJECTED');
  });
});
