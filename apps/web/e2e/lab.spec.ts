import { expect, test } from '@playwright/test';

/** GEMA RnD Lab (DEC-044/045): buku catatan eksperimen lokal + library sumber. */
test.describe('GEMA RnD Lab', () => {
  test('kartu jalur → eksperimen baru dengan ID otomatis → lengkapi hasil & langkah → riwayat versi', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.getByTestId('lab-hero')).toContainText('GEMA');
    await page.getByTestId('lab-product-BR').click();
    await expect(page.getByTestId('lab-filter-product')).toHaveValue('BR');
    await page.getByTestId('lab-new').click();
    await page.getByTestId('lab-date').fill('2026-10-11');
    await expect(page.getByTestId('lab-id')).toHaveText(/^BR-2610-\d{3}$/);
    const id = (await page.getByTestId('lab-id').textContent())!;
    await page.getByTestId('lab-title').fill('E2E uji perekat');
    await page.getByTestId('lab-save').click();

    await expect(page.getByTestId('lab-detail-id')).toHaveText(id);
    await expect(page).toHaveURL(new RegExp(`e=${id}`));
    await expect(page.getByTestId('lab-detail')).toContainText('belum dicatat');

    await page.getByTestId('lab-edit-open').click();
    await page.getByTestId('lab-edit-result').fill('Briket retak saat kering');
    await page.getByTestId('lab-edit-status').selectOption('gagal');
    await page.getByTestId('lab-edit-save').click();
    await expect(page.getByTestId('lab-detail')).toContainText('Briket retak saat kering');
    await expect(page.getByTestId('lab-detail')).toContainText('1 versi lama tersimpan');

    await page.getByTestId('lab-step-input').fill('Naikkan perekat, 3 ulangan');
    await page.getByTestId('lab-step-add').click();
    await expect(page.getByTestId('lab-steps')).toContainText('Naikkan perekat');

    await page.getByTestId('lab-back').click();
    await page.getByTestId('lab-search').fill('retak');
    await expect(page.getByTestId('lab-list')).toContainText(id);
    await page.getByTestId('lab-tab-ringkasan').click();
    await expect(page.getByTestId('lab-next')).toContainText('Naikkan perekat');
  });

  test('library menampilkan status pemeriksaan & standar per jalur', async ({ page }) => {
    await page.goto('/lab?t=library');
    await page.getByTestId('lib-filter-status').selectOption('dilaporkan');
    await expect(page.getByTestId('lib-list')).toContainText('SNI 01-6235-2000');
    await expect(page.getByTestId('lib-list')).not.toContainText('SNI 01-3946-1995');
    await page.getByTestId('lab-tab-standar').click();
    await page.getByTestId('std-tab-BL').click();
    await expect(page.getByTestId('std-detail')).toContainText('ISO 3376:2020');
    await expect(page.getByTestId('std-detail')).toContainText('Belum boleh disimpulkan');
  });
});
