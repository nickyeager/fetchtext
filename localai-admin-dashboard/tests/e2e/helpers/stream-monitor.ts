/**
 * Stream Monitor — E2E helper for monitoring SSE document processing stages.
 *
 * Watches the ProcessingLog UI component for stage transitions,
 * detects stalls (no new stage within timeout), detects errors,
 * and takes diagnostic screenshots at key points.
 *
 * Usage:
 *   const result = await waitForProcessingCompletion(page, {
 *     stageTimeout: 90_000,
 *     totalTimeout: 240_000,
 *     screenshotDir: '/tmp',
 *     log,
 *   });
 *   expect(result.final_status).toBe('complete');
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageEntry {
  stage: string;
  status: string;
  message: string;
  timestamp: number;
}

export interface ProcessingResult {
  /** All stages observed in order. */
  stages: StageEntry[];
  /** Total processing time in ms. */
  duration_ms: number;
  /** Final outcome. */
  final_status: 'complete' | 'error' | 'stalled';
  /** Error or stall description (populated when final_status !== 'complete'). */
  error_message?: string;
  /** Progress percentage at time of completion/failure. */
  progress: number;
}

export interface WaitOptions {
  /** Max ms between stage transitions before declaring a stall. Default: 90s. */
  stageTimeout?: number;
  /** Max total processing time. Default: 240s. */
  totalTimeout?: number;
  /** Directory for diagnostic screenshots. Default: /tmp. */
  screenshotDir?: string;
  /** Logger function. */
  log?: (msg: string) => void;
  /** Polling interval in ms. Default: 1000. */
  pollInterval?: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Read current progress percentage from the ProcessingLog header.
 */
async function getProgress(page: Page): Promise<number> {
  const text = await page
    .locator('[data-testid="processing-progress"]')
    .textContent({ timeout: 3_000 })
    .catch(() => '0%');
  return parseInt(text || '0', 10);
}

/**
 * Read all stage entries currently rendered in the ProcessingLog.
 */
async function getStageEntries(page: Page): Promise<StageEntry[]> {
  const entries = await page
    .locator('[data-testid="processing-stage-entry"]')
    .all()
    .catch(() => []);

  const results: StageEntry[] = [];
  for (const entry of entries) {
    try {
      const stage = (await entry.getAttribute('data-stage')) || 'unknown';
      const status = (await entry.getAttribute('data-stage-status')) || 'unknown';
      const message = (await entry.locator('[data-testid="processing-stage-message"]').textContent({ timeout: 3_000 })) || '';
      results.push({
        stage,
        status,
        message: message.trim(),
        timestamp: Date.now(),
      });
    } catch {
      // Element detached (page navigated away) — return what we have so far
      break;
    }
  }
  return results;
}

/**
 * Read the ProcessingLog header text (Processing Document | Processing Complete | Processing Error).
 */
async function getHeaderText(page: Page): Promise<string> {
  return (
    (await page
      .locator('[data-testid="processing-log-header"]')
      .textContent({ timeout: 3_000 })
      .catch(() => '')) || ''
  ).trim();
}

/**
 * Read the error banner text if visible.
 */
async function getErrorBannerText(page: Page): Promise<string | null> {
  const banner = page.locator('[data-testid="processing-error-banner"]');
  const visible = await banner.isVisible().catch(() => false);
  if (!visible) return null;
  return (await banner.textContent({ timeout: 3_000 }).catch(() => null)) || 'Unknown error';
}

/**
 * Capture a diagnostic screenshot with context info in the filename.
 */
async function diagnosticScreenshot(
  page: Page,
  dir: string,
  label: string,
): Promise<void> {
  const safeName = label.replace(/[^a-z0-9_-]/gi, '-').substring(0, 50);
  const ts = Date.now();
  await page.screenshot({ path: `${dir}/processing-${safeName}-${ts}.png` }).catch(() => {});
}

/**
 * Wait for the full document processing pipeline to complete,
 * monitoring each stage for stalls and errors.
 *
 * Returns a structured result that tests can assert on.
 */
export async function waitForProcessingCompletion(
  page: Page,
  options: WaitOptions = {},
): Promise<ProcessingResult> {
  const {
    stageTimeout = 90_000,
    totalTimeout = 240_000,
    screenshotDir = '/tmp',
    log = () => {},
    pollInterval = 1_000,
  } = options;

  const startTime = Date.now();
  let lastProgressTime = Date.now();
  let lastStageCount = 0;
  let lastProgress = 0;
  const allStages: StageEntry[] = [];

  // ── Wait for ProcessingLog to appear ──
  const headerLocator = page.locator('[data-testid="processing-log-header"]');
  try {
    await expect(headerLocator).toBeVisible({ timeout: 30_000 });
  } catch {
    return {
      stages: [],
      duration_ms: Date.now() - startTime,
      final_status: 'error',
      error_message: 'ProcessingLog component never appeared. The upload may not have triggered SSE streaming.',
      progress: 0,
    };
  }
  log('ProcessingLog visible');

  // ── Poll for progress ──
  while (true) {
    const elapsed = Date.now() - startTime;
    const sinceLast = Date.now() - lastProgressTime;

    // ── Total timeout ──
    if (elapsed > totalTimeout) {
      await diagnosticScreenshot(page, screenshotDir, 'total-timeout');
      const stages = await getStageEntries(page);
      const progress = await getProgress(page);
      return {
        stages,
        duration_ms: elapsed,
        final_status: 'stalled',
        error_message:
          `Total timeout (${Math.round(totalTimeout / 1000)}s) exceeded. ` +
          `Progress: ${progress}%. ` +
          `Stages reached: [${stages.map((s) => s.stage).join(', ')}]. ` +
          `Last stage: "${stages[stages.length - 1]?.message || 'none'}"`,
        progress,
      };
    }

    // ── Check for page navigation (auto-redirect to document detail) ──
    // When processing completes, the frontend may navigate to /documents/<uuid>
    // before we can read the "Processing Complete" header.
    const currentUrl = page.url();
    if (/\/documents\/(?!upload|gallery|templates)[a-f0-9-]+/.test(currentUrl)) {
      await diagnosticScreenshot(page, screenshotDir, 'navigated-complete');
      log(`Processing completed via navigation to ${currentUrl} in ${Math.round(elapsed / 1000)}s`);
      return {
        stages: allStages,
        duration_ms: elapsed,
        final_status: 'complete',
        progress: 100,
      };
    }

    // ── Check for error state ──
    const headerText = await getHeaderText(page);
    if (headerText.includes('Processing Error')) {
      const errorText = await getErrorBannerText(page);
      const stages = await getStageEntries(page);
      const progress = await getProgress(page);
      await diagnosticScreenshot(page, screenshotDir, 'processing-error');
      return {
        stages,
        duration_ms: elapsed,
        final_status: 'error',
        error_message: errorText || 'Processing error (no banner text)',
        progress,
      };
    }

    // ── Check for completion ──
    if (headerText.includes('Processing Complete')) {
      const stages = await getStageEntries(page);
      const progress = await getProgress(page);
      await diagnosticScreenshot(page, screenshotDir, 'processing-complete');
      log(`Processing complete in ${Math.round(elapsed / 1000)}s, ${stages.length} stages, ${progress}%`);
      return {
        stages,
        duration_ms: elapsed,
        final_status: 'complete',
        progress,
      };
    }

    // ── Track stage progression for stall detection ──
    const currentStages = await getStageEntries(page);
    const currentProgress = await getProgress(page);

    if (currentStages.length > lastStageCount || currentProgress > lastProgress) {
      // New stage appeared or progress changed — reset stall timer
      if (currentStages.length > lastStageCount) {
        const newEntries = currentStages.slice(lastStageCount);
        for (const entry of newEntries) {
          log(`Stage [${entry.stage}]: ${entry.message}`);
          allStages.push(entry);
        }
      }
      if (currentProgress > lastProgress) {
        log(`Progress: ${currentProgress}%`);
      }
      lastStageCount = currentStages.length;
      lastProgress = currentProgress;
      lastProgressTime = Date.now();
    }

    // ── Per-stage stall detection ──
    // Only declare a stall if the ProcessingLog header is gone (page navigated)
    // or if it no longer says "Processing Document" (indicating active work).
    // AI field extraction via Ollama can take 2+ minutes on a single stage.
    if (sinceLast > stageTimeout) {
      const stillProcessing = headerText.toLowerCase().includes('processing document');
      if (!stillProcessing) {
        await diagnosticScreenshot(page, screenshotDir, 'stage-stall');
        const stages = await getStageEntries(page);
        const progress = await getProgress(page);
        const lastStage = stages[stages.length - 1];
        return {
          stages,
          duration_ms: elapsed,
          final_status: 'stalled',
          error_message:
            `Stage stall detected: no progress for ${Math.round(stageTimeout / 1000)}s. ` +
            `Progress: ${progress}%. ` +
            `Stalled after stage "${lastStage?.stage || 'none'}": "${lastStage?.message || 'none'}"`,
          progress,
        };
      }
      // ProcessingLog still showing active processing — extend the stall timer
      // since the backend is still working (e.g., slow AI extraction)
      log(`Stage timeout reached (${Math.round(stageTimeout / 1000)}s) but processing still active, extending...`);
    }

    await page.waitForTimeout(pollInterval);
  }
}

/**
 * Assert that processing completed successfully.
 * Use after waitForProcessingCompletion() to fail the test with a clear message.
 */
export function assertProcessingComplete(result: ProcessingResult): void {
  if (result.final_status === 'complete') return;

  const stageList = result.stages
    .map((s, i) => `  ${i + 1}. [${s.stage}] ${s.message}`)
    .join('\n');

  throw new Error(
    `Document processing ${result.final_status}.\n` +
      `Error: ${result.error_message}\n` +
      `Duration: ${Math.round(result.duration_ms / 1000)}s\n` +
      `Progress: ${result.progress}%\n` +
      `Stages:\n${stageList || '  (none)'}`,
  );
}
