/**
 * Demo Recording Script
 *
 * Records a full walkthrough of the FetchText demo flow as a .webm video.
 * Uses Playwright for reliable file uploads, SSE monitoring, and navigation.
 *
 * Run:
 *   cd dashboard
 *   source ~/.nvm/nvm.sh && nvm use 20
 *   npx playwright test ../docs/demo-recordings/record-demo.ts --reporter=list
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stuccoPdf = path.resolve(__dirname, '../fixtures/Stucco Contract V1.pdf');

const BASE = 'http://localhost:5173';
const PAUSE = (ms: number) => new Promise(r => setTimeout(r, ms));

test.use({
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 },
  launchOptions: { slowMo: 150 }, // Slow down for watchability
});

test('Demo — Full FetchText Walkthrough', async ({ page }) => {
  test.setTimeout(300_000); // 5 min max

  // ── Part 1: Login ─────────────────────────────────────────────────
  await page.goto(`${BASE}/sign-in`);
  await PAUSE(1500);

  await page.fill('input[type="email"], input[name="email"]', 'admin@fetchtext.local');
  await PAUSE(300);
  await page.fill('input[type="password"], input[name="password"]', 'CHANGEME-set-via-TEST_USER_PASSWORD-env');
  await PAUSE(300);

  await page.click('button:has-text("Login")');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await PAUSE(3000); // Let viewer see dashboard stats

  // ── Part 2: Documents List ────────────────────────────────────────
  await page.click('a:has-text("Documents"):not(:has-text("Upload"))');
  await page.waitForURL('**/documents');
  await PAUSE(3000);

  // ── Part 3: Upload Document (key demo moment) ─────────────────────
  await page.click('a:has-text("Upload Document")');
  await page.waitForURL('**/documents/upload');
  await PAUSE(2000);

  // Upload the stucco contract
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(stuccoPdf);
  await PAUSE(1000);

  // Watch SSE processing stages stream in
  // Wait for processing to complete (navigates to detail page)
  await page.waitForURL(/\/documents\/\d+/, { timeout: 120_000 });
  await PAUSE(4000); // Let viewer see PDF preview + extracted fields

  // Scroll down to see extracted field cards with confidence scores
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
  await PAUSE(3000);

  // Try to expand the scoring breakdown (if template match card is visible)
  const scoringBtn = page.locator('button:has-text("Scoring Breakdown")');
  if (await scoringBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await scoringBtn.click();
    await PAUSE(3000); // Show the 5-factor breakdown
  }

  // Scroll further to see more extracted fields
  await page.evaluate(() => window.scrollTo({ top: 1000, behavior: 'smooth' }));
  await PAUSE(3000);

  // ── Part 4: Templates List ────────────────────────────────────────
  await page.click('a:has-text("Templates")');
  await page.waitForURL('**/templates');
  await PAUSE(3000);

  // ── Part 5: Template Detail — Overview ────────────────────────────
  // Click the Contract Key Terms Extractor template
  await page.click('text=Contract Key Terms Extractor');
  await page.waitForURL(/\/templates\/\d+/);
  await PAUSE(3000);

  // ── Part 5b: Template Detail — Documents tab ──────────────────────
  await page.click('button:has-text("Documents"), [role="tab"]:has-text("Documents")');
  await PAUSE(3000);

  // ── Part 5c: Template Detail — Examples tab ───────────────────────
  await page.click('button:has-text("Examples"), [role="tab"]:has-text("Examples")');
  await PAUSE(3000);

  // ── Part 6: Settings > Integrations ───────────────────────────────
  // Settings is a collapsible sidebar section, not a direct link
  await page.goto(`${BASE}/settings/integrations`);
  await page.waitForURL('**/settings/integrations');
  await PAUSE(2000);

  // Scroll to Snowflake section
  const snowflake = page.getByText('Snowflake Stages', { exact: true });
  if (await snowflake.isVisible()) {
    await snowflake.scrollIntoViewIfNeeded();
    await PAUSE(2000);

    // Show OAuth tab
    const oauthTab = page.locator('[role="tab"]:has-text("OAuth")');
    if (await oauthTab.isVisible()) {
      await oauthTab.click();
      await PAUSE(2000);
    }

    // Switch back to Key-Pair
    const keyPairTab = page.locator('[role="tab"]:has-text("Key-Pair")');
    if (await keyPairTab.isVisible()) {
      await keyPairTab.click();
      await PAUSE(2000);
    }
  }

  // ── End: Return to dashboard ──────────────────────────────────────
  await page.click('a:has-text("Dashboard")');
  await page.waitForURL('**/dashboard');
  await PAUSE(3000);
});
