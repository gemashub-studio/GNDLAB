import { expect, test } from '@playwright/test';
import { idNum } from './helpers';

/** Fase F (ADR-009): formula R&D, produksi per shift, ceklis. Angka diverifikasi hitung tangan. */
test.describe('Formula R&D', () => {
  test('cuka: gula neraca massa (12,6 kg) vs rumus lama + titrasi NaOH 0,5 N', async ({ page }) => {
    await page.goto('/formula?p=cuka');
    // 100 L, ρ 1,02, 4,5 → 15 °Brix: 102 × 10,5 ÷ 85 = 12,6 kg
    await expect(page.getByTestId('cuka-sugar-value')).toHaveText('12,6');
    await expect(page.getByTestId('cuka-legacy')).toContainText('10,50 kg');
    await expect(page.getByTestId('cuka-legacy')).toContainText('13,41 °Brix');
    await expect(page.getByTestId('cuka-bom')).toContainText('Gula pasir');

    await page.getByTestId('wstep-asetat').click();
    await page.getByTestId('tit-v').fill('14');
    await page.getByTestId('tit-n').fill('0,5');
    await page.getByTestId('tit-vs').fill('5');
    await expect(page.getByTestId('tit-result')).toContainText('8,41%');
    await expect(page.getByTestId('tit-warning')).toBeVisible();
    // Rumus ringkas hanya untuk 0,1 N & 10 mL → peringatan hilang
    await page.getByTestId('tit-n').fill('0,1');
    await page.getByTestId('tit-vs').fill('10');
    await page.getByTestId('tit-v').fill('70');
    await expect(page.getByTestId('tit-result')).toContainText('4,20%');
    await expect(page.getByTestId('tit-warning')).toHaveCount(0);
  });

  test('cuka: Brix target di luar 14–17 → peringatan', async ({ page }) => {
    await page.goto('/formula?p=cuka');
    await page.getByTestId('cuka-brix1').fill('10');
    await expect(page.getByText('Kadar gula must di luar resep')).toBeVisible();
  });

  test('briket shisha: 100 kg arang → BOM & butir; hitung mundur dari target', async ({ page }) => {
    await page.goto('/formula?p=shisha');
    await expect(page.getByTestId('shisha-bom')).toContainText('Tepung tapioka');
    await expect(page.getByTestId('shisha-result')).toContainText('biji');
    const kg = idNum((await page.getByTestId('shisha-result-value').textContent()) ?? '');
    expect(kg).toBeGreaterThan(95);
    expect(kg).toBeLessThan(110);
    await page.getByTestId('shisha-basis-target').click();
    await page.getByTestId('shisha-amount').fill(String(kg).replace('.', ','));
    await expect(page.getByTestId('shisha-result-value')).toHaveText(/^100(,0)?$/);
    // Perekat berlebih → peringatan FAO
    await page.getByTestId('shisha-binder').fill('12');
    await expect(page.getByText('Perekatnya kebanyakan')).toBeVisible();
  });

  test('briket BBQ: tebal pillow belum diisi → jumlah biji menunggu; uji mutu lolos/gagal', async ({ page }) => {
    await page.goto('/formula?p=bbq');
    await expect(page.getByTestId('bbq-result')).toContainText('Isi ukuran');
    await page.getByTestId('wstep-cetak').click();
    await page.getByTestId('bbq-thick').fill('30');
    await expect(page.getByTestId('bbq-result')).toContainText('biji');
    await page.getByTestId('wstep-uji').click();
    await page.getByTestId('bbq-lab-moisture_max_pct').fill('9');
    await expect(page.getByTestId('bbq-status-moisture_max_pct')).toHaveText('GAGAL');
    await page.getByTestId('bbq-lab-moisture_max_pct').fill('6');
    await expect(page.getByTestId('bbq-status-moisture_max_pct')).toHaveText('LOLOS');
  });

  test('kopra: desain Tracker (30/24) & temuan cadangan Ronde 1 40 kg', async ({ page }) => {
    await page.goto('/formula?p=kopra');
    await expect(page.getByTestId('kopra-design-value')).toHaveText('30 / 24');
    await page.getByTestId('kopra-kg').fill('40');
    await page.getByTestId('kopra-perrep').fill('5');
    await expect(page.getByTestId('kopra-design-value')).toHaveText('61 / 60');
    await expect(page.getByTestId('kopra-design')).toContainText('Cadangan cuma 1 butir');
    await page.getByTestId('wstep-grade').click();
    await page.getByTestId('kopra-mcavg').fill('5,5');
    await expect(page.getByTestId('kopra-grade')).toContainText('Edible');
  });

  test('arang: rendemen KORA 20% → peringatan; mati hampa ≥8 jam di rencana', async ({ page }) => {
    await page.goto('/formula?p=arang');
    await expect(page.getByTestId('arang-bom')).toContainText('mati hampa');
    await page.getByTestId('arang-y-kora').click();
    await expect(page.getByText('Rendemen di bawah acuan', { exact: true })).toBeVisible();
    await expect(page.getByTestId('arang-result-value')).toHaveText('200'); // 1.000 kg × 20%
  });
});

