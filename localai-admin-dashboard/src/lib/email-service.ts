import { emailClient } from '@/lib/email-client';
import { API_ENDPOINTS } from '@/lib/api-config';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send password reset email via N8N workflow (no API key in browser)
 */
export async function sendPasswordResetEmail(
  email: string, 
  resetToken: string
): Promise<EmailResult> {
  const result = await emailClient.sendPasswordResetEmail(email, resetToken);
  return { success: result.success, error: result.error };
}

/**
 * Send welcome email via N8N workflow
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  const result = await emailClient.sendWelcomeEmail(email, userName);
  return { success: result.success, error: result.error };
}

/**
 * Send two-factor authentication code email via N8N workflow
 */
export async function sendTwoFactorEmail(
  email: string,
  code: string
): Promise<EmailResult> {
  const result = await emailClient.sendTwoFactorEmail(email, code);
  return { success: result.success, error: result.error };
}

/**
 * Send organization invitation email via backend API
 *
 * Note: This calls the document processor backend which handles SendGrid
 * to avoid CORS issues with direct browser-to-SendGrid calls.
 */
export async function sendInvitationEmail(
  email: string,
  organizationName: string,
  inviterEmail: string,
  inviteToken: string,
  role: string
): Promise<EmailResult> {
  try {
    // Call the backend email API endpoint to avoid CORS issues
    const response = await fetch(API_ENDPOINTS.emailSendInvitation, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_email: email,
        organization_name: organizationName,
        inviter_email: inviterEmail,
        invite_token: inviteToken,
        role: role,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Backend email API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Backend failed to send email',
      };
    }

    return {
      success: true,
      messageId: result.message_id,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMsg || 'Failed to send invitation email',
    };
  }
}

/**
 * Validate email address format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize email input to prevent injection attacks
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/[<>]/g, '');
} 