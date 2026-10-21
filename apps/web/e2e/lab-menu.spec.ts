import { test, expect, type Page } from '@playwright/test';

/** Menu GnD Lab = roda pilihan OptionWheel + menu & halaman Gabungkan Data (DEC-126). */
const opacity = (page: Page, id: string) => page.getByTestId(id).evaluate((el) => Number(getComputedStyle(el).opacity));

test.describe('Menu GnD Lab — roda pilihan (DEC-126)', () => {
  test('4 menu dengan setelan bawaan, tanpa kartu; panah / klik berpindah; tautan lama → Pencatatan Data', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/lab?t=eksperimen');
    const wheel = page.getByTestId('lab-wheel');
    await expect(wheel.getByRole('option')).toHaveText(['Pencatatan Data', 'Riset Produk', 'Laporan Belanja', 'Gabungkan Data']);
    await expect(page.getByTestId('lab-tab-bahan')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/t=bahan/);
    for (const gone of ['ringkasan', 'eksperimen', 'library', 'standar']) await expect(page.getByTestId(`lab-tab-${gone}`)).toHaveCount(0);
    // tanpa kartu: latar transparan; setelan bawaan → menu tetangga memudar 25% per langkah, warna aktif hijau
    expect(await page.getByTestId('lab-menu').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect.poll(() => opacity(page, 'lab-tab-bahan')).toBeGreaterThan(0.95);
    await expect.poll(() => opacity(page, 'lab-tab-protokol')).toBeCloseTo(0.75, 1);
    expect(await page.getByTestId('lab-wheel').evaluate((el) => getComputedStyle(el).getPropertyValue('--ow-active-color').trim())).toBe('#10b97f');
    // klik menu → Riset Produk
    await page.getByTestId('lab-tab-protokol').click();
    await expect(page).toHaveURL(/t=protokol/);
    await expect(page.getByTestId('lab-tab-protokol')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => opacity(page, 'lab-tab-protokol')).toBeGreaterThan(0.95);
    // tombol panah di roda → Laporan Belanja
    await wheel.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page).toHaveURL(/t=belanja/);
    // klik (mis. dari asisten suara) → Gabungkan Data
    await page.getByTestId('lab-tab-gabung').dispatchEvent('click');
    await expect(page).toHaveURL(/t=gabung/);
    await expect(page.getByTestId('gabung-page')).toBeVisible();
  });

  test('gulir di atas teks menu → ganti menu; gulir di luar menu / di ujung daftar → halaman yang bergulir; jendela roda rapat (DEC-127)', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lab?t=protokol');
    const nav = page.getByTestId('lab-menu');
    await nav.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    // rapat: jendela roda tidak lebih tinggi dari menu yang tampak (+ sebaran blur); ditunggu sampai label terukur
    const gaps = () =>
      page.evaluate(() => {
        const n = document.querySelector('[data-testid="lab-menu"]')!.getBoundingClientRect();
        const it = [...document.querySelectorAll('[data-testid="lab-wheel"] .option-wheel__item')].map((e) => e.getBoundingClientRect());
        return [Math.round(Math.min(...it.map((r) => r.top)) - n.top), Math.round(n.bottom - Math.max(...it.map((r) => r.bottom)))];
      });
    await expect.poll(async () => { const [t = 99, b = 99] = await gaps(); return t >= -1 && t < 24 && b >= -1 && b < 24; }, { timeout: 15_000 }).toBe(true);
    // di luar menu (sebelah kanan) → halaman bergulir, menu tetap
    let box = (await nav.boundingBox())!;
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(box.x + box.width + 150, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0);
    await expect(page.getByTestId('lab-tab-protokol')).toHaveAttribute('aria-selected', 'true');
    // di atas teks menu → menu berganti
    box = (await nav.boundingBox())!;
    await page.mouse.move(box.x + 160, box.y + box.height / 2);
    await page.mouse.wheel(0, 120);
    await expect(page).toHaveURL(/t=belanja/);
    // di ujung daftar (menu terakhir) gulir ke bawah → halaman bergulir
    await page.getByTestId('lab-tab-gabung').dispatchEvent('click');
    await expect(page).toHaveURL(/t=gabung/);
    await page.waitForTimeout(600);
    box = (await nav.boundingBox())!;
    const y1 = await page.evaluate(() => scrollY);
    await page.mouse.move(box.x + 160, box.y + box.height - 30);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y1);
    await expect(page).toHaveURL(/t=gabung/);
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
