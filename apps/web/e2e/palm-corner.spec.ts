import { test, expect, type Page } from '@playwright/test';

/** Pohon kelapa WebGL di pojok kiri bawah (DEC-129): sejajar ikon kelapa, bersembunyi sebagian, muncul 10 detik. */
const geom = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector('[data-testid="palm-corner"]')!.getBoundingClientRect();
    const f = document.querySelector('[data-testid="va-fab"]')?.getBoundingClientRect();
    return { left: p.left, width: p.width, ground: p.top + (p.height * 979.44) / 1014, fabBottom: f?.bottom, vh: innerHeight };
  });

for (const [name, w, h] of [['desktop', 1440, 900], ['ponsel', 390, 844]] as const) {
  test(`pohon kelapa ${name}: tanah sejajar bawah ikon kelapa, sembunyi sebagian, sorot/klik → tampil 10 detik`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => {
      localStorage.setItem('gnd-va-force', '1');
      localStorage.setItem('gnd-va:local', 'nanti');
      localStorage.setItem('gemas.tour.v1', 'done');
    });
    await page.clock.install();
    await page.goto('/gudang');
    const palm = page.getByTestId('palm-corner');
    await expect(palm).toHaveAttribute('data-open', '0');
    // WebGL terpasang (kanvas 818×1014) atau cadangan gambar statis
    await expect.poll(() => page.evaluate(() => !!window.PalmWind)).toBe(true);
    await page.waitForTimeout(800);
    const g0 = await geom(page);
    expect(Math.abs(g0.ground - g0.fabBottom!)).toBeLessThan(3);
    expect(g0.left).toBeLessThan(-g0.width * 0.5);
    expect(g0.left + g0.width).toBeGreaterThan(20);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-sembunyi.png` });
    // jam dihentikan agar hitungan 10 detik hanya maju lewat runFor
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    // disorot (desktop) / diketuk (ponsel) → muncul penuh
    // isi halaman di dekat pohon tetap bisa diklik (pohon yang mengintip tidak menangkap klik di luar strip tepi kiri)
    const hit = page.getByTestId('palm-hit');
    const hb = (await hit.boundingBox())!;
    expect(hb.x).toBeLessThanOrEqual(1);
    expect(hb.width).toBeLessThanOrEqual(64);
    const over = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-testid="palm-corner"]') !== null, [hb.width + 30, hb.y + hb.height / 2]);
    expect(over).toBe(false);
    if (name === 'desktop') await hit.hover();
    else await hit.click();
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.waitForTimeout(900);
    expect((await geom(page)).left).toBeGreaterThanOrEqual(-1);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-muncul.png` });
    await page.mouse.move(w / 2, 10);
    await page.clock.runFor(9_000);
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.clock.runFor(1_500);
    await expect(palm).toHaveAttribute('data-open', '0');
  });
}
