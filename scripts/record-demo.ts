/**
 * scripts/record-demo.ts
 *
 * Playwright script that records a ~90-second demo walkthrough of RetireePlan
 * and saves the result to docs/demo.webm for embedding in the GitHub Pages
 * landing page and README.
 *
 * Usage (requires both dev servers to already be running):
 *   npx tsx scripts/record-demo.ts
 *   — or —
 *   npm run demo:record
 *
 * Start servers first in separate terminals:
 *   npm run dev:api   (port 3000)
 *   npm run dev:web   (port 5173)
 *
 * Output: docs/demo.webm  (~5–20 MB depending on animation complexity)
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';
const EMAIL    = 'test@retireeplan.dev';
const PASSWORD = 'TestPassword123!';
const DOCS_DIR = path.resolve(__dirname, '../docs');
const OUT_FILE = path.join(DOCS_DIR, 'demo.webm');

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor(page: import('playwright').Page, selector: string, ms = 10_000) {
  try { await page.waitForSelector(selector, { timeout: ms }); } catch { /* best-effort */ }
}

(async () => {
  console.log('🎬  RetireePlan demo recorder starting…');
  console.log(`    Output → ${OUT_FILE}\n`);

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: DOCS_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  // Skip the onboarding wizard for the test account (same approach as e2e tests)
  await context.addInitScript(() => {
    localStorage.setItem('rp_onboarded', 'true');
  });

  const page = await context.newPage();

  // ── 1. Login ───────────────────────────────────────────────────────────────
  console.log('  [1/8] Login');
  await page.goto(`${BASE_URL}/login`);
  await waitFor(page, 'input[type="email"]', 20_000);
  await pause(1500);

  // Type credentials at a human-readable pace so the viewer can follow
  await page.type('input[type="email"]', EMAIL, { delay: 55 });
  await pause(400);
  await page.type('input[type="password"]', PASSWORD, { delay: 55 });
  await pause(900);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
  await pause(2000);

  // ── 2. Dashboard ───────────────────────────────────────────────────────────
  console.log('  [2/8] Dashboard');
  await waitFor(page, 'text=Retirement Readiness', 8_000);
  await pause(3000);

  // Scroll down to reveal insights / completion checklist, then back up
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await pause(2500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(1200);

  // ── 3. Cash-Flow Projections ───────────────────────────────────────────────
  console.log('  [3/8] Projections');
  await page.goto(`${BASE_URL}/projections`);
  await waitFor(page, 'text=Cash-Flow Projections', 10_000);
  await pause(1800);

  // Pick the "Base Case" scenario
  const scenarioCombo = page.getByLabel('Scenario');
  if (await scenarioCombo.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await scenarioCombo.click();
    await pause(500);
    try {
      await page.getByRole('option', { name: 'Base Case' }).click();
    } catch {
      await page.keyboard.press('Escape');
    }
  }
  await pause(1000);

  // Run the projection and wait for the summary stats
  try {
    await page.getByRole('button', { name: /run projection/i }).click();
    await page.waitForSelector('text=Peak Net Worth', { timeout: 30_000 });
  } catch { /* projection may be slow on CI; continue anyway */ }
  await pause(3500);

  // Browse chart tabs to show variety
  try {
    await page.getByRole('tab', { name: /waterfall/i }).click();
    await pause(2000);
    const incomeTab = page.getByRole('tab', { name: /income/i }).first();
    if (await incomeTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await incomeTab.click();
      await pause(2000);
    }
  } catch { /* tabs optional */ }

  // ── 4. Monte Carlo Simulations ─────────────────────────────────────────────
  console.log('  [4/8] Simulations');
  await page.goto(`${BASE_URL}/simulations`);
  await waitFor(page, 'text=Simulations', 10_000);
  await pause(1800);

  try {
    const mcCombo = page.getByRole('combobox').first();
    await mcCombo.click();
    await pause(400);
    await page.getByRole('option', { name: 'Base Case' }).click();
    await pause(800);
    await page.getByRole('button', { name: /run|simulate/i }).first().click();
    // Monte Carlo can take up to 30 s with 1 000 trials
    await page.waitForSelector('text=Success Rate', { timeout: 40_000 });
  } catch { /* render whatever state we have */ }
  await pause(3500);

  // Flip to the success-rate heatmap
  try {
    await page.getByRole('tab', { name: /heatmap/i }).click();
    await pause(2500);
  } catch { /* tab optional */ }

  // ── 5. Tax Analytics ──────────────────────────────────────────────────────
  console.log('  [5/8] Tax Analytics');
  await page.goto(`${BASE_URL}/tax-analytics`);
  await waitFor(page, 'text=From household', 10_000);
  await pause(3000);

  await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  await pause(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(1000);

  // ── 6. Accounts ────────────────────────────────────────────────────────────
  console.log('  [6/8] Accounts');
  await page.goto(`${BASE_URL}/accounts`);
  await waitFor(page, "text=David's RRSP", 10_000);
  await pause(3000);

  // ── 7. Scenarios ───────────────────────────────────────────────────────────
  console.log('  [7/8] Scenarios');
  await page.goto(`${BASE_URL}/scenarios`);
  await waitFor(page, 'text=Base Case', 10_000);
  await pause(3000);

  // ── 8. Back to Dashboard (end on a high note) ─────────────────────────────
  console.log('  [8/8] Dashboard (final)');
  await page.goto(`${BASE_URL}/`);
  await waitFor(page, 'text=Retirement Readiness', 8_000);
  await pause(4000);

  // ── Save ───────────────────────────────────────────────────────────────────
  console.log('\n  → Closing browser and flushing video…');
  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    console.error('❌  No video object found. Was recordVideo configured?');
    process.exit(1);
  }

  const tmpPath = await video.path();
  if (!fs.existsSync(tmpPath)) {
    console.error('❌  Video file not found at', tmpPath);
    process.exit(1);
  }

  if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);
  fs.renameSync(tmpPath, OUT_FILE);

  const sizeMB = (fs.statSync(OUT_FILE).size / 1_048_576).toFixed(1);
  console.log(`\n✅  Saved: ${OUT_FILE}  (${sizeMB} MB)`);
  console.log('    Embed in HTML: <video src="demo.webm" autoplay loop muted playsinline controls>');
  console.log('    Commit docs/demo.webm and push to deploy on GitHub Pages.\n');
})();
