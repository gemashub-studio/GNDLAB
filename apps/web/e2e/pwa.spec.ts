import { expect, test } from '@playwright/test';
import { near, primary } from './helpers';

/**
 * NFR-03 offline-first — skenario nyata: aplikasi pernah dibuka sekali saat online, lalu dibuka lagi
 * di HP yang sedang TANPA sinyal. Hanya terhadap BUILD PRODUKSI (service worker mati di dev):
 *   pnpm build && node node_modules/next/dist/bin/next start -p 3001
 *   PWA_URL=http://localhost:3001 node node_modules/@playwright/test/cli.js test --grep @pwa
 * Catatan (ISS-025): pada emulasi offline Chromium, halaman yang SEDANG terbuka di-reload saat koneksi
 * putus sehingga navigasi di detik yang sama bisa batal; karena itu uji membuka tab baru setelah offline.
 */
const PWA_URL = process.env.PWA_URL;

// ISS-025: belum stabil di emulasi offline Chromium/Edge (navigasi dibatalkan oleh reload otomatis). Verifikasi di HP nyata.
test.fixme('@pwa kalkulator jalan saat dibuka tanpa sinyal setelah kunjungan pertama', async ({ context }) => {
  test.skip(!PWA_URL, 'set PWA_URL ke server produksi');
  const first = await context.newPage();
  await first.goto(`${PWA_URL}/muat`);
  near(await primary(first), 22230);
  await first.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await first.close();

  await context.setOffline(true);
  try {
    const page = await context.newPage();
    // Halaman yang belum pernah dibuka pun tersedia (di-cache saat instal).
    await page.goto(`${PWA_URL}/gudang`);
    await expect(page.getByTestId('floor-area')).toBeVisible();
    await page.goto(`${PWA_URL}/konversi`);
    await expect(page.getByTestId('convert-result')).toBeVisible();
    await page.goto(`${PWA_URL}/muat`);
    near(await primary(page), 22230);
    // Interaksi tetap menghitung (engine + dataset ter-bundle di client).
    await page.getByTestId('commodity-arang_batok_belah2').click();
    near(await primary(page), 12.62);
    await expect(page.getByText(/OFFLINE/).first()).toBeVisible();
    // Tautan bagikan dibuka saat offline → state dipulihkan dari `?s=` di client.
    const s = { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', containerId: '40HC', mode: 'PACKAGE' };
    const token = Buffer.from(JSON.stringify(s)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await page.goto(`${PWA_URL}/muat?s=${token}`);
    expect(await primary(page)).toBe(975);
  } finally {
    await context.setOffline(false);
  }
});
