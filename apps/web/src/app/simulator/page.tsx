import type { Metadata } from 'next';
import { SimulatorView } from '@/components/sim/SimulatorView';
import { decodeState } from '@/lib/scenario';

export const metadata: Metadata = { title: 'Simulator' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <SimulatorView key={sp.s ?? 'default'} initial={decodeState(sp.s)} />;
}
