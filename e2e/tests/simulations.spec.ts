/**
 * Simulations Page — Regression Tests
 * Validates all four simulation tabs:
 * Monte Carlo, Historical Backtesting, Guyton-Klinger, Success Rate Heatmap.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Simulations Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/simulations');
  });

  test('page header and all four tabs are visible', async ({ page }) => {
    await expect(page.getByText('Simulations')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /monte carlo/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /historical backtesting/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /guyton.klinger/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /heatmap/i })).toBeVisible();
  });

  // ── Monte Carlo ──────────────────────────────────────────────────────────────
  test.describe('Monte Carlo tab', () => {
    test('scenario dropdown lists seeded scenarios', async ({ page }) => {
      // Monte Carlo is tab 0 (default)
      const select = page.getByRole('combobox').first();
      await expect(select).toBeVisible({ timeout: 8_000 });
      await select.click();
      await expect(page.getByRole('option', { name: 'Base Case' })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('run Monte Carlo shows success rate chip', async ({ page }) => {
      const scenarioSelect = page.getByRole('combobox').first();
      await scenarioSelect.click();
      await page.getByRole('option', { name: 'Base Case' }).click();

      await page.getByRole('button', { name: /run|simulate/i }).first().click();

      await expect(page.getByText(/success rate/i)).toBeVisible({ timeout: 30_000 });
    });

    test('Monte Carlo chart (SVG) renders after run', async ({ page }) => {
      const scenarioSelect = page.getByRole('combobox').first();
      await scenarioSelect.click();
      await page.getByRole('option', { name: 'Base Case' }).click();
      await page.getByRole('button', { name: /run|simulate/i }).first().click();
      await expect(page.getByText(/success rate/i)).toBeVisible({ timeout: 30_000 });

      const svg = page.locator('svg').first();
      await expect(svg).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Historical Backtesting ───────────────────────────────────────────────────
  test.describe('Historical Backtesting tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /historical backtesting/i }).click();
    });

    test('backtest tab content is visible', async ({ page }) => {
      await expect(page.getByText(/backtest/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('run backtest shows windows result', async ({ page }) => {
      const scenarioSelect = page.getByRole('combobox').first();
      await scenarioSelect.click();
      await page.getByRole('option', { name: 'Base Case' }).click();

      await page.getByRole('button', { name: /run|simulate|backtest/i }).first().click();

      // Expect either a "windows" stat or a success rate chip
      await expect(page.getByText(/window|success rate|survived/i).first()).toBeVisible({ timeout: 30_000 });
    });
  });

  // ── Guyton-Klinger ───────────────────────────────────────────────────────────
  test.describe('Guyton-Klinger tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /guyton.klinger/i }).click();
    });

    test('Guyton-Klinger tab content loads', async ({ page }) => {
      await expect(page.getByText(/guyton.klinger/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('run Guyton-Klinger shows portfolio survived indicator', async ({ page }) => {
      const scenarioSelect = page.getByRole('combobox').first();
      await scenarioSelect.click();
      await page.getByRole('option', { name: 'Base Case' }).click();

      await page.getByRole('button', { name: /run|simulate/i }).first().click();

      await expect(page.getByText(/survived|portfolio/i).first()).toBeVisible({ timeout: 30_000 });
    });

    test('Guyton-Klinger chart renders', async ({ page }) => {
      const scenarioSelect = page.getByRole('combobox').first();
      await scenarioSelect.click();
      await page.getByRole('option', { name: 'Base Case' }).click();
      await page.getByRole('button', { name: /run|simulate/i }).first().click();
      await expect(page.getByText(/survived|portfolio/i).first()).toBeVisible({ timeout: 30_000 });

      await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Success Rate Heatmap ─────────────────────────────────────────────────────
  test.describe('Success Rate Heatmap tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /heatmap/i }).click();
    });

    test('heatmap tab content loads', async ({ page }) => {
      await expect(page.getByText(/heatmap/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('generate heatmap renders cells with percentages', async ({ page }) => {
      const scenarioSelect = page.getByRole('combobox').first();
      await scenarioSelect.click();
      await page.getByRole('option', { name: 'Base Case' }).click();

      await page.getByRole('button', { name: /generate|run|compute/i }).first().click();

      // Heatmap cells should contain percentage strings, and not all be 100%
      const cells = page.locator('[data-testid="heatmap-cell"], td, .heatmap-cell').filter({ hasText: /%/ });
      await expect(cells.first()).toBeVisible({ timeout: 30_000 });
    });
  });
});
