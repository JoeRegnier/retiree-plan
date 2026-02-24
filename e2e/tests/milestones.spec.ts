/**
 * Milestones Page — Regression Tests
 * Validates that the five seeded milestone events display correctly,
 * and that add / delete operations work end-to-end.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Milestones Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/milestones');
  });

  test('page header is visible', async ({ page }) => {
    await expect(page.getByText(/milestones/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows all five seeded milestone names', async ({ page }) => {
    for (const name of [
      'David Retires',
      'Sarah Retires',
      'RRSP to RRIF Conversion',
      'Mortgage Paid Off',
      'Inheritance Received',
    ]) {
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('milestone type chips are displayed', async ({ page }) => {
    // Seeded milestones include lump_sum_in (Inheritance), expense, income types
    const chipLabels = ['Lump Sum In', 'Expense', 'Income', 'Lump Sum Out'];
    // At least one chip type should be visible
    let found = false;
    for (const label of chipLabels) {
      if (await page.getByText(label).isVisible({ timeout: 2_000 }).catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('can add a new milestone', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Milestone' }).first().click();

    await page.getByLabel('Name').fill('E2E Test Milestone');

    const typeSelect = page.getByLabel('Type');
    await typeSelect.click();
    await page.getByRole('option', { name: /lump sum in/i }).click();

    await page.getByLabel('Age at Event').fill('63');
    await page.getByLabel(/amount/i).fill('50000');

    // Scope save button to the dialog to avoid ambiguity with the page header button
    await page.getByRole('dialog').getByRole('button', { name: /add milestone|save changes/i }).click();

    await expect(page.getByText('E2E Test Milestone')).toBeVisible({ timeout: 8_000 });
  });

  test('can delete the newly-added milestone', async ({ page }) => {
    // Add a throwaway milestone first
    await page.getByRole('button', { name: 'Add Milestone' }).first().click();
    await page.getByLabel('Name').fill('Delete Me Milestone');
    const typeSelect = page.getByLabel('Type');
    await typeSelect.click();
    await page.getByRole('option', { name: /expense/i }).first().click();
    await page.getByLabel('Age at Event').fill('70');
    await page.getByLabel(/amount/i).fill('5000');
    await page.getByRole('dialog').getByRole('button', { name: /add milestone|save changes/i }).click();
    await expect(page.getByText('Delete Me Milestone')).toBeVisible({ timeout: 8_000 });

    // Scope delete button to the table row containing 'Delete Me Milestone'
    const row = page.locator('tr', { has: page.getByText('Delete Me Milestone') });
    await row.getByRole('button', { name: 'Delete milestone' }).click();
    // Deletion is immediate — no confirm dialog

    await expect(page.getByText('Delete Me Milestone')).not.toBeVisible({ timeout: 8_000 });
  });

  test('milestone ages are displayed as numbers', async ({ page }) => {
    // David retires at 65, Sarah at 62 — these should appear in the table
    const ageCell = page.locator('td').filter({ hasText: /^6[0-9]$/ }).first();
    await expect(ageCell).toBeVisible({ timeout: 8_000 });
  });
});
