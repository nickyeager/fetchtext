/**
 * Cross-Document Field Matching — Production E2E Test
 *
 * Validates the full smart template matching workflow against the live
 * fetchtext.io site (or localhost when run locally):
 *   1. Warm backend (Azure Container Apps cold start handling)
 *   2. Verify CORS from a real browser
 *   3. Upload Contract A → processed via SSE → fields extracted → template matched
 *   4. Upload Contract B (structurally similar) → same template matched
 *   5. Verify both documents use the same template with similar field counts
 *   6. Verify each document's own values are present (no cross-contamination)
 *   7. No CORS, RLS, or storage errors throughout
 *
 * Run against production:
 *   cd dashboard
 *   npx playwright test --config=playwright.production.config.ts tests/e2e/production/cross-document-field-matching-production.pw.spec.ts --reporter=list
 *
 * Run against localhost:
 *   cd dashboard
 *   E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/production/cross-document-field-matching-production.pw.spec.ts --reporter=list
 */

import 'dotenv/config'
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  detectTarget,
  getCredentials,
  getBackendUrl,
  type Target,
} from '../helpers/env'
import {
  createLogger,
  uiLogin,
  navigateToWorkflow,
  monitorConsole,
  assertNoCriticalErrors,
  type ConsoleEntry,
} from '../helpers/auth'
import {
  waitForProcessingCompletion,
  assertProcessingComplete,
} from '../helpers/stream-monitor'

// ── Fixtures ──

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const contractAPath = path.resolve(
  __dirname,
  '../../fixtures/real-test-contract.txt',
)
const contractBPath = path.resolve(
  __dirname,
  '../../fixtures/real-test-contract-v2.txt',
)

const SCREENSHOT_DIR = '/tmp/cross-doc-matching-production-e2e'

const log = createLogger('cross-doc-prod')

// ── Types ──

interface DocumentInfo {
  detailUrl: string
  docId: string | undefined
  templateName: string | null
  fieldCount: number | null
}

// ── Helpers ──

/**
 * Warm the backend with retries (handles Azure Container Apps cold starts).
 * Returns true if the backend responded 200 within the retry budget.
 */
