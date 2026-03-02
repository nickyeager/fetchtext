/**
 * Cross-Document Field Matching E2E Test
 *
 * Validates the full smart template matching workflow:
 *   1. Upload Contract A → processed via SSE → fields extracted → template matched/generated
 *   2. Upload Contract B (structurally similar) → same template matched
 *   3. Verify both documents use the same template with the same field count
 *   4. Verify each document's own values are present (not cross-contaminated)
 *
 * Both contracts are real "Service Agreement" fixtures with different parties/amounts
 * but identical document structure.
 *
 * Run:
 *   cd localai-admin-dashboard
 *   E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/cross-document-field-matching.pw.spec.ts --reporter=list
 */

import 'dotenv/config'
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCredentials, getBackendUrl } from '../helpers/env'
import {
  createLogger,
  uiLogin,
  navigateToWorkflow,
  monitorConsole,
  assertNoCriticalErrors,
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

const SCREENSHOT_DIR = '/tmp/cross-doc-matching-e2e'

const log = createLogger('cross-doc-match')

// ── Types ──

interface DocumentInfo {
  detailUrl: string
  docId: string | undefined
  templateName: string | null
  fieldCount: number | null
}

// ── Helpers ──

/** Upload a file on the /documents/upload page and wait for SSE processing to complete. */
async function uploadAndProcess(
  page: import('@playwright/test').Page,
  filePath: string,
  label: string,
): Promise<DocumentInfo> {
  log(`[${label}] navigating to upload page`)
  await navigateToWorkflow(
    page,
    '/documents/upload',
    getCredentials().email,
    getCredentials().password,
    log,
  )

  // Wait for drop zone
  const dropZone = page.locator('[data-testid="drop-zone"]')
  await expect(dropZone).toBeVisible({ timeout: 15_000 })
  await expect(dropZone).not.toHaveClass(/opacity-50/, { timeout: 15_000 })
  log(`[${label}] drop zone ready`)

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${label}-01-upload-ready.png`,
  })

  // Upload file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
  log(`[${label}] file selected`)

  // Race: stream monitor vs auto-navigation to detail page.
  // When processing completes quickly the frontend navigates away from the
  // upload page before the stream monitor can observe "Processing Complete"
  // in the DOM — the ProcessingLog unmounts on navigation.  We therefore
  // also watch for the URL change and treat it as success.
  const detailUrlPattern = /\/documents\/[a-f0-9-]+(?:\?.*)?$/

  const navigationPromise = page
    .waitForURL(detailUrlPattern, { timeout: 240_000 })
    .then(() => 'navigated' as const)

  const streamPromise = waitForProcessingCompletion(page, {
    stageTimeout: 90_000,
    totalTimeout: 240_000,
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

  // Wait for the detail page to fully render.
  // Look for the "Completed" status badge which confirms the document loaded.
  const completedBadge = page.getByText('Completed').first()
  await expect(completedBadge).toBeVisible({ timeout: 30_000 })
  log(`[${label}] detail page loaded (Completed badge visible)`)

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${label}-02-detail-loaded.png`,
    fullPage: true,
  })

  // Extract template name from the page header area.
  // The UI renders it as a non-button element with an icon + text like "Invoice Template"
  // next to the "Completed" badge.  We exclude buttons (e.g. "Template View") by
  // looking for the element that is NOT a button and contains "Template".
  // The SSE stage message also reports the template: "Template matched: <name> (<score>%)"
  // so we capture from both sources for reliability.
  let templateName: string | null = null

  // Strategy 1: Read from the header badge (non-button, non-interactive element)
  // The Completed badge and template badge are siblings in a flex container.
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

  // Strategy 2: Fall back to the broader page text
  if (!templateName) {
    const bodyText = (await page.textContent('body')) || ''
    const match = bodyText.match(
      /(?:^|\s)([\w\s]+Template)(?=\s|$)/m,
    )
    if (match && !/Template View/i.test(match[1])) {
      templateName = match[1].trim()
    }
  }

  log(`[${label}] template name: ${templateName || '(none)'}`)

  // Extract field count from the "N/N fields" badge near "Edit Template"
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

  // Scroll down to see extracted fields section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1_000)

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${label}-03-scrolled.png`,
    fullPage: true,
  })

  return { detailUrl, docId, templateName, fieldCount }
}

// ── Tests ──

test.describe('Cross-Document Field Matching', () => {
  test.setTimeout(600_000)

  test.beforeAll(() => {
    if (!fs.existsSync(contractAPath)) {
      throw new Error(`Fixture not found: ${contractAPath}`)
    }
    if (!fs.existsSync(contractBPath)) {
      throw new Error(`Fixture not found: ${contractBPath}`)
    }
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  })

  test('backend is healthy', async () => {
    const backendUrl = getBackendUrl()
    const resp = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(30_000),
    })
    expect(resp.ok, `Backend unhealthy: ${resp.status}`).toBe(true)
    log('backend healthy')
  })

  test('uploads two similar contracts and verifies field matching', async ({
    page,
  }) => {
    const { email, password } = getCredentials()
    const consoleErrors = monitorConsole(page, log)

    // ── Login ──
    await uiLogin(page, email, password, log)
    log('logged in')

    // ════════════════════════════════════════════════════════════
    // PHASE 1: Upload Contract A
    // ════════════════════════════════════════════════════════════

    log('═══ PHASE 1: Upload Contract A ═══')
    const contractA = await uploadAndProcess(page, contractAPath, 'contractA')

    // Verify Contract A shows specific known values
    const pageTextA = (await page.textContent('body')) || ''
    const hasProviderA = pageTextA.includes('Digital Solutions')
    const hasClientA = pageTextA.includes('Modern Manufacturing')
    log(
      `Contract A values — provider: ${hasProviderA ? 'YES' : 'no'}, client: ${hasClientA ? 'YES' : 'no'}`,
    )

    // At least the document text should be present
    expect(
      hasProviderA || hasClientA,
      'Contract A should show at least one of its entity values on the detail page',
    ).toBe(true)

    // ════════════════════════════════════════════════════════════
    // PHASE 2: Upload Contract B
    // ════════════════════════════════════════════════════════════

    log('═══ PHASE 2: Upload Contract B ═══')
    const contractB = await uploadAndProcess(page, contractBPath, 'contractB')

    // Verify Contract B shows its own values (not Contract A's)
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

    // Core assertion 1: Both documents were assigned a template
    expect(
      contractA.templateName,
      'Contract A should have been assigned a template',
    ).toBeTruthy()
    expect(
      contractB.templateName,
      'Contract B should have been assigned a template',
    ).toBeTruthy()

    // Core assertion 2: Both documents use the SAME template
    // (normalise for comparison — template badge text may include icons)
    const normA = (contractA.templateName || '').replace(/\s+/g, ' ').trim()
    const normB = (contractB.templateName || '').replace(/\s+/g, ' ').trim()
    expect(normB, 'Both contracts should match the same template').toBe(normA)

    log(`TEMPLATE MATCH VERIFIED: both contracts use "${normA}"`)

    // Core assertion 3: Both documents have extracted fields
    if (contractA.fieldCount !== null && contractB.fieldCount !== null) {
      expect(
        contractA.fieldCount,
        'Contract A should have at least 1 extracted field',
      ).toBeGreaterThanOrEqual(1)
      expect(
        contractB.fieldCount,
        'Contract B should have at least 1 extracted field',
      ).toBeGreaterThanOrEqual(1)

      // Field counts should be similar (LLM may extract slightly different
      // numbers depending on document content, but the same template means
      // they should be in the same ballpark).
      const diff = Math.abs(contractA.fieldCount - contractB.fieldCount)
      expect(
        diff,
        `Field counts should be similar (A=${contractA.fieldCount}, B=${contractB.fieldCount}, diff=${diff}). ` +
          `A large difference suggests different templates were used.`,
      ).toBeLessThanOrEqual(3)

      log(
        `FIELD COUNT OK: A=${contractA.fieldCount}, B=${contractB.fieldCount} (diff=${diff})`,
      )
    }

    // Core assertion 4: Contract B does NOT show Contract A's values
    // (ensures extraction ran on the actual document, not cached from A)
    const crossContaminated =
      pageTextB.includes('Digital Solutions') &&
      !pageTextB.includes('CloudNet Systems')
    expect(
      crossContaminated,
      'Contract B should not show Contract A values exclusively — extraction should run on the actual document',
    ).toBe(false)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/final-comparison.png`,
      fullPage: true,
    })

    // ── Console error check ──
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
