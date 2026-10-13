/**
 * Manifest aplikasi khusus R&D Lab (DEC-070): "Tambahkan ke layar utama" dari halaman /lab memasang
 * aplikasi "GEMA RnD Lab" yang langsung terbuka di /lab.
 */
export const dynamic = 'force-static';

export function GET() {
  return new Response(
    JSON.stringify({
      name: 'GEMA RnD Lab — gemasSTUDIO',
      short_name: 'GEMA RnD',
      description: 'Buku catatan riset produk kelapa: bahan baku, resep, laporan harian, laporan belanja. Jalan offline.',
      lang: 'id',
      id: '/lab',
      start_url: '/lab',
      scope: '/',
      display: 'standalone',
      background_color: '#F3F6F7',
      theme_color: '#0E1A1F',
      icons: [
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
