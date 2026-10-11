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
    await page.getByTestId('wiz-next').click();
    await page.getByTestId('wiz-free').check();
    await page.getByTestId('wiz-next').click();
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

  test('protokol berversi → catatan harian (append-only) dengan hasil ukur & foto → PDF harian/kompilasi → cadangan & pulihkan', async ({ page }) => {
    // PNG 1×1 untuk lampiran.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    await page.goto('/lab?t=protokol');
    await page.getByTestId('proto-filter').selectOption('CK');
    await page.getByTestId('proto-new').click();
    const pid = (await page.getByTestId('proto-id').textContent())!;
    expect(pid).toMatch(/^CK-P\d{2}-v1$/);
    await page.getByTestId('proto-name').fill('Cuka E2E');
    await page.getByTestId('proto-ing-name-0').fill('Air kelapa');
    await page.getByTestId('proto-ing-amount-0').fill('2');
    await page.getByTestId('proto-ing-unit-0').fill('L');
    await page.getByTestId('proto-step-0').fill('Saring');
    await page.getByTestId('proto-save').click();
    const key = pid.replace(/-v1$/, '');
    await expect(page.getByTestId(`proto-${key}`)).toContainText('1 versi');
    await page.getByTestId(`proto-newver-${key}`).click();
    await expect(page.getByTestId('proto-id')).toHaveText(`${key}-v2`);
    await expect(page.getByTestId('proto-ing-amount-0')).toHaveValue('2');
    await page.getByTestId('proto-ing-amount-0').fill('3');
    await page.getByTestId('proto-save').click();
    await expect(page.getByTestId('proto-form')).toContainText('Tulis alasan');
    await page.getByTestId('proto-reason').fill('naikkan volume');
    await page.getByTestId('proto-save').click();
    await expect(page.getByTestId(`proto-${key}`)).toContainText('2 versi');

    await page.getByTestId('lab-tab-eksperimen').click();
    await page.getByTestId('lab-new').click();
    await page.getByTestId('lab-product').selectOption('CK');
    await page.getByTestId('lab-title').fill('E2E cuka harian');
    await page.getByTestId('wiz-next').click();
    await page.getByTestId('wiz-free').check();
    await page.getByTestId('wiz-next').click();
    await page.getByTestId('lab-save').click();
    const id = (await page.getByTestId('lab-detail-id').textContent())!;

    await page.getByTestId('day-new').click();
    await expect(page.getByTestId('day-id')).toHaveText(`${id}-H01`);
    await page.getByTestId('day-protocol').selectOption(`${key}-v2`);
    await page.getByTestId('day-plan').fill('Fermentasi 2 L');
    await page.getByTestId('day-actual').fill('Fermentasi 1,8 L karena tumpah');
    await page.getByTestId('day-mat-name-0').fill('Air kelapa');
    await page.getByTestId('day-mat-amount-0').fill('1,8');
    await page.getByTestId('day-mat-unit-0').fill('L');
    await page.getByTestId('day-meas-name-0').fill('pH');
    await page.getByTestId('day-meas-value-0').fill('4,6');
    await page.getByTestId('day-meas-at-0').fill('2026-10-11T08:00');
    await page.getByTestId('day-meas-add').click();
    await page.getByTestId('day-meas-name-1').fill('pH');
    await page.getByTestId('day-meas-value-1').fill('4,1');
    await page.getByTestId('day-meas-at-1').fill('2026-10-11T16:00');
    await page.getByTestId('day-deviation').fill('Tumpah 0,2 L');
    await page.getByTestId('day-files').setInputFiles({ name: 'botol.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('day-save').click();
    await expect(page.getByTestId('day-msg')).toContainText(`${id}-H01`);
    await expect(page.getByTestId(`day-meas-table-${id}-H01`)).toContainText('4,6');
    await expect(page.getByTestId(`day-media-${id}-H01`)).toContainText('botol.png');

    const daily = page.waitForEvent('download');
    await page.getByTestId(`day-pdf-${id}-H01`).click();
    expect((await daily).suggestedFilename()).toBe(`${id}-H01-harian.pdf`);
    const compiled = page.waitForEvent('download');
    await page.getByTestId('lab-compile-pdf').click();
    const pdfPath = await (await compiled).path();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(pdfPath!).subarray(0, 5).toString()).toBe('%PDF-');

    // Cadangan lengkap lalu pulihkan: semua sudah ada → dilewati, tidak ditimpa.
    await page.getByTestId('lab-tab-ringkasan').click();
    const dl = page.waitForEvent('download');
    await page.getByTestId('lab-backup').click();
    const backupPath = (await (await dl).path())!;
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    expect(backup.version).toBe(2);
    expect(backup.entries.some((e: { id: string }) => e.id === `${id}-H01`)).toBe(true);
    expect(backup.media.some((m: { name: string; data: string }) => m.name === 'botol.png' && m.data.length > 0)).toBe(true);
    await page.getByTestId('lab-restore-file').setInputFiles(backupPath);
    await expect(page.getByTestId('lab-restore-plan')).toContainText('Akan ditambahkan: 0 eksperimen, 0 catatan harian');
    await expect(page.getByTestId('lab-restore-apply')).toBeDisabled();
  });
  test('peneliti: wizard desain (faktor × ulangan) → lembar data → ringkasan per perlakuan → laporan PDF lengkap', async ({ page }) => {
    await page.goto('/lab?t=eksperimen');
    await page.getByTestId('lab-new').click();
    await page.getByTestId('lab-product').selectOption('KE');
    await page.getByTestId('lab-title').fill('E2E suhu oven');
    await page.getByTestId('lab-hypothesis').fill('70 °C lebih cepat kering');
    await page.getByTestId('wiz-next').click();
    await page.getByTestId('wiz-next').click();
    await expect(page.getByTestId('lab-msg')).toContainText('faktor');
    await page.getByTestId('wiz-f0-name').fill('Suhu oven');
    await page.getByTestId('wiz-f0-unit').fill('°C');
    await page.getByTestId('wiz-f0-levels').fill('60, 70');
    await page.getByTestId('wiz-reps').fill('2');
    await page.getByTestId('wiz-control').selectOption({ index: 1 });
    await page.getByTestId('wiz-next').click();
    await expect(page.getByTestId('lab-msg')).toContainText('diukur');
    await page.getByTestId('wiz-sug-ka_akhir_pct').click();
    await page.getByTestId('wiz-resp-name').fill('Warna');
    await page.getByTestId('wiz-resp-unit').fill('skor');
    await page.getByTestId('wiz-resp-add').click();
    await expect(page.getByTestId('wiz-responses')).toContainText('Kadar air akhir');
    await page.getByTestId('wiz-next').click();
    await expect(page.getByTestId('wiz-run-count')).toContainText('2 × 2 = 4 unit');
    await expect(page.getByTestId('wiz-runs')).toContainText('P2-U2');
    await page.getByTestId('lab-save').click();

    const id = (await page.getByTestId('lab-detail-id').textContent())!;
    await expect(page.getByTestId('lab-design')).toContainText('Suhu oven: 60 / 70 °C');
    const vals: Record<string, string> = { 'P1-U1': '6,0', 'P1-U2': '7,0', 'P2-U1': '5,0', 'P2-U2': '5,5' };
    for (const [code, v] of Object.entries(vals)) await page.getByTestId(`cell-${code}-0`).fill(v);
    await page.getByTestId('sheet-save').click();
    await expect(page.getByTestId('sheet-msg')).toContainText(`${id}-H01`);
    const sum = page.getByTestId('sum-Kadar air akhir');
    await expect(sum).toContainText('6,50');
    await expect(sum).toContainText('5,25');
    await expect(page.getByTestId(`cell-P1-U1-0`)).toHaveAttribute('placeholder', '6,0');

    const dl = page.waitForEvent('download');
    await page.getByTestId('lab-compile-pdf').click();
    const path = await (await dl).path();
    const { readFileSync } = await import('node:fs');
    const pdf = readFileSync(path!);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000);
  });
  test('eksperimen lama tanpa desain → Tambah desain (riwayat versi tetap) → lembar data muncul', async ({ page }) => {
    await page.goto('/lab?t=eksperimen');
    await page.getByTestId('lab-new').click();
    await page.getByTestId('lab-title').fill('E2E tanpa desain');
    await page.getByTestId('wiz-next').click();
    await page.getByTestId('wiz-free').check();
    await page.getByTestId('wiz-next').click();
    await page.getByTestId('lab-save').click();
    await expect(page.getByTestId('lab-no-design')).toBeVisible();
    await expect(page.getByTestId('lab-sheet')).toHaveCount(0);
    await page.getByTestId('lab-add-design').click();
    await page.getByTestId('wiz-f0-name').fill('Lama jemur');
    await page.getByTestId('wiz-f0-unit').fill('hari');
    await page.getByTestId('wiz-f0-levels').fill('3, 5');
    await page.getByTestId('wiz-resp-name').fill('Berat akhir');
    await page.getByTestId('wiz-resp-unit').fill('kg');
    await page.getByTestId('wiz-resp-add').click();
    await page.getByTestId('wiz-next').click();
    await expect(page.getByTestId('wiz-run-count')).toContainText('2 × 3 = 6 unit');
    await page.getByTestId('lab-save').click();
    await expect(page.getByTestId('lab-design')).toContainText('Lama jemur: 3 / 5 hari');
    await expect(page.getByTestId('lab-sheet')).toBeVisible();
    await expect(page.getByTestId('lab-detail')).toContainText('1 versi lama tersimpan');
  });
  test('riset produk: foto bahan & langkah + alat → laporan harian sampai SELESAI → laporan PDF, Word, PowerPoint', async ({ page }) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.goto('/lab?t=protokol');
    await expect(page.getByTestId('lab-tab-protokol')).toHaveText('Riset Produk');
    await page.getByTestId('proto-filter').selectOption('KE');
    await page.getByTestId('proto-new').click();
    const pid = (await page.getByTestId('proto-id').textContent())!;
    const key = pid.replace(/-v1$/, '');
    await page.getByTestId('proto-name').fill('Kopra oven E2E');
    await page.getByTestId('proto-start').fill('2026-10-11');
    await page.getByTestId('proto-author').fill('Owner');
    await page.getByTestId('proto-assistants').fill('Rina, Budi');
    await page.getByTestId('proto-ing-name-0').fill('Daging kelapa');
    await page.getByTestId('proto-ing-amount-0').fill('2');
    await page.getByTestId('proto-ing-unit-0').fill('kg');
    await page.getByTestId('proto-ing-files-0').setInputFiles({ name: 'daging.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('proto-tool-name-0').fill('Oven listrik');
    await page.getByTestId('proto-tool-amount-0').fill('1');
    await page.getByTestId('proto-tool-unit-0').fill('unit');
    await page.getByTestId('proto-tool-files-0').setInputFiles({ name: 'oven.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('proto-tool-add').click();
    await page.getByTestId('proto-tool-name-1').fill('Timbangan digital');
    await page.getByTestId('proto-step-0').fill('Belah dan tiriskan');
    await page.getByTestId('proto-day-add').click();
    await expect(page.getByTestId('proto-day-1')).toHaveText('Hari ke-2');
    await page.getByTestId('proto-step-1').fill('Oven 60 °C');
    await page.getByTestId('proto-step-files-0').setInputFiles({ name: 'belah.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('proto-save').click();
    await expect(page.getByTestId(`proto-${key}`)).toContainText('belum ada laporan');

    await page.getByTestId(`proto-open-${key}`).click();
    const latest = page.getByTestId('rp-latest');
    await expect(latest).toContainText('Oven listrik');
    await expect(latest.locator('img')).toHaveCount(3);
    await expect(latest).toContainText('Timbangan digital');
    await expect(page.getByTestId('rp-dates')).toContainText('Rina, Budi');
    await expect(page.getByTestId('rp-end')).toHaveText('belum selesai');
    await page.getByTestId('day-new').click();
    await page.getByTestId('day-date').fill('2026-10-12');
    await page.getByTestId('day-actual').fill('Oven 60 °C, 8 jam');
    await page.getByTestId('day-meas-name-0').fill('Kadar air');
    await page.getByTestId('day-meas-value-0').fill('9,5');
    await page.getByTestId('day-meas-unit-0').fill('%');
    await page.getByTestId('day-save').click();
    await expect(page.getByTestId('rp-status')).toHaveText('berjalan');
    await page.getByTestId('day-new').click();
    await page.getByTestId('day-date').fill('2026-10-13');
    await page.getByTestId('day-actual').fill('Kering, dikemas');
    await page.getByTestId('day-finish').check();
    await page.getByTestId('day-save').click();
    await expect(page.getByTestId('rp-status')).toHaveText('SELESAI');
    await expect(page.getByTestId('rp-end')).toHaveText('2026-10-13 · 3 hari');
    await expect(page.getByTestId('lab-daily')).toContainText('Hari ke-2');

    const { readFileSync } = await import('node:fs');
    for (const [k, magic] of [['pdf', '%PDF-'], ['docx', 'PK'], ['pptx', 'PK']] as const) {
      const dl = page.waitForEvent('download');
      await page.getByTestId(`rp-${k}`).click();
      const d = await dl;
      expect(d.suggestedFilename()).toBe(`${key}-riset-produk.${k}`);
      const out = `test-results/riset-produk.${k}`;
      await d.saveAs(out);
      expect(readFileSync(out).subarray(0, magic.length).toString()).toBe(magic);
    }
  });
});

test.describe('GEMA RnD Lab — HP 360 px', () => {
  for (const t of ['ringkasan', 'eksperimen', 'protokol', 'library', 'standar']) {
    test(`@mobile /lab?t=${t} tanpa geser horizontal`, async ({ page }) => {
      await page.goto(`/lab?t=${t}`);
      await expect(page.getByTestId('lab-hero')).toBeVisible();
      if (t === 'eksperimen') await page.getByTestId('lab-new').click();
      if (t === 'protokol') await page.getByTestId('proto-new').click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
