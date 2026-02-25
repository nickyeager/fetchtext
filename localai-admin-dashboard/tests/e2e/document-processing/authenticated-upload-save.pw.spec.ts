import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { preflight } from '../utils/preflight'
import {
  createLogger,
  uiLogin,
  monitorConsole,
  assertNoCriticalErrors,
} from '../helpers/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const invoicePath = path.resolve(
  __dirname,
  '../../fixtures/real-test-invoice.txt'
)

const log = createLogger('auth-upload')

test.describe('Authenticated Upload with Save', () => {
  test.setTimeout(240_000)

  test('logged-in user can upload and document is saved', async ({ page }) => {
    // ── Preflight ──
    log('starting preflight')
    await preflight({ log: (...a) => log(`[preflight] ${a.join(' ')}`) })
    log('preflight passed')

    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD
    if (!email || !password)
      throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD not set')

    const consoleErrors = monitorConsole(page, log)

    // ── Login ──
    await uiLogin(page, email, password, log)
    log('login complete')

    // ── Navigate to upload page ──
    await page.goto('/documents/upload', { waitUntil: 'networkidle' })
    log('on upload page')

    // ── Verify upload zone is enabled (user is authenticated) ──
    const dropZone = page
      .locator('[data-testid="drag-drop-zone"]')
      .or(page.locator('.border-dashed'))
    await expect(dropZone.first()).toBeVisible({ timeout: 15_000 })
    log('upload zone visible')

    // ── Upload fixture ──
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(invoicePath)
    log('file uploaded')

    // ── Wait for SSE processing to start ──
    const processingLog = page
      .locator('[data-testid="processing-log-header"]')
      .or(page.getByText('Processing Document'))
    await expect(processingLog.first()).toBeVisible({ timeout: 30_000 })
    log('processing started')

    // ── Wait for completion or navigation ──
    // The upload page navigates to /documents/:id on completion
    await page.waitForURL(/\/documents\/[a-f0-9-]+/, { timeout: 180_000 })
    log('navigated to document detail')

    // ── Verify document detail page loaded ──
    expect(page.url()).toMatch(/\/documents\/[a-f0-9-]+/)

    // ── Take evidence screenshot ──
    await page.screenshot({
      path: '/tmp/auth-upload-result.png',
      fullPage: true,
    })

    // ── Console error check ──
    assertNoCriticalErrors(consoleErrors)
    log('Authenticated upload test PASSED')
  })
})
