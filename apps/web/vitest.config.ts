import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` melempar error di luar React Server; di test cukup modul kosong.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    // Siapkan database TEST (bukan dev): migrate deploy + seed bila kosong.
    globalSetup: ['./test/db-setup.ts'],
    testTimeout: 30_000,
    // Uji DB berbagi satu database test → jalankan berurutan.
    fileParallelism: false,
  },
});
