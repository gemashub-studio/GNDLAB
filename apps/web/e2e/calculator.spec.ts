import { expect, test } from '@playwright/test';
import { idNum, near, openState, primary } from './helpers';

/** Angka harapan = kolom Acceptance Criteria PRD §5 (golden cases), toleransi ±0,5%. */

test('US-01 jambul 20GP default ≈ 22.230 butir, VOLUME, benchmark 22.500', async ({ page }) => {
  await page.goto('/muat');
  near(await primary(page), 22230);
  await expect(page.getByTestId('binding')).toHaveAttribute('data-binding', 'VOLUME');
  await expect(page.getByTestId('benchmark')).toContainText('22.500 butir');
});

test('US-02 arang lump 20GP ≈ 12,6 t; batok mentah belah ≈ 6,5 t', async ({ page }) => {
  await openState(page, { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '20GP', mode: 'BULK' });
  near(await primary(page), 12.62);
  await openState(page, { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'raw_halves', containerId: '20GP', mode: 'BULK' });
  near(await primary(page), 6.47);
  // 40HC arang lump dibatasi BERAT (FR-04)
  await openState(page, { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '40HC', mode: 'BULK' });
  await expect(page.getByTestId('binding')).toHaveAttribute('data-binding', 'WEIGHT');
  await expect(page.getByTestId('warnings')).toContainText('WEIGHT_LIMITED');
});

test('US-03 gudang 50 t, ρ 500, h 2,5 m, util 0,65 → 61,54 m²', async ({ page }) => {
  await openState(page, {
    kind: 'WAREHOUSE',
    commodityId: 'kopra_asalan',
    formCode: 'loose_bulk',
    stock: { massKg: 50000 },
    stackHeightM: 2.5,
    floorUtil: 0.65,
  });
  await expect(page.getByTestId('floor-area')).toHaveText('61,54');
});

test('US-04 koreksi kadar air 1.000 kg @15% → 6% = 904,26 kg', async ({ page }) => {
  await page.goto('/konversi');
  await page.getByTestId('mc-mass').fill('1000');
  await page.getByTestId('mc-w1').fill('15');
  await page.getByTestId('mc-w2').fill('6');
  await expect(page.getByTestId('mc-result')).toContainText('904,26 kg');
});

test('US-05 tumpukan bersarang H 100, cup 4,4, pitch 1,2 → 80 keping/kolom', async ({ page }) => {
  await page.goto('/konversi');
  await page.getByTestId('nest-height').fill('100');
  await page.getByTestId('nest-depth').fill('4,4');
  await page.getByTestId('nest-pitch').fill('1,2');
  await expect(page.getByTestId('nest-result')).toContainText('80 keping / kolom');
});

test('US-06 karung jambul 49×34×21 cm di 20GP → 924 karung', async ({ page }) => {
  await openState(page, { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PACKAGE' });
  expect(await primary(page)).toBe(924);
});

test('US-07 kartu hasil: typ + pita min–maks + badge keyakinan berhuruf', async ({ page }) => {
  await page.goto('/muat');
  const band = page.getByTestId('range-band');
  await expect(band).toContainText('MIN');
  await expect(band).toContainText('MAX');
  const [min, max] = (await band.locator('span').allTextContents()).map((t) => idNum(t));
  const typ = await primary(page);
  expect(min).toBeLessThanOrEqual(typ);
  expect(typ).toBeLessThanOrEqual(max!);
  // Huruf keyakinan tertulis, bukan warna saja (NFR-08)
  await expect(page.getByTestId('container-result').getByLabel(/Keyakinan data [ABC]/).first()).toBeVisible();
});

test('US-09 override parameter → hasil berubah + tanda CUSTOM; di luar rentang ditolak', async ({ page }) => {
  await page.goto('/muat');
  const before = await primary(page);
  await page.getByText('+ Ubah angka (hasil ukur sendiri)').click();
  await page.getByTestId('ovr-rho').fill('400');
  await expect(page.getByTestId('custom-tag')).toBeVisible();
  const after = await primary(page);
  expect(after).toBeGreaterThan(before);
  await page.getByTestId('ovr-rho').fill('5000');
  await expect(page.getByRole('alert').first()).toContainText('rentang wajar');
});

test('US-10 simpan di perangkat, buka dari daftar, tautan bagikan, ekspor CSV', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openState(page, { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', containerId: '40HC', mode: 'PACKAGE' });
  const value = await primary(page);
  await page.getByTestId('save').click();
  await expect(page.getByTestId('action-msg')).toContainText('tersimpan di perangkat');

  await page.getByTestId('share').click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain('/muat?s=');

  const download = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);

  await page.goto('/skenario');
  const item = page.getByTestId('local-scenarios').getByText('Kopra edible @ 40HC').first();
  await expect(item).toBeVisible();

  await page.goto(url);
  expect(await primary(page)).toBe(value);
});

test('US-11 peringatan keselamatan: kopra asalan basah, arang, kopra campur', async ({ page }) => {
  await openState(page, { kind: 'CONTAINER', commodityId: 'kopra_asalan', formCode: 'bagged_jute', containerId: '20GP', mode: 'BULK' });
  await expect(page.getByTestId('warnings')).toContainText('SELF_HEATING_RISK');
  await openState(page, { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '20GP', mode: 'BULK' });
  await expect(page.getByTestId('warnings')).toContainText('FLAMMABLE');
  await openState(page, {
    kind: 'WAREHOUSE',
    commodityId: 'kopra_edible',
    formCode: 'bagged',
    stock: { massKg: 1000 },
    stackHeightM: 1.8,
    coStored: ['kopra_asalan'],
  });
  await expect(page.getByTestId('warnings')).toContainText('ODOR_CONTAMINATION');
});

test('wizard panduan: 4 langkah sampai hasil', async ({ page }) => {
  await page.goto('/muat?wizard=1');
  await expect(page.getByTestId('wizard')).toBeVisible();
  await page.getByTestId('commodity-kopra_edible').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('container-40HC').click();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('container-result')).toContainText('KOPRA EDIBLE @ 40 FT HIGH CUBE');
});

test('API: server menghitung ulang & menolak input buruk (ARD §9)', async ({ request }) => {
  const ok = await request.post('/api/v1/calculate/container', {
    data: { commodityId: 'kelapa_jambul', form: 'bagged', containerId: '20GP', mode: 'PIECE' },
  });
  expect(ok.status()).toBe(200);
  near((await ok.json()).result.typ.pieces, 22230);
  const bad = await request.post('/api/v1/calculate/container', {
    data: { commodityId: 'kelapa_jambul', form: 'bagged', containerId: '20GP', mode: 'PIECE', overrides: { bulk_density: 5000 } },
  });
  expect(bad.status()).toBe(422);
  expect((await request.post('/api/v1/scenarios', { data: {} })).status()).toBe(401);
  expect((await request.get('/api/v1/commodities?version=9.9.9')).status()).toBe(404);
});

test('@mobile tampilan HP 360 px: menu bawah & target sentuh ≥ 44 px', async ({ page }) => {
  await page.goto('/muat');
  const nav = page.getByRole('navigation', { name: 'Menu bawah' });
  await expect(nav).toBeVisible();
  for (const link of await nav.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  // Tidak ada scroll horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  near(await primary(page), 22230);
});
