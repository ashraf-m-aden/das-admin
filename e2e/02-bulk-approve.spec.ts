import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * Parcours 2 (plan-de-tests.md §3) : sélection multiple -> Approuver -> vérifier le changement
 * d'étape. Couvre le piège de casse `stage` : le back exige `"Approved"`/`"Published"` en
 * PascalCase sur `PATCH /bulk` — un `400` ici est le seul signal qui verrait vraiment une
 * régression si quelqu'un repasse `stage` en minuscules.
 */
test('sélectionne une adresse et l\'approuve en masse', async ({ page }) => {
  await loginAsAdmin(page);

  const firstCheckbox = page.locator('.trow .col-check input[type="checkbox"]').first();
  await expect(firstCheckbox).toBeVisible({ timeout: 15_000 });
  await firstCheckbox.click();

  const bulkBar = page.locator('.bulk');
  await expect(bulkBar).toBeVisible();

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/adresses/bulk') && res.request().method() === 'PATCH',
  );
  await page.locator('.bulk__btn').first().click(); // "Approuver" = premier bouton bulk dans le DOM

  const response = await responsePromise;
  expect(response.status(), 'PATCH /bulk doit répondre 2xx — un 400 signale une casse de stage incorrecte').toBeLessThan(300);

  const requestBody = response.request().postDataJSON() as { stage?: string };
  expect(requestBody.stage, 'stage doit être PascalCase, jamais "approved" en minuscules').toBe('Approved');
});
