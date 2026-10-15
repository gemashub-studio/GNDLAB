import { expect, test } from '@playwright/test';

/** GEMA RnD Lab (DEC-044/045): buku catatan eksperimen lokal + library sumber. */
test.describe('GEMA RnD Lab', () => {
  test('kartu jalur → eksperimen baru dengan ID otomatis → lengkapi hasil & langkah → riwayat versi', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.getByTestId('lab-heading').getByRole('img', { name: 'GnD Lab' })).toBeVisible();
    await expect(page).toHaveTitle(/GnD Lab/);
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
    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-product').fill('Cuka Air Kelapa');
    const pid = (await page.getByTestId('proto-id').textContent())!;
    expect(pid).toMatch(/^CK-P\d{2}-v1$/);
    await page.getByTestId('proto-name').fill('Cuka E2E');
    await page.getByTestId('proto-ing-name-0').fill('Air kelapa');
    await page.getByTestId('proto-ing-amount-0').fill('2');
    await page.getByTestId('proto-ing-unit-0').fill('L');
    await page.getByTestId('proto-step-0').fill('Saring');
    await page.getByTestId('proto-finish').click();
    const key = pid.replace(/-v1$/, '');
    await expect(page.getByTestId(`proto-${key}`)).toContainText('1 versi');
    await page.getByTestId(`proto-newver-${key}`).click();
    await expect(page.getByTestId('proto-id')).toHaveText(`${key}-v2`);
    await expect(page.getByTestId('proto-ing-amount-0')).toHaveValue('2');
    await page.getByTestId('proto-ing-amount-0').fill('3');
    await page.getByTestId('proto-finish').click();
    await expect(page.getByTestId('proto-form')).toContainText('Tulis alasan');
    await page.getByTestId('proto-reason').fill('naikkan volume');
    await page.getByTestId('proto-finish').click();
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
    test.setTimeout(180_000); // 8 unduhan (laporan gabungan + harian, 4 format)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.goto('/lab?t=protokol');
    await expect(page.getByTestId('lab-tab-protokol')).toHaveText('Riset Produk');
    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-product').fill('Kopra Edibel');
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
    await page.getByTestId('proto-finish').click();
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
    await page.getByTestId('day-next').fill('Timbang & kemas');
    await page.getByTestId('day-save').click();
    await expect(page.getByTestId('rp-status')).toHaveText('berjalan');

    // laporan harian per hari: unduh PDF / Word / PowerPoint (DEC-072)
    const h1 = `${key}-H01`;
    {
      const { readFileSync } = await import('node:fs');
      for (const [k, magic] of [['pdf', '%PDF-'], ['docx', 'PK'], ['pptx', 'PK'], ['html', '<!doctype html>']] as const) {
        const dl = page.waitForEvent('download');
        await page.getByTestId(`day-${k}-${h1}`).click();
        const d = await dl;
        expect(d.suggestedFilename()).toBe(`${h1}-laporan-harian.${k}`);
        const out = `test-results/laporan-harian.${k}`;
        await d.saveAs(out);
        expect(readFileSync(out).subarray(0, magic.length).toString()).toBe(magic);
      }
    }
    // lanjut ke hari berikutnya: tanggal +1, rencana dari "langkah berikutnya" (resep tak punya Hari ke-3)
    await expect(page.getByTestId(`day-continue-${h1}`)).toContainText('Hari ke-3');
    await page.getByTestId(`day-continue-${h1}`).click();
    await expect(page.getByTestId('day-date')).toHaveValue('2026-10-13');
    await expect(page.getByTestId('day-plan')).toHaveValue('Timbang & kemas');
    await expect(page.getByTestId('day-meas-at-0')).toHaveValue(/^2026-10-13T/);
    await page.getByTestId('day-actual').fill('Kering, dikemas');
    await page.getByTestId('day-finish').check();
    await page.getByTestId('day-save').click();
    await expect(page.getByTestId('rp-status')).toHaveText('SELESAI');
    await expect(page.getByTestId('rp-end')).toHaveText('2026-10-13 · 3 hari');
    await expect(page.getByTestId('lab-daily')).toContainText('Hari ke-2');
    // riset selesai → tidak ada tombol lanjut lagi
    await expect(page.locator('[data-testid^="day-continue-"]')).toHaveCount(0);

    const { readFileSync } = await import('node:fs');
    for (const [k, magic] of [['pdf', '%PDF-'], ['docx', 'PK'], ['pptx', 'PK'], ['html', '<!doctype html>']] as const) {
      const dl = page.waitForEvent('download');
      await page.getByTestId(`rp-${k}`).click();
      const d = await dl;
      expect(d.suggestedFilename()).toBe(`${key}-riset-produk.${k}`);
      const out = `test-results/riset-produk.${k}`;
      await d.saveAs(out);
      expect(readFileSync(out).subarray(0, magic.length).toString()).toBe(magic);
    }
  });
  test('resep: Simpan = draf (buka lagi besok lewat On going proses) → Selesai = versi resmi', async ({ page }) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.goto('/lab?t=protokol');
    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-product').fill('Arang');
    await page.getByTestId('proto-name').fill('Arang draf E2E');
    await page.getByTestId('proto-ing-name-0').fill('Batok kelapa');
    await page.getByTestId('proto-ing-files-0').setInputFiles({ name: 'batok.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('proto-save').click();
    await expect(page.getByRole('status').filter({ hasText: 'On going proses' })).toBeVisible();

    await page.reload(); // "besok"
    await page.getByTestId('proto-ongoing').click();
    const list = page.getByTestId('ongoing-list');
    await expect(list).toContainText('Arang draf E2E');
    await expect(list).toContainText('DRAF');
    await list.getByRole('button', { name: 'Lanjutkan' }).first().click();
    await expect(page.getByTestId('proto-name')).toHaveValue('Arang draf E2E');
    await expect(page.getByTestId('proto-ing-name-0')).toHaveValue('Batok kelapa');
    await expect(page.getByTestId('proto-form')).toContainText('batok.png');
    await page.getByTestId('proto-ing-amount-0').fill('10');
    await page.getByTestId('proto-ing-unit-0').fill('kg');
    await page.getByTestId('proto-finish').click();
    await expect(page.getByTestId('proto-list')).toContainText('Arang draf E2E');
    await page.getByTestId('proto-ongoing').click();
    await expect(page.getByTestId('ongoing-list')).not.toContainText('Arang draf E2E');
    // ada draf terbuka → "+ Resep baru" tetap membuka formulir KOSONG baru (draf lama tidak tertimpa)
    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-name').fill('Draf A');
    await page.getByTestId('proto-save').click();
    await page.getByTestId('proto-new').click();
    await expect(page.getByTestId('proto-name')).toHaveValue('');
    await page.getByTestId('proto-name').fill('Draf B');
    await page.getByTestId('proto-save').click();
    await expect(page.getByTestId('proto-ongoing')).toContainText('(2)');
  });
  test('kamera: ambil foto & rekam video dari webcam (kamera palsu) ke bahan; tombol Foto/Video memakai kamera HP', async ({ page }) => {
    await page.goto('/lab?t=protokol');
    await page.getByTestId('proto-new').click();
    await expect(page.getByTestId('proto-ing-files-0-photo')).toHaveAttribute('capture', 'environment');
    await expect(page.getByTestId('proto-ing-files-0-video')).toHaveAttribute('accept', 'video/*');
    await page.getByTestId('proto-ing-files-0-cam').click();
    const dlg = page.getByTestId('proto-ing-files-0-camdlg');
    await expect(dlg).toBeVisible();
    await expect.poll(() => dlg.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await page.getByTestId('proto-ing-files-0-camdlg-snap').click();
    await page.getByTestId('proto-ing-files-0-camdlg-rec').click();
    await expect(dlg).toContainText('MEREKAM');
    await page.waitForTimeout(1500);
    await page.getByTestId('proto-ing-files-0-camdlg-rec').click();
    await expect(page.getByTestId('proto-ing-files-0-camdlg-close')).toContainText('(2)');
    await page.getByTestId('proto-ing-files-0-camdlg-close').click();
    await expect(dlg).toHaveCount(0);
    const form = page.getByTestId('proto-form');
    await expect(form).toContainText(/foto-\d{8}-\d{6}\.jpg/);
    await expect(form).toContainText(/video-\d{8}-\d{6}\.(webm|mp4)/);
  });
  test('hasil riset: pilih versi lalu unduh langsung; draf di On going proses bisa dihapus', async ({ page }) => {
    await page.goto('/lab?t=protokol');
    await expect(page.getByTestId('proto-filter')).toHaveCount(0);
    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-product').fill('Briket');
    const key = (await page.getByTestId('proto-id').textContent())!.replace(/-v1$/, '');
    await page.getByTestId('proto-name').fill('Briket versi E2E');
    await page.getByTestId('proto-finish').click();
    await page.getByTestId(`proto-newver-${key}`).click();
    await page.getByTestId('proto-reason').fill('perekat naik');
    await page.getByTestId('proto-finish').click();
    await page.getByTestId(`hr-ver-${key}`).selectOption(`${key}-v1`);
    const dl = page.waitForEvent('download');
    await page.getByTestId(`hr-docx-${key}`).click();
    expect((await dl).suggestedFilename()).toBe(`${key}-v1-riset-produk.docx`);

    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-name').fill('Draf dibuang E2E');
    await page.getByTestId('proto-save').click();
    await page.getByRole('button', { name: 'Tutup' }).click();
    await page.getByTestId('proto-ongoing').click();
    const list = page.getByTestId('ongoing-list');
    await expect(list).toContainText('Draf dibuang E2E');
    await list.locator('li', { hasText: 'Draf dibuang E2E' }).getByRole('button', { name: 'Hapus' }).click();
    await page.getByTestId('confirm-ok').click();
    await expect(list).not.toContainText('Draf dibuang E2E');
  });
});

