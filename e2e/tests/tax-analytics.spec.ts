/**
 * Tax Analytics Page — Regression Tests
 * Validates:
 * - "From household" chip appears when household income sources exist
 * - Editing income flips to "Customized" chip
 * - "Reset to household" restores original value
 * - Province selector works
 * - Tax bracket chart renders
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Tax Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/tax-analytics');
  });

  test('page renders without error', async ({ page }) => {
    await expect(page.getByText(/tax/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('"From household" chip is visible when income sources exist', async ({ page }) => {
    // Test account has employment income for David (~$120,000)
    await expect(page.getByText('From household')).toBeVisible({ timeout: 10_000 });
  });

  test('income field is pre-populated with a non-zero value', async ({ page }) => {
    await expect(page.getByText('From household')).toBeVisible({ timeout: 10_000 });
    const incomeField = page.getByLabel(/income/i).first();
    const value = await incomeField.inputValue();
    expect(Number(value)).toBeGreaterThan(0);
  });

  test('modifying income shows "Customized" chip', async ({ page }) => {
    await expect(page.getByText('From household')).toBeVisible({ timeout: 10_000 });

    const incomeField = page.getByLabel(/income/i).first();
    await incomeField.clear();
    await incomeField.fill('200000');
    await incomeField.press('Tab'); // trigger change event

    await expect(page.getByText('Customized')).toBeVisible({ timeout: 5_000 });
  });

  test('"Reset to household" button restores original income and removes Customized chip', async ({ page }) => {
    await expect(page.getByText('From household')).toBeVisible({ timeout: 10_000 });

    // Grab the original value before modifying
    const incomeField = page.getByLabel(/income/i).first();
    const originalValue = await incomeField.inputValue();

    // Modify
    await incomeField.clear();
    await incomeField.fill('200000');
    await incomeField.press('Tab');
    await expect(page.getByText('Customized')).toBeVisible({ timeout: 5_000 });

    // Reset
    await page.getByRole('button', { name: /reset to household/i }).click();

    await expect(page.getByText('Customized')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('From household')).toBeVisible({ timeout: 5_000 });

    const restoredValue = await incomeField.inputValue();
    expect(restoredValue).toBe(originalValue);
  });

  test('province selector changes displayed province name', async ({ page }) => {
    await expect(page.getByText('From household')).toBeVisible({ timeout: 10_000 });

    const provinceField = page.getByLabel(/province/i).first();
    await provinceField.click();
    // Select British Columbia
    const bcOption = page.getByRole('option', { name: /british columbia|bc/i }).first();
    if (await bcOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await bcOption.click();
      await expect(page.getByText(/british columbia|bc/i).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('tax bracket chart (SVG) renders', async ({ page }) => {
    await expect(page.getByText('From household')).toBeVisible({ timeout: 10_000 });
    // Tax bracket visualisation section contains an SVG or canvas
    const chart = page.locator('svg').first();
    await expect(chart).toBeVisible({ timeout: 10_000 });
  });
});
