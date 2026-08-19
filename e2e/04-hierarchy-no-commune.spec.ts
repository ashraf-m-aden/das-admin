import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * Parcours 4 (plan-de-tests.md §3) : régression sur le fix hiérarchie de cette session. Avant
 * correction, le select Quartier était verrouillé sur `zoneId` -- pour une ville sans commune
 * (toutes sauf Djibouti-ville), il restait bloqué en permanence. Ali Sabieh est l'exemple cité
 * dans la doc backend (`dasApi/CLAUDE.md`) comme ville sans commune.
 */
test('une ville sans commune (Ali Sabieh) laisse le select Quartier utilisable', async ({ page }) => {
  await loginAsAdmin(page);

  const selects = page.locator('das-hierarchy-cascade select.cascade__select');
  const citySelect = selects.nth(0);
  const quartierSelect = selects.nth(3);

  await expect(quartierSelect).toBeDisabled(); // état initial : aucune ville choisie

  const options = await citySelect.locator('option').allTextContents();
  const hasAliSabieh = options.some((o) => /ali sabieh/i.test(o));
  test.skip(!hasAliSabieh, 'Ali Sabieh absente des données de dev actuelles.');

  await citySelect.selectOption({ label: options.find((o) => /ali sabieh/i.test(o))! });

  // Le coeur du fix : le select Quartier se débloque sur cityId seul, pas sur zoneId.
  await expect(quartierSelect).toBeEnabled({ timeout: 10_000 });
});
