import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * Parcours 3 (plan-de-tests.md §3) : la file de validation unifiée (`/verification`) compose
 * trois sources réelles (surveys soumis + suggestions bloc + suggestions rue) en une seule
 * liste. Ce test vérifie que valider un relevé le retire bien de la file.
 */
test('valide un relevé soumis et le voit disparaître de la file', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/verification');

  const propertyTab = page.locator('.tab', { hasText: /propriété|property/i });
  if (await propertyTab.isVisible().catch(() => false)) await propertyTab.click();

  const firstCard = page.locator('.card').first();
  const hasItems = await firstCard.isVisible({ timeout: 15_000 }).catch(() => false);
  test.skip(!hasItems, 'Aucun relevé en attente dans la base de dev actuelle — rien à valider.');

  const countBefore = await page.locator('.card').count();

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/surveys/') && res.url().includes('/validate'),
  );
  await firstCard.locator('.actions .btn--approve').click();
  const response = await responsePromise;
  expect(response.status()).toBeLessThan(300);

  await expect(page.locator('.card')).toHaveCount(countBefore - 1, { timeout: 10_000 });
});

test('rejette une suggestion de nom de bloc avec un motif', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/verification');

  const blockTab = page.locator('.tab', { hasText: /bloc|block/i });
  await blockTab.click();

  const firstCard = page.locator('.card').first();
  const hasItems = await firstCard.isVisible({ timeout: 10_000 }).catch(() => false);
  test.skip(!hasItems, 'Aucune suggestion de bloc en attente dans la base de dev actuelle.');

  await firstCard.locator('.actions .btn--reject').click();
  await firstCard.locator('.reject input[formcontrolname="reason"]').fill('Nom illisible sur la photo');

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/blocs/suggestions/') && res.url().includes('/reject'),
  );
  await firstCard.locator('.reject .btn--reject').click();
  const response = await responsePromise;
  expect(response.status()).toBeLessThan(300);
});
