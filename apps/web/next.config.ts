import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Service worker hanya di build produksi agar cache tidak mengganggu pengembangan.
  disable: process.env.NODE_ENV !== 'production',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Paket workspace diekspor sebagai sumber TypeScript (DEC-019).
  transpilePackages: ['@gemas/calc-engine', '@gemas/dataset'],
  typedRoutes: false,
  poweredByHeader: false,
  // E2E kalibrasi menjalankan dev server kedua (DB test, port 3100) → folder build terpisah.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
};

export default withSerwist(nextConfig);
