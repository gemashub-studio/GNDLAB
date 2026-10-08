import type { Metadata } from 'next';
import { ContainerCalculator } from '@/components/container/ContainerCalculator';
import { decodeState } from '@/lib/scenario';

export const metadata: Metadata = { title: 'Muat Container' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const decoded = decodeState(sp.s);
  const initial = decoded?.kind === 'CONTAINER' ? decoded : undefined;
  // key → state di-reset bila tautan bagikan lain dibuka di tab yang sama.
  return <ContainerCalculator key={sp.s ?? 'new'} initial={initial} startWizard={sp.wizard === '1'} />;
}
