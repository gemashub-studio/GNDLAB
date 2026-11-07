import { test, expect } from '@playwright/test';

/** Daily Report R&D (DEC-144): anak menu GnD Lab → modal "Pencatatan harian by Drive" → pratinjau, Upload, grid kartu. */
// jam tampil mengikuti zona waktu perangkat → uji memakai WIB
test.use({ timezoneId: 'Asia/Jakarta' });
const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const URL_FILE = `https://drive.google.com/file/d/${ID}/view?usp=sharing`;

test('Daily Report R&D: URL Drive → pratinjau di atas → Upload (tanggal otomatis) → grid kartu berbayang, tetap ada setelah muat ulang', async ({ page }) => {
  test.setTimeout(180_000);
  // pratinjau Google diganti halaman tiruan (uji tanpa internet)
  await page.route('https://drive.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>pratinjau drive</p>' }));
  await page.clock.setFixedTime(new Date('2026-11-06T09:41:00+07:00'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lab?t=bahan');
  // anak menu navbar GnD Lab → Daily Report R&D
  await page.getByTestId('nav-lab-toggle').click();
  await expect(page.getByTestId('nav-lab-menu').getByRole('menuitem')).toHaveCount(5);
  await page.getByTestId('nav-lab-harian').click();
  await expect(page).toHaveURL(/t=harian/);
  await expect(page.getByTestId('lab-section-title')).toHaveText('Daily Report R&D');
  await expect(page.getByTestId('daily-grid-empty')).toBeVisible();

  await page.getByTestId('daily-open').click();
  const m = page.getByTestId('daily-modal');
  await expect(m).toContainText('Pencatatan harian by Drive');
  // pratinjau di ATAS kolom URL
  expect((await m.getByTestId('daily-preview').boundingBox())!.y).toBeLessThan((await m.getByTestId('daily-url').boundingBox())!.y);
  await expect(m.getByTestId('daily-preview')).toContainText('Pratinjau muncul di sini');
  // tidak ada kolom tanggal manual
  await expect(m.locator('input[type="date"], input[type="datetime-local"]')).toHaveCount(0);
  await m.getByTestId('daily-url').fill('https://example.com/laporan');
  await m.getByTestId('daily-upload').click();
  await expect(m.getByRole('alert')).toContainText('belum dikenali');
  await m.getByTestId('daily-url').fill(URL_FILE);
  await expect(m.getByTestId('daily-preview-frame')).toHaveAttribute('src', `https://drive.google.com/file/d/${ID}/preview`);
  await m.getByTestId('daily-upload').click();
  // setelah Upload: kolom dikosongkan, data harian tampil di bawahnya sebagai kartu (pratinjau, URL, tanggal otomatis)
  await expect(m.getByTestId('daily-url')).toHaveValue('');
  const card = m.getByTestId('daily-modal-grid-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('iframe')).toHaveAttribute('src', `https://drive.google.com/file/d/${ID}/preview`);
  await expect(card.getByTestId('daily-modal-grid-url')).toHaveText(URL_FILE);
  await expect(card.getByTestId('daily-modal-grid-date')).toContainText('6 November 2026');
  await expect(card.getByTestId('daily-modal-grid-date')).toContainText('09.41');
  expect(await card.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  // unggahan kedua → terbaru di atas
  await m.getByTestId('daily-url').fill(`https://docs.google.com/document/d/${ID}/edit`);
  await m.getByTestId('daily-url').press('Enter');
  await expect(card).toHaveCount(2);
  await expect(card.first().getByTestId('daily-modal-grid-url')).toContainText('docs.google.com/document');
  // Esc menutup modal; grid di halaman ikut terisi & bertahan setelah muat ulang
  await page.keyboard.press('Escape');
  await expect(m).toHaveCount(0);
  await expect(page.getByTestId('daily-grid-card')).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId('lab-section-title')).toHaveText('Daily Report R&D');
  await expect(page.getByTestId('daily-grid-card')).toHaveCount(2);
  await expect(page.getByTestId('daily-grid-card').last().getByTestId('daily-grid-url')).toHaveAttribute('href', URL_FILE);
});
