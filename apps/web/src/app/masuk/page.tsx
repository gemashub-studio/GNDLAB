import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { currentUser } from '@/server/auth';

export const metadata: Metadata = { title: 'Masuk' };
export const dynamic = 'force-dynamic';

const ERR: Record<string, string> = {
  Verification: 'Tautan sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.',
  EmailSignin: 'Email belum bisa dikirim. Coba lagi sebentar lagi.',
  Default: 'Gagal masuk. Coba lagi.',
};

export default async function Masuk({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser();
  return (
    <>
      <header className="flex flex-col gap-2.5">
        <span className="tag-mono self-start">AKUN</span>
        <h1 className="text-[40px] sm:text-[52px]">Masuk</h1>
      </header>
      <section className="card flex max-w-lg flex-col gap-4">
        {user ? (
          <>
            <p>
              Kamu masuk sebagai <b>{user.email}</b> (peran: <span className="font-mono">{user.role}</span>).
            </p>
            <a href="/api/auth/signout" className="btn-ghost self-start no-underline">Keluar</a>
          </>
        ) : sp.cek ? (
          <>
            <h2 className="text-2xl">Cek email kamu</h2>
            <p>Tautan masuk sudah dikirim. Buka dari perangkat ini ya (berlaku 15 menit).</p>
            <p className="text-[13px] text-muted">
              Mode pengembangan tanpa server email: tautan dicetak di terminal tempat aplikasi berjalan.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px]">
              Login hanya diperlukan untuk <b>menyimpan skenario ke akun</b> & membagikan tautan pendek. Kalkulator
              tetap bisa dipakai tanpa login.
            </p>
            {sp.error && <p role="alert" className="bg-safety p-2 font-bold">{ERR[sp.error] ?? ERR.Default}</p>}
            <LoginForm callbackUrl={sp.callbackUrl ?? '/skenario'} />
          </>
        )}
      </section>
    </>
  );
}
