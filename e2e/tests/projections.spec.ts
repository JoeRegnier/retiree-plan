/**
 * Projections Page — Regression Tests
 * Validates scenario selection, cash-flow projection execution,
 * chart tabs, and Monte Carlo run.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Projections Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/projections');
  });

  test('page header is visible', async ({ page }) => {
    await expect(page.getByText('Cash-Flow Projections')).toBeVisible({ timeout: 10_000 });
  });

  test('scenario dropdown is populated with seeded scenarios', async ({ page }) => {
    const select = page.getByLabel('Scenario');
    await expect(select).toBeVisible({ timeout: 10_000 });

    // Open and check options
    await select.click();
    await expect(page.getByRole('option', { name: 'Base Case' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Early Retirement' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Conservative' })).toBeVisible();
    // Close
    await page.keyboard.press('Escape');
  });

  test('can run a cash-flow projection and see results', async ({ page }) => {
    // Select Base Case
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();

    await page.getByRole('button', { name: /run projection/i }).click();

    // Wait for result — Peak Net Worth chip should appear
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });
  });

  test('cash-flow chart tab renders after projection', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    // Tab 0 (Cash Flow Chart) should already be active — verify SVG renders
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 10_000 });
  });

  test('waterfall tab renders after projection', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /waterfall/i }).click();
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 8_000 });
  });

  test('year-by-year table tab shows rows', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /table/i }).click();
    // Should have at least one data row
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8_000 });
  });

  test('Monte Carlo run shows success rate chip', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();

    // Run cash-flow first (MC button is disabled until projection is run)
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /run monte carlo/i }).click();
    await expect(page.getByText(/mc success rate/i)).toBeVisible({ timeout: 30_000 });
  });
});
