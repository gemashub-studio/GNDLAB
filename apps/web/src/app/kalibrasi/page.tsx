import type { Metadata } from 'next';
import Link from 'next/link';
import { ProposalReview } from '@/components/calibration/ProposalReview';
import { listProposals } from '@/server/approval';
import { currentUser } from '@/server/auth';
import { activeDataset } from '@/server/datasets';

export const metadata: Metadata = { title: 'Usulan Kalibrasi' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  let user = null;
  let proposals: Awaited<ReturnType<typeof listProposals>> = [];
  let version: string | undefined;
  let dbOk = true;
  try {
    user = await currentUser();
    if (user) proposals = await listProposals();
    version = (await activeDataset()).semver;
  } catch (e) {
    dbOk = false;
    console.error('[kalibrasi] gagal memuat dari server', e);
  }
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">REVIEW DATA{version ? ` · AKTIF v${version}` : ''}</span>
          <h1 className="text-[40px] sm:text-[52px]">
            Usulan
            <br />
            Kalibrasi
          </h1>
          <p className="max-w-prose">
            Setujui → terbit versi dataset baru (naik patch) dan jadi aktif. Versi lama tetap utuh, jadi skenario lama tetap menghitung dengan angkanya sendiri.
          </p>
        </div>
        <Link href="/sampling" className="btn-ghost no-underline">
          ← Sampling
        </Link>
      </header>
      {!dbOk ? (
        <p role="alert" className="card font-bold">
          Server data lagi nggak bisa dihubungi.
        </p>
      ) : !user ? (
        <p>
          <Link href="/masuk?callbackUrl=/kalibrasi" className="btn-acid no-underline">
            Masuk untuk melihat usulan
          </Link>
        </p>
      ) : (
        <ProposalReview proposals={proposals} isAdmin={user.role === 'data_admin'} />
      )}
    </>
  );
}
