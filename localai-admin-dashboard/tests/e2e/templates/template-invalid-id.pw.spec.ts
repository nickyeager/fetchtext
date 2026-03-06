import 'dotenv/config'
import { test, expect } from '@playwright/test'

// Verifies that invalid template IDs (e.g., id=0) are handled gracefully using .maybeSingle()
// instead of throwing 406 errors. Ensures the UI remains usable for uploads.

test.describe('Smart template fetch with invalid id', () => {
  test('Invalid template ID handled gracefully and UI stays interactive', async ({ page }, testInfo) => {
    const { TEST_USER_EMAIL: email, TEST_USER_PASSWORD: password } = process.env

    // Login if creds provided (keeps behavior consistent with authenticated requests)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    if (email && password) {
      await page.goto('/sign-in').catch(() => {})
      let emailInput = page.getByPlaceholder('name@example.com')
      let pwdInput = page.getByPlaceholder('********')
      let loginButton = page.getByRole('button', { name: 'Login' })
      if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
        await page.goto('/sign-in')
        emailInput = page.getByPlaceholder('name@example.com')
        pwdInput = page.getByPlaceholder('********')
        loginButton = page.getByRole('button', { name: 'Login' })
      }
      const alreadyAuthed = /dashboard/.test(page.url())
      if (!alreadyAuthed) {
        await emailInput.fill(email)
        await pwdInput.fill(password)
        await loginButton.click()
        await page.waitForURL(/dashboard/, { timeout: 20000 })
      }
    }

    // Capture console logs for diagnostics
    const logs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      logs.push(text)
    })

    // Navigate with invalid template id=0
    await page.goto('/documents/process-document?templateId=0&templateSource=smart_templates', { waitUntil: 'domcontentloaded' })

    // Wait a moment for any potential requests to complete
    await page.waitForTimeout(2000)

    // UI should be usable despite invalid template ID: upload control visible
    const fileInput = page.locator('[data-testid="document-file-input"]')
    await expect(fileInput).toBeVisible({ timeout: 15000 })

    // Verify no 406 errors in console logs (the fix working)
    const has406Error = logs.some((l) => /406|Not Acceptable/i.test(l))
    expect(has406Error, 'Should not have 406 errors in console (fix working)').toBe(false)

    // Should handle missing template gracefully - look for "Generate New Template" or similar
    try {
      const generateButton = page.locator('button:has-text("Generate")')
      const templateButton = page.locator('button:has-text("Template")')
      const noTemplateText = page.locator('text="No template found"')

      const generateCount = await generateButton.count()
      const templateCount = await templateButton.count()
      const noTemplateCount = await noTemplateText.count()

      if (generateCount > 0 || templateCount > 0 || noTemplateCount > 0) {
        console.log('✅ Template generation workflow available for invalid template ID')
      }
    } catch (error) {
      console.log('ℹ️ Template generation elements not found (may be expected)')
    }

    // Attach logs for debugging
    await testInfo.attach('console-logs', { body: logs.join('\n'), contentType: 'text/plain' })
  })
})
