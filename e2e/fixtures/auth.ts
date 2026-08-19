import { Page, expect } from '@playwright/test';

/**
 * Identifiants du seed dev (dasApi/src/DASApi.WebApi/appsettings.Development.json,
 * `Seed:AdminUsername`/`Seed:AdminPassword`) — valables uniquement en local, jamais en
 * environnement réel (le back le rappelle explicitement).
 */
export const ADMIN_CREDENTIALS = { username: 'admin', password: 'ChangeMe123!' };

/** Connexion réelle via le formulaire — pas de contournement JWT direct, pour couvrir le flux entier. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[formcontrolname="username"]').fill(ADMIN_CREDENTIALS.username);
  await page.locator('input[formcontrolname="password"]').fill(ADMIN_CREDENTIALS.password);
  await page.locator('button.login__submit').click();
  await expect(page).toHaveURL(/\/adresse/, { timeout: 15_000 });
}
