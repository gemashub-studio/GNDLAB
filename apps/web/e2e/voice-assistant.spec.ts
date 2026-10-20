import { test, expect, type Page } from '@playwright/test';

// asisten suara kelapa (DEC-111): kartu sambutan → Ayo → perintah → buka halaman/form & isi data.
// Rencana Groq ditiru (route) supaya uji tidak memakai kuota; mikrofon palsu Chromium.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

const force = async (page: Page) => {
  await page.addInitScript(() => window.localStorage.setItem('gnd-va-force', '1'));
  await page.route('**/api/voice-transcribe', (r) => r.fulfill({ json: { ok: true, text: '' } }));
};

test('kartu sambutan: Gak dulu deh → tidak muncul lagi, tombol kelapa tetap ada', async ({ page }) => {
  test.setTimeout(180_000);
  await force(page);
  await page.goto('/gudang');
  const intro = page.getByTestId('va-intro');
  await expect(intro).toContainText('Mau mulai bersama ku?');
  await expect(intro).toContainText('aku bisa lakukan itu via perintah suara');
  await expect(intro.getByRole('img', { name: 'Maskot kelapa' })).toBeVisible();
  await intro.getByTestId('va-no').click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByTestId('va-fab')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('va-fab')).toBeVisible();
  await expect(page.getByTestId('va-intro')).toHaveCount(0);
});

test('Ayo → "buka pencatatan data lalu buat catatan baru" → form terbuka → "jumlah item…" terisi', async ({ page }) => {
  test.setTimeout(240_000);
  await force(page);
  const plans = [
    { actions: [{ type: 'navigate', target: '/lab?t=bahan' }, { type: 'click', target: 'catat-new' }], reply: 'Buka pencatatan data dan membuat catatan baru.' },
    { actions: [{ type: 'fill', text: 'jumlah item dua perlakuan green house jumlah produksi dua' }], reply: 'Mengisi jumlah item dan perlakuan.' },
    { actions: [{ type: 'fill', text: 'nomor dua berat awal seribu tiga puluh empat tebal daging sepuluh' }], reply: 'Mengisi nomor dua.' },
  ];
  const sent: { text: string; ctx: { path: string; form?: string; buttons: { id: string }[] } }[] = [];
  await page.route('**/api/voice-assistant', async (r) => {
    sent.push(r.request().postDataJSON());
    await r.fulfill({ json: { ok: true, ...plans[sent.length - 1] } });
  });
  await page.goto('/');
  await page.getByTestId('va-yes').click();
  const panel = page.getByTestId('va-panel');
  await expect(panel).toContainText('Aku mendengarkan');
  const say = async (t: string) => {
    await panel.getByTestId('va-text').fill(t);
    await panel.getByTestId('va-text').press('Enter');
  };
  await say('tolong buka pencatatan data terus bikin catatan baru ya');
  await expect(page).toHaveURL(/\/lab\?t=bahan/, { timeout: 120_000 });
  const m = page.getByTestId('catat-awal-modal');
  await expect(m).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByTestId('va-status')).toContainText('Buka pencatatan data');
  expect(sent[0]!.ctx.path).toBe('/');
  await say('jumlah itemnya dua, perlakuannya green house sebanyak dua');
  await expect(m.getByTestId('catat-count')).toHaveValue('2');
  await expect(m.getByTestId('catat-perl-0')).toContainText('Green House');
  await expect(m.getByTestId('catat-perl-count-0')).toHaveValue('2');
  expect(sent[1]!.ctx.form).toBe('Buat catatan awal');
  await say('nomor dua berat awalnya seribu tiga puluh empat, tebalnya sepuluh');
  await expect(m.getByTestId('catat-awal-beratAwal-2')).toHaveValue('1034');
  await expect(m.getByTestId('catat-awal-tebalAwal-2')).toHaveValue('10');
  // tombol berbahaya tidak pernah dikirim ke perencana
  expect(sent.flatMap((s) => s.ctx.buttons.map((b) => b.id)).some((id) => /delete|hapus|logout/i.test(id))).toBe(false);
  await panel.getByTestId('va-stop').click();
  await expect(page.getByTestId('va-fab')).toBeVisible();
});
