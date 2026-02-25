/**
 * Shared auth helpers for regression tests against the seeded test account.
 *
 * Test account credentials:
 *   Email:    test@retireeplan.dev
 *   Password: TestPassword123!
 */
import type { Page } from '@playwright/test';

export const TEST_EMAIL    = 'test@retireeplan.dev';
export const TEST_PASSWORD = 'TestPassword123!';
export const TEST_NAME     = 'David Smith';
export const HOUSEHOLD_NAME = 'Smith Family';
export const MEMBER_A      = 'David Smith';
export const MEMBER_B      = 'Sarah Smith';

/**
 * Log in as the test account.
 * Waits until the dashboard URL is reached before returning.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  // Inject rp_onboarded before any page script runs so the OnboardingWizard
  // never auto-opens during tests (it checks this key on mount).
  await page.addInitScript(() => {
    localStorage.setItem('rp_onboarded', 'true');
  });

  await page.goto('/');
  // Make sure we're on the login page (unauthenticated redirect)
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 15_000 });
}

/**
 * Log out the currently-authenticated user.
 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /user account/i }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await page.waitForURL('/login', { timeout: 8_000 });
}

/**
 * Navigate to a page via the sidebar link and wait for the URL to match.
 */
export async function navTo(page: Page, label: string, path: string): Promise<void> {
  await page.getByRole('navigation').getByText(label).click();
  await page.waitForURL(path, { timeout: 10_000 });
}
