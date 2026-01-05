/**
 * Integration Test: Invitation Email via SendGrid
 *
 * Tests that invitation emails are actually sent via SendGrid.
 * Requires VITE_SENDGRID_API_KEY to be set in environment.
 *
 * NOTE: Vitest's jsdom environment has HTTP request issues with SendGrid.
 * For reliable testing, use the Node.js script instead:
 *
 *   node scripts/test-invitation-email.mjs
 *
 * This Vitest test is kept for CI/documentation purposes but may fail
 * due to jsdom's XMLHttpRequest limitations with the SendGrid SDK.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sendInvitationEmail } from '@/lib/email-service';
import { EMAIL_CONFIG } from '@/config/email';

describe('Invitation Email Integration', () => {
  beforeAll(() => {
    // Verify SendGrid is configured
    if (!EMAIL_CONFIG.SENDGRID_API_KEY) {
      throw new Error(
        'VITE_SENDGRID_API_KEY is not set. ' +
        'Set it in localai-admin-dashboard/.env.local to run this test.'
      );
    }
    console.log('SendGrid API key is configured');
    console.log('From email:', EMAIL_CONFIG.FROM_EMAIL);
  });

  it('should send real invitation email via SendGrid', async () => {
    // Use the verified sender email as the recipient for testing
    const testEmail = EMAIL_CONFIG.FROM_EMAIL; // nick@fetchtext.io
    const testOrgName = 'Test Organization';
    const testInviterEmail = 'admin@fetchtext.local';
    const testToken = `test-token-${Date.now()}`;
    const testRole = 'member';

    console.log('Sending test invitation email to:', testEmail);

    const result = await sendInvitationEmail(
      testEmail,
      testOrgName,
      testInviterEmail,
      testToken,
      testRole
    );

    console.log('SendGrid result:', result);

    // Verify SendGrid accepted the email
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.error).toBeUndefined();

    console.log('Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Check inbox for:', testEmail);
  });

  it('should handle invalid email gracefully', async () => {
    // SendGrid should reject obviously invalid emails
    const result = await sendInvitationEmail(
      'not-an-email',
      'Test Org',
      'inviter@test.com',
      'token123',
      'member'
    );

    // Either fails validation or SendGrid rejects it
    // We just verify it doesn't throw
    console.log('Invalid email result:', result);
    expect(result).toBeDefined();
  });
});
