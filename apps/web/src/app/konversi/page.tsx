import type { Metadata } from 'next';
import { Converter } from '@/components/convert/Converter';
import { decodeState } from '@/lib/scenario';

export const metadata: Metadata = { title: 'Konversi' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const decoded = decodeState(sp.s);
  return <Converter key={sp.s ?? 'new'} initial={decoded?.kind === 'CONVERT' ? decoded : undefined} />;
}
