import { test, expect } from '@playwright/test';

/** Menu GnD Lab = anak menu "GnD Lab" di navbar & menu ☰ (DEC-143; dulu roda OptionWheel di halaman, DEC-126) + Gabungkan Data. */
const MENU = ['Pencatatan Data', 'Riset Produk', 'Laporan Belanja', 'Gabungkan Data', 'Daily Report R&D'];

test.describe('Menu GnD Lab — anak menu navbar (DEC-143)', () => {
  test('desktop: klik GnD Lab → 5 anak menu; pilih → menu halaman berganti tanpa muat ulang; tautan lama → Pencatatan Data', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lab?t=eksperimen');
    await expect(page).toHaveURL(/t=bahan/);
    await expect(page.getByTestId('lab-section-title')).toHaveText('Pencatatan Data');
    // roda menu di halaman sudah tidak ada
    await expect(page.getByTestId('lab-menu')).toHaveCount(0);
    await expect(page.locator('[data-testid^="lab-tab-"]')).toHaveCount(0);
    const toggle = page.getByTestId('nav-lab-toggle');
    await expect(page.getByTestId('nav-lab-menu')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByTestId('nav-lab-menu');
    await expect(menu.getByRole('menuitem')).toHaveCount(MENU.length);
    for (const [i, label] of MENU.entries()) await expect(menu.getByRole('menuitem').nth(i)).toContainText(label);
    await expect(page.getByTestId('nav-lab-bahan')).toHaveAttribute('aria-current', 'page');
    // tanpa muat ulang halaman: penanda di window tetap ada
    await page.evaluate(() => ((window as unknown as { __stay: number }).__stay = 1));
    await page.getByTestId('nav-lab-protokol').click();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/\/lab\?t=protokol/);
    await expect(page.getByTestId('lab-section-title')).toHaveText('Riset Produk');
    await expect(page.getByTestId('proto-new')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __stay?: number }).__stay)).toBe(1);
    await toggle.click();
    await expect(page.getByTestId('nav-lab-protokol')).toHaveAttribute('aria-current', 'page');
    // Esc / klik di luar menutup anak menu
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('nav-lab-menu')).toHaveCount(0);
    await toggle.click();
    await page.mouse.click(40, 500);
    await expect(page.getByTestId('nav-lab-menu')).toHaveCount(0);
    // dari halaman lain → membuka /lab dengan menu terpilih
    await page.goto('/gudang');
    await page.getByTestId('nav-lab-toggle').click();
    await page.getByTestId('nav-lab-gabung').click();
    await expect(page).toHaveURL(/\/lab\?t=gabung/, { timeout: 120_000 });
    await expect(page.getByTestId('gabung-page')).toBeVisible({ timeout: 60_000 });
  });

  test('ponsel: menu ☰ → GnD Lab membuka anak menu → pilih Laporan Belanja', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/lab?t=bahan');
    await expect(page.getByTestId('lab-section-title')).toHaveText('Pencatatan Data');
    await page.getByTestId('menu-open').click();
    const drawer = page.getByTestId('menu-drawer');
    await expect(drawer).toBeInViewport();
    // di halaman GnD Lab anak menu langsung terbuka; klik GnD Lab menutup/membuka
    const lab = drawer.getByTestId('nav-lab');
    await expect(lab).toHaveAttribute('aria-expanded', 'true');
    await lab.click();
    await expect(drawer.getByTestId('navm-lab-menu')).toHaveCount(0);
    await lab.click();
    await expect(drawer.getByTestId('navm-lab-menu').getByRole('button')).toHaveText(MENU);
    await expect(drawer.getByTestId('navm-lab-bahan')).toHaveAttribute('aria-current', 'page');
    await drawer.getByTestId('navm-lab-belanja').click();
    await expect(drawer).not.toBeInViewport();
    await expect(page).toHaveURL(/t=belanja/);
    await expect(page.getByTestId('lab-section-title')).toHaveText('Laporan Belanja');
  });

  test('Gabungkan Data: pilih pencatatan → Konfirmasi → "Tunggu ya data sedang di gabungkan" → unduh PPTX, Word, PDF, TXT', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/');
    // satu catatan pencatatan langsung di IndexedDB perangkat (Supabase tidak aktif di uji)
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('gemas-catat', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('records', { keyPath: 'id' });
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const tx = req.result.transaction('records', 'readwrite');
            tx.objectStore('records').put({
              id: 'PD-261021-99',
              item: 'Kelapa tua',
              count: 2,
              createdAt: '2026-10-21T08:00:00.000Z',
              finishedAt: '2026-10-21T10:00:00.000Z',
              rows: [
                { no: 1, beratAwal: '1000', volAir: '300', beratAir: '300', tebalAwal: '10', beratAkhir: '600', tebalAkhir: '8' },
                { no: 2, beratAwal: '1100', volAir: '300', beratAir: '310', tebalAwal: '11', beratAkhir: '650', tebalAkhir: '9' },
              ],
            });
            tx.oncomplete = () => resolve();
          };
        }),
    );
    await page.goto('/lab?t=gabung');
    await page.getByTestId('gabung-open').click();
    const d = page.getByTestId('gabung-dialog');
    await expect(d.getByTestId('gabung-confirm')).toBeDisabled();
    await d.getByTestId('gabung-catat').click();
    await d.getByTestId('gabung-catat-opt-PD-261021-99').click();
    await expect(d.getByTestId('gabung-riset')).toBeVisible();
    await expect(d.getByTestId('gabung-belanja')).toBeVisible();
    await d.getByTestId('gabung-confirm').click();
    await expect(page.getByTestId('gabung-loading')).toContainText('Tunggu ya data sedang di gabungkan');
    await expect(page.getByTestId('gabung-done')).toBeVisible({ timeout: 120_000 });
    for (const [k, ext] of [['pptx', 'pptx'], ['docx', 'docx'], ['pdf', 'pdf'], ['txt', 'txt']] as const) {
      const dl = page.waitForEvent('download');
      await page.getByTestId(`gabung-${k}`).click();
      const f = await dl;
      expect(f.suggestedFilename()).toBe(`PD-261021-99-gabungan-data.${ext}`);
    }
  });
});
