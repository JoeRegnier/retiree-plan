/**
 * Scenarios Page — Regression Tests
 * Validates that the three seeded scenarios display correctly, and
 * that create / edit / delete operations work.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Scenarios Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/scenarios');
  });

  test('shows all three seeded scenarios', async ({ page }) => {
    for (const name of ['Base Case', 'Early Retirement', 'Conservative']) {
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('displays key numeric parameters for Base Case', async ({ page }) => {
    // Retirement age 65 should appear on the Base Case card
    await expect(page.getByText(/65/).first()).toBeVisible({ timeout: 8_000 });
  });

  test('can create a new scenario', async ({ page }) => {
    await page.getByRole('button', { name: /new scenario|create scenario/i }).click();

    await page.getByLabel('Scenario Name').fill('E2E Test Scenario');

    // Set a retirement age — the field may be labelled differently
    const retirementAgeField = page.getByLabel(/retirement age/i);
    if (await retirementAgeField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await retirementAgeField.fill('67');
    }

    await page.getByRole('button', { name: /create scenario/i }).last().click();

    await expect(page.getByText('E2E Test Scenario')).toBeVisible({ timeout: 10_000 });
  });

  test('can edit a scenario name', async ({ page }) => {
    // Click the first Edit scenario button (tests the edit workflow)
    await page.getByRole('button', { name: 'Edit scenario' }).first().click();

    const nameField = page.getByLabel('Scenario Name');
    const originalName = await nameField.inputValue();
    await nameField.clear();
    await nameField.fill(`${originalName} (edited)`);
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText(`${originalName} (edited)`)).toBeVisible({ timeout: 8_000 });
  });

  test('can delete the scenario created in the create test', async ({ page }) => {
    // Create then delete to keep suite idempotent
    await page.getByRole('button', { name: /new scenario|create scenario/i }).click();
    await page.getByLabel('Scenario Name').fill('Delete Me Scenario');
    await page.getByRole('button', { name: /create scenario/i }).last().click();
    await expect(page.getByText('Delete Me Scenario')).toBeVisible({ timeout: 10_000 });

    // Find the delete button scoped to the card/accordion containing 'Delete Me Scenario'
    // Scenarios render in Accordion — find the one with our name and click its delete button
    const accordion = page.locator('div', { has: page.getByText('Delete Me Scenario') })
      .filter({ has: page.getByRole('button', { name: 'Delete scenario' }) })
      .last();
    await accordion.getByRole('button', { name: 'Delete scenario' }).click();
    // Deletion is immediate (no confirm dialog)

    await expect(page.getByText('Delete Me Scenario')).not.toBeVisible({ timeout: 8_000 });
  });
});
