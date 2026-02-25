/**
 * Integration Test: Invitation Email via Backend API
 *
 * Tests that invitation emails are sent via the backend API endpoint.
 * Requires the document-processor backend to be running with SENDGRID_API_KEY.
 */
import { EMAIL_CONFIG } from '@/config/email'
import { describe, it, expect, beforeAll } from 'vitest'
import { sendInvitationEmail } from '@/lib/organization-service'

const BACKEND_URL =
  import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'

describe('Invitation Email Integration', () => {
  beforeAll(async () => {
    // Verify backend is running
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      throw new Error(
        'Backend is not running. Start with: docker compose -p localai up -d document-processor'
      )
    }
    console.log('Backend is healthy')
    console.log('From email:', EMAIL_CONFIG.FROM_EMAIL)
  })

  it('should send real invitation email via backend API', async () => {
    // Use the verified sender email as the recipient for testing
    const testEmail = EMAIL_CONFIG.FROM_EMAIL // nick@fetchtext.io
    const testOrgName = 'Test Organization'
    const testInviterEmail = 'admin@fetchtext.local'
    const testToken = `test-token-${Date.now()}`
    const testRole = 'member'

    console.log('Sending test invitation email to:', testEmail)

    const result = await sendInvitationEmail(
      testEmail,
      testOrgName,
      testInviterEmail,
      testToken,
      testRole
    )

    console.log('Backend API result:', result)

    // Verify backend accepted the email
    expect(result.success).toBe(true)
    expect(result.messageId).toBeDefined()
    expect(result.error).toBeUndefined()

    console.log('Email sent successfully!')
    console.log('Message ID:', result.messageId)
    console.log('Check inbox for:', testEmail)
  })

  it('should handle invalid email gracefully', async () => {
    const result = await sendInvitationEmail(
      'not-an-email',
      'Test Org',
      'inviter@test.com',
      'token123',
      'member'
    )

    // Either fails validation or SendGrid rejects it
    // We just verify it doesn't throw
    console.log('Invalid email result:', result)
    expect(result).toBeDefined()
  })
})
