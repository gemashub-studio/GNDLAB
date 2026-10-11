import { defineConfig, devices } from '@playwright/test';

/**
 * E2E US-01..US-07, US-09..US-11 (PRD §5). Memakai Microsoft Edge yang sudah terpasang
 * (`channel: 'msedge'`) agar tidak perlu mengunduh browser Playwright.
 */
export default defineConfig({
  testDir: './e2e',
  // Alur kalibrasi mengubah versi dataset aktif → hanya lewat playwright.calib.config.ts (DB test).
  testIgnore: /calibration\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'msedge',
    locale: 'id-ID',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      // Kamera & mikrofon palsu bawaan Chromium untuk menguji Kamera/Ambil foto/Rekam video (DEC-055).
      use: { ...devices['Desktop Edge'], channel: 'msedge', launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } },
      grepInvert: /@mobile/,
    },
    { name: 'hp-360', use: { channel: 'msedge', viewport: { width: 360, height: 780 }, isMobile: false, hasTouch: true }, grep: /@mobile/ },
  ],
  // Uji PWA memakai server produksi terpisah (PWA_URL) → jangan nyalakan dev server.
  ...(!process.env.PWA_URL && {
    webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
  }),
});
