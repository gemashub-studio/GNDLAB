import type { Metadata } from 'next';
import Link from 'next/link';
import { ScenarioList } from '@/components/scenario/ScenarioList';
import { currentUser } from '@/server/auth';
import { listScenarios } from '@/server/scenarios';

export const metadata: Metadata = { title: 'Skenario' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  // Halaman tetap bisa dibuka offline/tanpa DB: kegagalan server → hanya daftar di perangkat.
  let user = null;
  let server: Awaited<ReturnType<typeof listScenarios>> = [];
  try {
    user = await currentUser();
    if (user) server = await listScenarios(user.id);
  } catch (e) {
    console.error('[skenario] gagal memuat dari server', e);
  }
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">ARSIP</span>
          <h1 className="text-[40px] sm:text-[52px]">Skenario<br />Tersimpan</h1>
        </div>
        {!user && (
          <Link href="/masuk?callbackUrl=/skenario" className="btn-acid no-underline">
            Masuk untuk sinkron
          </Link>
        )}
      </header>
      <ScenarioList
        loggedIn={!!user}
        server={server.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </>
  );
}
