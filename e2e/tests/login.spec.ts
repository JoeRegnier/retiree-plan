import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('RetireePlan')).toBeVisible();
    await expect(page.getByText('Sign In')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('shows register tab', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Register').click();
    await expect(page.getByLabel('Name')).toBeVisible();
  });
});
