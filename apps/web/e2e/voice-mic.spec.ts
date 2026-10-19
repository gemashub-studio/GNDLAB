import { test, expect } from '@playwright/test';

// mikrofon palsu Chromium (nada bip) → potongan rekaman dikirim ke /api/voice-transcribe (ditiru) → kolom terisi (DEC-099)
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

test('pengisian suara: mikrofon → potong saat diam → transkripsi → "dua. Berat awal seribu tiga empat." → 1034', async ({ page }) => {
  test.setTimeout(180_000);
  let calls = 0;
  await page.route('**/api/voice-transcribe', async (r) => {
    calls++;
    expect(r.request().postDataBuffer()?.length ?? 0).toBeGreaterThan(0);
    await r.fulfill({ json: { ok: true, text: calls === 1 ? 'dua. Berat awal seribu tiga empat.' : '' } });
  });
  await page.goto('/lab?t=bahan');
  await page.getByTestId('catat-new').click();
  const m = page.getByTestId('catat-awal-modal');
  await m.getByTestId('catat-count').fill('3');
  await m.getByTestId('catat-awal-voice-toggle').click();
  await expect(m.getByTestId('catat-awal-voice-toggle')).toContainText('Berhenti');
  await expect(m.getByTestId('catat-awal-beratAwal-2')).toHaveValue('1034', { timeout: 90_000 });
  await expect(m.locator('[data-voice-row="2"]')).toHaveClass(/voice-row-neon/);
  await m.getByTestId('catat-awal-voice-toggle').click();
  await expect(m.getByTestId('catat-awal-voice-toggle')).toContainText('Isi dengan suara');
});
