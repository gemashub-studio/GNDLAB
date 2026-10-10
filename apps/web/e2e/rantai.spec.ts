import { expect, test } from '@playwright/test';

/** Fase G (ADR-010): rantai produksi. Angka harapan dihitung tangan (lihat test engine chain.test.ts). */
test.describe('Rantai produksi', () => {
  test('angkut: CDD box 357 karung = 8.925 butir (berat); 22.500 butir → truk 1 rit', async ({ page }) => {
    await page.goto('/rantai?t=angkut');
    await expect(page.getByTestId('veh-cdd_box-pcs')).toHaveText('8.925');
    await expect(page.getByTestId('angkut-best')).toContainText('TRONTON');
    await page.getByTestId('veh-20GP').click();
    await expect(page.getByTestId('angkut-sim')).toContainText('20ft');
    await page.getByTestId('angkut-mode-bulk').click();
    await expect(page.getByTestId('angkut-table')).toBeVisible();
  });

  test('terima: 650 mdpl → DT, kode lot otomatis, tersimpan di register', async ({ page }) => {
    await page.goto('/rantai?t=terima');
    await page.getByTestId('lot-date').fill('2026-10-10');
    await page.getByTestId('lot-region').fill('Kebun Uji Gunung');
    await page.getByTestId('lot-alt').fill('650');
    await expect(page.getByTestId('lot-origin')).toContainText('DATARAN TINGGI');
    await expect(page.getByTestId('lot-code')).toHaveText(/^DT-261010-\d{3}$/);
    const code = (await page.getByTestId('lot-code').textContent())!;
    await page.getByTestId('lot-nuts').fill('5000');
    await page.getByTestId('lot-save').click();
    await expect(page.getByTestId('lot-msg')).toContainText(code);
    await expect(page.getByTestId('lot-list')).toContainText(code);
    await expect(page.getByTestId('zone-DT')).toContainText('m²');
    // 500 mdpl tepat → DR
    await page.getByTestId('lot-alt').fill('500');
    await expect(page.getByTestId('lot-origin')).toContainText('DATARAN RENDAH');
  });

  test('belah: 1.000 butir → air ±128 L, pendingin per 2 jam', async ({ page }) => {
    await page.goto('/rantai?t=belah');
    await expect(page.getByTestId('belah-water-value')).toHaveText('128');
    await expect(page.getByTestId('belah-chill')).toContainText('26 L');
    await page.getByTestId('belah-preset-hibrida').click();
    await expect(page.getByTestId('belah-routes')).toContainText('400');
  });

  test('greenhouse: contoh KORA 3 rak × 6 tingkat → 1.638 butir; lebar 6 m → 5 rak; tray 0,65 m → 1.215', async ({ page }) => {
    await page.goto('/rantai?t=kering');
    await expect(page.getByTestId('gh-cap-value')).toHaveText('1.638');
    await expect(page.getByTestId('gh-racks')).toContainText('3');
    await expect(page.getByTestId('gh-tiers')).toContainText('6');
    await expect(page.getByTestId('gh-fans')).toContainText('2–4 unit');
    await expect(page.getByTestId('gh-points')).toContainText('1');
    await expect(page.getByTestId('gh-tilt')).toContainText('15–30°');
    await page.getByTestId('gh-trayL').fill('0,65');
    await expect(page.getByTestId('gh-cap-value')).toHaveText('1.215');
    await expect(page.getByTestId('gh-pertray')).toContainText('4,5');
    await page.getByTestId('gh-W').fill('6');
    await expect(page.getByTestId('gh-racks')).toContainText('5');
    await expect(page.getByTestId('gh-aisle')).toContainText('0,69');
    await expect(page.getByText('Angka kipas/belerang hasil skala')).toBeVisible();
  });

  test('arang kolam: 2×2×1,5 m → 1.053 kg/angkatan; tepung → waktu giling', async ({ page }) => {
    await page.goto('/rantai?t=arang');
    await page.getByTestId('arang-origin-DT').click();
    await page.getByTestId('arang-kiln-kolam').click();
    await expect(page.getByText('isi ukuran kolam')).toBeVisible();
    await page.getByTestId('arang-pit-L').fill('2');
    await page.getByTestId('arang-pit-W').fill('2');
    await page.getByTestId('arang-pit-D').fill('1,5');
    await page.getByTestId('arang-pit-burn').fill('24');
    await expect(page.getByTestId('arang-batch')).toContainText('1.053 kg');
    await expect(page.getByTestId('arang-yield-value')).toHaveText('300');
    await page.getByTestId('arang-pass-1').fill('10');
    await page.getByTestId('arang-pass-2').fill('5');
    await expect(page.getByTestId('arang-lumps')).toContainText('257 kg'); // 300 × 0,9 × 0,95 = 256,5
    await page.getByTestId('arang-out-tepung').click();
    await expect(page.getByTestId('arang-powder')).toContainText('300 kg');
    await expect(page.getByTestId('arang-millh')).toContainText('jam');
  });

  test('briket: abu DT 2% / DR 3,5%, DT 20% → GAGAL; rasio layak mulai 33%', async ({ page }) => {
    await page.goto('/rantai?t=briket');
    await page.getByTestId('briket-dt-ash_max_pct').fill('2');
    await page.getByTestId('briket-dr-ash_max_pct').fill('3,5');
    await page.getByTestId('briket-share').fill('20');
    await expect(page.getByTestId('briket-status-ash_max_pct')).toHaveText('GAGAL');
    await expect(page.getByTestId('briket-feasible')).toContainText('33–100%');
    await page.getByTestId('briket-share').fill('50');
    await expect(page.getByTestId('briket-status-ash_max_pct')).toHaveText('LOLOS');
    await expect(page.getByTestId('briket-dt-shell')).toContainText('kg');
  });

  test('bioleather + cocofiber: dosis 5 g/L → bahan & NaOH', async ({ page }) => {
    await page.goto('/rantai?t=turunan');
    await page.getByTestId('bl-mat-cocofiber').click();
    await page.getByTestId('bl-dose').fill('5');
    await expect(page.getByTestId('bl-wet')).toContainText('50,0 g');
    await expect(page.getByTestId('bl-naoh')).toContainText('37,5 g'); // 0,05 kg × 15 L/kg × 50 g/L
    await expect(page.getByTestId('bl-composite')).toBeVisible();
  });
});

test.describe('Rantai produksi — HP 360 px', () => {
  for (const t of ['angkut', 'kering', 'arang', 'briket']) {
    test(`@mobile /rantai?t=${t} tanpa geser horizontal`, async ({ page }) => {
      await page.goto(`/rantai?t=${t}`);
      await expect(page.locator('main h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