test.describe('Hapus hasil riset', () => {
  test('Pencatatan Data: catatan awal N baris → simpan → data akhir berdampingan → Lihat hasil (awal, akhir, perbandingan + kesimpulan) & unduh', async ({ page }) => {
    test.setTimeout(240_000);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.goto('/lab?t=bahan');
    // urutan menu: Ringkasan → Pencatatan Data → Riset Produk → …
    await expect(page.getByRole('tab')).toHaveText(['Ringkasan', 'Pencatatan Data', 'Riset Produk', 'Eksperimen', 'Laporan Belanja', 'Library', 'Standar']);
    await expect(page.getByTestId('lab-tab-bahan')).toHaveText('Pencatatan Data');
    await expect(page.getByTestId('lab-hero')).toContainText('Pencatatan data');
    await expect(page.getByTestId('catat-stat-awal')).toContainText('0');
    // data akhir belum bisa dibuka tanpa catatan awal
    await expect(page.getByTestId('catat-akhir')).toBeDisabled();

    await page.getByTestId('catat-new').click();
    const awal = page.getByTestId('catat-awal-modal');
    await expect(awal).not.toContainText('Perlakuan air');
    await expect(awal.getByTestId('catat-treatments')).toHaveCount(0);
    await awal.getByTestId('catat-count').fill('3');
    await expect(awal.locator('[data-testid^="catat-awal-beratAwal-"]')).toHaveCount(3);
    await expect(awal.locator('[data-testid^="catat-awal-tebalAwal-"]')).toHaveCount(3);
    await awal.getByTestId('catat-awal-beratAwal-1').fill('1.000');
    await awal.getByTestId('catat-awal-confirm').click();
    await expect(awal).toContainText('Masih kosong');
    const vals: [string, string, string, string][] = [['1.000', '300', '310', '10'], ['1.200', '', '', '12'], ['800', '', '', '9']];
    for (const [i, [b, va, ba, t]] of vals.entries()) {
      await awal.getByTestId(`catat-awal-beratAwal-${i + 1}`).fill(b);
      if (va) await awal.getByTestId(`catat-awal-volAir-${i + 1}`).fill(va);
      if (ba) await awal.getByTestId(`catat-awal-beratAir-${i + 1}`).fill(ba);
      await awal.getByTestId(`catat-awal-tebalAwal-${i + 1}`).fill(t);
    }
    // foto per nomor (data awal)
    await awal.getByTestId('catat-awal-foto-1').setInputFiles({ name: 'awal1.png', mimeType: 'image/png', buffer: png });
    await expect(awal.getByTestId('catat-awal-foto-1-img')).toBeVisible();
    await awal.getByTestId('catat-awal-confirm').click();
    await expect(page.getByTestId('catat-toast')).toContainText('Tunggu ya, data sedang di save.');
    await expect(page.getByTestId('catat-toast').getByTestId('file-loader').locator('.pfile')).toHaveCount(6);
    await expect(page.getByTestId('catat-toast')).toHaveCount(0);
    const card = page.locator('[data-testid^="catat-card-PD-"]');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Kelapa tua · 3 item');
    await expect(card).toContainText('Menunggu data akhir');
    await expect(page.getByTestId('catat-stat-awal')).toContainText('1');
    const id = (await card.getAttribute('data-testid'))!.replace('catat-card-', '');
    // unduh dari kartu
    const dl = page.waitForEvent('download');
    await page.getByTestId(`catat-dl-${id}-pdf`).click();
    expect((await dl).suggestedFilename()).toBe(`${id}-pencatatan-data.pdf`);
    // pratinjau saat kartu diklik
    await card.click();
    const pv = page.getByTestId('catat-preview');
    await expect(pv.getByTestId('catat-tbl-awal')).toContainText('1.200');
    await expect(pv.getByTestId('catat-preview-dl-docx')).toBeVisible();
    await pv.getByTestId('catat-preview-close').click();

    // catatan awal kedua (sekam) → pilihan "Pilih catatan awal yang tersedia" muncul
    await page.getByTestId('catat-new').click();
    await page.getByTestId('catat-item').click();
    await page.getByTestId('catat-item-opt-Sekam').click();
    await page.getByTestId('catat-count').fill('1');
    await expect(page.locator('[data-testid^="catat-awal-tebalAwal-"]')).toHaveCount(0);
    await page.getByTestId('catat-awal-beratAwal-1').fill('500');
    await page.getByTestId('catat-awal-confirm').click();
    await expect(page.locator('[data-testid^="catat-card-PD-"]')).toHaveCount(2);

    await expect(page.getByTestId('catat-select')).toBeDisabled();
    await page.getByTestId('catat-akhir').click();
    const akhir = page.getByTestId('catat-akhir-modal');
    await expect(akhir).toContainText('Pencatatan data akhir');
    await akhir.getByTestId('catat-pick').click();
    await akhir.getByTestId(`catat-pick-opt-${id}`).click();
    await expect(akhir.getByTestId('catat-akhir-info')).toContainText('Kelapa tua · 3 item');
    // data awal di samping kolom akhir yang masih kosong
    await expect(akhir.getByLabel('Berat awal nomor 2')).toHaveValue('1.200');
    await expect(akhir.getByTestId('catat-akhir-berat-2')).toHaveValue('');
    // foto data awal tampil di form data akhir; foto data akhir bisa ditambah
    await expect(akhir.getByTestId('catat-akhir-fotoawal-1')).toHaveAttribute('src', /^data:image\/jpeg/);
    await expect(akhir.getByTestId('catat-akhir-fotoawal-2')).toHaveText('tanpa foto');
    await akhir.getByTestId('catat-akhir-fotoawal-1').click();
    await expect(page.getByTestId('img-preview')).toBeVisible();
    await page.getByTestId('img-preview-close').click();
    await expect(page.getByTestId('img-preview')).toHaveCount(0);
    await akhir.getByTestId('catat-akhir-foto-1').setInputFiles({ name: 'akhir1.png', mimeType: 'image/png', buffer: png });
    await expect(akhir.getByTestId('catat-akhir-foto-1-img')).toBeVisible();
    await akhir.getByTestId('catat-akhir-confirm').click();
    await expect(akhir).toContainText('Data akhir masih kosong di nomor: 1, 2, 3');
    // perlakuan (opsional) di bawah data akhir; tombol + menambah kolom jumlah + dropdown metode
    await expect(akhir.getByTestId('catat-treatments')).toContainText('Jumlah perlakuan bibit bio leather');
    await akhir.getByTestId('catat-tr-count-kopra-0').fill('3');
    await akhir.getByTestId('catat-tr-method-kopra-0').click();
    await expect(akhir.getByTestId('catat-tr-method-kopra-0-list')).toContainText('Oven Briket');
    await akhir.getByTestId('catat-tr-method-kopra-0-opt-Oven Gas').click();
    await akhir.getByTestId('catat-tr-add-kopra').click();
    await akhir.getByTestId('catat-tr-add-kopra').click();
    await expect(akhir.locator('[data-testid^="catat-tr-count-kopra-"]')).toHaveCount(3);
    await akhir.getByTestId('catat-tr-del-kopra-2').click();
    await expect(akhir.locator('[data-testid^="catat-tr-count-kopra-"]')).toHaveCount(2);
    await akhir.getByTestId('catat-tr-count-kopra-1').fill('1');
    await akhir.getByTestId('catat-tr-method-kopra-1').click();
    await akhir.getByTestId('catat-tr-method-kopra-1-opt-Oven Briket').click();
    await akhir.getByTestId('catat-tr-method-cuka-0').click();
    await expect(akhir.getByTestId('catat-tr-method-cuka-0-list').getByRole('option')).toHaveText(['— pilih —', 'CUKA 1 - GULA 25g', 'CUKA 2 - GULA 75g', 'CUKA 3 - GULA 50']);
    await akhir.getByTestId('catat-tr-method-cuka-0-opt-CUKA 2 - GULA 75g').click();
    await akhir.getByTestId('catat-tr-count-cuka-0').fill('2');
    // "Simpan dulu": baru nomor 1 yang terisi → tersimpan sementara, catatan tetap menunggu (DEC-082)
    await akhir.getByTestId('catat-akhir-berat-1').fill('900');
    await akhir.getByTestId('catat-akhir-tebal-1').fill('8');
    await akhir.getByTestId('catat-akhir-draft').click();
    await expect(page.getByTestId('catat-toast')).toBeVisible();
    const drafted = page.getByTestId('catat-drafted');
    await expect(drafted).toContainText('1 dari 3 nomor');
    await drafted.getByTestId('catat-drafted-close').click();
    await expect(page.getByTestId(`catat-card-${id}`)).toContainText('tersimpan sementara (1/3)');
    await expect(page.getByTestId('catat-stat-akhir')).toContainText('0');
    // pratinjau/unduhan memuat data sementara
    await page.getByTestId(`catat-card-${id}`).click();
    const pv2 = page.getByTestId('catat-preview');
    await expect(pv2.getByTestId('catat-akhir-draft-note')).toContainText('1 dari 3 nomor terisi');
    await expect(pv2.getByTestId('catat-tbl-akhir')).toContainText('900');
    await pv2.getByTestId('catat-preview-close').click();
    // buka lagi: isian sementara & perlakuan terisi kembali
    await page.getByTestId('catat-akhir').click();
    await akhir.getByTestId('catat-pick').click();
    await akhir.getByTestId(`catat-pick-opt-${id}`).click();
    await expect(akhir.getByTestId('catat-akhir-berat-1')).toHaveValue('900');
    await expect(akhir.getByTestId('catat-tr-count-kopra-0')).toHaveValue('3');
    await expect(akhir.locator('[data-testid^="catat-tr-count-kopra-"]')).toHaveCount(2);
    await expect(akhir.getByTestId('catat-akhir-foto-1-img')).toBeVisible();
    for (const [no, b, t] of [[1, '900', '8'], [2, '1.140', '11,4'], [3, '600', '9']] as const) {
      await akhir.getByTestId(`catat-akhir-berat-${no}`).fill(b);
      await akhir.getByTestId(`catat-akhir-tebal-${no}`).fill(t);
    }
    await akhir.getByTestId('catat-akhir-confirm').click();
    await expect(page.getByTestId('catat-toast')).toBeVisible();
    const done = page.getByTestId('catat-done');
    await expect(done).toContainText('Yes!! akhirnya selesai.., yuk download/simpan hasil data nya.');
    await expect(done).toContainText('Success !');
    await expect(done.getByTestId('catat-done-close')).toBeVisible();
    await expect(page.getByTestId('catat-stat-akhir')).toContainText('1');
    await expect(done.getByTestId('catat-done-card')).toHaveClass(/alert-slide-in/);
    const order = await page.locator('[data-testid^="catat-card-PD-"]').evaluateAll((els) => els.map((e) => e.textContent ?? ''));
    expect(order[0]).toContain('Menunggu data akhir');
    expect(order[1]).toContain('Awal & akhir lengkap');
    await done.getByTestId('catat-done-view').click();

    // halaman hasil: 3 bagian + kesimpulan + unduh
    await expect(page).toHaveURL(new RegExp(`/lab/hasil\\?id=${id}`));
    const hasil = page.getByTestId('hasil-page');
    await expect(hasil).toContainText('Hasil pencatatan data awal dan akhir');
    await expect(hasil.getByTestId('catat-tbl-awal')).toContainText('1.000');
    await expect(hasil.getByTestId('catat-tbl-awal').getByRole('img', { name: 'Foto awal nomor 1' })).toBeVisible();
    await expect(hasil.getByTestId('catat-tbl-akhir').getByRole('img', { name: 'Foto akhir nomor 1' })).toBeVisible();
    await expect(hasil.getByTestId('catat-tbl-akhir')).toContainText('1.140');
    await expect(hasil.getByTestId('catat-formula-berat')).toContainText('berat awal − berat air − berat akhir');
    await expect(hasil.getByTestId('catat-tbl-cmp-berat')).toContainText('-30,4%');
    await expect(hasil.getByTestId('catat-tbl-cmp-tebal')).toContainText('Rata-rata');
    await expect(hasil.getByTestId('catat-conclusion')).toContainText('selisih rata-rata -210 g');
    await expect(hasil.getByTestId('catat-conclusion')).toContainText('Nomor 2, 3 belum dihitung karena berat air kosong');
    await expect(hasil.getByTestId('catat-tbl-treat')).toContainText('Oven Gas');
    await expect(hasil.getByTestId('catat-tbl-treat')).toContainText('CUKA 2 - GULA 75g');
    await expect(hasil.getByTestId('catat-tbl-treat')).toContainText('Oven Briket');
    for (const k of ['docx', 'pptx'] as const) {
      const d = page.waitForEvent('download');
      await hasil.getByTestId(`hasil-dl-${k}`).click();
      expect((await d).suggestedFilename()).toBe(`${id}-pencatatan-data.${k}`);
    }
    // foto di tabel hasil → pratinjau
    await hasil.getByRole('button', { name: 'Lihat Foto awal nomor 1' }).click();
    await expect(page.getByTestId('img-preview')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('img-preview')).toHaveCount(0);

    // revisi data akhir dari kartu yang sudah lengkap: form terisi data sebelumnya (DEC-083)
    await page.goto('/lab?t=bahan');
    await page.getByTestId(`catat-card-${id}`).click();
    await page.getByTestId('catat-revise').click();
    const rev = page.getByTestId('catat-akhir-modal');
    await expect(rev).toContainText(`Revisi data akhir · ${id}`);
    await expect(rev.getByTestId('catat-akhir-berat-3')).toHaveValue('600');
    await expect(rev.getByTestId('catat-tr-count-kopra-0')).toHaveValue('3');
    await expect(rev.getByTestId('catat-akhir-draft')).toHaveCount(0);
    await rev.getByTestId('catat-akhir-berat-3').fill('650');
    await rev.getByTestId('catat-akhir-confirm').click();
    await expect(page.getByTestId('catat-revised')).toContainText('Revisi data akhir');
    await page.getByTestId('catat-revised-close').click();
    await page.getByTestId(`catat-card-${id}`).click();
    await expect(page.getByTestId('catat-preview').getByTestId('catat-tbl-akhir')).toContainText('650');
    await page.getByTestId('catat-preview-close').click();

    // Pilih → pilih salah satu → hanya catatan lengkap → Hapus (permanen)
    await page.goto('/lab?t=bahan');
    await expect(page.locator('[data-testid^="catat-card-PD-"]')).toHaveCount(2);
    await page.getByTestId('catat-select').click();
    await expect(page.getByTestId('catat-select-menu')).not.toContainText('Hapus');
    await page.getByTestId('catat-select-one').click();
    const pendingId = (await page.locator('[data-testid^="catat-card-PD-"]').filter({ hasText: 'Menunggu data akhir' }).getAttribute('data-testid'))!.replace('catat-card-', '');
    await expect(page.getByTestId(`catat-check-${pendingId}`)).toBeDisabled();
    await page.getByTestId(`catat-card-${id}`).click();
    await expect(page.getByTestId(`catat-check-${id}`)).toBeChecked();
    await page.getByTestId('catat-select').click();
    await expect(page.getByTestId('catat-select-delete')).toContainText('Hapus (1)');
    await expect(page.getByTestId('catat-select-delete')).toContainText('tidak dapat dipulihkan');
    await page.getByTestId('catat-select-delete').click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('TIDAK dapat dipulihkan');
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('catat-deleted')).toContainText('1 catatan dihapus permanen.');
    await expect(page.getByTestId(`catat-card-${id}`)).toHaveCount(0);
    await expect(page.getByTestId(`catat-card-${pendingId}`)).toBeVisible();
    await expect(page.getByTestId('catat-stat-awal')).toContainText('1');
  });
  test('jalur produk bisa diisi manual → kode otomatis, nama tersimpan', async ({ page }) => {
    await page.goto('/lab?t=protokol');
    await page.getByTestId('proto-new').click();
    await page.getByTestId('proto-product').fill('Minyak Kelapa Murni');
    await expect(page.getByTestId('proto-product-code')).toContainText('Kode jalur: MK (isian manual)');
    await expect(page.getByTestId('proto-id')).toHaveText(/^MK-P\d{2}-v1$/);
    await page.getByTestId('proto-name').fill('VCO fermentasi E2E');
    await page.getByTestId('proto-save').click();
    await page.getByRole('button', { name: 'Tutup' }).click();
    await page.getByTestId('proto-ongoing').click();
    await expect(page.getByTestId('ongoing-list')).toContainText('Minyak Kelapa Murni');
  });
  test('hapus butuh ketik kode; kode salah tidak menghapus', async ({ page }) => {
    await page.goto('/lab?t=protokol');
    await page.getByTestId('proto-new').click();
    const key = (await page.getByTestId('proto-id').textContent())!.replace(/-v1$/, '');
    await page.getByTestId('proto-name').fill('Riset dihapus E2E');
    await page.getByTestId('proto-finish').click();
    await expect(page.getByTestId('proto-list')).toContainText('Riset dihapus E2E');
    await page.getByTestId(`proto-del-${key}`).click();
    await page.getByTestId('confirm-input').fill('SALAH');
    await expect(page.getByTestId('confirm-ok')).toBeDisabled();
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('proto-list')).toContainText('Riset dihapus E2E');
    await page.getByTestId(`proto-del-${key}`).click();
    await page.getByTestId('confirm-input').fill(key.toLowerCase());
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('Terhapus:');
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByText('Riset dihapus E2E')).toHaveCount(0);
  });
});

