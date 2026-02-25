import { test, expect } from '@playwright/test';

/** Unique suffix per test run to avoid DB conflicts */
const ts = Date.now();
const testEmail = `e2e+household+${ts}@example.com`;
const testPassword = 'Password123!';
const testName = 'E2E Test User';
const householdName = 'E2E Smith Family';
const memberName = 'Jane Smith';
const secondMemberName = 'Bob Smith';

/** Helper: register a fresh user and land on the dashboard. */
async function registerUser(page: any) {
  // Suppress OnboardingWizard for all navigations on this page instance.
  await page.addInitScript(() => {
    localStorage.setItem('rp_onboarded', 'true');
  });
  await page.goto('/');
  await page.getByText('Register').click();
  await page.getByLabel('Name').fill(testName);
  await page.getByLabel('Email').fill(`e2e+hh+${Date.now()}@example.com`);
  await page.getByLabel('Password').fill(testPassword);
  // Submit button label is "Create Account" (Register tab has role="tab", not role="button")
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/', { timeout: 10_000 });
}

/** Helper: open the wizard from the household page. */
async function openWizard(page: any) {
  await page.goto('/household');
  await page.getByRole('button', { name: /start setup wizard/i }).click();
  await expect(page.getByText('Household Setup Wizard')).toBeVisible();
}

/** Helper: complete wizard step 0 (household name). */
async function fillHouseholdName(page: any, name = householdName) {
  await page.getByLabel('Household Name').fill(name);
  await page.getByRole('button', { name: 'Next' }).click();
}

/** Helper: fill and submit the member form in step 1. */
async function addMemberInWizard(page: any, name: string, isFirst = true) {
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Date of Birth').fill('1970-06-15');
  await page.getByLabel('Province').click();
  await page.getByRole('option', { name: /Ontario/i }).click();
  const buttonLabel = isFirst ? /create household & add member/i : /add another member/i;
  await page.getByRole('button', { name: buttonLabel }).click();
  // Member chip should appear on step 1
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 8_000 });
}

test.describe('Household Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  test('creates a household with one member via the wizard', async ({ page }) => {
    await openWizard(page);

    // Step 0 — household name
    await fillHouseholdName(page);

    // Step 1 — add first member; page stays on step 1, chip is rendered
    await addMemberInWizard(page, memberName, true);

    // "Next" is now enabled (household exists); advance to step 2
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — income step; member accordion visible, skip income
    await expect(page.getByText(memberName).first()).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3 — completion step; finish wizard
    await page.getByRole('button', { name: 'Finish' }).click();

    // Wizard closes; member name appears in the members accordion list
    await expect(page.getByText(memberName).first()).toBeVisible({ timeout: 8_000 });
  });

  test('can add multiple members before advancing', async ({ page }) => {
    await openWizard(page);
    await fillHouseholdName(page);

    // Add first member
    await addMemberInWizard(page, memberName, true);

    // "Add Another Member" button should appear; add second member
    await addMemberInWizard(page, secondMemberName, false);

    // Both chips should be visible on step 1
    await expect(page.getByText(memberName).first()).toBeVisible();
    await expect(page.getByText(secondMemberName).first()).toBeVisible();

    // Advance through remaining steps
    await page.getByRole('button', { name: 'Next' }).click(); // → step 2
    await page.getByRole('button', { name: 'Next' }).click(); // → step 3
    await page.getByRole('button', { name: 'Finish' }).click();

    // Both members appear on the household page
    await expect(page.getByText(memberName).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(secondMemberName).first()).toBeVisible();
  });

  test('can add income to a member in wizard step 2', async ({ page }) => {
    await openWizard(page);
    await fillHouseholdName(page);
    await addMemberInWizard(page, memberName, true);
    await page.getByRole('button', { name: 'Next' }).click(); // → step 2

    // Step 2 accordions are defaultExpanded; 'Add Income Source' is already visible
    // Click "Add Income Source" inside the first member accordion
    await page.getByRole('button', { name: /add income source/i }).first().click();

    // Fill income dialog — field labels are "Name" and "Annual Amount ($)"
    await page.getByRole('dialog').getByLabel('Name').fill('CPP');
    await page.getByLabel(/annual amount/i).fill('12000');
    // Submit income form
    await page.getByRole('button', { name: /save|add/i }).last().click();

    // Income should appear inside the wizard dialog accordion
    await expect(page.getByLabel('Household Setup Wizard').getByText('CPP')).toBeVisible({ timeout: 8_000 });

    // Finish wizard
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByText(memberName).first()).toBeVisible({ timeout: 8_000 });
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  test('shows validation error when household name is empty', async ({ page }) => {
    await openWizard(page);
    await page.getByLabel('Household Name').fill('');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/please enter a household name/i)).toBeVisible();
  });

  test('"Next" is disabled on step 1 before any member is created', async ({ page }) => {
    await openWizard(page);
    await fillHouseholdName(page);
    // Next should be disabled until a household + member exists
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeDisabled();
  });
});
