import { expect, test, type Page } from '@playwright/test';
import { idNum } from './helpers';

async function setNuts(page: Page, rendah: number, tinggi: number) {
  await page.getByTestId('nuts-dataran_rendah').fill(String(rendah));
  await page.getByTestId('nuts-dataran_tinggi').fill(String(tinggi));
}

test.describe('Alur Proses (Fase P)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/proses');
    await expect(page.getByRole('heading', { name: /Alur/ })).toBeVisible();
  });

  test('kelapa masuk: total butir & berat dari 2 asal + simulasi container (ft)', async ({ page }) => {
    await setNuts(page, 30000, 0);
    await expect(page.getByTestId('total-nuts')).toContainText('30.000');
    await expect(page.getByTestId('incoming-kg')).toContainText('52,50 t'); // 30.000 × 1,75 kg
    // Jambul 20 ft muat ±22.229 butir → 30.000 butir butuh 2 container
    await expect(page.getByTestId('containers-needed')).toHaveText('2');
    const sim = page.getByTestId('load-sim');
    await expect(sim).toContainText('19 ft 4 in');
    await expect(sim.locator('svg circle').first()).toBeVisible();
    await setNuts(page, 5000, 2000);
    await sim.screenshot({ path: 'test-results/proses-simulasi-kelapa.png' });
  });

  test('kupas → belah → cungkil: neraca massa per 1.000 butir dataran rendah', async ({ page }) => {
    await setNuts(page, 1000, 0);
    await page.getByTestId('step-kupas').click();
    await expect(page.getByTestId('husk-kg')).toContainText('735 kg'); // 1.750 × 42%
    await page.getByTestId('step-belah').click();
    await expect(page.getByTestId('halves')).toContainText('2.000 keping');
    await page.getByTestId('step-cungkil').click();
    await expect(page.getByTestId('kernel-kg')).toContainText('490 kg'); // 28%
    await expect(page.getByTestId('shell-kg')).toContainText('210 kg'); // 12%
  });

  test('jemur: oven lebih cepat dari greenhouse, greenhouse lebih cepat dari matahari', async ({ page }) => {
    await page.getByTestId('step-jemur').click();
    const time = async () => (await page.getByTestId('dry-time').locator('span').nth(1).textContent()) ?? '';
    const hours = (t: string) => (t.includes('hari') ? idNum(t) * 24 : idNum(t));
    await page.getByTestId('method-sun').click();
    const sun = hours(await time());
    await page.getByTestId('method-greenhouse').click();
    const gh = hours(await time());
    await page.getByTestId('method-oven').click();
    const oven = hours(await time());
    expect(oven).toBeLessThan(gh);
    expect(gh).toBeLessThan(sun);
    await expect(page.getByTestId('method-compare').locator('tbody tr')).toHaveCount(3);
  });

  test('rak: kosongkan jumlah rak → hitung kebutuhan rak untuk sekali jemur', async ({ page }) => {
    await setNuts(page, 1000, 0);
    await page.getByTestId('step-jemur').click();
    await page.getByTestId('rack-area').fill('1');
    await page.getByTestId('rack-tiers').fill('5');
    await page.getByTestId('rack-density').fill('111');
    await page.getByTestId('rack-count').fill('');
    // 2.000 belahan / (111 × 1 × 5 = 555 per rak) → 4 rak
    await expect(page.getByTestId('racks-needed')).toContainText('4 rak');
  });

  test('produk jadi: kopra edible ≈ 261 kg per 1.000 butir + arang', async ({ page }) => {
    await setNuts(page, 1000, 0);
    await page.getByTestId('step-jadi').click();
    await page.getByTestId('product-edible').click();
    await expect(page.getByTestId('copra-kg')).toHaveText(/^2\d\d$/);
    await expect(page.getByTestId('charcoal-kg')).toBeVisible();
    await page.getByTestId('product-asalan').click();
    await expect(page.getByTestId('warnings')).toContainText('SELF_HEATING_RISK');
  });
});
