import type { Metadata } from 'next';
import { ChainPage } from '@/components/chain/ChainPage';

export const metadata: Metadata = { title: 'Rantai Produksi' };

export default function Page() {
  return <ChainPage />;
}
