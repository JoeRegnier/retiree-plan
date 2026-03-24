/**
 * Estate Page — Regression Tests (Feature 7.3 Legacy & Estate Giving Planner)
 *
 * Verifies:
 *   - Both tabs visible on the Estate page
 *   - Existing estate calculator still works end-to-end
 *   - Legacy Strategies tab renders all four accordions
 *   - Each strategy calculator shows results when inputs are changed
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Estate Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/estate');
    await page.waitForURL('/estate', { timeout: 10_000 });
  });

  // ── Page structure ─────────────────────────────────────────────────────────

  test('page header is visible', async ({ page }) => {
    await expect(page.getByText('Estate Planning')).toBeVisible({ timeout: 10_000 });
  });

  test('both tabs are visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Estate Calculator' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Legacy Strategies' })).toBeVisible();
  });

  test('estate calculator tab is active by default', async ({ page }) => {
    const tab = page.getByRole('tab', { name: 'Estate Calculator' });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    // Estate calculator form should be visible
    await expect(page.getByLabel('RRSP / RRIF Balance')).toBeVisible();
  });

  // ── Estate Calculator tab ──────────────────────────────────────────────────

  test('estate calculator produces results after clicking Calculate', async ({ page }) => {
    await expect(page.getByLabel('RRSP / RRIF Balance')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /calculate estate/i }).click();

    // Summary cards should appear
    await expect(page.getByText('Gross Estate')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Tax & Fees')).toBeVisible();
    // 'Net to Heirs' appears in both the stat card and the table header — use first()
    await expect(page.getByText('Net to Heirs').first()).toBeVisible();
  });

  test('estate breakdown table appears after calculation', async ({ page }) => {
    await page.getByRole('button', { name: /calculate estate/i }).click();
    await expect(page.getByText('Asset Breakdown')).toBeVisible({ timeout: 15_000 });
    // Use role=cell to avoid matching the form label also containing 'RRSP / RRIF'
    await expect(page.getByRole('cell', { name: 'RRSP / RRIF' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'TFSA' })).toBeVisible();
  });

  // ── Legacy Strategies tab ──────────────────────────────────────────────────

  test('switching to Legacy Strategies tab shows intro text', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();
    await expect(
      page.getByText(/proactive strategies to protect your estate/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('all four strategy accordions are visible in Legacy Strategies tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    await expect(
      page.getByText(/Spousal RRSP Rollover & Testamentary Trust/i),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByText(/Charitable Giving & Donor-Advised Fund/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Life Insurance for Estate Equalization/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Principal Residence Nomination Optimizer/i),
    ).toBeVisible();
  });

  // ── Strategy 1: Spousal RRSP Rollover ─────────────────────────────────────

  test('spousal trust accordion shows result stats after load', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();
    // First accordion is defaultExpanded — result cards should be visible immediately
    await expect(
      page.getByText('Tax Avoided at First Death'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('RRSP at Survivor\'s Death')).toBeVisible();
    await expect(page.getByText('Net Benefit to Heirs')).toBeVisible();
  });

  test('spousal trust result updates when RRSP balance changes', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    // Locate the RRSP balance field inside the spouse trust accordion
    const accordion = page.getByTestId('accordion-spouse-trust');
    const rrspField = accordion.getByLabel('RRSP / RRIF Balance at First Death');
    await expect(rrspField).toBeVisible({ timeout: 8_000 });

    // Change the RRSP balance
    await rrspField.fill('1000000');
    // The "Tax Avoided at First Death" should update (1,000,000 × 0.50 = $500K)
    await expect(page.getByText(/\$500K|\$500,000/)).toBeVisible({ timeout: 5_000 });
  });

  // ── Strategy 2: Charitable Giving ─────────────────────────────────────────

  test('charitable giving accordion expands and shows credit results', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    const accordion = page.getByTestId('accordion-charitable');
    await accordion.getByRole('button').first().click(); // expand
    await expect(accordion.getByText('Total Credit')).toBeVisible({ timeout: 8_000 });
    await expect(accordion.getByText('Net Out-of-Pocket Cost')).toBeVisible();
  });

  test('DAF toggle shows annual grant field and grant result', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    const accordion = page.getByTestId('accordion-charitable');
    await accordion.getByRole('button').first().click();

    // Enable DAF toggle — MUI Switch associates via FormControlLabel; use getByLabel
    const dafSwitch = accordion.getByLabel('Model as Donor-Advised Fund (DAF)');
    await dafSwitch.check();

    // Annual grant stat card should appear
    await expect(accordion.getByText('Annual DAF Grant')).toBeVisible({ timeout: 5_000 });
  });

  // ── Strategy 3: Life Insurance ─────────────────────────────────────────────

  test('life insurance accordion shows insurance results', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    const accordion = page.getByTestId('accordion-insurance');
    await accordion.getByRole('button').first().click();

    await expect(accordion.getByText('RRSP Tax Bomb')).toBeVisible({ timeout: 8_000 });
    await expect(accordion.getByText('Death Benefit Needed')).toBeVisible();
    await expect(accordion.getByText('Est. Monthly Premium')).toBeVisible();
  });

  // ── Strategy 4: PR Nomination ──────────────────────────────────────────────

  test('principal residence accordion shows optimal vs worst-case tax', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    const accordion = page.getByTestId('accordion-pr-nomination');
    await accordion.getByRole('button').first().click();

    await expect(accordion.getByText('Optimal Tax')).toBeVisible({ timeout: 8_000 });
    await expect(accordion.getByText('Worst-Case Tax')).toBeVisible();
    await expect(accordion.getByText('Tax Savings')).toBeVisible();
  });

  test('PR nomination shows explanation text', async ({ page }) => {
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();

    const accordion = page.getByTestId('accordion-pr-nomination');
    await accordion.getByRole('button').first().click();

    // Default values (900K primary, 450K cottage) should show the recommendation Alert.
    // Match the specific pattern "Designating N years" which only appears in the recommendation.
    await expect(
      accordion.getByText(/Designating \d+ years/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── Navigation regression ──────────────────────────────────────────────────

  test('tab state resets correctly when navigating away and back', async ({ page }) => {
    // Switch to Legacy Strategies
    await page.getByRole('tab', { name: 'Legacy Strategies' }).click();
    await expect(page.getByText(/Spousal RRSP Rollover/i)).toBeVisible();

    // Navigate away then back
    await page.getByRole('navigation').getByText('Accounts').click();
    await page.waitForURL('/accounts', { timeout: 8_000 });
    await page.getByRole('navigation').getByText('Estate').click();
    await page.waitForURL('/estate', { timeout: 8_000 });

    // Should default back to Estate Calculator tab
    await expect(page.getByLabel('RRSP / RRIF Balance')).toBeVisible({ timeout: 8_000 });
  });
});
