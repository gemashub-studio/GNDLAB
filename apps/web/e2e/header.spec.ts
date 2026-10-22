import { test, expect } from '@playwright/test';

/** Bilah atas (DEC-132): tanpa teks "/ <halaman>" di samping judul; transparan di puncak halaman, hitam setelah digulir. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gemas.tour.v1', 'done'));
});

for (const path of ['/muat', '/gudang', '/', '/lab']) {
  test(`bilah atas ${path}: tanpa label halaman, transparan di atas, hitam saat digulir`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const bar = page.getByTestId('topbar');
    await expect(bar).toBeVisible();
    // tidak ada teks "/ Muat Container" dsb. di samping logo
    await expect(bar.locator('span', { hasText: /^\/ / })).toHaveCount(0);
    await expect(bar).toHaveAttribute('data-scrolled', '0');
    await expect(bar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}${path.replace(/\W/g, '_') || '_home'}-atas.png`, clip: { x: 0, y: 0, width: 1440, height: 220 } });
    await page.mouse.wheel(0, 600);
    await expect(bar).toHaveAttribute('data-scrolled', '1');
    await expect.poll(() => bar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(14, 26, 31)');
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}${path.replace(/\W/g, '_') || '_home'}-gulir.png`, clip: { x: 0, y: 0, width: 1440, height: 220 } });
    // kembali ke puncak → transparan lagi
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).toHaveAttribute('data-scrolled', '0');
  });
}
