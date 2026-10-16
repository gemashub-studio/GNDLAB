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
  // Supabase (DEC-084): env Vercel PROJECT_URL & ANON_KEY_SUPABASE → tersedia di browser. Anon key memang publik.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.PROJECT_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.ANON_KEY_SUPABASE ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  // E2E kalibrasi menjalankan dev server kedua (DB test, port 3100) → folder build terpisah.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
};

export default withSerwist(nextConfig);
