// Development Email Service - Simulates email sending for local development
/* eslint-disable no-console */

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Development version of sendPasswordResetEmail
 * Simulates email sending without making real API calls
 */
export async function sendPasswordResetEmail(
  email: string, 
  resetToken: string
): Promise<EmailResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Log for development debugging
  console.log('🚀 [DEV] Password Reset Email:', {
    to: email,
    resetToken,
    resetUrl: `${window.location.origin}/reset-password?token=${resetToken}`,
    timestamp: new Date().toISOString(),
  });

  // Simulate different outcomes based on email
  if (email.includes('fail')) {
    return {
      success: false,
      error: 'Development: Simulated email failure',
    };
  }

  if (email.includes('slow')) {
    // Simulate slow response
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return {
    success: true,
    messageId: `dev-msg-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
  };
}

/**
 * Development version of sendWelcomeEmail
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 400));
  
  console.log('🎉 [DEV] Welcome Email:', {
    to: email,
    userName,
    dashboardUrl: `${window.location.origin}/dashboard`,
    timestamp: new Date().toISOString(),
  });

  if (email.includes('fail')) {
    return {
      success: false,
      error: 'Development: Simulated welcome email failure',
    };
  }

  return {
    success: true,
    messageId: `dev-welcome-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
  };
}

/**
 * Development version of sendTwoFactorEmail
 */
export async function sendTwoFactorEmail(
  email: string,
  code: string
): Promise<EmailResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log('🔐 [DEV] Two-Factor Email:', {
    to: email,
    code,
    timestamp: new Date().toISOString(),
  });

  if (email.includes('fail')) {
    return {
      success: false,
      error: 'Development: Simulated 2FA email failure',
    };
  }

  return {
    success: true,
    messageId: `dev-2fa-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
  };
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