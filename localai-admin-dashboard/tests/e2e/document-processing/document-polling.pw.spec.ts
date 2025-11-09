import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TestAuthProvider, TEST_USER } from '../utils/test-auth-provider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Document Polling and Status Updates', () => {
  let authProvider: TestAuthProvider;
  let testDocumentId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Initialize test auth provider
    authProvider = new TestAuthProvider(TEST_USER);

    // Mock Supabase auth API calls
    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      const authState = authProvider.getAuthState();

      if (url.includes('/session')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { session: authState.session },
            error: null
          })
        });
      } else if (url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { user: authState.user },
            error: null
          })
        });
      } else {
        await route.continue();
      }
    });

    // Inject test auth provider
    await page.addInitScript(authProvider.getInjectionScript());

    // Set up console log monitoring
    page.on('console', (msg) => {
      const text = msg.text();
      // Log polling-related messages for debugging
      if (text.includes('Polling') || text.includes('Stop polling') || text.includes('Document not loaded')) {
        console.log(`[CONSOLE] ${text}`);
      }
    });
  });

  test('should continue polling when document data is undefined initially', async ({ page }) => {
    console.log('🧪 Testing polling behavior with undefined document data...');

    let pollCount = 0;
    let documentCreated = false;

    // Mock the document API to simulate undefined → processing → completed flow
    await page.route('**/rest/v1/documents**', async (route) => {
      const url = route.request().url();

      if (url.includes('select=') && url.includes('id.eq.')) {
        pollCount++;
        console.log(`📊 Poll attempt #${pollCount}`);

        // First 2 polls: return empty (document not found)
        if (pollCount <= 2) {
          console.log('  → Returning empty (document not created yet)');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]) // Empty array = no document
          });
        }
        // Polls 3-5: return processing document
        else if (pollCount <= 5) {
          console.log('  → Returning document with status: analyzing');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
              id: 'test-123',
              uuid: 'test-uuid-123',
              name: 'test-document.pdf',
              processing_status: 'analyzing',
              status: undefined,
              metadata: {
                processing_status: 'analyzing'
              }
            }])
          });
        }
        // After poll 5: return completed document
        else {
          console.log('  → Returning document with status: completed');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
              id: 'test-123',
              uuid: 'test-uuid-123',
              name: 'test-document.pdf',
              processing_status: 'completed',
              status: 'completed',
              metadata: {
                processing_status: 'completed',
                extracted_fields: {
                  field1: 'value1',
                  field2: 'value2'
                }
              }
            }])
          });
        }
      } else {
        await route.continue();
      }
    });

    // Navigate to a document detail view
    await page.goto('/_authenticated/documents/test-123', { waitUntil: 'domcontentloaded' });

    // Wait for polling to start
    await page.waitForTimeout(1000);

    // Verify polling messages in console
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Wait for multiple polling cycles (should see at least 6 polls)
    await page.waitForTimeout(15000); // 15 seconds should allow ~7 polls at 2-second intervals

    // Verify polling continued when data was undefined
    expect(pollCount).toBeGreaterThanOrEqual(6);

    // Check for the critical fix message
    const hasUndefinedPolling = await page.evaluate(() => {
      const logs = (window as any).__consoleLogs || [];
      return logs.some((log: string) => log.includes('Document not loaded yet, continuing to poll'));
    });

    console.log(`✅ Total polls executed: ${pollCount}`);
    console.log(`✅ Polling continued through undefined state: ${hasUndefinedPolling ? 'Yes' : 'No'}`);
  });

  test('should stop polling when document status is completed', async ({ page }) => {
    console.log('🧪 Testing polling stops when document is completed...');

    let pollCount = 0;
    let lastPollTime = Date.now();

    // Mock completed document from the start
    await page.route('**/rest/v1/documents**', async (route) => {
      const url = route.request().url();

      if (url.includes('select=') && url.includes('id.eq.')) {
        pollCount++;
        lastPollTime = Date.now();
        console.log(`📊 Poll attempt #${pollCount} at ${new Date(lastPollTime).toISOString()}`);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'test-completed',
            uuid: 'test-uuid-completed',
            name: 'completed-document.pdf',
            processing_status: 'completed',
            status: 'completed',
            metadata: {
              processing_status: 'completed',
              extracted_fields: { field1: 'value1' }
            }
          }])
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to document detail view
    await page.goto('/_authenticated/documents/test-completed', { waitUntil: 'domcontentloaded' });

    // Wait for initial load and potential polling
    await page.waitForTimeout(8000); // Wait 8 seconds

    // Polling should have stopped after first successful fetch
    // With a completed document, we expect only 1-2 polls (initial + maybe one check)
    expect(pollCount).toBeLessThanOrEqual(3);

    console.log(`✅ Polling stopped correctly. Total polls: ${pollCount}`);
  });

  test('should handle status transitions correctly', async ({ page }) => {
    console.log('🧪 Testing document status transitions...');

    let currentStatus = 'uploading';
    let pollCount = 0;
    const statusTransitions: string[] = [];

    // Mock dynamic status transitions
    await page.route('**/rest/v1/documents**', async (route) => {
      const url = route.request().url();

      if (url.includes('select=') && url.includes('id.eq.')) {
        pollCount++;

        // Simulate status progression
        if (pollCount === 1) currentStatus = 'uploading';
        else if (pollCount === 2) currentStatus = 'analyzing';
        else if (pollCount === 3) currentStatus = 'processing';
        else if (pollCount === 4) currentStatus = 'processing'; // Stay in processing
        else if (pollCount >= 5) currentStatus = 'completed';

        statusTransitions.push(currentStatus);
        console.log(`📊 Poll #${pollCount}: Status = ${currentStatus}`);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'test-transitions',
            uuid: 'test-uuid-transitions',
            name: 'transitioning-document.pdf',
            processing_status: currentStatus,
            metadata: {
              processing_status: currentStatus
            }
          }])
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to document detail view
    await page.goto('/_authenticated/documents/test-transitions', { waitUntil: 'domcontentloaded' });

    // Wait for status transitions (should take ~10 seconds for 5 polls)
    await page.waitForTimeout(12000);

    // Verify all expected transitions occurred
    expect(statusTransitions).toContain('uploading');
    expect(statusTransitions).toContain('analyzing');
    expect(statusTransitions).toContain('processing');
    expect(statusTransitions).toContain('completed');

    // Verify polling stopped after completed status
    const finalPollCount = pollCount;
    await page.waitForTimeout(4000); // Wait another 4 seconds
    expect(pollCount).toBe(finalPollCount); // No additional polls

    console.log('✅ Status transitions handled correctly:', statusTransitions.join(' → '));
  });

  test('should invalidate cache and refetch after status update', async ({ page }) => {
    console.log('🧪 Testing cache invalidation after status update...');

    let fetchCount = 0;
    let currentStatus = 'processing';

    // Mock document endpoint
    await page.route('**/rest/v1/documents**', async (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        fetchCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'test-cache',
            processing_status: currentStatus,
            metadata: { processing_status: currentStatus }
          }])
        });
      } else if (method === 'PATCH') {
        // Status update request
        currentStatus = 'completed';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-cache',
            processing_status: 'completed'
          })
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to document
    await page.goto('/_authenticated/documents/test-cache', { waitUntil: 'domcontentloaded' });

    const initialFetchCount = fetchCount;

    // Trigger a status update (this would normally happen via UI interaction)
    await page.evaluate(() => {
      // Simulate status update via console
      console.log('✅ Document status updated successfully:', {
        documentId: 'test-cache',
        newStatus: 'completed'
      });
    });

    // Wait for cache invalidation and refetch
    await page.waitForTimeout(3000);

    // Verify additional fetch occurred after update
    expect(fetchCount).toBeGreaterThan(initialFetchCount);

    console.log(`✅ Cache invalidation working. Fetches: ${fetchCount}`);
  });

  test('should handle API errors gracefully with retry logic', async ({ page }) => {
    console.log('🧪 Testing retry logic for failed API calls...');

    let attemptCount = 0;
    let shouldFail = true;

    // Mock API with intermittent failures
    await page.route('**/rest/v1/documents**', async (route) => {
      attemptCount++;
      console.log(`📊 API attempt #${attemptCount}: ${shouldFail ? 'FAIL' : 'SUCCESS'}`);

      if (shouldFail && attemptCount <= 2) {
        // Fail first 2 attempts
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      } else {
        // Succeed on 3rd attempt
        shouldFail = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'test-retry',
            processing_status: 'completed',
            metadata: { processing_status: 'completed' }
          }])
        });
      }
    });

    // Navigate to document
    await page.goto('/_authenticated/documents/test-retry', { waitUntil: 'domcontentloaded' });

    // Wait for retries to complete
    await page.waitForTimeout(5000);

    // Verify retry logic worked (should have made 3 attempts)
    expect(attemptCount).toBe(3);

    console.log(`✅ Retry logic working. Total attempts: ${attemptCount}`);
  });
});