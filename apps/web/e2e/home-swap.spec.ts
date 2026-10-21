import { test, expect } from '@playwright/test';
/** Ringkasan: dua tumpukan kartu bergeser (DEC-120). */
test('Ringkasan: Mulai cepat (kanan) & komoditas (kiri, dicerminkan) memakai CardSwap; kartu depan membuka halaman', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('gnd-va:local', 'nanti'));
  await page.goto('/');
  const kanan = page.getByTestId('home-swap-mulai');
  const kiri = page.getByTestId('home-swap-komoditas');
  await expect(kanan).toBeVisible();
  await expect(kiri).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId('home-swaps').scrollIntoViewIfNeeded();
  // posisi kartu belakang: kanan bergeser ke kanan, kiri (cermin) bergeser ke kiri
  const dx = await page.evaluate(() => ['home-swap-mulai', 'home-swap-komoditas'].map((id) => {
    const slots = [...document.querySelectorAll(`[data-testid="${id}"] .card-swap-slot`)] as HTMLElement[];
    const front = slots.find((s) => s.hasAttribute('data-front'))!.getBoundingClientRect();
    const back = slots.filter((s) => !s.hasAttribute('data-front')).map((s) => s.getBoundingClientRect().x);
    return Math.max(...back.map((x) => x - front.x)) > 0 ? 'kanan' : 'kiri';
  }));
  expect(dx).toEqual(['kanan', 'kiri']);
  // kartu depan Mulai cepat → buka halaman
  const front = kanan.locator('.card-swap-slot[data-front] a');
  const href = await front.getAttribute('href');
  await front.click();
  await expect(page).toHaveURL(new RegExp(href!.replace('?', '\?')), { timeout: 60_000 });
});
