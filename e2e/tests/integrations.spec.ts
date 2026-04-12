/**
 * Integrations Page — File Import E2E Tests
 *
 * Covers:
 *  1. Integrations page loads and shows all sections
 *  2. OFX file upload triggers a preview dialog
 *  3. Wealthsimple CSV upload triggers a preview dialog
 *  4. Monarch Money CSV upload triggers a preview dialog
 *  5. Upload with an invalid file shows an error
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a temp file on disk and return its path. Clean up after the test. */
function tempFile(name: string, content: string | Buffer): string {
  const p = path.join(os.tmpdir(), name);
  fs.writeFileSync(p, content);
  return p;
}

const MINIMAL_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:151
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>CAD
<BANKACCTFROM>
<BANKID>021000021
<ACCTID>11223344
<ACCTTYPE>SAVINGS
</BANKACCTFROM>
<LEDGERBAL>
<BALAMT>12500.00
<DTASOF>20240101000000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const MINIMAL_WS_CSV = `Date,Account,Type,Amount,Currency
2024-01-31,RRSP Self-Directed,eod balance,45000,CAD
2024-01-31,TFSA Self-Directed,eod balance,22000,CAD
`;

const MINIMAL_MONARCH_CSV = `Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags
2024-01-15,Grocery Store,Groceries,Chequing,,,-200.00,
2024-01-20,Gas Station,Transportation,Chequing,,,-80.00,
2024-02-10,Grocery Store,Groceries,Chequing,,,-210.00,
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Integrations Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/integrations');
    await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Page structure ──────────────────────────────────────────────────────

  test('shows the page heading and main sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /file.*csv import/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /universal ofx.*qfx import/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /wealthsimple activity csv/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /monarch money csv/i })).toBeVisible();
  });

  test('shows all brokerage cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Questrade', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wealthsimple', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'TD Bank', exact: true })).toBeVisible();
  });

  test('shows YNAB section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /ynab/i })).toBeVisible();
  });

  // ── OFX Upload ──────────────────────────────────────────────────────────

  test('OFX upload opens preview dialog', async ({ page }) => {
    const ofxPath = tempFile('test.ofx', MINIMAL_OFX);

    try {
      // Intercept the file input
      const fileInput = page.locator('input[type="file"][accept=".ofx,.qfx"]');

      // Trigger file chooser via the upload button
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser').catch(() => null),
        page.getByRole('button', { name: /upload ofx.*qfx/i }).click(),
      ]);

      if (fileChooser) {
        await fileChooser.setFiles(ofxPath);
      } else {
        // Fallback: set file directly on the input element
        await fileInput.setInputFiles(ofxPath);
      }

      // The preview dialog should appear
      await expect(
        page.getByRole('dialog').getByText(/ofx import preview/i),
      ).toBeVisible({ timeout: 15_000 });

      // Should show the account we uploaded
      await expect(page.getByText(/SAVINGS/i)).toBeVisible();

      // Cancel should close the dialog
      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    } finally {
      fs.unlinkSync(ofxPath);
    }
  });

  // ── Wealthsimple CSV Upload ──────────────────────────────────────────────

  test('Wealthsimple CSV upload opens preview dialog', async ({ page }) => {
    const csvPath = tempFile('ws-activity.csv', MINIMAL_WS_CSV);

    try {
      const fileInput = page.locator('input[type="file"][accept=".csv"]').first();

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser').catch(() => null),
        page.getByRole('button', { name: /upload wealthsimple csv/i }).click(),
      ]);

      if (fileChooser) {
        await fileChooser.setFiles(csvPath);
      } else {
        await fileInput.setInputFiles(csvPath);
      }

      await expect(
        page.getByRole('dialog').getByText(/wealthsimple csv import preview/i),
      ).toBeVisible({ timeout: 15_000 });

      // Should show both found accounts
      await expect(page.getByText(/RRSP/i).first()).toBeVisible();
      await expect(page.getByText(/TFSA/i).first()).toBeVisible();

      await page.getByRole('button', { name: /cancel/i }).click();
    } finally {
      fs.unlinkSync(csvPath);
    }
  });

  // ── Monarch Money CSV Upload ─────────────────────────────────────────────

  test('Monarch Money CSV upload opens expense preview dialog', async ({ page }) => {
    const csvPath = tempFile('monarch.csv', MINIMAL_MONARCH_CSV);

    try {
      // The Monarch button is the 3rd file upload button on the page
      const fileInput = page.locator('input[type="file"][accept=".csv"]').nth(1);

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser').catch(() => null),
        page.getByRole('button', { name: /upload monarch money csv/i }).click(),
      ]);

      if (fileChooser) {
        await fileChooser.setFiles(csvPath);
      } else {
        await fileInput.setInputFiles(csvPath);
      }

      await expect(
        page.getByRole('dialog').getByText(/monarch money expense/i),
      ).toBeVisible({ timeout: 15_000 });

      // Should show expense categories
      await expect(page.getByText('Groceries')).toBeVisible();
      await expect(page.getByText('Transportation')).toBeVisible();

      await page.getByRole('button', { name: /cancel/i }).click();
    } finally {
      fs.unlinkSync(csvPath);
    }
  });

  // ── Error handling ───────────────────────────────────────────────────────

  test('uploading a non-OFX file shows an error', async ({ page }) => {
    const badPath = tempFile('bad.ofx', 'this is not an ofx file');

    try {
      const fileInput = page.locator('input[type="file"][accept=".ofx,.qfx"]');

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser').catch(() => null),
        page.getByRole('button', { name: /upload ofx.*qfx/i }).click(),
      ]);

      if (fileChooser) {
        await fileChooser.setFiles(badPath);
      } else {
        await fileInput.setInputFiles(badPath);
      }

      // Should show an error alert rather than a dialog
      await expect(
        page.getByRole('alert').filter({ hasText: /invalid|failed|no.*ofx/i }),
      ).toBeVisible({ timeout: 15_000 });

      // No preview dialog should open
      await expect(
        page.getByRole('dialog').getByText(/ofx import preview/i),
      ).not.toBeVisible();
    } finally {
      fs.unlinkSync(badPath);
    }
  });

  // ── OnboardingWizard integration step ────────────────────────────────────

  test('OnboardingWizard has a Connect Your Data step', async ({ browser }) => {
    // Use a fresh context so there is no addInitScript that auto-sets rp_onboarded
    const context = await browser.newContext();
    const wzPage  = await context.newPage();

    try {
      // Login manually (no init script in this context)
      await wzPage.goto('/');
      await wzPage.getByLabel('Email').fill('test@retireeplan.dev');
      await wzPage.getByLabel('Password').fill('TestPassword123!');
      await wzPage.getByRole('button', { name: /sign in|log in/i }).click();
      await wzPage.waitForURL(/\/(dashboard|accounts|projections|$)/, { timeout: 10_000 });

      // Clear the flag and reload — wizard should auto-open
      await wzPage.evaluate(() => localStorage.removeItem('rp_onboarded'));
      await wzPage.reload();
      await wzPage.waitForTimeout(600);

      const wizardDialog = wzPage.getByRole('dialog');
      await expect(wizardDialog).toBeVisible({ timeout: 10_000 });

      // Verify "Connect Your Data" appears as a step label (step 4 of 7)
      await expect(wizardDialog.getByText('Connect Your Data')).toBeVisible();

      // Navigate to that step (it's 3 clicks from the start: 1→2→3→4)
      for (let i = 0; i < 3; i++) {
        await wizardDialog.getByRole('button', { name: /continue|next/i }).first().click();
        await wzPage.waitForTimeout(300);
      }

      // Now the Connect Your Data step is active — verify its description text
      const dialogText = await wizardDialog.textContent();
      expect(dialogText).toMatch(/connect your data/i);
      expect(dialogText).toMatch(/questrade|ofx|wealthsimple/i);
    } finally {
      await context.close();
    }
  });
});
