/// <reference lib="webworker" />
/**
 * Service worker (Serwist): precache aset build (termasuk bundle engine + dataset) dan halaman
 * kalkulator → kalkulator jalan offline (NFR-03, ARD AR-07). API & auth tidak di-cache.
 */
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const OFFLINE_PAGES = ['/', '/muat', '/gudang', '/konversi', '/panduan', '/data', '/skenario'];

const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    ...OFFLINE_PAGES.map((url) => ({ url, revision: process.env.NEXT_PUBLIC_BUILD_ID ?? '1' })),
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ url }) => url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: '/muat', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
