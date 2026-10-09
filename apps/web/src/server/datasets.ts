import 'server-only';
import { applyParameterOverrides, bundledDataset, diffParameters, type DatasetSI, type ParameterOverride } from '@gemas/dataset';
import type { Confidence } from '@gemas/calc-engine';
import { notFound } from './http';
import { prisma } from './db';

/**
 * Dataset per versi (ADR-002, ADR-008): versi X = dataset ter-bundle (basis) + override parameter
 * versi X dari DB (patch hanya mengubah nilai). Versi PUBLISHED immutable (IR-02) → aman di-cache.
 */
const cache = new Map<string, { ds: DatasetSI; versionId: string; overrides: ParameterOverride[] }>();

export async function activeVersion() {
  const v = await prisma.dataset_version.findFirst({ where: { is_active: true } });
  if (!v) throw notFound('Belum ada versi dataset aktif (jalankan setup database)');
  return v;
}

export async function parameterRowsForVersion(versionId: string): Promise<ParameterOverride[]> {
  const rows = await prisma.parameter.findMany({
    where: { commodity_form: { commodity: { dataset_version_id: versionId } } },
    select: {
      key: true,
      v_min: true,
      v_typ: true,
      v_max: true,
      confidence: true,
      note: true,
      commodity_form: { select: { code: true, commodity: { select: { code: true } } } },
    },
  });
  return rows.map((r) => ({
    commodityId: r.commodity_form.commodity.code,
    formCode: r.commodity_form.code,
    key: r.key,
    min: Number(r.v_min),
    typ: Number(r.v_typ),
    max: Number(r.v_max),
    confidence: r.confidence as Confidence,
    ...(r.note && { note: r.note }),
  }));
}

async function load(v: { id: string; semver: string; status: string }) {
  const hit = cache.get(v.semver);
  if (hit) return hit;
  const base = bundledDataset();
  const overrides = diffParameters(base, await parameterRowsForVersion(v.id));
  const ds = overrides.length || v.semver !== base.version ? applyParameterOverrides(base, v.semver, overrides) : base;
  const entry = { ds, versionId: v.id, overrides };
  // Hanya versi terbit yang di-cache (DRAFT bisa masih berubah).
  if (v.status === 'PUBLISHED') cache.set(v.semver, entry);
  return entry;
}

/** Dataset untuk versi `semver` (undefined → versi aktif). 404 bila versi tak dikenal. */
export async function datasetForVersion(semver?: string | null) {
  const v = semver
    ? await prisma.dataset_version.findUnique({ where: { semver } })
    : await prisma.dataset_version.findFirst({ where: { is_active: true } });
  if (!v) throw notFound(semver ? `Dataset versi ${semver} tidak dikenal` : 'Belum ada versi dataset aktif');
  return { ...(await load(v)), semver: v.semver, status: v.status, publishedAt: v.published_at };
}

export async function activeDataset() {
  return datasetForVersion();
}

/**
 * Untuk halaman & hitung publik: versi aktif bila DB tersedia, selain itu dataset ter-bundle
 * (kalkulator tidak boleh mati hanya karena DB tidak bisa dihubungi).
 */
export async function datasetOrBundled(semver?: string | null): Promise<DatasetSI> {
  try {
    return (await datasetForVersion(semver)).ds;
  } catch (e) {
    if (semver) throw e;
    console.warn('[dataset] DB tidak tersedia, memakai dataset ter-bundle:', e instanceof Error ? e.message : e);
    return bundledDataset();
  }
}

/** Kosongkan cache (dipakai test & setelah versi baru diterbitkan). */
export function clearDatasetCache() {
  cache.clear();
}
