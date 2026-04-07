/**
 * scripts/take-screenshots.ts
 *
 * Playwright script that logs in with the test account and captures
 * full-page screenshots of every major page for the README / docs.
 *
 * Usage:
 *   npx ts-node --esm scripts/take-screenshots.ts
 *   — or —
 *   npx tsx scripts/take-screenshots.ts
 *
 * Requires the web dev server and API to already be running:
 *   npm run dev:api   (port 3000)
 *   npm run dev:web   (port 5173)
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL  = 'http://localhost:5173';
const EMAIL     = 'test@retireeplan.dev';
const PASSWORD  = 'TestPassword123!';
const OUT_DIR   = path.resolve(__dirname, '../docs/screenshots');

const PAGES: Array<{ route: string; filename: string; waitFor?: string; note?: string }> = [
  { route: '/login',         filename: '00-login.png',          waitFor: 'text=RetireePlan' },
  { route: '/',              filename: '01-dashboard.png',       waitFor: 'text=Retirement Readiness' },
  { route: '/household',     filename: '02-household.png',       waitFor: 'text=Household' },
  { route: '/accounts',      filename: '03-accounts.png',        waitFor: 'text=Accounts' },
  { route: '/scenarios',     filename: '04-scenarios.png',       waitFor: 'text=Scenarios' },
  { route: '/projections',   filename: '05-projections.png',     waitFor: 'text=Projections' },
  { route: '/simulations',   filename: '06-simulations.png',     waitFor: 'text=Simulations' },
  { route: '/retire-finder', filename: '07-retire-finder.png',   waitFor: 'text=Earliest' },
  { route: '/tax-analytics', filename: '08-tax-analytics.png',   waitFor: 'text=Tax' },
  { route: '/compare',       filename: '09-compare.png',         waitFor: 'text=Compare' },
  { route: '/estate',        filename: '10-estate.png',          waitFor: 'text=Estate' },
  { route: '/international', filename: '11-international.png',   waitFor: 'text=International' },
  { route: '/milestones',    filename: '12-milestones.png',      waitFor: 'text=Milestones' },
  { route: '/goals',         filename: '13-goals.png',           waitFor: 'text=Goals' },
  { route: '/ai-chat',       filename: '14-ai-chat.png',         waitFor: 'text=AI' },
  { route: '/integrations',  filename: '15-integrations.png',    waitFor: 'text=Integrations' },
  { route: '/settings',      filename: '16-settings.png',        waitFor: 'text=Settings' },  { route: '/decisions',     filename: '17-decisions.png',     waitFor: 'text=Decision Journal' },];

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  console.log('  ✓ Logged in');
}

async function screenshot(page: Page, route: string, filename: string, waitFor?: string) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  if (waitFor) {
    try {
      await page.waitForSelector(waitFor, { timeout: 8_000 });
    } catch {
      // Best-effort — page may load differently with test data
    }
  }
  // Small settle delay for charts / animations
  await page.waitForTimeout(1200);

  const dest = path.join(OUT_DIR, filename);
  await page.screenshot({ path: dest, fullPage: true });
  console.log(`  ✓ ${filename}`);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina quality
  });
  // Suppress the onboarding wizard and any first-run dialogs globally
  await context.addInitScript(() => {
    localStorage.setItem('rp_onboarded', 'true');
  });
  const page = await context.newPage();

  // Screenshot the login page before logging in
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, '00-login.png'), fullPage: true });
  console.log('  ✓ 00-login.png');

  console.log('\nLogging in…');
  await login(page);

  console.log('\nCapturing pages…');
  for (const { route, filename, waitFor } of PAGES.slice(1)) {
    await screenshot(page, route, filename, waitFor);
  }

  await browser.close();

  console.log(`\nDone! Screenshots saved to docs/screenshots/\n`);
  console.log('Files:');
  fs.readdirSync(OUT_DIR).sort().forEach((f) => {
    const size = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0);
    console.log(`  ${f}  (${size} KB)`);
  });
})();
