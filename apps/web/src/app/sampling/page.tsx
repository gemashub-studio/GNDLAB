import type { Metadata } from 'next';
import Link from 'next/link';
import { SamplingWorkbench } from '@/components/sampling/SamplingWorkbench';
import { currentUser } from '@/server/auth';
import { samplingStats, type ParamStats } from '@/server/calibration';

export const metadata: Metadata = { title: 'Sampling Lapangan' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  let user = null;
  let stats: ParamStats[] = [];
  let dbOk = true;
  try {
    user = await currentUser();
    stats = await samplingStats();
  } catch (e) {
    dbOk = false;
    console.error('[sampling] gagal memuat dari server', e);
  }
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">DATA LAPANGAN</span>
          <h1 className="text-[40px] sm:text-[52px]">
            Sampling
            <br />& Kalibrasi
          </h1>
          <p className="max-w-prose">Timbang, ukur, catat. Makin banyak sampel dari gudang sendiri, makin pas hitungan kalkulatornya.</p>
        </div>
        <Link href="/kalibrasi" className="btn-ghost no-underline">
          Usulan kalibrasi →
        </Link>
      </header>
      <SamplingWorkbench role={user?.role ?? null} stats={stats} dbOk={dbOk} />
    </>
  );
}
