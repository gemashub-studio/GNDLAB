import { expect, type Page } from '@playwright/test';
import type { ScenarioState } from '../src/lib/scenario';

/** Sama dengan encodeState di aplikasi (JSON → base64url); ditulis ulang agar E2E tak memuat engine. */
const encodeState = (s: ScenarioState) =>
  Buffer.from(JSON.stringify(s), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const PATH = { CONTAINER: '/muat', WAREHOUSE: '/gudang', CONVERT: '/konversi' } as const;

/** Buka kalkulator langsung pada state tertentu (sama dengan tautan "Bagikan"). */
export async function openState(page: Page, s: ScenarioState) {
  await page.goto(`${PATH[s.kind]}?s=${encodeState(s)}`);
}

/** Ambil angka dari teks gaya Indonesia ("22.229" → 22229, "12,62" → 12.62). */
export const idNum = (t: string) => Number(t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));

export async function primary(page: Page): Promise<number> {
  const el = page.getByTestId('primary-value');
  await expect(el).toBeVisible();
  return idNum((await el.textContent()) ?? '');
}

export const near = (actual: number, expected: number, tol = 0.005) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(tol);
