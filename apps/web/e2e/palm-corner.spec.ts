import { test, expect, type Page } from '@playwright/test';

/**
 * Pohon kelapa WebGL (DEC-129 → DEC-131): selalu tegak, bawah rata tepi bawah layar, bayangan tanah di pojok;
 * bersembunyi di kiri → muncul 20 detik (pangkal batang di pojok kiri bawah) → bisa ditutup lagi dengan klik / sorot ulang.
 */
const geom = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="palm-corner"]')!;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return {
      baseY: el.offsetTop + (el.offsetHeight * 978) / 1014,
      // tepi kiri pangkal batang di layar (x gambar 231/818)
      baseX: m.m41 + (el.offsetWidth * 231) / 818,
      angle: Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI),
      vh: innerHeight,
    };
  });

const init = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem('gnd-va-force', '1');
    localStorage.setItem('gnd-va:local', 'nanti');
    localStorage.setItem('gemas.tour.v1', 'done');
  });

for (const [name, w, h] of [['desktop', 1440, 900], ['ponsel', 390, 844]] as const) {
  test(`pohon kelapa ${name}: tegak, bayangan tanah, muncul 20 detik dengan pangkal di pojok, tutup lagi dengan klik/sorot`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: w, height: h });
    await init(page);
    await page.clock.install();
    await page.goto('/gudang');
    const palm = page.getByTestId('palm-corner');
    await expect(palm).toHaveAttribute('data-open', '0');
    await expect.poll(() => page.evaluate(() => !!window.PalmWind)).toBe(true);
    await page.waitForTimeout(1000);
    // bawaan: tegak (tidak miring), bawah rata tepi bawah layar, pangkal tersembunyi di kiri
    const g0 = await geom(page);
    expect(g0.angle).toBe(0);
    expect(Math.abs(g0.baseY - g0.vh)).toBeLessThan(2);
    expect(g0.baseX).toBeLessThan(0);
    // bayangan tanah hitam menempel di pojok kiri bawah, tak terlihat saat pohon bersembunyi
    const ground = page.getByTestId('palm-ground');
    const gb = (await ground.boundingBox())!;
    expect(gb.x).toBeLessThanOrEqual(1);
    expect(Math.round(gb.y + gb.height)).toBe(h);
    await expect(ground).toHaveCSS('opacity', '0');
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-sembunyi.png` });
    // isi halaman di dekat pohon tetap bisa diklik
    const hit = page.getByTestId('palm-hit');
    const hb = (await hit.boundingBox())!;
    const over = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-testid="palm-corner"]') !== null, [hb.width + 30, hb.y + hb.height / 2]);
    expect(over).toBe(false);

    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    if (name === 'desktop') await hit.hover();
    else await hit.click();
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.waitForTimeout(1000);
    const g1 = await geom(page);
    expect(g1.angle).toBe(0);
    expect(Math.abs(g1.baseX)).toBeLessThan(2);
    expect(Math.abs(g1.baseY - g1.vh)).toBeLessThan(2);
    await expect(ground).toHaveCSS('opacity', '1');
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-muncul.png` });
    // tampil 20 detik
    await page.mouse.move(w - 5, 300);
    await page.clock.runFor(19_000);
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.clock.runFor(1_500);
    await expect(palm).toHaveAttribute('data-open', '0');

    // buka lagi → klik lagi menutup
    if (name === 'desktop') await hit.hover();
    else await hit.click();
    await expect(palm).toHaveAttribute('data-open', '1');
    await page.clock.runFor(800);
    // kursor masuk ke pohon (belum keluar sejak dibuka) lalu klik → menutup, tidak dibuka ulang
    const pb = (await palm.boundingBox())!;
    await page.mouse.click(pb.x + pb.width * 0.6, pb.y + pb.height * 0.3);
    await expect(palm).toHaveAttribute('data-open', '0');
    await page.clock.runFor(800);
    if (name === 'desktop') {
      // sorot lagi (setelah kursor keluar dari pohon) → menutup
      await page.mouse.move(w - 5, 300);
      await hit.hover();
      await expect(palm).toHaveAttribute('data-open', '1');
      await page.clock.runFor(800);
      await page.mouse.move(w - 5, 300);
      await expect(palm).toHaveAttribute('data-open', '1');
      const p2 = (await palm.boundingBox())!;
      await page.mouse.move(p2.x + p2.width * 0.6, p2.y + p2.height * 0.3);
      await expect(palm).toHaveAttribute('data-open', '0');
    }
  });
}

test('pohon kelapa tampil di semua halaman', async ({ page }) => {
  test.setTimeout(240_000);
  await init(page);
  for (const path of ['/', '/muat', '/konversi', '/data', '/lab']) {
    await page.goto(path);
    await expect(page.getByTestId('palm-corner')).toHaveCount(1);
    await expect(page.getByTestId('palm-ground')).toHaveCount(1);
  }
});
