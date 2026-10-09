/**
 * E2E alur penuh M4 / US-08 (database TEST, lihat playwright.calib.config.ts):
 * editor impor CSV 10 sampel → usulan otomatis → data_admin setujui di /kalibrasi → versi patch baru aktif
 * → skenario BARU memakai nilai baru, skenario LAMA tetap sama.
 * Bisa diulang tanpa reset: memakai versi aktif apa pun sebagai titik awal.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const BASE = 'http://localhost:3100';
const KEY = { commodityId: 'kelapa_jambul', formCode: 'loose', key: 'bulk_density' } as const;
const STATE = { kind: 'CONTAINER', commodityId: 'kelapa_jambul', formCode: 'loose', containerId: '20GP', mode: 'PIECE' } as const;

type Role = 'editor' | 'data_admin';
const prisma = new PrismaClient();
const users: Partial<Record<Role, { id: string; email: string; cookie: string }>> = {};

async function mkUser(role: Role) {
  const email = `e2e-${role}-${randomUUID().slice(0, 8)}@gemas.test`;
  const u = await prisma.app_user.create({ data: { email, role } });
  const token = await encode({ token: { sub: u.id, email, role }, secret: process.env.NEXTAUTH_SECRET! });
  return { id: u.id, email, cookie: token };
}

async function as(browser: Browser, role: Role) {
  const ctx = await browser.newContext({ baseURL: BASE });
  await ctx.addCookies([{ name: 'next-auth.session-token', value: users[role]!.cookie, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
  return ctx;
}

async function activeParam(req: APIRequestContext) {
  const r = await req.get('/api/v1/commodities');
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  type P = { key: string; min: number; typ: number; max: number; confidence: string };
  const form = j.commodities.find((c: { id: string }) => c.id === KEY.commodityId).forms.find((f: { code: string }) => f.code === KEY.formCode);
  return { version: j.version as string, p: (form.params as P[]).find((x) => x.key === KEY.key)! };
}

const bump = (v: string) => v.replace(/(\d+)$/, (n) => String(Number(n) + 1));

test.beforeAll(async () => {
  users.editor = await mkUser('editor');
  users.data_admin = await mkUser('data_admin');
});
test.afterAll(async () => prisma.$disconnect());

test('sampling CSV → usulan → approval → versi baru; skenario lama tetap', async ({ browser }) => {
  test.setTimeout(300_000); // dev server meng-compile tiap rute pertama kali
  const editor = await as(browser, 'editor');
  const before = await activeParam(editor.request);

  // Skenario A disimpan dengan versi sebelum kalibrasi.
  const a = await editor.request.post('/api/v1/scenarios', { data: { name: 'E2E sebelum', state: STATE } });
  expect(a.status()).toBe(201);
  const aId = (await a.json()).id as string;
  const aPieces = (await (await editor.request.get(`/api/v1/scenarios/${aId}`)).json()).result.typ.pieces as number;

  // 10 sampel di sekitar 102% nilai biasa (tetap di dalam rentang realistis) → median = target.
  const target = Math.round(before.p.typ * 1.02);
  const values = [-4, -3, -2, -1, 0, 0, 1, 2, 3, 4].map((d) => target + d);
  const csv = [
    'measured_at,location,lot_ref,commodity_code,form_code,parameter_key,value,unit,method,officer,note',
    ...values.map((v, i) => `2026-10-20T08:${String(i).padStart(2, '0')}:00+07:00,Gudang E2E,LOT-E2E,${KEY.commodityId},${KEY.formCode},${KEY.key},${v},kg_m3,ember_1m3,Petugas E2E,`),
  ].join('\n');

  const page = await editor.newPage();
  await page.goto('/sampling');
  await expect(page.getByTestId('prio-ASM-06')).toBeVisible();
  await page.getByRole('tab', { name: 'Impor CSV' }).click();
  await page.getByTestId('csv-file').setInputFiles({ name: 'sampel.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByTestId('csv-summary')).toContainText('10 baris siap · 0 baris salah');
  await page.getByTestId('csv-submit').click();
  await expect(page.getByTestId('flash')).toContainText('10 sampel tersimpan', { timeout: 90_000 });
  await expect(page.getByTestId('flash')).toContainText(/Usulan kalibrasi (baru|diperbarui)/);
  await expect(page.locator(`[data-key="${KEY.commodityId}|${KEY.formCode}|${KEY.key}"]`)).toContainText('Usulan menunggu');

  // Editor tidak bisa menyetujui.
  await page.goto('/kalibrasi');
  await expect(page.getByTestId('proposal').first()).toBeVisible();
  await expect(page.getByTestId('approve')).toHaveCount(0);

  // data_admin menyetujui.
  const admin = await as(browser, 'data_admin');
  const ap = await admin.newPage();
  await ap.goto('/kalibrasi');
  const card = ap.locator('[data-testid="proposal"][data-status="PENDING"]', { hasText: 'Lepas / curah' }).filter({ hasText: 'Densitas curah' });
  await expect(card).toHaveCount(1);
  await card.getByTestId('approve').click();
  await card.getByTestId('confirm').click();
  const newVersion = bump(before.version);
  await expect(ap.getByTestId('review-msg')).toContainText(`v${newVersion} terbit`, { timeout: 90_000 });

  // Versi baru aktif dengan nilai kalibrasi (keyakinan A).
  const after = await activeParam(editor.request);
  expect(after.version).toBe(newVersion);
  expect(after.p.confidence).toBe('A');
  expect(after.p.typ).toBeGreaterThan(before.p.typ);

  // Skenario B memakai nilai baru; skenario A tetap.
  const b = await editor.request.post('/api/v1/scenarios', { data: { name: 'E2E sesudah', state: STATE } });
  const bId = (await b.json()).id as string;
  const bJson = await (await editor.request.get(`/api/v1/scenarios/${bId}`)).json();
  expect(bJson.datasetVersion).toBe(newVersion);
  expect(bJson.result.typ.pieces).toBeGreaterThan(aPieces);
  const aAgain = await (await editor.request.get(`/api/v1/scenarios/${aId}`)).json();
  expect(aAgain.datasetVersion).toBe(before.version);
  expect(aAgain.result.typ.pieces).toBe(aPieces);

  // Badge versi di shell ikut berganti.
  await page.goto('/muat', { timeout: 120_000 });
  await expect(page.getByText(`v${newVersion}`).first()).toBeVisible();
});

test('realisasi muat: selisih vs prediksi tampil', async ({ browser }) => {
  const editor = await as(browser, 'editor');
  const page = await editor.newPage();
  await page.goto('/sampling');
  await page.getByRole('tab', { name: 'Realisasi muat' }).click();
  await page.getByTestId('r-form').selectOption('kelapa_jambul|bagged');
  await page.getByTestId('r-container').selectOption('20GP');
  await page.getByTestId('r-pieces').fill('22500');
  await expect(page.getByTestId('r-result')).toBeVisible();
  await expect(page.getByTestId('r-gap')).toHaveAttribute('data-within', /true|false/);
  await expect(page.getByTestId('r-save')).toBeVisible();
});
