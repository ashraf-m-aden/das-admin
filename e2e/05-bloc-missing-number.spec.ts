import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * Parcours 5 (plan-de-tests.md §3) : un bloc sans `number` (antérieur au 2026-08-18, jamais
 * repris) ne doit jamais pouvoir être renommé -- ni depuis `/addressing/block-naming`, ni depuis
 * la fiche bloc (`/blocks/{id}`). Même garde-fou, deux écrans, testé aux deux endroits.
 */
test('un bloc sans numéro affiche le message de garde-fou sur block-naming', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/addressing/block-naming');

  const hint = page.locator('.item .naming__hint').first();
  const found = await hint.isVisible({ timeout: 15_000 }).catch(() => false);
  test.skip(!found, 'Aucun bloc sans numéro dans les données de dev actuelles.');

  await expect(hint).toContainText(/numéro/i);
  // Le formulaire de renommage direct ne doit pas apparaître à côté du message.
  const parentItem = page.locator('.item', { has: hint });
  await expect(parentItem.locator('.direct')).toHaveCount(0);
});

test('un bloc sans numéro affiche le même garde-fou sur la fiche bloc', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/blocks');

  const rowWithoutNumber = page.locator('.tbl__row', { has: page.locator('.tbl__muted', { hasText: '—' }) }).first();
  const found = await rowWithoutNumber.isVisible({ timeout: 15_000 }).catch(() => false);
  test.skip(!found, 'Tous les blocs de la base de dev actuelle ont déjà un numéro.');

  await rowWithoutNumber.click();
  await expect(page).toHaveURL(/\/blocks\/.+/);
  await expect(page.locator('.fiche__hint')).toContainText(/numéro/i);
});
