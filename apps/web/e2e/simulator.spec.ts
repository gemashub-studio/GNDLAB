import { expect, test, type Page } from '@playwright/test';
import type { ScenarioState } from '../src/lib/scenario';
import { idNum, openState, primary } from './helpers';

const enc = (s: ScenarioState) =>
  Buffer.from(JSON.stringify(s), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function simPrimary(page: Page, s: ScenarioState) {
  await page.goto(`/simulator?s=${enc(s)}`);
  const el = page.getByTestId('sim-primary');
  await expect(el).toBeVisible();
  return idNum((await el.textContent()) ?? '');
}

/** Golden kemasan (calc_spec §7): simulator HARUS sama dengan kartu hasil kalkulator. */
const GOLDEN_PACKS: ScenarioState[] = [
  { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '20GP', mode: 'PACKAGE' },
  { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '20GP', mode: 'PACKAGE' },
  { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'lumps', containerId: '40HC', mode: 'PACKAGE' },
  { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', containerId: '20GP', mode: 'PACKAGE' },
  { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', containerId: '40HC', mode: 'PACKAGE' },
];

test.describe('Simulator (M3)', () => {
  for (const s of GOLDEN_PACKS) {
    const name = `${s.commodityId} ${s.kind === 'CONTAINER' ? s.containerId : ''}`;
    test(`angka simulator == kartu hasil · ${name}`, async ({ page }) => {
      await openState(page, s);
      const card = await primary(page);
      const sim = await simPrimary(page, s);
      expect(sim).toBe(card);
      await expect(page.getByTestId('plan-2d')).toBeVisible();
      await expect(page.getByTestId('grid-label')).toContainText('representasi grid, bukan posisi fisik eksak');
      // Slider isi 100% = semua karung hasil engine.
      await expect(page.locator('label[for="fill"]')).toContainText(`${new Intl.NumberFormat('id-ID').format(card)} / ${new Intl.NumberFormat('id-ID').format(card)}`);
    });
  }

  test('slider isi % & tombol buka simulator dari kalkulator', async ({ page }) => {
    await openState(page, GOLDEN_PACKS[0]!);
    await page.getByTestId('open-sim').click();
    await expect(page).toHaveURL(/\/simulator\?s=/);
    await expect(page.getByTestId('plan-2d')).toBeVisible();
    // Geser slider pakai keyboard (fill() pada range tidak memicu onChange React).
    const slider = page.getByTestId('fill-slider');
    // Mode dev bisa full-reload sekali saat rute selesai dikompilasi → ulangi sampai stabil.
    await expect(async () => {
      await slider.focus();
      await slider.press('Home');
      for (let i = 0; i < 50; i++) await slider.press('ArrowRight');
      await expect(page.locator('label[for="fill"]')).toContainText('Isi 50% · 462 / 924', { timeout: 2000 });
    }).toPass({ timeout: 90_000 });
  });

  test('3D: satu InstancedMesh untuk ≥1.200 karung, fps terukur', async ({ page }) => {
    const s: ScenarioState = { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'bagged', containerId: '40HC', mode: 'PACKAGE' };
    const n = await simPrimary(page, s);
    expect(n).toBeGreaterThanOrEqual(1200);
    await page.getByTestId('view-3d').click();
    await expect(page.getByTestId('sim-3d').locator('canvas')).toBeVisible();
    await page.waitForFunction(() => (window.__gemasSim3d?.frames ?? 0) > 60, null, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    const probe = await page.evaluate(() => window.__gemasSim3d!);
    console.log(`[fps] ${n} karung → ${probe.fps.toFixed(1)} fps (instances ${probe.instances})`);
    expect(probe.instances).toBe(n);
    await page.getByTestId('sim-3d').screenshot({ path: 'test-results/simulator-3d.png' });
    // Spesifikasi M3: ≥ 30 fps untuk 1.200 karung (terukur ±48 fps headless untuk 1.892 karung).
    expect(probe.fps).toBeGreaterThanOrEqual(30);
  });

  test('gudang: denah zona berisi tumpukan sesuai hasil engine', async ({ page }) => {
    const s: ScenarioState = {
      kind: 'WAREHOUSE', commodityId: 'kopra_edible', formCode: 'bagged', stock: { massKg: 10000 }, usePackaging: true,
      stackHeightM: 1.8, floorUtil: 0.65, zone: { lengthM: 20, widthM: 10 },
    };
    await openState(page, s);
    await simPrimary(page, s);
    const stacks = idNum((await page.getByTestId('sim-stacks').textContent()) ?? '');
    expect(stacks).toBe(40);
    await expect(page.getByTestId('plan-warehouse').locator('svg rect[fill="#63E6CF"]')).toHaveCount(40);
    await page.getByTestId('plan-warehouse').screenshot({ path: 'test-results/simulator-gudang.png' });
  });

  test('arang belah 2 bersarang: kolom', async ({ page }) => {
    await simPrimary(page, { kind: 'CONTAINER', commodityId: 'arang_batok_belah2', formCode: 'halves_nested', containerId: '20GP', mode: 'PIECE' });
    await expect(page.getByTestId('plan-nested')).toBeVisible();
  });

  test('curah: tampak samping dengan tinggi isi', async ({ page }) => {
    await simPrimary(page, { kind: 'CONTAINER', commodityId: 'kopra_asalan', formCode: 'bagged_jute', containerId: '20GP', mode: 'BULK' });
    await expect(page.getByTestId('plan-2d-bulk')).toBeVisible();
    await page.getByTestId('plan-2d').or(page.getByTestId('plan-2d-bulk')).first().screenshot({ path: 'test-results/simulator-curah.png' });
  });
});
