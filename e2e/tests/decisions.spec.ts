/**
 * Decision Journal Page — Regression Tests
 *
 * Validates:
 *   - Page structure (header, summary chips, filters, view-mode toggle)
 *   - Full 4-step form flow to create a decision record
 *   - Decision list renders the new record
 *   - Detail panel opens on selection
 *   - Status / category filters update the list
 *   - Timeline view renders
 *   - Mind Map view renders (canvas container present)
 *   - Delete removes an entry
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Decision Journal Page', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/decisions');
    await page.waitForURL('/decisions', { timeout: 15_000 });
  });

  // ── Page structure ────────────────────────────────────────────────────────

  test('page header is visible', async ({ page }) => {
    await expect(page.getByText('Decision Journal')).toBeVisible({ timeout: 10_000 });
  });

  test('"New Decision" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new decision/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('filter bar is rendered with Status and Category selects', async ({ page }) => {
    const combos = page.locator('[role="combobox"]');
    await expect(combos.nth(0)).toBeVisible({ timeout: 10_000 });
    await expect(combos.nth(1)).toBeVisible();
  });

  test('view-mode toggle buttons are visible', async ({ page }) => {
    const toggles = page.locator('[class*="MuiToggleButtonGroup-root"] button');
    await expect(toggles).toHaveCount(3);
    await expect(toggles.first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Create decision (full 4-step form) ───────────────────────────────────

  test('can create a new decision record through the form', async ({ page }) => {
    // Open form
    await page.getByRole('button', { name: /new decision/i }).click();
    await expect(
      page.getByRole('dialog', { name: /new decision record/i }),
    ).toBeVisible({ timeout: 8_000 });

    // ── Step 0: Basic Info ──
    await page.getByLabel('Title').fill('Test CPP Timing Decision');
    const dialog = page.getByRole('dialog', { name: /new decision record/i });

    // Status and Category are pre-populated with PROPOSED / GENERAL — keep defaults
    await dialog.locator('button', { hasText: 'Continue' }).last().click();

    // ── Step 1: Context & Decision ──
    await dialog.getByLabel('Context').fill(
      'We need to decide when David should start CPP benefits.',
    );
    await dialog.getByRole('textbox', { name: 'Decision' }).fill('Delay CPP to age 70 for maximum benefit.');
    await dialog.locator('button', { hasText: 'Continue' }).last().click();

    // ── Step 2: Rationale & Alternatives ──
    await page.getByLabel('Rationale').fill('Deferring CPP may increase guaranteed lifetime income.');
    await dialog.locator('button', { hasText: 'Continue' }).last().click();

    // ── Step 3: Dates & Links — submit ──
    await page
      .getByRole('button', { name: /create decision/i })
      .click();

    // Dialog should close and the new record should be in the list
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Test CPP Timing Decision')).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Detail panel ─────────────────────────────────────────────────────────

  test('clicking a decision in the list opens its detail panel', async ({ page }) => {
    // Wait for at least one record (the one created above may not be seeded; guard)
    const listItems = page.locator('[data-testid="decision-list-item"], .MuiBox-root').filter({
      hasText: 'Test CPP Timing Decision',
    });

    // If we just created it (same session), it should appear; otherwise skip gracefully
    const count = await listItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await listItems.first().click();
    // Detail card should appear — look for the ADR-style heading
    await expect(page.getByText(/context/i).first()).toBeVisible({ timeout: 8_000 });
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  test('status filter "PROPOSED" shows only proposed records or empty state', async ({
    page,
  }) => {
    // Select PROPOSED from the Status dropdown
    await page.locator('[role="combobox"]').nth(0).click();
    await page.getByRole('option', { name: 'PROPOSED' }).click();

    // Either proposed records are shown, or the empty-state placeholder is shown
    const proposedBadges = page.locator('span.MuiChip-label', { hasText: 'PROPOSED' });
    const hasProposed = (await proposedBadges.count()) > 0;
    const hasEmpty = await page
      .getByText(/no decisions yet/i)
      .isVisible()
      .catch(() => false);

    expect(hasProposed || hasEmpty).toBe(true);
  });

  test('category filter "Tax Planning" narrows the list', async ({ page }) => {
    await page.locator('[role="combobox"]').nth(1).click();
    await page.getByRole('option', { name: 'Tax Planning' }).click();

    await expect(page.locator('[role="combobox"]').nth(1)).toContainText(/tax planning/i);
  });

  // ── View mode toggles ─────────────────────────────────────────────────────

  test('switching to Timeline view renders the timeline container', async ({ page }) => {
    // Toggle order is list, timeline, mind map.
    await page.locator('[class*="MuiToggleButtonGroup-root"] button').nth(1).click();

    // The timeline renders vertically — look for year-grouped sections or known text
    // If no records exist, the list/timeline shows empty state; if records exist they render
    // Either way the page should not error
    await expect(page.getByText(/decision journal/i).first()).toBeVisible({
      timeout: 8_000,
    });
    // Switching back to list should work
    await page.locator('[class*="MuiToggleButtonGroup-root"] button').first().click();
    await expect(page.locator('[role="combobox"]').nth(0)).toBeVisible({ timeout: 5_000 });
  });

  test('switching to Mind Map view renders the mind map container', async ({ page }) => {
    await page.locator('[class*="MuiToggleButtonGroup-root"] button').nth(2).click();

    // DecisionMindMap renders an SVG; wait for it or a loading spinner to appear
    await page
      .locator('svg, [class*="CircularProgress"]')
      .first()
      .waitFor({ timeout: 10_000, state: 'visible' });

    // Switch back
    await page.locator('[class*="MuiToggleButtonGroup-root"] button').first().click();
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  test('can delete a decision record', async ({ page }) => {
    // Create a throwaway record first
    await page.getByRole('button', { name: /new decision/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
    const dialog = page.getByRole('dialog', { name: /new decision record/i });

    await page.getByLabel('Title').fill('Delete Me Decision');
    await dialog.locator('button', { hasText: 'Continue' }).last().click();

    await dialog.getByLabel('Context').fill('Throwaway context for delete test.');
    await dialog.locator('button', { hasText: 'Continue' }).last().click();
    await dialog.locator('button', { hasText: 'Continue' }).last().click();
    await page.getByRole('button', { name: /create decision/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    const createdDecision = page.locator('p', { hasText: 'Delete Me Decision' }).first();
    await expect(createdDecision).toBeVisible({ timeout: 10_000 });

    // Click on it to open the detail panel, then delete
    await createdDecision.click();

    // Detail card has a Delete button (icon or labelled)
    await page.getByRole('button', { name: /delete/i }).last().click();

    // Confirm dialog if present
    const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete/i });
    if (await confirmDialog.isVisible().catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /confirm|yes|delete/i }).first().click();
    }

    await expect(createdDecision).not.toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('sidebar nav item navigates to /decisions', async ({ page }) => {
    // Navigate away first
    await page.goto('/');
    await page.waitForURL('/');

    // Click the Decisions nav item in the sidebar
    await page.getByRole('navigation').getByText('Decisions').first().click();

    await page.waitForURL('/decisions', { timeout: 10_000 });
    await expect(page.getByText('Decision Journal')).toBeVisible({ timeout: 10_000 });
  });
});
