import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * Parcours 1 (plan-de-tests.md §3) : login -> liste adresses -> filtre hiérarchique ->
 * tiroir détail. Le parcours qui traverse le plus de couches (auth, store, HTTP réel, carte).
 */
test.describe('Login puis navigation Adresse', () => {
  test('se connecte et affiche la liste des adresses', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.locator('.kpis')).toBeVisible();
    await expect(page.locator('.kpi__value').first()).not.toHaveText('');

    // Jamais coincé en chargement : au bout d'un moment, une ligne ou le message vide apparaît.
    await expect(page.locator('.trow, .table-empty')).toBeVisible({ timeout: 15_000 });
  });

  test('filtre par ville puis ouvre le tiroir détail', async ({ page }) => {
    await loginAsAdmin(page);

    const citySelect = page.locator('das-hierarchy-cascade select').first();
    await citySelect.selectOption({ index: 1 }); // première ville réelle, quelle qu'elle soit

    await expect(page.locator('.trow, .table-empty')).toBeVisible({ timeout: 15_000 });

    const firstRow = page.locator('.trow').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page.locator('das-address-detail-drawer')).toBeVisible();
      await expect(page.locator('.drawer__eyebrow')).not.toHaveText('');
    }
  });
});
