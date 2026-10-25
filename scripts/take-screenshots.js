/**
 * scripts/take-screenshots.js
 *
 * Playwright script that logs in with the test account and captures
 * screenshots of every major page for the README / docs.
 *
 * Usage (both dev servers must be running first):
 *   node scripts/take-screenshots.js
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const EMAIL    = 'test@retireeplan.dev';
const PASSWORD = 'TestPassword123!';
const OUT_DIR  = path.resolve(__dirname, '../docs/screenshots');

// Page list removed — each page has its own capture function below

async function dismissTour(page) {
  try {
    const closeBtn = page.locator('[aria-label="Close onboarding"]').first();
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForSelector('.MuiDialog-root', { state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
  } catch {
    // Tour not present — that's fine
  }
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  // Dismiss the Getting Started tour that auto-opens on first visit
  await page.waitForTimeout(800);
  await dismissTour(page);
  console.log('  ✓ Logged in');
}

async function save(page, filename) {
  await page.waitForTimeout(1200);
  const dest = path.join(OUT_DIR, filename);
  await page.screenshot({ path: dest, fullPage: true });
  const kb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log(`\n  ✓ ${filename}  (${kb} KB)`);
}

async function goto(page, route, waitFor) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  if (waitFor) {
    await page.waitForSelector(waitFor, { timeout: 10_000 }).catch(() => {});
  }
  await dismissTour(page);
}

// ── Individual page capture functions ────────────────────────────────────────

async function captureDashboard(page) {
  await goto(page, '/', '.MuiCard-root');
  await page.waitForTimeout(1500);
  await save(page, '01-dashboard.png');
}

async function captureHousehold(page) {
  await goto(page, '/household', '.MuiCard-root');
  await save(page, '02-household.png');
}

async function captureAccounts(page) {
  await goto(page, '/accounts', '.MuiCard-root');
  await save(page, '03-accounts.png');
}

async function captureScenarios(page) {
  await goto(page, '/scenarios', '.MuiCard-root');
  await save(page, '04-scenarios.png');
}

async function captureProjections(page) {
  await goto(page, '/projections', '[aria-label="Scenario"]');

  // Select Base Case scenario
  await page.getByLabel('Scenario').click();
  await page.getByRole('option', { name: 'Base Case' }).click();

  // Run projection
  await page.getByRole('button', { name: /run projection/i }).click();

  // Wait for results
  await page.waitForSelector('text=Peak Net Worth', { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await save(page, '05-projections.png');
}

async function captureSimulations(page) {
  await goto(page, '/simulations', '[role="tab"]');

  // Monte Carlo tab (default) — select Base Case and run
  const scenarioSelect = page.getByRole('combobox').first();
  await scenarioSelect.click();
  await page.getByRole('option', { name: 'Base Case' }).click();
  await page.getByRole('button', { name: /run|simulate/i }).first().click();
  await page.waitForSelector('text=Success Rate', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await save(page, '06-simulations.png');
}

async function captureRetireFinder(page) {
  await goto(page, '/retire-finder', '.MuiCard-root');

  // Select a scenario
  const scenarioEl = page.getByRole('combobox').first();
  const scenarioVisible = await scenarioEl.isVisible({ timeout: 2_000 }).catch(() => false);
  if (scenarioVisible) {
    await scenarioEl.click();
    await page.getByRole('option', { name: 'Base Case' }).click().catch(() => {});
  }

  // Click Find Earliest and wait for results
  await page.getByRole('button', { name: /find earliest/i }).click();
  await page.waitForSelector('svg', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await save(page, '07-retire-finder.png');
}

async function captureTaxAnalytics(page) {
  await goto(page, '/tax-analytics', '.MuiCard-root');
  await save(page, '08-tax-analytics.png');
}

async function captureCompare(page) {
  await goto(page, '/compare', '.MuiCard-root');

  // Both scenario pickers are MUI TextField[select] → role="combobox"
  // Select the first available option for Scenario A
  const comboboxes = page.getByRole('combobox');
  await comboboxes.nth(0).click();
  const optionsA = page.getByRole('option');
  await optionsA.first().waitFor({ timeout: 5_000 });
  const optCountA = await optionsA.count();
  // Click the first real option (index 0 is the placeholder "<em>Select a scenario</em>")
  await optionsA.nth(optCountA > 1 ? 1 : 0).click();

  // Small pause so the list closes before opening the next
  await page.waitForTimeout(400);

  // Select a different option for Scenario B (use the last available)
  await comboboxes.nth(1).click();
  const optionsB = page.getByRole('option');
  await optionsB.first().waitFor({ timeout: 5_000 });
  const optCountB = await optionsB.count();
  // Use the last option so we're guaranteed a different pick from A
  await optionsB.nth(optCountB - 1).click();

  await page.getByRole('button', { name: /^run$/i }).click();
  await page.waitForSelector('svg', { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await save(page, '09-compare.png');
}

async function captureEstate(page) {
  await goto(page, '/estate', '.MuiCard-root');

  // Pre-fill numeric inputs that are empty so calculation has values
  const inputs = page.locator('input[type="number"]');
  const inputCount = await inputs.count();
  for (let i = 0; i < Math.min(inputCount, 4); i++) {
    const val = await inputs.nth(i).inputValue().catch(() => '1');
    if (!val || val === '0' || val === '') {
      await inputs.nth(i).fill('500000');
    }
  }

  await page.getByRole('button', { name: /calculate estate/i }).click();
  await page.waitForSelector('text=Gross Estate', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await save(page, '10-estate.png');
}

async function captureInternational(page) {
  await goto(page, '/international', '.MuiCard-root');
  await save(page, '11-international.png');
}

async function captureMilestones(page) {
  await goto(page, '/milestones', '.MuiCard-root');
  await save(page, '12-milestones.png');
}

async function captureGoals(page) {
  await goto(page, '/goals', '.MuiCard-root');

  // Add a goal if none exist yet
  const addBtn = page.getByRole('button', { name: /add.*goal|add your first goal/i });
  const addVisible = await addBtn.first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (addVisible) {
    await addBtn.first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });

    // Fill goal name
    await page.getByLabel('Goal Name').fill('Retire Comfortably at 60').catch(() => {});

    // Fill target amount — exact label from GoalsPage.tsx
    await page.getByLabel('Target Amount ($)').fill('2000000').catch(() => {});

    // Submit — button text is "Create" for new goals
    await page.getByRole('dialog').getByRole('button', { name: /create|update|save/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  await save(page, '13-goals.png');
}

async function captureAiChat(page) {
  await goto(page, '/ai-chat', '.MuiCard-root');
  await save(page, '14-ai-chat.png');
}

async function captureIntegrations(page) {
  await goto(page, '/integrations', '.MuiCard-root');
  await save(page, '15-integrations.png');
}

async function captureSettings(page) {
  await goto(page, '/settings', '.MuiCard-root');
  await save(page, '16-settings.png');
}

async function captureHelp(page) {
  await goto(page, '/help', '.MuiCard-root');
  await save(page, '19-help.png');
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // Suppress the onboarding wizard on every page by pre-setting its localStorage flag
  await context.addInitScript(() => {
    localStorage.setItem('rp_onboarded', 'true');
  });

  const page = await context.newPage();

  // Login page (pre-auth)
  console.log('\nCapturing login page…');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '00-login.png'), fullPage: true });
  const loginKb = (fs.statSync(path.join(OUT_DIR, '00-login.png')).size / 1024).toFixed(0);
  console.log(`  ✓ 00-login.png  (${loginKb} KB)`);

  console.log('\nLogging in…');
  await login(page);

  const steps = [
    ['Dashboard',     captureDashboard],
    ['Household',     captureHousehold],
    ['Accounts',      captureAccounts],
    ['Scenarios',     captureScenarios],
    ['Projections',   captureProjections],
    ['Simulations',   captureSimulations],
    ['Retire Finder', captureRetireFinder],
    ['Tax Analytics', captureTaxAnalytics],
    ['Compare',       captureCompare],
    ['Estate',        captureEstate],
    ['International', captureInternational],
    ['Milestones',    captureMilestones],
    ['Goals',         captureGoals],
    ['AI Chat',       captureAiChat],
    ['Integrations',  captureIntegrations],
    ['Settings',      captureSettings],
    ['Help',          captureHelp],
  ];

  console.log('\nCapturing authenticated pages…');
  for (const [label, fn] of steps) {
    process.stdout.write(`  → ${label}…`);
    try {
      await fn(page);
    } catch (err) {
      console.error(`\n    ✗ ${label} failed: ${err.message}`);
    }
  }

  await browser.close();

  console.log('\n─────────────────────────────────────');
  console.log(`Done! ${steps.length + 1} screenshots saved to docs/screenshots/`);
  console.log('─────────────────────────────────────\n');
})().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