async function warmBackend(backendUrl: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await fetch(`${backendUrl}/health`, {
        signal: AbortSignal.timeout(60_000),
      })
      if (resp.ok) {
        log(`backend warm (attempt ${attempt})`)
        return true
      }
      log(`warm attempt ${attempt}/4 returned ${resp.status}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`warm attempt ${attempt}/4 failed: ${msg}`)
    }
    if (attempt < 4) {
      const waitMs = attempt * 15_000
      log(`retrying in ${waitMs / 1000}s...`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  return false
}

/**
 * Upload a file on the /documents/upload page and wait for SSE processing
 * to complete. Works against both local and production targets — timeouts
 * are scaled for network latency.
 */
async function uploadAndProcess(
  page: import('@playwright/test').Page,
  filePath: string,
  label: string,
  target: Target,
): Promise<DocumentInfo> {
  const { email, password } = getCredentials(target)

  // Production needs longer timeouts for network latency + Azure cold paths
  const dropZoneTimeout = target === 'production' ? 30_000 : 15_000
  const stageTimeout = target === 'production' ? 120_000 : 90_000
  const totalTimeout = target === 'production' ? 300_000 : 240_000
  const detailLoadTimeout = target === 'production' ? 60_000 : 30_000

  log(`[${label}] navigating to upload page`)
  await navigateToWorkflow(page, '/documents/upload', email, password, log)

  // Wait for drop zone
  const dropZone = page.locator('[data-testid="drop-zone"]')
  await expect(dropZone).toBeVisible({ timeout: dropZoneTimeout })
  await expect(dropZone).not.toHaveClass(/opacity-50/, {
    timeout: dropZoneTimeout,
  })
  log(`[${label}] drop zone ready`)

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${label}-01-upload-ready.png`,
  })

  // Upload file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
  log(`[${label}] file selected`)

  // Race: stream monitor vs auto-navigation to detail page.
  // When processing completes quickly the frontend navigates away before
  // the stream monitor can observe "Processing Complete" in the DOM.
  const detailUrlPattern = /\/documents\/[a-f0-9-]+(?:\?.*)?$/

  const navigationPromise = page
    .waitForURL(detailUrlPattern, { timeout: totalTimeout })
    .then(() => 'navigated' as const)

  const streamPromise = waitForProcessingCompletion(page, {
    stageTimeout,
    totalTimeout,
    screenshotDir: SCREENSHOT_DIR,
    log: (msg: string) => log(`[${label}] ${msg}`),
    pollInterval: 1_000,
  }).then((result) => ({ kind: 'stream' as const, result }))

  const winner = await Promise.race([navigationPromise, streamPromise])

  if (winner === 'navigated') {
    log(`[${label}] page navigated to detail before stream monitor finished`)
  } else {
    assertProcessingComplete(winner.result)
    log(
      `[${label}] processing complete: ${winner.result.stages.length} stages in ${Math.round(winner.result.duration_ms / 1000)}s`,
    )
    await page.waitForURL(detailUrlPattern, { timeout: 30_000 })
  }

  const detailUrl = page.url()
  const docId = detailUrl.match(/\/documents\/([a-f0-9-]+)/)?.[1]
  log(`[${label}] navigated to detail: ${detailUrl}`)

  // Wait for the detail page to fully render
  const completedBadge = page.getByText('Completed').first()
  await expect(completedBadge).toBeVisible({ timeout: detailLoadTimeout })
  log(`[${label}] detail page loaded (Completed badge visible)`)

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${label}-02-detail-loaded.png`,
    fullPage: true,
  })

  // Extract template name from the header badge area
  let templateName: string | null = null

  const headerBadges = page.locator('h1 + div span, h1 ~ div > div')
  const badgeCount = await headerBadges.count()
  for (let i = 0; i < badgeCount; i++) {
    const text = await headerBadges.nth(i).textContent().catch(() => '')
    if (
      text &&
      /template/i.test(text) &&
      !/template view/i.test(text) &&
      !/edit template/i.test(text) &&
      !/save template/i.test(text)
    ) {
      templateName = text.trim()
      break
    }
  }

  if (!templateName) {
    const bodyText = (await page.textContent('body')) || ''
    const match = bodyText.match(/(?:^|\s)([\w\s]+Template)(?=\s|$)/m)
    if (match && !/Template View/i.test(match[1])) {
      templateName = match[1].trim()
    }
  }

  log(`[${label}] template name: ${templateName || '(none)'}`)

  // Extract field count
  const fieldCountEl = page.getByText(/\d+\/\d+ fields/).first()
  let fieldCount: number | null = null
  const fieldCountText = await fieldCountEl
    .textContent({ timeout: 5_000 })
    .catch(() => null)
  if (fieldCountText) {
    const match = fieldCountText.match(/(\d+)\/(\d+) fields/)
    if (match) {
      fieldCount = parseInt(match[1], 10)
      log(`[${label}] field count: ${fieldCountText}`)
    }
  }

  // Scroll to see extracted fields section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1_000)

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${label}-03-scrolled.png`,
    fullPage: true,
  })

  return { detailUrl, docId, templateName, fieldCount }
}

// ── Tests ──

