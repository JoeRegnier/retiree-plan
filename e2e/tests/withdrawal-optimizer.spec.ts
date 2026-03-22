/**
 * Withdrawal Optimizer — E2E Tests
 * Validates the new withdrawal strategy selector in Scenarios
 * and the Strategy comparison tab in Projections.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Withdrawal Strategy — Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/scenarios');
  });

  test('scenario dialog has a Spending tab with withdrawal strategy selector', async ({ page }) => {
    await page.getByRole('button', { name: /new scenario|create scenario/i }).click();
    await page.getByRole('tab', { name: /spending/i }).click();

    await expect(page.getByLabel(/drawdown strategy/i)).toBeVisible({ timeout: 5_000 });
  });

  test('can change withdrawal strategy to RRSP First and save', async ({ page }) => {
    // Open create dialog
    await page.getByRole('button', { name: /new scenario|create scenario/i }).click();
    await page.getByLabel('Scenario Name').fill('E2E Withdrawal Strategy Test');

    // Switch to Spending tab
    await page.getByRole('tab', { name: /spending/i }).click();

    // Change strategy
    const strategySelect = page.getByLabel(/drawdown strategy/i);
    await strategySelect.click();
    await page.getByRole('option', { name: /rrsp first/i }).click();

    // Save
    await page.getByRole('button', { name: /create scenario/i }).last().click();
    await expect(page.getByText('E2E Withdrawal Strategy Test')).toBeVisible({ timeout: 10_000 });

    // Cleanup
    const card = page.getByText('E2E Withdrawal Strategy Test').locator('..');
    const deleteBtn = card.getByRole('button', { name: /delete/i });
    if (await deleteBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.getByRole('button', { name: /confirm|yes|delete/i }).click().catch(() => {});
    }
  });

  test('spending tab shows flex spending toggle', async ({ page }) => {
    await page.getByRole('button', { name: /new scenario|create scenario/i }).click();
    await page.getByRole('tab', { name: /spending/i }).click();

    await expect(page.getByText(/flexible spending guardrails/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/enable flexible spending/i)).toBeVisible({ timeout: 3_000 });
  });

  test('enabling flex spending shows floor/ceiling sliders', async ({ page }) => {
    await page.getByRole('button', { name: /new scenario|create scenario/i }).click();
    await page.getByRole('tab', { name: /spending/i }).click();

    // Toggle flex spending on
    const flexSwitch = page.getByRole('checkbox', { name: /enable flexible spending/i })
      .or(page.locator('input[type=checkbox]').filter({ hasText: /flex/i }).first());
    // Use the FormControlLabel switch
    const switchControl = page.locator('label').filter({ hasText: /enable flexible spending/i }).locator('input');
    await switchControl.check();

    await expect(page.getByText(/floor:/i)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/ceiling:/i)).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Withdrawal Strategy — Projections Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/projections');
  });

  test('Strategy tab appears in projections after running', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('tab', { name: /strategy/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Strategy tab shows Compare Strategies button', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /strategy/i }).click();
    await expect(page.getByRole('button', { name: /compare strategies/i })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Compare Strategies returns ranked results', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /strategy/i }).click();
    await page.getByRole('button', { name: /compare strategies/i }).click();

    // Should show a result with "Recommended" label
    await expect(page.getByText(/recommended/i)).toBeVisible({ timeout: 30_000 });
    // Should show "Best" chip
    await expect(page.getByText('Best')).toBeVisible({ timeout: 10_000 });
    // Should show lifetime tax column header in the table
    await expect(page.getByRole('columnheader', { name: /lifetime tax/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Buckets tab shows 3-bucket visualization', async ({ page }) => {
    await page.getByLabel('Scenario').click();
    await page.getByRole('option', { name: 'Base Case' }).click();
    await page.getByRole('button', { name: /run projection/i }).click();
    await expect(page.getByText(/peak net worth/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /buckets/i }).click();
    await expect(page.getByText(/3-bucket strategy/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/cash reserve/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
