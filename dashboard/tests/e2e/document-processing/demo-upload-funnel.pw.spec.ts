import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { preflight } from '../utils/preflight'
import {
  createLogger,
  getAuthToken,
  monitorConsole,
  assertNoCriticalErrors,
} from '../helpers/auth'
import { getBackendUrl } from '../helpers/env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const invoicePath = path.resolve(
  __dirname,
  '../../fixtures/real-test-invoice.txt'
)

const BACKEND_URL = getBackendUrl()
const log = createLogger('demo-funnel')

test.describe('Demo Upload Funnel (Guest → Sign-Up → Save)', () => {
  test.setTimeout(180_000)

  // Do NOT use stored auth state — this test is for unauthenticated users
  test.use({ storageState: { cookies: [], origins: [] } })

  test('guest can upload, see results, and save after sign-up', async ({
    page,
  }) => {
    // ── Preflight ──
    log('starting preflight')
    await preflight({ log: (...a) => log(`[preflight] ${a.join(' ')}`) })
    log('preflight passed')

    // ── Reset demo rate limiter ──
    // The in-memory rate limiter (3 req/day per IP) persists across test runs.
    // Reset it via the authenticated admin endpoint before testing the guest flow.
    log('resetting demo rate limiter')
    const token = await getAuthToken()
    const resetResp = await fetch(
      `${BACKEND_URL}/api/enhanced-documents/reset-demo-rate-limit`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (!resetResp.ok) {
      log(`rate limiter reset failed: ${resetResp.status} (non-fatal)`)
    } else {
      log('demo rate limiter reset')
    }

    const consoleErrors = monitorConsole(page, log)

    // ── Navigate to landing page ──
    log('navigating to landing page')
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // ── Find demo upload zone ──
    const uploadZone = page.locator('[data-testid="demo-upload-zone"]')
    await expect(uploadZone).toBeVisible({ timeout: 15_000 })
    log('demo upload zone visible')

    // ── Upload fixture file via hidden input ──
    const fileInput = page.locator('#demo-file-input')
    await fileInput.setInputFiles(invoicePath)
    log('file selected')

    // ── Wait for processing ──
    // Widget transitions through uploading → processing → success
    const results = page.locator('[data-testid="demo-results"]')
    await expect(results).toBeVisible({ timeout: 120_000 })
    log('demo results visible')

    // ── Verify extracted fields ──
    const fieldRows = results.locator('.border-b, .last\\:border-0').first()
    await expect(fieldRows).toBeVisible({ timeout: 5_000 })
    log('extracted fields visible')

    // ── Click Save Results ──
    const saveButton = page.locator('[data-testid="demo-save-button"]')
    await expect(saveButton).toBeVisible()
    await saveButton.click()
    log('clicked save button')

    // ── Verify sign-up dialog appears ──
    const dialog = page.locator('[data-testid="demo-signup-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    log('sign-up dialog visible')

    // ── Fill sign-up form ──
    // Generate unique email to avoid conflicts
    const testEmail = `demo-test-${Date.now()}@test.fetchtext.io`
    const testPassword = 'TestPassword123!'

    await dialog.getByPlaceholder('name@example.com').fill(testEmail)
    await dialog.locator('input[placeholder="********"]').first().fill(testPassword)
    await dialog.locator('input[placeholder="********"]').last().fill(testPassword)
    log('filled sign-up form')

    // ── Submit ──
    await dialog.getByRole('button', { name: 'Create Account' }).click()
    log('submitted sign-up form')

    // ── Wait for redirect to document detail ──
    // Document IDs may be numeric (auto-increment) or UUID-style
    await page.waitForURL(/\/documents\/[\da-f-]+/, { timeout: 30_000 })
    log('redirected to document detail')

    // ── Verify we're on a document page ──
    expect(page.url()).toMatch(/\/documents\/[\da-f-]+/)
    log('document detail URL confirmed')

    // ── Take evidence screenshot ──
    await page.screenshot({
      path: '/tmp/demo-funnel-result.png',
      fullPage: true,
    })

    // ── Console error check ──
    assertNoCriticalErrors(consoleErrors)
    log('Demo funnel test PASSED')
  })
})
