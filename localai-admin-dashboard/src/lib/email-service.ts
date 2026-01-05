import sgMail from '@sendgrid/mail';
import { EMAIL_CONFIG } from '@/config/email';

// Initialize SendGrid with API key
sgMail.setApiKey(EMAIL_CONFIG.SENDGRID_API_KEY);

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send password reset email using dynamic content
 */
export async function sendPasswordResetEmail(
  email: string, 
  resetToken: string
): Promise<EmailResult> {
  try {
    // Construct the reset URL using configured app URL
    const resetUrl = `${EMAIL_CONFIG.APP_URL}/reset-password?token=${resetToken}`;
    
    const message = {
      to: email,
      from: {
        email: EMAIL_CONFIG.FROM_EMAIL,
        name: EMAIL_CONFIG.FROM_NAME,
      },
      replyTo: EMAIL_CONFIG.REPLY_TO,
      subject: 'Reset Your FetchText Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - FetchText</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 FetchText</h1>
            <p style="color: white; margin: 10px 0 0; opacity: 0.9;">Password Reset Request</p>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
            
            <p>Hello,</p>
            
            <p>We received a request to reset the password for your FetchText account (<strong>${email}</strong>).</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold; 
                        display: inline-block;
                        font-size: 16px;">
                Reset My Password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              <strong>This link will expire in 1 hour</strong> for security reasons.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't request this password reset, you can safely ignore this email. 
              Your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              If the button above doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              This email was sent by FetchText • <a href="mailto:${EMAIL_CONFIG.FROM_EMAIL}" style="color: #667eea;">${EMAIL_CONFIG.FROM_EMAIL}</a>
              <br>© ${new Date().getFullYear()} FetchText. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Reset Your FetchText Password
        
        Hello,
        
        We received a request to reset the password for your FetchText account (${email}).
        
        To reset your password, click the link below or copy and paste it into your browser:
        ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
        
        Best regards,
        The FetchText Team
        ${EMAIL_CONFIG.FROM_EMAIL}
        
        © ${new Date().getFullYear()} FetchText. All rights reserved.
      `,
    };

    const response = await sgMail.send(message);
    
    return {
      success: true,
      messageId: response[0]?.headers?.['x-message-id'] as string,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle specific SendGrid errors
    if (error && typeof error === 'object' && 'response' in error) {
      const sendGridError = error as { response?: { body?: { errors?: Array<{ message: string }> } } };
      if (sendGridError.response?.body?.errors) {
        const errorMessages = sendGridError.response.body.errors
          .map((err) => err.message)
          .join(', ');
        return {
          success: false,
          error: `SendGrid error: ${errorMessages}`,
        };
      }
    }
    
    return {
      success: false,
      error: errorMsg || 'Failed to send password reset email',
    };
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  try {
    const message = {
      to: email,
      from: {
        email: EMAIL_CONFIG.FROM_EMAIL,
        name: EMAIL_CONFIG.FROM_NAME,
      },
      templateId: EMAIL_CONFIG.TEMPLATES.WELCOME,
      dynamicTemplateData: {
        user_name: userName,
        user_email: email,
        dashboard_url: `${EMAIL_CONFIG.APP_URL}/dashboard`,
        company_name: 'FetchText',
        support_email: EMAIL_CONFIG.FROM_EMAIL,
      },
    };

    const response = await sgMail.send(message);
    
    return {
      success: true,
      messageId: response[0]?.headers?.['x-message-id'] as string,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMsg || 'Failed to send welcome email',
    };
  }
}

/**
 * Send two-factor authentication code email
 */
export async function sendTwoFactorEmail(
  email: string,
  code: string
): Promise<EmailResult> {
  try {
    const message = {
      to: email,
      from: {
        email: EMAIL_CONFIG.FROM_EMAIL,
        name: EMAIL_CONFIG.FROM_NAME,
      },
      templateId: EMAIL_CONFIG.TEMPLATES.TWO_FACTOR,
      dynamicTemplateData: {
        verification_code: code,
        user_email: email,
        expires_in: '10 minutes',
        company_name: 'FetchText',
      },
    };

    const response = await sgMail.send(message);
    
    return {
      success: true,
      messageId: response[0]?.headers?.['x-message-id'] as string,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMsg || 'Failed to send verification code',
    };
  }
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
    const response = await fetch('http://localhost:8090/api/email/send-invitation', {
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