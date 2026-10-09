/**
 * Integrasi DB: simpan skenario → scenario + scenario_override + calc_result; idempoten; ambil ulang.
 * Butuh DATABASE_URL (apps/web/.env dari scripts/windows/setup-dev-db.ps1). Dilewati bila tidak ada.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from './env';

loadEnv();
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('layanan skenario (PostgreSQL)', async () => {
  const { prisma } = await import('@/server/db');
  const { saveScenario, getScenario, listScenarios, deleteScenario } = await import('@/server/scenarios');
  const email = `uji-${randomUUID()}@gemas.test`;
  let user: { id: string; email: string; role: 'editor' };

  beforeAll(async () => {
    const u = await prisma.app_user.create({ data: { email, role: 'editor' } });
    user = { id: u.id, email, role: 'editor' };
  });
  afterAll(async () => {
    await prisma.scenario.deleteMany({ where: { user_id: user.id } });
    await prisma.container_type.deleteMany({ where: { owner_id: user.id } });
    await prisma.app_user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it('menyimpan skenario container + override + hasil server', async () => {
    const clientId = randomUUID();
    const r = await saveScenario(user, {
      clientId,
      name: 'Uji jambul 20GP',
      state: { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE', overrides: { bulk_density: 400 } },
    });
    expect(r.created).toBe(true);
    expect(r.id).toBe(clientId);
    expect(r.shareSlug).toMatch(/^[a-z2-9]{10}$/);

    const ov = await prisma.scenario_override.findMany({ where: { scenario_id: r.id }, include: { parameter: true } });
    expect(ov).toHaveLength(1);
    expect(ov[0]!.parameter.key).toBe('bulk_density');
    expect(Number(ov[0]!.v_typ)).toBe(400);

    const cr = await prisma.calc_result.findFirstOrThrow({ where: { scenario_id: r.id } });
    expect(cr.binding).toBe('VOLUME');
    expect((cr.result_typ as { pieces: number }).pieces).toBe(Math.floor((33.2 * 400) / 0.575));
    expect(cr.engine_version).toBe('1.0.0');

    // Sinkron ulang dengan clientId sama → tidak membuat baris baru (idempoten).
    const again = await saveScenario(user, { clientId, name: 'Uji jambul 20GP', state: { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE' } });
    expect(again.created).toBe(false);
    expect(await prisma.scenario.count({ where: { user_id: user.id } })).toBe(1);

    // Ambil lewat share_slug → dihitung ulang dengan versi datasetnya sendiri.
    const got = await getScenario(r.shareSlug);
    expect(got.name).toBe('Uji jambul 20GP');
    expect(got.output.kind === 'CONTAINER' && got.output.out.result.typ.pieces).toBe(Math.floor((33.2 * 400) / 0.575));
  });

  it('container custom membuat container_type milik pengguna', async () => {
    const r = await saveScenario(user, {
      name: 'Truk',
      state: { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', mode: 'BULK', custom: { lengthM: 6, widthM: 2.4, heightM: 2.2, payloadKg: 8000 } },
    });
    const sc = await prisma.scenario.findUniqueOrThrow({ where: { id: r.id }, include: { container_type: true } });
    expect(sc.container_type?.is_custom).toBe(true);
    expect(sc.container_type?.owner_id).toBe(user.id);
  });

  it('gudang & konversi tersimpan dengan calc_kind yang benar', async () => {
    const w = await saveScenario(user, {
      name: 'Gudang',
      state: { kind: 'WAREHOUSE', commodityId: 'kopra_asalan', formCode: 'loose_bulk', stock: { massKg: 50000 }, stackHeightM: 2.5, floorUtil: 0.65 },
    });
    const c = await saveScenario(user, {
      name: 'Konversi',
      state: { kind: 'CONVERT', commodityId: 'kelapa_jambul', formCode: 'bagged', from: { unit: 'pack', value: 2 }, to: 'pcs' },
    });
    const kinds = (await listScenarios(user.id)).map((s) => s.kind).sort();
    expect(kinds).toEqual(['CONTAINER', 'CONTAINER', 'CONVERT', 'WAREHOUSE']); // sebelum uji paralel
    const wr = await prisma.calc_result.findFirstOrThrow({ where: { scenario_id: w.id } });
    expect((wr.result_typ as { floorAreaM2: number }).floorAreaM2).toBeCloseTo(61.54, 2);
    expect(c.created).toBe(true);
  });

  it('override di luar rentang ditolak sebelum menulis apa pun', async () => {
    const before = await prisma.scenario.count({ where: { user_id: user.id } });
    await expect(
      saveScenario(user, {
        name: 'Salah',
        state: { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PIECE', overrides: { bulk_density: 5000 } },
      }),
    ).rejects.toThrow(/rentang wajar/);
    expect(await prisma.scenario.count({ where: { user_id: user.id } })).toBe(before);
  });

  it('IDOR: ambil by UUID hanya untuk pemilik; share_slug tetap publik', async () => {
    const mine = (await listScenarios(user.id))[0]!;
    await expect(getScenario(mine.id)).rejects.toThrow(/tidak ditemukan/);
    await expect(getScenario(mine.id, randomUUID())).rejects.toThrow(/tidak ditemukan/);
    expect((await getScenario(mine.id, user.id)).id).toBe(mine.id);
    expect((await getScenario(mine.shareSlug!)).id).toBe(mine.id);
  });

  it('dua sinkron paralel dengan clientId sama → satu baris, keduanya sukses', async () => {
    const clientId = randomUUID();
    const body = { clientId, name: 'Paralel', state: { kind: 'CONVERT' as const, commodityId: 'kelapa_jambul', formCode: 'bagged', from: { unit: 'kg' as const, value: 1 }, to: 't' as const } };
    const [a, b] = await Promise.all([saveScenario(user, body), saveScenario(user, body)]);
    expect(a.id).toBe(clientId);
    expect(b.id).toBe(clientId);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    expect(await prisma.scenario.count({ where: { id: clientId } })).toBe(1);
  });

  it('sinkron ulang mengembalikan hasil skenario TERSIMPAN, bukan state baru', async () => {
    const clientId = randomUUID();
    const st = (v: number) => ({ kind: 'CONVERT' as const, commodityId: 'kelapa_jambul', formCode: 'bagged', from: { unit: 'kg' as const, value: v }, to: 't' as const });
    await saveScenario(user, { clientId, name: 'Asli', state: st(1000) });
    const again = await saveScenario(user, { clientId, name: 'Ubah', state: st(5000) });
    expect(again.created).toBe(false);
    expect(again.out.kind === 'CONVERT' && again.out.out.result.typ.value).toBe(1);
  });

  it('pengguna lain tidak bisa menghapus / memakai clientId milik orang lain', async () => {
    const other = await prisma.app_user.create({ data: { email: `lain-${randomUUID()}@gemas.test`, role: 'editor' } });
    try {
      const mine = (await listScenarios(user.id))[0]!;
      const o = { id: other.id, email: other.email, role: 'editor' as const };
      await expect(deleteScenario(o, mine.id)).rejects.toThrow(/tidak ditemukan/);
      await expect(
        saveScenario(o, { clientId: mine.id, name: 'x', state: { kind: 'CONVERT', commodityId: 'kelapa_jambul', formCode: 'bagged', from: { unit: 'kg', value: 1 }, to: 't' } }),
      ).rejects.toThrow(/sudah dipakai/);
    } finally {
      await prisma.app_user.delete({ where: { id: other.id } });
    }
  });
});
