import 'server-only';
import { bundledDataset, type DatasetSI } from '@gemas/dataset';
import { notFound } from './http';
import { prisma } from './db';

/**
 * Versi dataset aktif di DB. Engine menghitung dengan dataset ter-bundle yang versinya HARUS sama
 * dengan versi aktif DB — bila beda, server menolak menyimpan agar tidak ada angka yang tak terlacak.
 * (M4 menambah pemuatan versi lain dari DB untuk kalibrasi; ADR-002.)
 */
export async function activeVersion() {
  const v = await prisma.dataset_version.findFirst({ where: { is_active: true } });
  if (!v) throw notFound('Belum ada versi dataset aktif (jalankan setup database)');
  return v;
}

export function datasetFor(semver: string | null | undefined): DatasetSI {
  const ds = bundledDataset();
  if (semver && semver !== ds.version) throw notFound(`Dataset versi ${semver} tidak dikenal`);
  return ds;
}

export async function activeDataset(): Promise<{ ds: DatasetSI; versionId: string }> {
  const v = await activeVersion();
  return { ds: datasetFor(v.semver), versionId: v.id };
}