test.describe('Laporan belanja (LPJ)', () => {
  test('bukti alokasi: nama toko, foto nota, foto barang + nama → Simpan ▾ (Simpan saja / PPTX / Word / PDF)', async ({ page }) => {
    test.setTimeout(150_000);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await page.goto('/lab?t=belanja');
    await page.getByTestId('lpj-new').click();
    await page.getByTestId('lpj-purpose').fill('Belanja E2E');
    const p0 = page.getByTestId('lpj-proof-0');
    await expect(p0).toContainText('Nama toko 1 (judul)');
    await page.getByTestId('lpj-proof-title-0').fill('Toko Kimia Jaya');
    await page.getByTestId('lpj-nota-0').setInputFiles({ name: 'nota.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('lpj-barang-0').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }]);
    await expect(p0.locator('img')).toHaveCount(3);
    await page.getByTestId('lpj-barang-0-name-0').fill('Natrium bisulfit');
    await page.getByTestId('lpj-barang-0-name-1').fill('Kertas pH');
    // total & keterangan opsional (terlipat)
    await p0.getByText('Total & keterangan (opsional)').click();
    await page.getByTestId('lpj-proof-total-0').fill('427.000');
    await expect(p0).toContainText('Empat Ratus Dua Puluh Tujuh Ribu Rupiah');
    await page.getByTestId('lpj-proof-add').click();
    await page.getByTestId('lpj-proof-title-1').fill('Toko Plastik');
    await page.getByTestId('lpj-proof-1').getByText('Total & keterangan (opsional)').click();
    await page.getByTestId('lpj-proof-total-1').fill('73.000');
    await expect(page.getByTestId('lpj-form')).toContainText('Rp500.000');

    // Simpan ▾ → Simpan saja, lalu PPTX / Word / PDF
    await page.getByTestId('lpj-save').click();
    await expect(page.getByTestId('lpj-save-menu')).toContainText('PPTX');
    await page.getByTestId('lpj-save-only').click();
    await expect(page.getByTestId('lpj-form')).toContainText('Tersimpan');
    for (const k of ['pptx', 'docx', 'pdf'] as const) {
      await page.getByTestId('lpj-save').click();
      const dl = page.waitForEvent('download');
      await page.getByTestId(`lpj-save-${k}`).click();
      expect((await dl).suggestedFilename()).toMatch(new RegExp(`^LPJ-\\d{6}-\\d{2}-laporan-belanja\\.${k}$`));
    }
    await page.getByRole('button', { name: 'Tutup' }).click();
    const list = page.getByTestId('lpj-list');
    await expect(list).toContainText('Belanja E2E');
    await expect(list).toContainText('2 alokasi · total Rp500.000');
    // daftar: Unduh ▾
    const dlBtn = list.locator('[data-testid^="lpj-dl-"][aria-haspopup="menu"]').first();
    await dlBtn.click();
    const dl = page.waitForEvent('download');
    await list.locator('[data-testid$="-pptx"]').first().click();
    expect((await dl).suggestedFilename()).toMatch(/\.pptx$/);
  });
});

test.describe('GEMA RnD Lab — HP 360 px', () => {
  for (const t of ['ringkasan', 'eksperimen', 'bahan', 'protokol', 'belanja', 'library', 'standar']) {
    test(`@mobile /lab?t=${t} tanpa geser horizontal`, async ({ page }) => {
      await page.goto(`/lab?t=${t}`);
      await expect(page.getByTestId('lab-hero')).toBeVisible();
      if (t === 'eksperimen') await page.getByTestId('lab-new').click();
      if (t === 'protokol') await page.getByTestId('proto-new').click();
      if (t === 'belanja') await page.getByTestId('lpj-new').click();
      if (t === 'bahan') await page.getByTestId('catat-new').click();
      if (t === 'bahan') await page.getByTestId('catat-count').fill('3');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
