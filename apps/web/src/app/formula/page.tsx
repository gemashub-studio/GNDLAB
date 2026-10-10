import type { Metadata } from 'next';
import { FormulaPage } from '@/components/formula/FormulaPage';

export const metadata: Metadata = { title: 'Formula R&D' };

export default function Page() {
  return <FormulaPage />;
}
