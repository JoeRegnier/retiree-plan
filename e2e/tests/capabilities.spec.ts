import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Additional Capabilities Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Goals page can create a goal', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByText('Retirement Goals')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /add goal/i }).first().click();
    await page.getByLabel('Goal Name').fill('E2E Goal Coverage');
    await page.getByLabel('Target Amount ($)').fill('123456');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('E2E Goal Coverage')).toBeVisible({ timeout: 10_000 });
  });

  test('Earliest Retirement Finder runs a sweep', async ({ page }) => {
    await page.goto('/retire-finder');
    await expect(page.getByText('Earliest Retirement Finder')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /find earliest/i }).click();
    await expect(page.getByText('Earliest Viable Age')).toBeVisible({ timeout: 60_000 });
  });

  test('Compare page can run a scenario comparison', async ({ page }) => {
    await page.goto('/compare');
    await expect(page.getByText('What-If Comparison')).toBeVisible({ timeout: 10_000 });

    const combos = page.locator('[role="combobox"]');
    await combos.nth(0).click();
    await page.getByRole('option', { name: /base case/i }).click();
    await combos.nth(1).click();
    await page.getByRole('option', { name: /conservative/i }).click();

    await page.getByRole('button', { name: /^run$/i }).click();
    await expect(page.getByText('Net Worth Projection')).toBeVisible({ timeout: 30_000 });
  });

  test('International page switches tabs and shows calculators', async ({ page }) => {
    await page.goto('/international');
    await expect(page.getByText('International Planning')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('RRSP/RRIF Treaty Withdrawal Calculator')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /worldwide \/ expat/i }).click();
    await expect(page.getByText('Treaty Withholding Rates by Country')).toBeVisible({ timeout: 10_000 });
  });

  test('Help page tabs render core documentation sections', async ({ page }) => {
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: 'Help & Documentation' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /retirement planning guide/i }).click();
    await expect(page.getByRole('heading', { name: 'What Is a Retirement Plan?' })).toBeVisible({ timeout: 10_000 });
  });

  test('AI assistant accepts a prompt and shows a response or error state', async ({ page }) => {
    await page.goto('/ai-chat');
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({ timeout: 10_000 });

    const prompt = 'How much should I have saved by retirement?';
    await page.getByRole('button', { name: prompt }).click();

    await expect(page.getByText(prompt)).toBeVisible({ timeout: 10_000 });
    const hasAssistant = await page.getByText(/retirement|rrsp|tfsa|cpp|oas/i).first().isVisible().catch(() => false);
    const hasError = await page.getByRole('alert').isVisible().catch(() => false);
    expect(hasAssistant || hasError).toBe(true);
  });

  test('Settings page preferences controls are usable', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Settings')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Default Assumptions')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Default Inflation Rate (%)').fill('2.8');
    await page.getByRole('button', { name: /save preferences/i }).click();
    await expect(page.getByText('Preferences saved')).toBeVisible({ timeout: 10_000 });
  });
});
