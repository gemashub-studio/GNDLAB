import type { Metadata } from 'next';
import { LabPage } from '@/components/lab/LabPage';

export const metadata: Metadata = { title: 'GnD Lab', manifest: '/lab-manifest.webmanifest', appleWebApp: { title: 'GnD Lab', capable: true } };

export default function Page() {
  return <LabPage />;
}
