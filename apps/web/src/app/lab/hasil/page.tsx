import type { Metadata } from 'next';
import { HasilPage } from '@/components/lab/HasilPage';

export const metadata: Metadata = { title: 'Hasil pencatatan data', manifest: '/lab-manifest.webmanifest' };

export default function Page() {
  return <HasilPage />;
}
