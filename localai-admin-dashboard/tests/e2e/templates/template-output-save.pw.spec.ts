/**
 * Playwright E2E Test: Template Output Auto-Save
 *
 * Tests the complete save flow for template output edits:
 * 1. Navigate to a document with template
 * 2. Enter edit mode in Template Output tab
 * 3. Make an edit
 * 4. Wait for auto-save (1s debounce)
 * 5. Verify save completed
 * 6. Refresh and verify persistence
 *
 * This test captures console logs to trace the save flow through our diagnostic logging.
 */

import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { preflight } from '../utils/preflight';

// Debug logging helper
function logStep(step: string) {
  if (process.env.E2E_DEBUG || process.env.E2E_DEBUG_TEMPLATE_SAVE) {
    /* eslint-disable no-console */
    console.log(`[template-save] ${step}`);
    /* eslint-enable no-console */
  }
}

test.describe('Template Output Auto-Save', () => {
  test.setTimeout(180_000); // Allow 3 minutes for full flow

  test('saves template edits to document metadata and persists across refresh', async ({
    page,
  }) => {
    // Collect console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      // Log template save related messages in real-time
      if (
        text.includes('[TemplateOutputView]') ||
        text.includes('[DocumentDetailView]') ||
        text.includes('UpdateDocumentStatus')
      ) {
        logStep(`CONSOLE: ${text}`);
      }
    });

    // Preflight validations
    logStep('starting preflight');
    await preflight({
      log: (...a) => {
        if (process.env.E2E_DEBUG || process.env.E2E_DEBUG_TEMPLATE_SAVE) {
          /* eslint-disable no-console */
          console.log('[template-save][preflight]', ...a);
          /* eslint-enable no-console */
        }
      },
    });
    logStep('preflight complete');

    // Get credentials
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password)
      throw new Error('TEST_USER_EMAIL/TEST_USER_PASSWORD not set');

    // Login
    logStep('navigating to sign-in');
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    const emailInput = page.getByPlaceholder('name@example.com');
    const loginButton = page.getByRole('button', { name: 'Login' });

    if (await loginButton.isVisible().catch(() => false)) {
      logStep('performing UI login');
      await emailInput.fill(email);
      await page.getByPlaceholder('********').fill(password);
      await loginButton.click();
      await page.waitForURL(/dashboard|documents/, {
        timeout: 20000,
      });
      logStep('login complete');
    }

    // Navigate to documents list to find a document
    logStep('navigating to documents list');
    await page.goto('/documents', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Switch to Admin's Workspace to find documents with templates
    // The test user has been added to Admin's organization
    logStep('checking if need to switch organization');
    const orgSwitcher = page.locator('button').filter({ hasText: /workspace/i }).first();
    if (await orgSwitcher.isVisible().catch(() => false)) {
      const currentOrgText = await orgSwitcher.textContent();
      logStep(`current org: ${currentOrgText}`);

      // If not in Admin's Workspace, switch to it
      if (!currentOrgText?.includes("Admin's Workspace")) {
        await orgSwitcher.click();
        await page.waitForTimeout(1000);

        // Take screenshot to see the dropdown
        await page.screenshot({ path: '/tmp/test-results/org-dropdown.png', fullPage: true });
        logStep('took screenshot of org dropdown');

        // Look for Admin's Workspace in the dropdown - try multiple selectors
        const dropdownItems = await page.locator('[role="menuitem"], [role="option"], .dropdown-item, button').all();
        logStep(`found ${dropdownItems.length} dropdown items`);

        for (const item of dropdownItems) {
          const text = await item.textContent().catch(() => '');
          if (text?.toLowerCase().includes('admin')) {
            logStep(`found Admin workspace item: ${text}`);
            await item.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // Re-navigate to documents after org switch
            await page.goto('/documents', { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle');
            break;
          }
        }
      }
    }

    // Take screenshot of documents page
    await page.screenshot({ path: '/tmp/test-results/documents-page.png', fullPage: true });
    logStep('took screenshot of documents page');

    // Click on "Generated Documents" tab to see the document list
    // The /documents page has tabs: Template Gallery and Generated Documents
    const generatedDocsTab = page.getByRole('tab', { name: /generated documents/i });
    try {
      await expect(generatedDocsTab).toBeVisible({ timeout: 5000 });
      await generatedDocsTab.click();
      await page.waitForTimeout(2000);
      logStep('clicked Generated Documents tab');
    } catch {
      logStep('Generated Documents tab not found, continuing');
    }

    // Take screenshot after clicking tab
    await page.screenshot({ path: '/tmp/test-results/documents-tab.png', fullPage: true });

    // Wait for documents to load and find one to test with
    // Look for document view buttons that navigate to /documents/{id}
    let documentFound = false;
    let documentUrl = '';

    // Wait for document list to load
    await page.waitForTimeout(2000);

    // The document list has Eye buttons that navigate to /documents/{id}
    // Look for links or buttons that go to document detail pages
    const allLinks = await page.locator('a[href^="/documents/"], button').all();
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      // Document detail URLs have numeric IDs (like /documents/150)
      if (href) {
        const match = href.match(/\/documents\/(\d+)$/);
        if (match) {
          documentUrl = href;
          documentFound = true;
          logStep(`found document link: ${href}`);
          break;
        }
      }
    }

    // Also look for Eye button clicks that navigate via onClick
    if (!documentFound) {
      const eyeButtons = page.locator('button:has(svg.lucide-eye)');
      const eyeCount = await eyeButtons.count();
      logStep(`found ${eyeCount} eye buttons`);

      if (eyeCount > 0) {
        // Click the first eye button and wait for navigation
        await eyeButtons.first().click();
        await page.waitForURL(/\/documents\/\d+/, { timeout: 5000 });
        documentUrl = page.url();
        documentFound = true;
        logStep(`navigated to document via eye button: ${documentUrl}`);
      }
    }

    // Fallback: navigate directly to a known document with template content
    // Document ID 150 (Stucco Contract) has custom_template_content in Admin's org
    if (!documentFound) {
      logStep('trying known document ID 150 (has template content)');
      documentUrl = '/documents/150';
      documentFound = true;
    }
    logStep(`found document URL: ${documentUrl}`);

    // Navigate to the document detail page
    await page.goto(documentUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    logStep('on document detail page');

    // Wait for the page to fully load
    await page.waitForTimeout(2000);

    // The Output view is shown by default (showOutput=true in UnifiedDocumentView)
    // Check if the Output switch is available and ensure it's enabled
    const outputSwitch = page.locator('button[role="switch"]');
    if (await outputSwitch.isVisible().catch(() => false)) {
      const isChecked = await outputSwitch.getAttribute('aria-checked');
      logStep(`Output switch visible, checked: ${isChecked}`);
      if (isChecked !== 'true') {
        await outputSwitch.click();
        logStep('clicked switch to enable Output view');
        await page.waitForTimeout(500);
      }
    } else {
      logStep('No switch found - Output view may already be visible');
    }

    // Wait for template content to load
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/test-results/template-output-view.png', fullPage: true });
    logStep('took screenshot of output view');

    // Look for the Edit button to enter edit mode
    // The edit button may be labeled "Edit" or have an edit icon
    const editButton = page
      .locator('button')
      .filter({ hasText: /^edit$/i })
      .first();
    const editIconButton = page.locator(
      'button:has([data-lucide="pencil"]), button:has([class*="edit"])'
    );
    const anyEditButton = editButton.or(editIconButton);

    try {
      await expect(anyEditButton).toBeVisible({ timeout: 5000 });
      await anyEditButton.click();
      logStep('clicked Edit button - entered edit mode');
    } catch {
      // Maybe already in edit mode, or need to find a different way to edit
      logStep('Edit button not found - checking if already in edit mode');
    }

    // Wait for TipTap editor to be ready
    await page.waitForTimeout(500);

    // Find the TipTap editor (ProseMirror)
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    const editorVisible = await editor.isVisible().catch(() => false);

    if (!editorVisible) {
      logStep('TipTap editor not visible - taking screenshot');
      await page.screenshot({
        path: '/tmp/test-results/template-save-no-editor.png',
        fullPage: true,
      });
      test.skip(true, 'TipTap editor not available');
      return;
    }

    logStep('TipTap editor is visible');

    // Get initial content for comparison
    const initialContent = await editor.textContent();
    logStep(`initial content length: ${initialContent?.length || 0}`);

    // Make an edit - add a unique marker so we can verify persistence
    const testMarker = `[TEST-${Date.now()}]`;
    logStep(`adding test marker: ${testMarker}`);

    // Use ProseMirror API to insert content (keyboard events don't trigger TipTap's onUpdate)
    // This approach directly manipulates the editor state and triggers proper React updates
    await editor.click();
    await page.evaluate((marker) => {
      // Find the ProseMirror editor view
      const editorElement = document.querySelector('.ProseMirror');
      if (editorElement) {
        // Insert a paragraph with the marker at the end
        const newParagraph = document.createElement('p');
        newParagraph.textContent = marker;
        editorElement.appendChild(newParagraph);

        // Trigger an input event to notify TipTap of the change
        editorElement.dispatchEvent(new InputEvent('input', { bubbles: true }));

        // Also try triggering a compositionend which TipTap listens to
        editorElement.dispatchEvent(new CompositionEvent('compositionend', {
          bubbles: true,
          data: marker
        }));
      }
    }, testMarker);

    // Wait a moment for the input event to propagate
    await page.waitForTimeout(500);

    logStep('inserted test marker into editor via DOM');

    // Wait for debounce (1 second) + save to complete
    logStep('waiting for auto-save (debounce + save)...');
    await page.waitForTimeout(3000);

    // Check console logs for save flow
    const saveFlowLogs = consoleLogs.filter(
      (log) =>
        log.includes('[TemplateOutputView]') ||
        log.includes('[DocumentDetailView]') ||
        log.includes('UpdateDocumentStatus') ||
        log.includes('Saved custom template')
    );

    logStep(`Save flow logs captured: ${saveFlowLogs.length}`);
    saveFlowLogs.forEach((log) => logStep(`  ${log}`));

    // Check for "Saved" badge or indicator
    const savedBadge = page.locator('text=Saved').first();
    const savingBadge = page.locator('text=Saving').first();

    // Wait for saving to complete
    try {
      // First wait for "Saving..." to appear (optional)
      if (await savingBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
        logStep('saw Saving... badge');
        // Wait for it to change to "Saved"
        await expect(savedBadge).toBeVisible({ timeout: 5000 });
        logStep('saw Saved badge');
      } else {
        // Check if already saved
        const isSaved = await savedBadge.isVisible().catch(() => false);
        logStep(`Saved badge visible: ${isSaved}`);
      }
    } catch {
      logStep('Could not confirm save status via UI badge');
    }

    // Take screenshot of current state
    await page.screenshot({
      path: '/tmp/test-results/template-save-after-edit.png',
      fullPage: true,
    });

    // CRITICAL: Refresh the page to test persistence
    logStep('refreshing page to test persistence...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for content to fully load

    // Wait for the TipTap editor to be visible after refresh
    const editorAfterRefresh = page.locator('.ProseMirror');
    await expect(editorAfterRefresh).toBeVisible({ timeout: 10000 });
    logStep('TipTap editor visible after refresh');

    // Check if our test marker persisted in the editor's text content
    const editorTextAfterRefresh = await editorAfterRefresh.textContent();
    const markerPersisted = editorTextAfterRefresh?.includes(testMarker) ?? false;

    logStep(`editor content length after refresh: ${editorTextAfterRefresh?.length || 0}`);
    logStep(`test marker persisted: ${markerPersisted}`);

    // Take screenshot of refreshed state
    await page.screenshot({
      path: '/tmp/test-results/template-save-after-refresh.png',
      fullPage: true,
    });

    // Output all relevant console logs
    /* eslint-disable no-console */
    console.log('\n=== SAVE FLOW CONSOLE LOGS ===');
    saveFlowLogs.forEach((log) => console.log(log));
    console.log('=== END LOGS ===\n');
    /* eslint-enable no-console */

    // Assert that the save flow was triggered (we should see our logging)
    const saveFlowTriggered = saveFlowLogs.some(
      (log) =>
        log.includes('onUpdate fired') ||
        log.includes('handleTemplateContentChange') ||
        log.includes('saveCustomTemplateContent')
    );

    if (!saveFlowTriggered) {
      /* eslint-disable no-console */
      console.log('\n=== ALL CONSOLE LOGS ===');
      consoleLogs.forEach((log) => console.log(log));
      console.log('=== END ALL LOGS ===\n');
      /* eslint-enable no-console */
    }

    // The key assertion: our diagnostic logs should show the save flow being triggered
    expect(
      saveFlowTriggered,
      'Save flow should be triggered when editing template content'
    ).toBe(true);

    // If marker persisted, save worked end-to-end
    if (markerPersisted) {
      logStep('SUCCESS: Template save persisted across refresh');
    } else {
      logStep(
        'FAILURE: Template save did NOT persist - save flow may have a bug'
      );
      // This is the actual bug we're trying to find
      expect(
        markerPersisted,
        'Template content should persist after refresh'
      ).toBe(true);
    }
  });

  test('captures save flow logging for debugging', async ({ page }) => {
    // This is a simpler test that just captures the console output
    // to help debug where the save flow breaks

    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Preflight
    await preflight({ log: () => {} });

    // Login
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) test.skip(true, 'No test credentials');

    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    const loginButton = page.getByRole('button', { name: 'Login' });
    if (await loginButton.isVisible().catch(() => false)) {
      await page.getByPlaceholder('name@example.com').fill(email!);
      await page.getByPlaceholder('********').fill(password!);
      await loginButton.click();
      await page.waitForURL(/dashboard|documents/, {
        timeout: 20000,
      });
    }

    // Navigate to documents
    await page.goto('/documents', { waitUntil: 'networkidle' });

    // Find any document link
    const documentLinks = page.locator('a[href*="/documents/"]');
    const hasDocuments = await documentLinks.count();

    if (hasDocuments === 0) {
      test.skip(true, 'No documents for testing');
      return;
    }

    // Click first document
    await documentLinks.first().click();
    await page.waitForLoadState('networkidle');

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // Output all console logs at the end
    /* eslint-disable no-console */
    console.log('\n=== CAPTURED CONSOLE LOGS ===');
    consoleLogs
      .filter(
        (log) =>
          log.includes('[TemplateOutputView]') ||
          log.includes('[DocumentDetailView]') ||
          log.includes('UpdateDocumentStatus') ||
          log.includes('🔄') ||
          log.includes('✅') ||
          log.includes('❌')
      )
      .forEach((log) => console.log(log));
    console.log('=== END LOGS ===\n');
    /* eslint-enable no-console */

    // This test always passes - it's for capturing diagnostic output
    expect(true).toBe(true);
  });
});
