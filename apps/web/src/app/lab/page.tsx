import type { Metadata } from 'next';
import { LabPage } from '@/components/lab/LabPage';

export const metadata: Metadata = { title: 'GEMA RnD Lab' };

export default function Page() {
  return <LabPage />;
}
