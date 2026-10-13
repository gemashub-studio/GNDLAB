import type { Metadata } from 'next';
import { LabPage } from '@/components/lab/LabPage';

export const metadata: Metadata = { title: 'GEMA RnD Lab', manifest: '/lab-manifest.webmanifest', appleWebApp: { title: 'GEMA RnD', capable: true } };

export default function Page() {
  return <LabPage />;
}
