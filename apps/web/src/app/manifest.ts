import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'gemasSTUDIO — Coco Inventory & R&D Lab',
    short_name: 'gemasSTUDIO',
    description: 'Kalkulator muat container & gudang komoditas kelapa — jalan offline.',
    lang: 'id',
    start_url: '/',
    display: 'standalone',
    background_color: '#EFEDE4',
    theme_color: '#111111',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
