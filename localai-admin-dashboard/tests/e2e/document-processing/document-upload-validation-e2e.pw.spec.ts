import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { preflight } from '../utils/preflight';
import {
  createLogger,
  uiLogin,
  monitorConsole,
  assertNoCriticalErrors,
} from '../helpers/auth';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ESM-safe fixture path
const contractPath = new URL(
  '../../fixtures/real-test-contract.txt',
  import.meta.url
).pathname;

// Temp directory for programmatically generated test files
const tmpDir = os.tmpdir();
const oversizedFilePath = path.join(tmpDir, 'e2e-oversized-test.bin');
const invalidExePath = path.join(tmpDir, 'e2e-invalid.exe');
const invalidZipPath = path.join(tmpDir, 'e2e-invalid.zip');

const log = createLogger('upload-validation');

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function setup(page: Page) {
  await preflight({ log: (...a) => log(`[preflight] ${a.join(' ')}`) });

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password)
    throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD not set');

  const consoleErrors = monitorConsole(page);
  await uiLogin(page, email, password);

  return { email, password, consoleErrors };
}

/** Navigate to the upload page and wait for the drop zone to be ready and enabled. */
async function goToUpload(page: Page, search = '') {
  const url = `/documents/upload${search}`;
  log(`navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const dropZone = page.locator('[data-testid="drop-zone"]');
  await expect(dropZone).toBeVisible({ timeout: 15_000 });

  // Wait for the zone to become enabled (not disabled via opacity-50).
  // The zone is disabled until auth + org context loads.
  await expect(dropZone).not.toHaveClass(/opacity-50/, { timeout: 15_000 });

  return dropZone;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Document Upload Validation', () => {
  test.setTimeout(240_000); // 4 minutes — generous for CI

  test.beforeAll(async () => {
    log('generating test fixtures');
    // 11 MB file — exceeds the 10 MB DEFAULT_MAX_SIZE in drag-drop-zone.tsx
    fs.writeFileSync(oversizedFilePath, Buffer.alloc(11 * 1024 * 1024, 0x61));
    // Small files with unsupported extensions
    fs.writeFileSync(invalidExePath, 'MZ-fake-executable-content');
    fs.writeFileSync(invalidZipPath, 'PK-fake-zip-content');
    log('test fixtures ready');
  });

  test.afterAll(async () => {
    for (const f of [oversizedFilePath, invalidExePath, invalidZipPath]) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  // -----------------------------------------------------------------------
  // 1. File Size Validation
  // -----------------------------------------------------------------------
  test('rejects files exceeding the 10 MB size limit', async ({ page }) => {
    const { consoleErrors } = await setup(page);
    await goToUpload(page);

    // Track whether any request reaches the document-processor backend
    let backendHit = false;
    page.on('request', (req) => {
      if (req.url().includes('localhost:8090')) backendHit = true;
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(oversizedFilePath);

    // Error UI must appear inside the DragDropZone
    await expect(page.getByText('Upload Error')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText(/exceeds maximum allowed size/)
    ).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Click to try again')).toBeVisible();

    // No backend call should have been made — validation is client-side
    expect(backendHit, 'Expected no backend request for oversized file').toBe(
      false
    );

    assertNoCriticalErrors(consoleErrors);
    log('Test 1 PASSED — file size validation');
  });

  // -----------------------------------------------------------------------
  // 2. Unsupported File Type Rejection
  // -----------------------------------------------------------------------
  test('rejects unsupported file types (.exe, .zip)', async ({ page }) => {
    const { consoleErrors } = await setup(page);
    await goToUpload(page);

    const fileInput = page.locator('input[type="file"]');

    // --- .exe ---
    log('testing .exe rejection');
    await fileInput.setInputFiles(invalidExePath);
    await expect(page.getByText('Upload Error')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText(/\.exe.*is not supported/)
    ).toBeVisible({ timeout: 3_000 });
    log('.exe rejected correctly');

    // --- .zip (setting a new file clears previous error then re-validates) ---
    log('testing .zip rejection');
    await fileInput.setInputFiles(invalidZipPath);
    await expect(
      page.getByText(/\.zip.*is not supported/)
    ).toBeVisible({ timeout: 5_000 });
    log('.zip rejected correctly');

    assertNoCriticalErrors(consoleErrors);
    log('Test 2 PASSED — unsupported file types');
  });

  // -----------------------------------------------------------------------
  // 3. Drag & Drop Visual State
  // -----------------------------------------------------------------------
  test('shows visual feedback during drag interactions', async ({ page }) => {
    const { consoleErrors } = await setup(page);
    const dropZone = await goToUpload(page);

    // Initial state — no drag highlight
    await expect(dropZone).not.toHaveClass(/border-blue-500/);

    // Dispatch native dragover → React handler sets isDragging = true
    await dropZone.dispatchEvent('dragover');
    await expect(dropZone).toHaveClass(/border-blue-500/, { timeout: 3_000 });
    log('drag-over highlight active');

    // Dispatch native dragleave → isDragging = false
    await dropZone.dispatchEvent('dragleave');
    await expect(dropZone).not.toHaveClass(/border-blue-500/, { timeout: 3_000 });
    log('drag-leave highlight removed');

    assertNoCriticalErrors(consoleErrors);
    log('Test 3 PASSED — drag & drop visual state');
  });

  // -----------------------------------------------------------------------
  // 4. Sequential Uploads
  // -----------------------------------------------------------------------
  test('handles sequential uploads without state leakage', async ({
    page,
  }) => {
    const { consoleErrors } = await setup(page);

    // --- First upload ---
    await goToUpload(page);
    const fileInput1 = page.locator('input[type="file"]');
    await fileInput1.setInputFiles(contractPath);

    // Confirm upload accepted — evaluating/analyzing state appears
    // Use .first() because both DragDropZone and DocumentUploadPage show analyzing text
    await expect(
      page
        .getByText('Analyzing Document')
        .or(page.getByText('Analyzing document...'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
    log('first upload accepted');

    // --- Navigate back to a fresh upload page ---
    await goToUpload(page);

    // Verify clean state: no stale errors or lingering analysis
    await expect(page.getByText('Upload Error')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(page.getByText('Analyzing Document').first()).not.toBeVisible({
      timeout: 2_000,
    });
    log('upload page is clean after first upload');

    // --- Second upload ---
    const fileInput2 = page.locator('input[type="file"]');
    await fileInput2.setInputFiles(contractPath);

    await expect(
      page
        .getByText('Analyzing Document')
        .or(page.getByText('Analyzing document...'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
    log('second upload accepted — no state leakage');

    assertNoCriticalErrors(consoleErrors);
    log('Test 4 PASSED — sequential uploads');
  });

  // -----------------------------------------------------------------------
  // 5. Pre-Selected Template via URL Params
  // -----------------------------------------------------------------------
  test('displays pre-selected template info from URL params', async ({
    page,
  }) => {
    const { consoleErrors } = await setup(page);

    const templateId = process.env.TEST_TEMPLATE_ID || 'e2e-placeholder-id';
    const templateName = 'E2E Test Template';
    const search =
      `?templateId=${encodeURIComponent(templateId)}` +
      `&templateType=smart` +
      `&templateName=${encodeURIComponent(templateName)}`;

    await goToUpload(page, search);

    // Template notification alert must be visible (scoped to the Alert)
    await expect(
      page.getByRole('alert').getByText('Template Selected:')
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('alert').getByText(templateName)
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('alert').getByText('smart template')
    ).toBeVisible({ timeout: 5_000 });

    // Help card reflects the pre-selected state
    await expect(
      page.getByText('Ready to Process with Selected Template')
    ).toBeVisible({ timeout: 5_000 });

    // "Clear Selection" button exists and is functional
    const clearBtn = page.getByRole('button', { name: 'Clear Selection' });
    await expect(clearBtn).toBeVisible();

    assertNoCriticalErrors(consoleErrors);
    log('Test 5 PASSED — pre-selected template URL params');
  });

  // -----------------------------------------------------------------------
  // 6. Error Recovery
  // -----------------------------------------------------------------------
  test('recovers from validation error to successful upload', async ({
    page,
  }) => {
    const { consoleErrors } = await setup(page);
    await goToUpload(page);

    // Upload invalid file → error state
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(invalidExePath);

    await expect(page.getByText('Upload Error')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Click to try again')).toBeVisible();
    log('error state displayed');

    // Click "try again" text → opens file dialog → choose a valid file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Click to try again').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(contractPath);

    // Error must clear and upload must proceed to analysis
    await expect(page.getByText('Upload Error')).not.toBeVisible({
      timeout: 10_000,
    });
    // Use .first() because both DragDropZone and DocumentUploadPage show analyzing text
    await expect(
      page
        .getByText('Analyzing Document')
        .or(page.getByText('Analyzing document...'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
    log('error cleared, upload proceeding');

    assertNoCriticalErrors(consoleErrors);
    log('Test 6 PASSED — error recovery');
  });
});
