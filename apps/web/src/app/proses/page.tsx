import type { Metadata } from 'next';
import { ProcessCalculator } from '@/components/process/ProcessCalculator';

export const metadata: Metadata = { title: 'Alur Proses' };

export default function Page() {
  return <ProcessCalculator />;
}