test.describe('Production: Cross-Document Field Matching', () => {
  // Two full upload cycles with production latency
  test.setTimeout(600_000)

  let resolvedTarget: Target

  test.beforeAll(() => {
    if (!fs.existsSync(contractAPath)) {
      throw new Error(`Fixture not found: ${contractAPath}`)
    }
    if (!fs.existsSync(contractBPath)) {
      throw new Error(`Fixture not found: ${contractBPath}`)
    }
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  })

  // ── TEST 1: Warm backend + verify health ──
  test('backend is reachable (warm up for Azure cold starts)', async () => {
    const baseURL = test.info().project.use.baseURL || ''
    resolvedTarget = detectTarget(baseURL)
    const backendUrl = getBackendUrl(resolvedTarget)

    log(`target=${resolvedTarget}, baseURL=${baseURL}, backend=${backendUrl}`)

    const isWarm = await warmBackend(backendUrl)
    expect(
      isWarm,
      `Backend unreachable after 4 attempts at ${backendUrl}/health`,
    ).toBe(true)

    // Verify CORS config in production
    if (resolvedTarget === 'production') {
      const corsResp = await fetch(`${backendUrl}/health/cors`, {
        signal: AbortSignal.timeout(30_000),
      }).catch(() => null)
      if (corsResp?.ok) {
        const corsData = await corsResp.json()
        log(`CORS allowed origins: ${JSON.stringify(corsData.allowed_origins)}`)
        expect(
          corsData.allowed_origins.some((o: string) =>
            o.includes('fetchtext.io'),
          ),
          `Production CORS must include fetchtext.io. Got: ${corsData.allowed_origins}`,
        ).toBe(true)
      }
    }

    log('backend warm and CORS verified')
  })

  // ── TEST 2: Browser CORS check (production-critical) ──
  test('browser can reach backend without CORS errors', async ({ page }) => {
    const baseURL = test.info().project.use.baseURL || ''
    resolvedTarget = detectTarget(baseURL)
    const backendUrl = getBackendUrl(resolvedTarget)
    const frontendUrl =
      resolvedTarget === 'production'
        ? 'https://fetchtext.io'
        : 'http://localhost:5173'

    log(`browser CORS: frontend=${frontendUrl} backend=${backendUrl}`)

    await page.goto(frontendUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })

    const result = await page.evaluate(async (url: string) => {
      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          credentials: 'omit',
        })
        return {
          ok: resp.ok,
          status: resp.status,
          corsHeader: resp.headers.get('access-control-allow-origin'),
          error: null,
        }
      } catch (err: unknown) {
        return {
          ok: false,
          status: 0,
          corsHeader: null,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }, `${backendUrl}/health`)

    log(`browser fetch result: ${JSON.stringify(result)}`)

    expect(
      result.error,
      `Browser fetch to ${backendUrl}/health failed (CORS block): ${result.error}`,
    ).toBeNull()
    expect(result.ok, `Backend returned ${result.status} (not 200)`).toBe(true)

    log('browser CORS verification passed')
  })

  // ── TEST 3: The actual cross-document field matching test ──
  test('uploads two similar contracts and verifies field matching', async ({
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL || ''
    resolvedTarget = detectTarget(baseURL)
    const { email, password } = getCredentials(resolvedTarget)

    log(`target=${resolvedTarget}`)

    // ── CORS-specific tracking (production-critical) ──
    const corsErrors: ConsoleEntry[] = []
    const consoleErrors = monitorConsole(page, log)

    page.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('CORS') ||
        text.includes('Access-Control-Allow-Origin') ||
        text.includes('blocked by CORS') ||
        text.includes('cross-origin')
      ) {
        corsErrors.push({ type: 'cors', text, timestamp: new Date() })
        log(`[CORS ERROR] ${text}`)
      }
    })

    const networkFailures: string[] = []
    page.on('requestfailed', (req) => {
      const failure = req.failure()
      if (failure) {
        networkFailures.push(
          `${req.method()} ${req.url()} → ${failure.errorText}`,
        )
        log(`[NETWORK FAIL] ${req.method()} ${req.url()} → ${failure.errorText}`)
      }
    })

    // ── Login ──
    await uiLogin(page, email, password, log)
    log('logged in')

    // ════════════════════════════════════════════════════════════
    // PHASE 1: Upload Contract A
    // ════════════════════════════════════════════════════════════

    log('═══ PHASE 1: Upload Contract A ═══')
    const contractA = await uploadAndProcess(
      page,
      contractAPath,
      'contractA',
      resolvedTarget,
    )

    const pageTextA = (await page.textContent('body')) || ''
    const hasProviderA = pageTextA.includes('Digital Solutions')
    const hasClientA = pageTextA.includes('Modern Manufacturing')
    log(
      `Contract A values — provider: ${hasProviderA ? 'YES' : 'no'}, client: ${hasClientA ? 'YES' : 'no'}`,
    )

    expect(
      hasProviderA || hasClientA,
      'Contract A should show at least one of its entity values on the detail page',
    ).toBe(true)

    // ════════════════════════════════════════════════════════════
    // PHASE 2: Upload Contract B
    // ════════════════════════════════════════════════════════════

    log('═══ PHASE 2: Upload Contract B ═══')
    const contractB = await uploadAndProcess(
      page,
      contractBPath,
      'contractB',
      resolvedTarget,
    )

    const pageTextB = (await page.textContent('body')) || ''
    const hasProviderB = pageTextB.includes('CloudNet Systems')
    const hasClientB = pageTextB.includes('Pacific Coast')
    log(
      `Contract B values — provider: ${hasProviderB ? 'YES' : 'no'}, client: ${hasClientB ? 'YES' : 'no'}`,
    )

    expect(
      hasProviderB || hasClientB,
      'Contract B should show at least one of its entity values on the detail page',
    ).toBe(true)

    // ════════════════════════════════════════════════════════════
    // PHASE 3: Compare — both should use the same template
    // ════════════════════════════════════════════════════════════

    log('═══ PHASE 3: Compare template matching ═══')

    log(`Contract A template: "${contractA.templateName}"`)
    log(`Contract B template: "${contractB.templateName}"`)
    log(`Contract A fields: ${contractA.fieldCount}`)
    log(`Contract B fields: ${contractB.fieldCount}`)

    // Assertion 1: Both documents were assigned a template
    expect(
      contractA.templateName,
      'Contract A should have been assigned a template',
    ).toBeTruthy()
    expect(
      contractB.templateName,
      'Contract B should have been assigned a template',
    ).toBeTruthy()

    // Assertion 2: Both documents use the SAME template
    const normA = (contractA.templateName || '').replace(/\s+/g, ' ').trim()
    const normB = (contractB.templateName || '').replace(/\s+/g, ' ').trim()
    expect(normB, 'Both contracts should match the same template').toBe(normA)

    log(`TEMPLATE MATCH VERIFIED: both contracts use "${normA}"`)

    // Assertion 3: Both documents have extracted fields (similar count)
    if (contractA.fieldCount !== null && contractB.fieldCount !== null) {
      expect(
        contractA.fieldCount,
        'Contract A should have at least 1 extracted field',
      ).toBeGreaterThanOrEqual(1)
      expect(
        contractB.fieldCount,
        'Contract B should have at least 1 extracted field',
      ).toBeGreaterThanOrEqual(1)

      const diff = Math.abs(contractA.fieldCount - contractB.fieldCount)
      expect(
        diff,
        `Field counts should be similar (A=${contractA.fieldCount}, B=${contractB.fieldCount}, diff=${diff}).`,
      ).toBeLessThanOrEqual(3)

      log(
        `FIELD COUNT OK: A=${contractA.fieldCount}, B=${contractB.fieldCount} (diff=${diff})`,
      )
    }

    // Assertion 4: No cross-contamination
    const crossContaminated =
      pageTextB.includes('Digital Solutions') &&
      !pageTextB.includes('CloudNet Systems')
    expect(
      crossContaminated,
      'Contract B should not show Contract A values exclusively',
    ).toBe(false)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/final-comparison.png`,
      fullPage: true,
    })

    // ── CORS error check (production-critical) ──
    if (corsErrors.length > 0) {
      log('\n=== CORS ERRORS DETECTED ===')
      corsErrors.forEach((e, i) => log(`  ${i + 1}. ${e.text}`))
    }
    expect(
      corsErrors,
      `CORS errors during upload:\n${corsErrors.map((e) => e.text).join('\n')}`,
    ).toHaveLength(0)

    // ── Backend network failure check ──
    const backendUrl = getBackendUrl(resolvedTarget)
    const backendFailures = networkFailures.filter(
      (f) => f.includes(backendUrl) || f.includes(':8090/'),
    )
    if (backendFailures.length > 0) {
      log('\n=== BACKEND NETWORK FAILURES ===')
      backendFailures.forEach((f) => log(`  ${f}`))
    }
    expect(
      backendFailures,
      `Backend network failures:\n${backendFailures.join('\n')}`,
    ).toHaveLength(0)

    // ── General console error check ──
    const filteredErrors = consoleErrors.filter(
      (e) =>
        !e.text.includes('pdfjs-dist') &&
        !e.text.includes('unpkg.com') &&
        !e.text.includes('pdf.worker'),
    )
    assertNoCriticalErrors(filteredErrors)

    log('Test PASSED')
  })
})
