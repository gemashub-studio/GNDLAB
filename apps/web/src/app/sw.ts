/// <reference lib="webworker" />
/**
 * Service worker (Serwist) — kalkulator jalan offline (NFR-03, ARD AR-07).
 * - Aset build (JS/CSS/font, termasuk engine + dataset ter-bundle) → precache berversi otomatis.
 * - Halaman → NetworkFirst: online selalu versi terbaru; offline dari cache. Pencocokan mengabaikan
 *   `Vary` (respons Next membawa Vary: RSC, …) dan query (`?s=` tautan bagikan) — FND-016.
 * - API & auth tidak pernah di-cache.
 */
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const PAGES_CACHE = 'gemas-pages-v1';
/** Halaman yang harus tersedia offline sejak kunjungan pertama. */
const OFFLINE_PAGES = ['/', '/proses', '/muat', '/gudang', '/konversi', '/panduan', '/data'];
const PAGE_MATCH: CacheQueryOptions = { ignoreSearch: true, ignoreVary: true };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    { matcher: ({ url }) => url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    // Hanya halaman kalkulator publik yang di-cache. Halaman per-pengguna (/masuk, /skenario, /s/…)
    // TIDAK disimpan agar data akun tidak tertinggal di HP bersama setelah logout.
    {
      matcher: ({ request, sameOrigin, url }) => sameOrigin && request.mode === 'navigate' && OFFLINE_PAGES.includes(url.pathname),
      handler: new NetworkFirst({ cacheName: PAGES_CACHE, matchOptions: PAGE_MATCH, networkTimeoutSeconds: 4 }),
    },
    { matcher: ({ request }) => request.mode === 'navigate', handler: new NetworkOnly() },
    ...defaultCache,
  ],
});

// Isi cache halaman saat instal agar offline langsung jalan tanpa harus membuka tiap halaman dulu.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) =>
      Promise.all(
        OFFLINE_PAGES.map((path) =>
          fetch(path, { credentials: 'same-origin' })
            .then((res) => (res.ok ? cache.put(path, res) : undefined))
            .catch(() => undefined), // satu halaman gagal tidak boleh menggagalkan instalasi
        ),
      ),
    ),
  );
});

// Halaman tak ada di cache saat offline → kalkulator muat (selalu ada).
serwist.setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cache = await caches.open(PAGES_CACHE);
    return (await cache.match(request, PAGE_MATCH)) ?? (await cache.match('/muat', PAGE_MATCH)) ?? Response.error();
  }
  return Response.error();
});

serwist.addEventListeners();
