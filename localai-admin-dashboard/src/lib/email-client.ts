import { EMAIL_CONFIG } from '@/config/email';

export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  templateType: 'password-reset' | 'welcome' | 'two-factor';
  variables?: Record<string, string>;
}

export interface EmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface N8NWebhookPayload {
  to: string;
  fromEmail: string;
  fromName: string;
  [key: string]: string;
}

// N8N webhook endpoints for different email types
const N8N_WEBHOOKS = {
  'password-reset': 'http://localhost:5678/webhook/password-reset-email',
  'welcome': 'http://localhost:5678/webhook/welcome-email',
  'two-factor': 'http://localhost:5678/webhook/two-factor-email'
} as const;

/**
 * N8N Email Client
 * Uses N8N workflows for all email delivery as per repo rules
 */
class N8NEmailClient {
  private async callN8NWebhook(
    endpoint: string,
    payload: N8NWebhookPayload
  ): Promise<EmailResponse> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Email sent successfully via N8N',
      };
         } catch (error) {
       // eslint-disable-next-line no-console
       console.error('N8N webhook error:', error);
       return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendPasswordResetEmail(email: string, resetLinkOrToken: string): Promise<EmailResponse> {
    // Check if the parameter is a full URL or just a token
    const isFullUrl = resetLinkOrToken.startsWith('http');
    const resetUrl = isFullUrl 
      ? resetLinkOrToken 
      : `${window.location.origin}/reset-password?token=${resetLinkOrToken}`;
    
    const messageHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Reset Your FetchText Password</h2>
        <p style="color: #666; line-height: 1.6;">
          You requested to reset your password. Click the button below to reset your password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If you didn't request this, please ignore this email. This link will expire in 1 hour.
        </p>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #007bff;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent by FetchText. If you have any questions, please contact support.
        </p>
      </div>
    `;

    const payload: N8NWebhookPayload = {
      to: email,
      resetToken: isFullUrl ? '' : resetLinkOrToken, // For backward compatibility
      resetUrl,
      messageHTML,
      fromEmail: EMAIL_CONFIG.FROM_EMAIL,
      fromName: EMAIL_CONFIG.FROM_NAME,
    };

    return this.callN8NWebhook(N8N_WEBHOOKS['password-reset'], payload);
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<EmailResponse> {
    const dashboardUrl = `${window.location.origin}/dashboard`;
    const messageHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Welcome to FetchText!</h2>
        <p style="color: #666; line-height: 1.6;">
          Hi ${userName},
        </p>
        <p style="color: #666; line-height: 1.6;">
          Welcome to FetchText! Your account has been successfully created and confirmed.
        </p>
        <p style="color: #666; line-height: 1.6;">
          You can now access all the features of FetchText, including document processing, 
          AI-powered text analysis, and much more.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          If you have any questions or need help getting started, don't hesitate to reach out to our support team.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent by FetchText. If you have any questions, please contact support.
        </p>
      </div>
    `;

    const payload: N8NWebhookPayload = {
      to: email,
      userName,
      dashboardUrl,
      messageHTML,
      fromEmail: EMAIL_CONFIG.FROM_EMAIL,
      fromName: EMAIL_CONFIG.FROM_NAME,
    };

    return this.callN8NWebhook(N8N_WEBHOOKS['welcome'], payload);
  }

  async sendTwoFactorEmail(email: string, code: string): Promise<EmailResponse> {
    const messageHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Your FetchText Verification Code</h2>
        <p style="color: #666; line-height: 1.6;">
          You requested a two-factor authentication code for your FetchText account.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px;">
              ${code}
            </span>
          </div>
        </div>
        <p style="color: #666; line-height: 1.6;">
          Enter this code in the verification field to complete your login.
        </p>
        <p style="color: #666; font-size: 14px;">
          This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
        </p>
        <p style="color: #666; font-size: 14px;">
          For security reasons, never share this code with anyone.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent by FetchText. If you have any questions, please contact support.
        </p>
      </div>
    `;

    const payload: N8NWebhookPayload = {
      to: email,
      code,
      messageHTML,
      fromEmail: EMAIL_CONFIG.FROM_EMAIL,
      fromName: EMAIL_CONFIG.FROM_NAME,
    };

    return this.callN8NWebhook(N8N_WEBHOOKS['two-factor'], payload);
  }

  async sendGenericEmail(request: EmailRequest): Promise<EmailResponse> {
    const webhook = N8N_WEBHOOKS[request.templateType];
    if (!webhook) {
      return {
        success: false,
        error: `Unknown email template type: ${request.templateType}`,
      };
    }

    const payload: N8NWebhookPayload = {
      to: request.to,
      subject: request.subject,
      html: request.html,
      messageHTML: request.html, // Use the provided HTML as messageHTML
      fromEmail: EMAIL_CONFIG.FROM_EMAIL,
      fromName: EMAIL_CONFIG.FROM_NAME,
      ...request.variables,
    };

    return this.callN8NWebhook(webhook, payload);
  }
}

// Export singleton instance
export const emailClient = new N8NEmailClient();

// Export for testing
export { N8NEmailClient };

/**
 * Legacy wrapper functions for backward compatibility
 */
export async function sendPasswordResetEmail(
  email: string, 
  resetLinkOrToken: string
): Promise<EmailResponse> {
  return emailClient.sendPasswordResetEmail(email, resetLinkOrToken);
}

export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResponse> {
  return emailClient.sendWelcomeEmail(email, userName);
}

export async function sendTwoFactorEmail(
  email: string,
  code: string
): Promise<EmailResponse> {
  return emailClient.sendTwoFactorEmail(email, code);
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