test.describe('Metode R&D cuka & bioleather (formula v1.1.0)', () => {
  test('cuka: 5 metode; 100 L statis = 200 L / 3 bulan; tanpa gula gagal 4%; generator 32 jam', async ({ page }) => {
    await page.goto('/formula?p=cuka');
    await expect(page.getByTestId('cm-table')).toBeVisible();
    await page.getByTestId('cm-volume').fill('100');
    await expect(page.getByTestId('cm-liters-statis')).toHaveText('200');
    await expect(page.getByTestId('cm-acid-statis')).toContainText('✓');
    await expect(page.getByTestId('cm-acid-alami')).toContainText('✗');
    await page.getByTestId('cm-pick-generator').click();
    await expect(page.getByTestId('cm-steps')).toContainText('32 jam');
    await page.getByTestId('cm-pick-alami').click();
    await expect(page.getByText('Cukanya bisa kurang asam')).toBeVisible();
  });

  test('bioleather: resep C 3 L → 1.000 mL gliserin + 2.000 mL etanol; kopi & finishing dihitung', async ({ page }) => {
    await page.goto('/formula?p=bioleather');
    await expect(page.getByTestId('bl-culture-berkala')).toContainText('19,0 g/L/hari');
    await page.getByTestId('bl-plast-C').click();
    await page.getByTestId('bl-bath').fill('3');
    await expect(page.getByTestId('bl-plast-bom')).toContainText('1.000 mL');
    await expect(page.getByTestId('bl-plast-bom')).toContainText('2.000 mL');
    await page.getByTestId('bl-dye-kopi').click();
    await expect(page.getByTestId('bl-dye-bom')).toContainText('Bubuk kopi');
    await page.getByTestId('bl-coverage').fill('40');
    await expect(page.getByTestId('bl-fin-bom')).toContainText('Lilin karnauba');
  });

  test('tautan ceklis dari kalkulator membuka ceklis R&D yang tepat', async ({ page }) => {
    await page.goto('/formula?p=cuka');
    await page.getByTestId('cm-checklist').click();
    await expect(page).toHaveURL(/ceklis\?id=rnd-cuka-metode/);
    await expect(page.getByText('Uji banding metode cuka', { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId('checklist-status')).toHaveAttribute('data-status', 'incomplete');
  });
});

test.describe('Produksi per shift', () => {
  test('kopra + oven listrik: oven jadi pembatas (1 angkatan/hari pada 1 shift)', async ({ page }) => {
    await page.goto('/produksi');
    await expect(page.getByTestId('bottleneck')).toContainText(/Oven/i);
    await page.getByTestId('shift-target').fill('300');
    await expect(page.getByTestId('need-oven')).toContainText('unit');
  });

  test('briket: press & oven wajib diisi, lalu hasil muncul', async ({ page }) => {
    await page.goto('/produksi');
    await page.getByTestId('line-briket').click();
    await expect(page.getByTestId('station-press')).toContainText('Isi kapasitas mesin cetak');
    await page.getByTestId('rate-press').fill('200');
    await page.getByTestId('batch-oven_briket').fill('500');
    await expect(page.getByTestId('shift-output')).toBeVisible();
    await expect(page.getByText('Belum lengkap')).toHaveCount(0);
  });
});

test.describe('Ceklis', () => {
  test('QC: item kritis TIDAK → gagal; semua OK → lolos; tersimpan di riwayat', async ({ page }) => {
    await page.goto('/ceklis');
    await page.getByTestId('open-qc-cka').click();
    const status = page.getByTestId('checklist-status');
    await expect(status).toHaveAttribute('data-status', 'incomplete');
    await page.getByTestId('ng-0').click();
    await expect(status).toHaveAttribute('data-status', 'fail');
    const n = await page.locator('[data-testid^="item-"]').count();
    for (let i = 0; i < n; i++) await page.getByTestId(`ok-${i}`).click();
    await expect(status).toHaveAttribute('data-status', 'pass');
    await page.getByTestId('fill-lot').fill('CKA-2610-001');
    await page.getByTestId('fill-save').click();
    await expect(page.getByTestId('fill-msg')).toContainText('Tersimpan');
    await page.getByRole('button', { name: '← Daftar ceklis' }).click();
    await expect(page.getByTestId('checklist-history')).toContainText('CKA-2610-001');
  });

  test('filter jenis & produk', async ({ page }) => {
    await page.goto('/ceklis');
    await page.getByTestId('ctype-product').click();
    await page.getByTestId('cprod-briket').click();
    const list = page.getByTestId('checklist-list');
    await expect(list).toContainText('Briket shisha');
    await expect(list).not.toContainText('Kopra Edible');
  });
});

test.describe('HP 360 px', () => {
  for (const path of ['/formula?p=cuka', '/formula?p=bioleather', '/formula?p=shisha', '/produksi', '/ceklis']) {
    test(`@mobile ${path} tanpa geser horizontal`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('Audit kalkulator 2026-10-11 (DEC-048/049)', () => {
  test('kopra: tahap sulfur tanpa dosis; cuka: label jenis angka & simpan sebagai versi protokol; bioleather: basis gliserol', async ({ page }) => {
    await page.goto('/formula?p=kopra');
    await page.getByTestId('wstep-belerang').click();
    await expect(page.getByTestId('kopra-sulfur-off')).toContainText('Tidak ada hitungan dosis');
    await expect(page.getByTestId('sulfur-status')).toHaveText('DOSIS BELUM DITETAPKAN');

    await page.goto('/formula?p=cuka');
    const ev = page.getByTestId('cuka-evidence');
    await expect(ev.locator('[data-evidence=teoritis]')).toBeVisible();
    await expect(ev.locator('[data-evidence=input]')).toBeVisible();
    await page.getByTestId('cuka-proto-open').click();
    await page.getByTestId('cuka-proto-save').click();
    await expect(page.getByTestId('cuka-proto-msg')).toContainText(/CK-P\d{2}-v1/);
    await page.goto('/lab?t=protokol');
    await expect(page.getByTestId('proto-list')).toContainText('Cuka air kelapa');

    await page.goto('/formula?p=bioleather');
    await expect(page.getByTestId('blt-glycerol-basis')).toContainText('belum terverifikasi');
    await expect(page.getByTestId('blt-bom')).toContainText('mL atau');
  });
});
