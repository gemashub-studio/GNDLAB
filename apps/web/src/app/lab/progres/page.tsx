import type { Metadata } from 'next';
import { ProgresPage } from '@/components/lab/ProgresPage';

export const metadata: Metadata = { title: 'Media dan data progres perlakuan', manifest: '/lab-manifest.webmanifest' };

export default function Page() {
  return <ProgresPage />;
}
