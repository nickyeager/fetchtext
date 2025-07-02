import { supabase } from '@/lib/supabase';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailRequest {
  type: 'password-reset' | 'welcome' | 'two-factor';
  email: string;
  data: {
    resetToken?: string;
    userName?: string;
    code?: string;
  };
}

// Check if we're in development or if Edge Functions are available
const isDevelopment = import.meta.env.DEV;
const useDevEmail = isDevelopment || import.meta.env.VITE_USE_DEV_EMAIL === 'true';

/**
 * Send password reset email via Supabase Edge Function or development service
 */
export async function sendPasswordResetEmail(
  email: string, 
  resetToken: string
): Promise<EmailResult> {
  // Use development email service in dev mode
  if (useDevEmail) {
    const { sendPasswordResetEmail: devSendEmail } = await import('@/lib/email-dev');
    return devSendEmail(email, resetToken);
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'password-reset',
        email,
        data: { resetToken },
      } as EmailRequest,
    });

    if (error) {
      // If Edge Function fails, fall back to development service
      if (error.message?.includes('Function not found') || error.message?.includes('404')) {
        const { sendPasswordResetEmail: devSendEmail } = await import('@/lib/email-dev');
        return devSendEmail(email, resetToken);
      }

      return {
        success: false,
        error: error.message || 'Failed to send password reset email',
      };
    }

    return data as EmailResult;
  } catch (_error) {
    // Fall back to development service on any error
    const { sendPasswordResetEmail: devSendEmail } = await import('@/lib/email-dev');
    return devSendEmail(email, resetToken);
  }
}

/**
 * Send welcome email via Supabase Edge Function or development service
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  // Use development email service in dev mode
  if (useDevEmail) {
    const { sendWelcomeEmail: devSendEmail } = await import('@/lib/email-dev');
    return devSendEmail(email, userName);
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        email,
        data: { userName },
      } as EmailRequest,
    });

    if (error) {
      // If Edge Function fails, fall back to development service
      if (error.message?.includes('Function not found') || error.message?.includes('404')) {
        const { sendWelcomeEmail: devSendEmail } = await import('@/lib/email-dev');
        return devSendEmail(email, userName);
      }

      return {
        success: false,
        error: error.message || 'Failed to send welcome email',
      };
    }

    return data as EmailResult;
  } catch (_error) {
    // Fall back to development service on any error
    const { sendWelcomeEmail: devSendEmail } = await import('@/lib/email-dev');
    return devSendEmail(email, userName);
  }
}

/**
 * Send two-factor authentication code email via Supabase Edge Function or development service
 */
export async function sendTwoFactorEmail(
  email: string,
  code: string
): Promise<EmailResult> {
  // Use development email service in dev mode
  if (useDevEmail) {
    const { sendTwoFactorEmail: devSendEmail } = await import('@/lib/email-dev');
    return devSendEmail(email, code);
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'two-factor',
        email,
        data: { code },
      } as EmailRequest,
    });

    if (error) {
      // If Edge Function fails, fall back to development service
      if (error.message?.includes('Function not found') || error.message?.includes('404')) {
        const { sendTwoFactorEmail: devSendEmail } = await import('@/lib/email-dev');
        return devSendEmail(email, code);
      }

      return {
        success: false,
        error: error.message || 'Failed to send verification code',
      };
    }

    return data as EmailResult;
  } catch (_error) {
    // Fall back to development service on any error
    const { sendTwoFactorEmail: devSendEmail } = await import('@/lib/email-dev');
    return devSendEmail(email, code);
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