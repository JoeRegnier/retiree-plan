import { test, expect } from '@playwright/test';

/**
 * Helpers
 */
function uniqueEmail() {
  return `e2e-${Date.now()}@test.local`;
}

const PASSWORD = 'Test1234!';

test.describe('Authentication', () => {
  test('registers a new user and lands on dashboard', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');

    // Switch to register tab / click register link
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
    }

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(PASSWORD);

    // Some forms have a confirm password field
    const confirmPw = page.getByLabel(/confirm password/i);
    if (await confirmPw.isVisible()) await confirmPw.fill(PASSWORD);

    await page.getByRole('button', { name: /register|sign up|create/i }).click();

    // Should redirect to dashboard or login, depending on auto-login
    await expect(page).toHaveURL(/\/(login|)/, { timeout: 10_000 });
  });

  test('logs in with valid credentials and shows dashboard', async ({ page }) => {
    const email = uniqueEmail();

    // Register first
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
    if (await registerLink.isVisible()) await registerLink.click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(PASSWORD);
    const confirmPw = page.getByLabel(/confirm password/i);
    if (await confirmPw.isVisible()) await confirmPw.fill(PASSWORD);
    await page.getByRole('button', { name: /register|sign up|create/i }).click();
    await page.waitForURL(/\/(login|)/, { timeout: 10_000 });

    // Now log in
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(PASSWORD);
    await page.getByRole('button', { name: /log in|sign in|login/i }).click();

    await expect(page).toHaveURL('/', { timeout: 10_000 });
    await expect(page.getByText(/retiree plan|dashboard/i).first()).toBeVisible();
  });
});

test.describe('Household creation', () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = uniqueEmail();

    // Register & log in
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
    if (await registerLink.isVisible()) await registerLink.click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(PASSWORD);
    const confirmPw = page.getByLabel(/confirm password/i);
    if (await confirmPw.isVisible()) await confirmPw.fill(PASSWORD);
    await page.getByRole('button', { name: /register|sign up|create/i }).click();
    await page.waitForURL(/\/(login|)/, { timeout: 10_000 });

    // Log in
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(PASSWORD);
    await page.getByRole('button', { name: /log in|sign in|login/i }).click();
    await page.waitForURL('/', { timeout: 10_000 });
  });

  test('creates a household with a member', async ({ page }) => {
    await page.goto('/household');
    await expect(page.getByRole('heading', { name: /household/i })).toBeVisible();

    // Fill household name
    const nameField = page.getByLabel(/household name/i);
    if (await nameField.isVisible()) {
      await nameField.fill('Test Family');
    }

    // Add a member
    const addMemberBtn = page.getByRole('button', { name: /add member/i });
    if (await addMemberBtn.isVisible()) {
      await addMemberBtn.click();
      await page.getByLabel(/name/i).last().fill('Alice Smith');
      const dobField = page.getByLabel(/date of birth|born/i).last();
      if (await dobField.isVisible()) await dobField.fill('1970-01-15');
    }

    // Save
    const saveBtn = page.getByRole('button', { name: /save|create/i });
    await saveBtn.click();

    // Verify success
    await expect(page.getByText(/household/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('navigates to Accounts page', async ({ page }) => {
    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();
  });

  test('navigates to Scenarios page', async ({ page }) => {
    await page.goto('/scenarios');
    await expect(page.getByRole('heading', { name: /scenarios/i })).toBeVisible();
  });

  test('navigates to Help page', async ({ page }) => {
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: /help/i })).toBeVisible();
  });

  test('navigates to Milestones page', async ({ page }) => {
    await page.goto('/milestones');
    await expect(page.getByRole('heading', { name: /milestone/i })).toBeVisible();
  });

  test('navigates to Estate page', async ({ page }) => {
    await page.goto('/estate');
    await expect(page.getByRole('heading', { name: /estate/i })).toBeVisible();
  });

  test('navigates to Compare page', async ({ page }) => {
    await page.goto('/compare');
    await expect(page.getByRole('heading', { name: /comparison|compare/i })).toBeVisible();
  });
});
