/**
 * Navigation & Dashboard — Regression Tests
 * Tests that the sidebar navigation works and the dashboard renders
 * key data for the seeded test account.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser, HOUSEHOLD_NAME, MEMBER_A, MEMBER_B } from '../helpers/auth';

test.describe('Navigation & Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('dashboard loads and shows household name', async ({ page }) => {
    await expect(page).toHaveURL('/');
    // Household name or member name should appear somewhere on the dashboard
    await expect(page.getByText(HOUSEHOLD_NAME).first()).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar navigation links are all visible', async ({ page }) => {
    const nav = page.getByRole('navigation');
    for (const label of [
      'Dashboard', 'Household', 'Accounts', 'Milestones', 'Scenarios',
      'Projections', 'Simulations', 'Tax Analytics', 'Estate',
      'Compare', 'Integrations', 'Settings',
    ]) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });

  test('navigates to each main page without errors', async ({ page }) => {
    const routes: Array<[string, string]> = [
      ['Household',     '/household'],
      ['Accounts',      '/accounts'],
      ['Milestones',    '/milestones'],
      ['Scenarios',     '/scenarios'],
      ['Projections',   '/projections'],
      ['Simulations',   '/simulations'],
      ['Tax Analytics', '/tax-analytics'],
      ['Estate',        '/estate'],
      ['Settings',      '/settings'],
    ];

    for (const [label, path] of routes) {
      await page.getByRole('navigation').getByText(label).first().click();
      await page.waitForURL(path, { timeout: 10_000 });
      // No crash-level error overlay
      await expect(page.locator('[data-testid="error-boundary"]')).not.toBeVisible();
    }
  });

  test('user menu shows email and sign-out option', async ({ page }) => {
    await page.getByRole('button', { name: /user account/i }).click();
    await expect(page.getByText('test@retireeplan.dev')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
    // dismiss
    await page.keyboard.press('Escape');
  });

  test('logout redirects to login page', async ({ page }) => {
    await page.getByRole('button', { name: /user account/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await page.waitForURL('/login', { timeout: 8_000 });
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });

  test('unauthenticated access redirects to login', async ({ page: freshPage }) => {
    await freshPage.goto('/accounts');
    await freshPage.waitForURL('/login', { timeout: 8_000 });
  });
});
