import { defineConfig, devices } from '@playwright/test';

/**
 * Config e2e minimale — un seul navigateur (Chromium) pour l'instant, cf.
 * docs/plans/plan-de-tests.md §3. Le webServer lance `ng serve` automatiquement ; le backend
 * réel (dasApi, http://localhost:5026) doit déjà tourner de son côté, rien ici ne le démarre.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // les tests partagent un compte Admin unique côté back — pas de course
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
