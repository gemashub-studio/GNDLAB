import type { Metadata } from 'next';
import { ChecklistPage } from '@/components/checklist/ChecklistPage';

export const metadata: Metadata = { title: 'Ceklis' };

export default function Page() {
  return <ChecklistPage />;
}
