import { test, expect } from '@playwright/test';
import { idNum } from './helpers';

/** Gudang: form "Input barang masuk dan barang keluar" (DEC-130) — gudang → barang → asal → berat → volume & luas lantai otomatis. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gemas.tour.v1', 'done'));
});

const pick = async (page: import('@playwright/test').Page, testId: string, value: string) => {
  await page.getByTestId(testId).click();
  await page.getByTestId(`${testId}-opt-${value}`).click();
};

test('kolom sesuai urutan; gudang → pilihan barang; volume & luas lantai otomatis dari berat; tanpa data → belum bisa dihitung', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/gudang');
  await expect(page.getByTestId('wh-form-title')).toHaveText('Input barang masuk dan barang keluar');
  // Gudang Kopra → Kelapa jambul (densitas curah dataset)
  await expect(page.getByTestId('wh-gudang')).toContainText('Gudang Kopra');
  await expect(page.getByTestId('wh-item')).toContainText('Kelapa jambul');
  await page.getByTestId('wh-asal').fill('Petani Desa Uji');
  await page.getByTestId('wh-stock').fill('10000');
  const v1 = idNum((await page.getByTestId('wh-volume').textContent()) ?? '');
  expect(v1).toBeGreaterThan(0);
  await expect(page.getByTestId('wh-volume-basis')).toContainText('ρ curah');
  await expect(page.getByTestId('floor-area')).toBeVisible();
  await expect(page.getByTestId('wh-result-item')).toHaveText('Gudang Kopra · Kelapa jambul · asal Petani Desa Uji');
  // berat setengahnya → volume setengahnya
  await page.getByTestId('wh-stock').fill('5000');
  // tampilan dibulatkan 1 desimal
  await expect.poll(async () => Math.abs(idNum((await page.getByTestId('wh-volume').textContent()) ?? '') - v1 / 2)).toBeLessThanOrEqual(0.1);
  // pilihan gudang lengkap
  await page.getByTestId('wh-gudang').click();
  for (const g of ['kopra', 'arang', 'briket', 'bioleather', 'cuka']) await expect(page.getByTestId(`wh-gudang-opt-${g}`)).toBeVisible();
  await page.getByTestId('wh-gudang-opt-arang').click();
  await expect(page.getByTestId('wh-item')).toContainText('Arang batok');
  await expect(page.getByTestId('floor-area')).toBeVisible();
  // Gudang Briket: 8 barang; briket dihitung dari master box dataset rantai
  await pick(page, 'wh-gudang', 'briket');
  await page.getByTestId('wh-item').click();
  const opts = page.locator('[data-testid^="wh-item-opt-"]');
  await expect(opts).toHaveText(['Coconut Shell Charcoal', 'Coconut Charcoal Powder', 'Biochar & Char Residues', 'Sisha Briquettes', 'BBQ Briquettes', 'Hexa Briquettes', 'Pillow Briquettes', 'Custom Moldings']);
  await page.getByTestId('wh-item-opt-sisha').click();
  await page.getByTestId('wh-stock').fill('1000');
  await expect(page.getByTestId('wh-volume-basis')).toContainText('Master box 10 kg');
  await expect(page.getByTestId('warehouse-result')).toContainText('100 box');
  await expect(page.getByTestId('floor-area')).toBeVisible();
  // tanpa data densitas → tidak dikarang
  await pick(page, 'wh-item', 'coconut_charcoal_powder');
  await expect(page.getByTestId('wh-no-result')).toContainText('Belum bisa dihitung');
  await expect(page.getByTestId('wh-volume')).toHaveText('—');
  await pick(page, 'wh-gudang', 'cuka');
  await expect(page.getByTestId('wh-item')).toContainText('Cuka air kelapa');
  await expect(page.getByTestId('wh-no-result')).toBeVisible();
});
