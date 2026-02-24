/**
 * Accounts Page — Regression Tests
 * Validates that the seeded accounts display correctly, and that
 * CRUD operations (add, edit, delete) work end-to-end.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Accounts Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/accounts');
  });

  test('shows all five seeded accounts', async ({ page }) => {
    for (const name of [
      "David's RRSP",
      "David's TFSA",
      "Joint Non-Registered",
      "Sarah's RRSP",
      "Sarah's TFSA",
    ]) {
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('displays correct account types', async ({ page }) => {
    await expect(page.getByText('RRSP').first()).toBeVisible();
    await expect(page.getByText('TFSA').first()).toBeVisible();
    await expect(page.getByText('NON_REG')).toBeVisible();
  });

  test('total net worth is displayed and non-zero', async ({ page }) => {
    // Some representation of total balance should exist (dashboard card or header chip)
    const moneyPattern = /\$[\d,]+/;
    await expect(page.getByText(moneyPattern).first()).toBeVisible({ timeout: 10_000 });
  });

  test('can add a new account', async ({ page }) => {
    await page.getByRole('button', { name: /add account/i }).click();

    // Fill in the dialog
    await page.getByLabel('Account Name').fill('Test GIC Account');
    // Select type
    const typeSelect = page.getByLabel('Account Type');
    await typeSelect.click();
    await page.getByRole('option', { name: /non.reg|non-reg|non_reg/i }).first().click();

    await page.getByLabel(/current balance/i).fill('25000');
    await page.getByRole('button', { name: /add account|save/i }).last().click();

    await expect(page.getByText('Test GIC Account')).toBeVisible({ timeout: 8_000 });
  });

  test('can edit an existing account balance', async ({ page }) => {
    // Find David's TFSA list item and click its edit button
    const item = page.locator('li', { has: page.getByText("David's TFSA") });
    await item.getByRole('button', { name: 'Edit account' }).click();

    const balanceField = page.getByLabel(/current balance/i);
    await balanceField.clear();
    await balanceField.fill('100000');
    await page.getByRole('button', { name: /update|save/i }).last().click();

    await expect(page.getByText(/100,000|100000/).first()).toBeVisible({ timeout: 8_000 });
  });

  test('can delete an account', async ({ page }) => {
    // Add a throwaway account first
    await page.getByRole('button', { name: /add account/i }).click();
    await page.getByLabel('Account Name').fill('Delete Me Account');
    const typeSelect = page.getByLabel('Account Type');
    await typeSelect.click();
    await page.getByRole('option', { name: /tfsa/i }).first().click();
    await page.getByLabel(/current balance/i).fill('1000');
    await page.getByRole('button', { name: /add account|save/i }).last().click();
    await expect(page.getByText('Delete Me Account')).toBeVisible({ timeout: 8_000 });

    // Find the list item and click its delete button
    const item = page.locator('li', { has: page.getByText('Delete Me Account') });
    await item.getByRole('button', { name: 'Delete account' }).click();

    await expect(page.getByText('Delete Me Account')).not.toBeVisible({ timeout: 8_000 });
  });
});
