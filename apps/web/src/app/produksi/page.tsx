import type { Metadata } from 'next';
import { ProductionPlanner } from '@/components/production/ProductionPlanner';

export const metadata: Metadata = { title: 'Produksi per Shift' };

export default function Page() {
  return <ProductionPlanner />;
}
