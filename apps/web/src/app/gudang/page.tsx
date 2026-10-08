import type { Metadata } from 'next';
import { WarehouseCalculator } from '@/components/warehouse/WarehouseCalculator';
import { decodeState } from '@/lib/scenario';

export const metadata: Metadata = { title: 'Gudang' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const decoded = decodeState(sp.s);
  return <WarehouseCalculator key={sp.s ?? 'new'} initial={decoded?.kind === 'WAREHOUSE' ? decoded : undefined} />;
}
