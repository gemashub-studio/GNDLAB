import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './test/env';

/**
 * E2E alur penuh M4 (sampling → usulan → approval → versi baru). Mengubah versi dataset aktif,
 * jadi SELALU memakai database TEST lewat dev server terpisah (port 3100, folder build sendiri).
 * Jalankan: node node_modules/@playwright/test/cli.js test -c playwright.calib.config.ts
 */
loadEnv(); // DATABASE_URL ← TEST_DATABASE_URL
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL belum ada — jalankan scripts/windows/setup-dev-db.ps1');

const PORT = 3100;
export default defineConfig({
  testDir: './e2e',
  testMatch: /calibration\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  globalSetup: './test/calib-setup.ts',
  use: { ...devices['Desktop Edge'], channel: 'msedge', baseURL: `http://localhost:${PORT}`, locale: 'id-ID', trace: 'retain-on-failure' },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      NEXT_DIST_DIR: '.next-calib',
    },
  },
});
