import { test, expect } from '@playwright/test';

/** Revisi laporan belanja (DEC-145): tombol Revisi → alasan wajib → "Revisi ke-N" di daftar & riwayat. */
test('Laporan Belanja: Revisi → alasan wajib → Revisi ke-1, lalu ke-2 dengan riwayat', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/lab?t=belanja');
  await page.getByTestId('lpj-new').click();
  await page.getByTestId('lpj-purpose').fill('Belanja revisi E2E');
  await page.getByTestId('lpj-proof-title-0').fill('Toko Kimia Jaya');
  await page.getByTestId('lpj-save').click();
  await page.getByTestId('lpj-save-only').click();
  await page.getByRole('button', { name: 'Tutup' }).click();
  const item = page.getByTestId('lpj-list').locator('li').filter({ hasText: 'Belanja revisi E2E' });
  await expect(item).toBeVisible();
  const id = ((await item.locator('[data-testid^="lpj-open-"]').getAttribute('data-testid')) ?? '').replace('lpj-open-', '');
  await expect(page.getByTestId(`lpj-rev-${id}`)).toHaveCount(0);

  // revisi pertama: alasan wajib
  await page.getByTestId(`lpj-revise-${id}`).click();
  const box = page.getByTestId('lpj-revise-box');
  await expect(box).toContainText(`Revisi ke-1 · ${id}`);
  await expect(page.getByTestId('lpj-purpose')).toHaveValue('Belanja revisi E2E'); // terisi data lama
  await page.getByTestId('lpj-proof-title-0').fill('Toko Kimia Jaya Abadi');
  await page.getByTestId('lpj-save').click();
  await page.getByTestId('lpj-save-only').click();
  await expect(page.getByTestId('lpj-form')).toContainText('Tulis alasan revisi dulu.');
  await page.getByTestId('lpj-rev-reason').fill('Nama toko diperbaiki');
  await page.getByTestId('lpj-save').click();
  await page.getByTestId('lpj-save-only').click();
  await expect(page.getByTestId('lpj-form')).toContainText('Revisi ke-1 tersimpan');
  // simpan ulang di sesi yang sama → tetap satu revisi
  await page.getByTestId('lpj-save').click();
  await page.getByTestId('lpj-save-only').click();
  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByTestId(`lpj-rev-${id}`)).toContainText('Revisi ke-1');

  // revisi kedua: riwayat revisi sebelumnya tampil
  await page.getByTestId(`lpj-revise-${id}`).click();
  await expect(page.getByTestId('lpj-revise-box')).toContainText('Revisi ke-2');
  await expect(page.getByTestId('lpj-rev-history')).toContainText('Revisi ke-1 · ');
  await expect(page.getByTestId('lpj-rev-history')).toContainText('Nama toko diperbaiki');
  await expect(page.getByTestId('lpj-proof-title-0')).toHaveValue('Toko Kimia Jaya Abadi');
  await page.getByTestId('lpj-rev-reason').fill('Total alokasi ditambah');
  await page.getByTestId('lpj-save').click();
  await page.getByTestId('lpj-save-only').click();
  await expect(page.getByTestId('lpj-form')).toContainText('Revisi ke-2 tersimpan');
  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByTestId(`lpj-rev-${id}`)).toContainText('Revisi ke-2');
  // "Buka" biasa tidak menambah revisi
  await page.getByTestId(`lpj-open-${id}`).click();
  await expect(page.getByTestId('lpj-revise-box')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByTestId(`lpj-rev-${id}`)).toContainText('Revisi ke-2');
});
