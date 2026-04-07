import { chromium } from 'playwright';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';
const OUT = path.resolve(__dirname, '../docs/screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.addInitScript(() => localStorage.setItem('rp_onboarded', 'true'));

  // login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'test@retireeplan.dev');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15_000 });

  // navigate to decisions
  await page.goto(`${BASE_URL}/decisions`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Decision Journal', { timeout: 10_000 });
  // Dismiss any open modal/dialog (e.g. onboarding wizard)
  const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("×")');
  if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(1000);

  // click the 3rd toggle button (mind map)
  const toggles = await page.locator('.MuiToggleButtonGroup-root button').all();
  if (toggles.length >= 3) {
    await toggles[2].click();
    await page.waitForTimeout(2500); // wait for D3 simulation to settle
  }

  await page.screenshot({ path: `${OUT}/18-decision-mindmap.png`, fullPage: true });
  console.log('✓ 18-decision-mindmap.png');

  await browser.close();
})();
