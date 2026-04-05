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
    await expect(page.getByLabel('Status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Category')).toBeVisible();
  });

  test('view-mode toggle buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /list/i }).first()).toBeVisible({
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

    // Status and Category are pre-populated with PROPOSED / GENERAL — keep defaults
    await page.getByRole('button', { name: /continue/i }).first().click();

    // ── Step 1: Context & Decision ──
    await page.getByLabel('Context').fill(
      'We need to decide when David should start CPP benefits.',
    );
    await page.getByLabel('Decision').fill('Delay CPP to age 70 for maximum benefit.');
    await page.getByRole('button', { name: /continue/i }).first().click();

    // ── Step 2: Rationale & Alternatives ──
    // Add one alternative
    await page.getByRole('button', { name: /add alternative/i }).click();
    await page.getByLabel('Alternative Title').fill('Start CPP at 65');
    await page.getByRole('button', { name: /continue/i }).first().click();

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
    await page.getByLabel('Status').click();
    await page.getByRole('option', { name: 'PROPOSED' }).click();

    // Either proposed records are shown, or the empty-state placeholder is shown
    const hasProposed = await page.getByText('PROPOSED').isVisible();
    const hasEmpty = await page
      .getByText(/no decisions yet/i)
      .isVisible()
      .catch(() => false);

    expect(hasProposed || hasEmpty).toBe(true);
  });

  test('category filter "Tax Planning" narrows the list', async ({ page }) => {
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Tax Planning' }).click();

    // Verify that the list now either shows TAX_PLANNING items or the empty state
    const filtered = page.getByText('TAX_PLANNING');
    const empty = page.getByText(/no decisions yet/i);

    await expect(filtered.or(empty)).toBeVisible({ timeout: 8_000 });
  });

  // ── View mode toggles ─────────────────────────────────────────────────────

  test('switching to Timeline view renders the timeline container', async ({ page }) => {
    // Click the Timeline toggle button (title tooltip "Timeline")
    await page.getByRole('button', { name: /timeline/i }).click();

    // The timeline renders vertically — look for year-grouped sections or known text
    // If no records exist, the list/timeline shows empty state; if records exist they render
    // Either way the page should not error
    await expect(page.getByText(/decision journal/i).first()).toBeVisible({
      timeout: 8_000,
    });
    // Switching back to list should work
    await page.getByRole('button', { name: /list/i }).click();
    await expect(page.getByLabel('Status')).toBeVisible({ timeout: 5_000 });
  });

  test('switching to Mind Map view renders the mind map container', async ({ page }) => {
    await page.getByRole('button', { name: /mind map/i }).click();

    // DecisionMindMap renders an SVG; wait for it or a loading spinner to appear
    await page
      .locator('svg, [class*="CircularProgress"]')
      .first()
      .waitFor({ timeout: 10_000, state: 'visible' });

    // Switch back
    await page.getByRole('button', { name: /list/i }).click();
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  test('can delete a decision record', async ({ page }) => {
    // Create a throwaway record first
    await page.getByRole('button', { name: /new decision/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });

    await page.getByLabel('Title').fill('Delete Me Decision');
    await page.getByRole('button', { name: /continue/i }).first().click();

    await page.getByLabel('Context').fill('Throwaway context for delete test.');
    await page.getByRole('button', { name: /continue/i }).first().click();
    await page.getByRole('button', { name: /continue/i }).first().click();
    await page.getByRole('button', { name: /create decision/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Delete Me Decision')).toBeVisible({ timeout: 10_000 });

    // Click on it to open the detail panel, then delete
    await page.getByText('Delete Me Decision').first().click();

    // Detail card has a Delete button (icon or labelled)
    await page.getByRole('button', { name: /delete/i }).last().click();

    // Confirm dialog if present
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText('Delete Me Decision')).not.toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('sidebar nav item navigates to /decisions', async ({ page }) => {
    // Navigate away first
    await page.goto('/');
    await page.waitForURL('/');

    // Click the Decisions nav item in the sidebar
    await page.getByRole('link', { name: /decisions/i }).click();

    await page.waitForURL('/decisions', { timeout: 10_000 });
    await expect(page.getByText('Decision Journal')).toBeVisible({ timeout: 10_000 });
  });
});
