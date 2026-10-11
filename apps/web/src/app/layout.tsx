import type { Metadata, Viewport } from 'next';
import { Archivo, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { profileOf } from '@gemas/dataset';
import { datasetOrBundled } from '@/server/datasets';
import { Shell } from '@/components/shell/Shell';
import { Tour } from '@/components/tour/Tour';
import './globals.css';

// Font di-host lokal oleh next/font → tetap tampil saat offline (DEC-020).
const display = Space_Grotesk({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = Archivo({ weight: ['400', '500', '700', '800'], subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'gemasSTUDIO — Coco Inventory & R&D Lab', template: '%s · gemasSTUDIO' },
  description: 'Kalkulator muat container & ruang gudang untuk kelapa jambul, arang batok, kopra asalan, dan kopra edible.',
  applicationName: 'gemasSTUDIO',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#0E1A1F', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ds = await datasetOrBundled();
  const p = profileOf(ds);
  const profile = `${p.A + p.B + p.C} param · A${p.A} · B${p.B} · C${p.C}`;
  return (
    <html lang="id" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Shell datasetVersion={ds.version} profile={profile}>
          {children}
        </Shell>
        <Tour />
      </body>
    </html>
  );
}
