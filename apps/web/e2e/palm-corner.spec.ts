import { test, expect, type Page } from '@playwright/test';

/** Pohon kelapa WebGL (DEC-129 → DEC-130): pangkal batang menempel di pojok kiri bawah layar, condong saat bersembunyi, tegak 10 detik. */
const geom = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="palm-corner"]')!;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return {
      // titik poros (pangkal batang) tidak bergeser oleh rotasi: x = 0 setelah translateX, y = top + 978/1014 tinggi
      baseY: el.offsetTop + (el.offsetHeight * 978) / 1014,
      angle: Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI),
      vh: innerHeight,
    };
  });

for (const [name, w, h] of [['desktop', 1440, 900], ['ponsel', 390, 844]] as const) {
  test(`pohon kelapa ${name}: pangkal batang di pojok kiri bawah, condong saat sembunyi, tegak 10 detik saat disorot/diklik`, async ({ page }) => {
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
    await expect.poll(() => page.evaluate(() => !!window.PalmWind)).toBe(true);
    await page.waitForTimeout(1000);
    const g0 = await geom(page);
    expect(Math.abs(g0.baseY - g0.vh)).toBeLessThan(2);
    expect(g0.angle).toBe(-25);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-sembunyi.png` });
    // isi halaman di dekat pohon tetap bisa diklik (hanya strip tepi kiri bawah yang memicu)
    const hit = page.getByTestId('palm-hit');
    const hb = (await hit.boundingBox())!;
    expect(hb.x).toBeLessThanOrEqual(1);
    expect(Math.round(hb.y + hb.height)).toBe(h);
    const over = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-testid="palm-corner"]') !== null, [hb.width + 30, hb.y + hb.height / 2]);
    expect(over).toBe(false);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    if (name === 'desktop') await hit.hover();
    else await hit.click();
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.waitForTimeout(1000);
    const g1 = await geom(page);
    expect(g1.angle).toBe(0);
    expect(Math.abs(g1.baseY - g1.vh)).toBeLessThan(2);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-muncul.png` });
    await page.mouse.move(w / 2, 10);
    await page.clock.runFor(9_000);
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.clock.runFor(1_500);
    await expect(palm).toHaveAttribute('data-open', '0');
  });
}
