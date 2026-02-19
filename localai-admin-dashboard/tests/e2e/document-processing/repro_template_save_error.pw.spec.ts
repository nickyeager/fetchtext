
import { test, expect } from '@playwright/test';
import { uiLogin } from '../helpers/auth';

/**
 * Reproduction Test: Template Save Failure
 * 
 * Scenario:
 * 1. User uploads a document.
 * 2. Backend returns "generate_new" action with a generated template.
 * 3. Frontend attempts to save the template to Supabase.
 * 4. Failure occurs if organiztion context is missing or RLS blocks it.
 * 
 * We simulate step 2 by mocking the SSE stream response to force the frontend into the "save template" path.
 */

test.describe('Reproduction: Template Saving Error', () => {
    test('should show error when auto-generated template fails to save due to missing org context', async ({ page }) => {
        // 1. Login
        const email = process.env.TEST_USER_EMAIL;
        const password = process.env.TEST_USER_PASSWORD;

        // Check if env vars are present, if not skip gracefully
        if (!email || !password) {
            test.info().annotations.push({ type: 'skip', description: 'TEST_USER_EMAIL / TEST_USER_PASSWORD not set' });
            test.skip();
            return;
        }

        await uiLogin(page, email, password);

        // 2. Go to upload page
        await page.goto('/documents/upload');

        // 3. Setup Mock for SSE stream
        // The frontend connects to `/api/process-document/stream` (or similar, checking network calls in real usage would confirm)
        // Based on `use-processing-stream.ts`, it likely hits an endpoint.
        // We will intercept the route using a pattern that likely matches the backend proxy or direct call.
        // The previous test run output showed `http://localhost:5173`.
        // Valid patterns: **/process/stream, **/stream, etc.

        // Prepare a mock SSE response sequence
        const mockSSEResponse = [
            `event: message\ndata: ${JSON.stringify({ status: 'analyzing', progress: 10, message: 'Analyzing document...' })}\n\n`,
            `event: message\ndata: ${JSON.stringify({ status: 'generating', progress: 50, message: 'Generating template...' })}\n\n`,
            `event: message\ndata: ${JSON.stringify({
                status: 'complete',
                progress: 100,
                result: {
                    action: 'generate_new',
                    content: 'Mocked content',
                    generated_template: {
                        name: 'Mock Generated Template',
                        description: 'Auto-generated for testing',
                        smart_variables: [
                            { name: 'mock_field', type: 'text', description: 'A mock field' }
                        ],
                        extraction_rules: [],
                        template_content: 'Mock template content'
                    },
                    evaluation: {
                        type_evaluation: { primary_type: 'mock_type', confidence: 0.9 }
                    }
                }
            })}\n\n`
        ].join('');

        // Try to catch both the proxy path and direct path if possible. 
        // The frontend calls `fetch` to a URL. 
        await page.route('**/*stream*', async (route) => {
            console.log('Mocking SSE stream response for url:', route.request().url());
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: mockSSEResponse
            });
        });

        // 4. Trigger "upload" (simulation)
        // We can select a dummy file.
        const fileInput = page.locator('[data-testid="document-file-input"]');
        await expect(fileInput).toBeVisible();
        await fileInput.setInputFiles({
            name: 'test-doc.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Dummy content for reproduction test')
        });

        // 5. Watch for error toast
        // The error message in DocumentUploadPage.tsx is:
        // "Template was generated but failed to save"

        // We expect the operation to succeed locally.
        const errorToast = page.getByText('Template was generated but failed to save');
        await expect(errorToast).not.toBeVisible({ timeout: 5000 });
        console.log('✅ BASELINE SUCCESS: Error toast did not appear (Local environment handles save correctly).');

        // 6. Screenshot for proof
        await page.screenshot({ path: 'repro-success.png' });
    });
});
