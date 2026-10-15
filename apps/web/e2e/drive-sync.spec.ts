import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Sinkron Google Drive (DEC-065) diuji dengan Google PALSU: login GIS & Drive API dicegat di jaringan,
 * file Drive disimpan di memori tes. Dua konteks browser = laptop & HP (penyimpanan terpisah).
 */
let driveFile: string | undefined;

async function fakeGoogle(ctx: BrowserContext) {
  await ctx.route('https://accounts.google.com/gsi/client', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: 'window.google={accounts:{oauth2:{initTokenClient:function(c){return{requestAccessToken:function(){setTimeout(function(){c.callback({access_token:"tok"})},10)}}}}}};' }),
  );
  await ctx.route('https://www.googleapis.com/**', async (r) => {
    const u = new URL(r.request().url());
    const auth = r.request().headers()['authorization'];
    if (u.pathname !== '/put-target' && auth !== 'Bearer tok') return r.fulfill({ status: 401 });
    if (u.pathname === '/drive/v3/files') return r.fulfill({ json: { files: driveFile ? [{ id: 'F1', modifiedTime: 'x' }] : [] } });
    if (u.pathname === '/drive/v3/files/F1') return r.fulfill({ body: driveFile ?? '' });
    if (u.pathname.startsWith('/upload/drive/v3/files')) return r.fulfill({ status: 200, headers: { Location: 'https://www.googleapis.com/put-target', 'Access-Control-Expose-Headers': 'Location', 'Access-Control-Allow-Origin': '*' }, body: '{}' });
    if (u.pathname === '/put-target') {
      driveFile = r.request().postData() ?? '';
      return r.fulfill({ status: 200, body: '{}' });
    }
    return r.fulfill({ status: 404 });
  });
}

async function device(browser: import('@playwright/test').Browser): Promise<Page> {
  const ctx = await browser.newContext();
  await fakeGoogle(ctx);
  // Sinkron dipasang = Client ID ada (panel tersembunyi saat offline).
  await ctx.addInitScript(() => localStorage.setItem('gemas-google-client-id', '1234567890-abcdef.apps.googleusercontent.com'));
  const page = await ctx.newPage();
  await page.goto('/lab?t=ringkasan');
  return page;
}

async function sync(page: Page) {
  await page.goto('/lab?t=ringkasan');
  await page.getByTestId('lab-drive-sync').click();
  await expect(page.getByTestId('lab-drive-msg')).toContainText('Sinkron selesai');
}

async function newLpj(page: Page, name: string) {
  await page.goto('/lab?t=belanja');
  await page.getByTestId('lpj-new').click();
  await page.getByTestId('lpj-purpose').fill(name);
  await page.getByTestId('lpj-save').click();
  await page.getByTestId('lpj-save-only').click();
  await page.getByRole('button', { name: 'Tutup' }).click();
}

test('offline: panel sinkron tidak tampil bila belum dipasang', async ({ page }) => {
  await page.goto('/lab?t=ringkasan');
  await expect(page.getByTestId('lab-backup-panel')).toBeVisible();
  await expect(page.getByTestId('lab-drive-panel')).toHaveCount(0);
});

test('laptop & HP: data digabung lewat Google Drive; hapus ikut terhapus', async ({ browser }) => {
  test.setTimeout(180_000);
  driveFile = undefined;
  const laptop = await device(browser);
  const hp = await device(browser);

  await newLpj(laptop, 'Belanja laptop E2E');
  await newLpj(hp, 'Belanja HP E2E');
  await sync(laptop);
  expect(driveFile).toContain('Belanja laptop E2E');
  await sync(hp);
  await expect(hp.getByTestId('lab-drive-msg')).toContainText('1 perubahan diambil');
  expect(driveFile).toContain('Belanja HP E2E');
  await sync(laptop);
  await laptop.goto('/lab?t=belanja');
  await expect(laptop.getByTestId('lpj-list')).toContainText('Belanja HP E2E');

  // hapus di HP → setelah sinkron, hilang juga di laptop (tidak muncul lagi)
  await hp.goto('/lab?t=belanja');
  await hp.getByTestId('lpj-list').locator('li', { hasText: 'Belanja laptop E2E' }).getByRole('button', { name: 'Hapus' }).click();
  await hp.getByTestId('confirm-ok').click();
  await expect(hp.getByTestId('lpj-list')).not.toContainText('Belanja laptop E2E');
  await sync(hp);
  await expect(hp.getByTestId('lab-drive-msg')).toContainText('0 perubahan diambil');
  await sync(laptop);
  await laptop.goto('/lab?t=belanja');
  await expect(laptop.getByTestId('lpj-list')).not.toContainText('Belanja laptop E2E');
  await expect(laptop.getByTestId('lpj-list')).toContainText('Belanja HP E2E');
});
