import { test, expect, type Page } from '@playwright/test';

/** Dok maskot kelapa asisten suara (DEC-133): gambar baru, sebagian bersembunyi di kanan, seret naik-turun, klik → keluar & mulai. */
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

const box = (page: Page) => page.getByTestId('va-fab').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, bottom: innerHeight - r.bottom, vw: innerWidth }; });

for (const [name, w, h] of [['desktop', 1440, 900], ['ponsel', 390, 844]] as const) {
  test(`dok maskot ${name}: sebagian di luar kanan, seret naik & diingat, klik → meluncur keluar lalu asisten mulai`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => {
      localStorage.setItem('gnd-va-force', '1');
      localStorage.setItem('gnd-va:local', 'nanti');
      localStorage.setItem('gemas.tour.v1', 'done');
    });
    await page.route('**/api/voice-transcribe', (r) => r.fulfill({ json: { ok: true, text: '' } }));
    await page.goto('/konversi');
    const fab = page.getByTestId('va-fab');
    await expect(fab).toBeVisible();
    // gambar maskot baru
    await expect(fab.locator('img')).toHaveAttribute('src', '/assets/mascot/kelapa-kora.webp');
    await page.waitForTimeout(800);
    const b0 = await box(page);
    expect(b0.right).toBeGreaterThan(b0.vw + b0.width * 0.3);
    expect(b0.left).toBeLessThan(b0.vw);
    // seret ke atas 200 px → posisi berubah & diingat setelah muat ulang
    await page.mouse.move(b0.left + 20, h - b0.bottom - 40);
    await page.mouse.down();
    await page.mouse.move(b0.left + 20, h - b0.bottom - 140, { steps: 5 });
    await page.mouse.move(b0.left + 20, h - b0.bottom - 240, { steps: 5 });
    await page.mouse.up();
    const b1 = await box(page);
    expect(b1.bottom).toBeGreaterThan(b0.bottom + 150);
    await expect(fab).toHaveAttribute('data-out', '0');
    await page.reload();
    await page.waitForTimeout(800);
    expect(Math.abs((await box(page)).bottom - b1.bottom)).toBeLessThan(4);
    // klik → meluncur keluar penuh, lalu panel asisten muncul
    await fab.click();
    await expect(fab).toHaveAttribute('data-out', '1');
    // meluncur keluar penuh (transisi 0,55 dtk) sebelum asisten mulai (0,7 dtk)
    await page.waitForTimeout(600);
    const b2 = await box(page);
    expect(b2.right).toBeLessThanOrEqual(b2.vw + 1);
    await expect(page.getByTestId('va-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('va-panel').locator('img')).toHaveAttribute('src', '/assets/mascot/kelapa-kora.webp');
    // hentikan → kembali ke dok, bersembunyi sebagian
    await page.getByTestId('va-stop').click();
    await expect(fab).toHaveAttribute('data-out', '0');
  });
}
