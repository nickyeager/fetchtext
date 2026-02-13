/**
 * N8N Email Client for FetchText
 * 
 * Email delivery via N8N workflows + SendGrid
 * 
 * Architecture:
 * - Development: Console logging simulation
 * - Production: Frontend → N8N Webhook → SendGrid API
 * 
 * N8N Configuration:
 * - Webhook URL: http://localhost:5678/webhook/password-reset-email
 * - SendGrid Node with API Key configuration
 * - Professional email templates with FetchText branding
 */

import { N8nClient, N8nWorkflowData, N8nWorkflow } from './n8n-client';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  template?: 'password-reset' | 'welcome' | 'two-factor';
}

// N8N configuration - no localhost fallback
function getN8nBaseUrl(): string {
  const url = import.meta.env.VITE_N8N_URL || '';
  if (!url && import.meta.env.DEV) {
    console.warn('[N8N Email] VITE_N8N_URL is not set. N8N webhooks will not work.');
  }
  return url;
}

function getN8nApiKey(): string {
  return import.meta.env.VITE_N8N_API_KEY || '';
}

// Initialize N8N client dynamically
function getN8nClient(): N8nClient {
  return new N8nClient(getN8nBaseUrl() + '/api/v1', getN8nApiKey());
}

/**
 * Development logger function
 */
function logInDevelopment(message: string, data?: unknown): void {
  if (import.meta.env.DEV) {
    if (data !== undefined) {
      // eslint-disable-next-line no-console
      console.log(message, data);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }
  }
}

/**
 * Main email sending function via N8N webhooks
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // In development mode, simulate email sending
  if (import.meta.env.DEV) {
    return sendEmailDevelopment(options);
  }

  // Production mode - use N8N webhook
  try {
    logInDevelopment('Sending email via N8N webhook:', {
      to: options.to,
      subject: options.subject,
      template: options.template
    });

    const webhookUrl = `${getN8nBaseUrl()}/webhook/password-reset-email`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: options.to,
        subject: options.subject,
        html: options.html,
        template: options.template,
        resetUrl: options.template === 'password-reset' ? extractResetUrl(options.html) : undefined
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logInDevelopment('N8N webhook error:', { status: response.status, error: errorText });
      return {
        success: false,
        error: `N8N webhook failed: ${response.status} ${errorText}`,
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'N8N workflow execution failed',
      };
    }

    logInDevelopment('Email sent successfully via N8N:', result);
    return {
      success: true,
      messageId: result.messageId || `n8n-${Date.now()}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logInDevelopment('N8N email sending error:', errorMessage);
    
    return {
      success: false,
      error: `N8N client error: ${errorMessage}`,
    };
  }
}

/**
 * Development mode email simulation
 */
function sendEmailDevelopment(options: EmailOptions): EmailResult {
  logInDevelopment('📧 N8N EMAIL SIMULATION (Development Mode)');
  logInDevelopment('='.repeat(50));
  logInDevelopment(`To: ${options.to}`);
  logInDevelopment(`Subject: ${options.subject}`);
  logInDevelopment(`Template: ${options.template || 'custom'}`);
  logInDevelopment(`From: FetchText <nick@fetchtext.io>`);
  logInDevelopment(`N8N Webhook: ${getN8nBaseUrl()}/webhook/password-reset-email`);
  logInDevelopment('='.repeat(50));
  logInDevelopment('HTML Content:');
  logInDevelopment(options.html);
  logInDevelopment('='.repeat(50));
  logInDevelopment('📧 Email would be sent via N8N Workflow → SendGrid');
  logInDevelopment('='.repeat(50));
  
  return {
    success: true,
    messageId: `n8n-dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * Extract reset URL from HTML content
 */
function extractResetUrl(html: string): string | undefined {
  const match = html.match(/href="([^"]*reset[^"]*)"/i);
  return match ? match[1] : undefined;
}

/**
 * Send password reset email via N8N
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<EmailResult> {
  const html = generatePasswordResetHTML(resetUrl);
  
  return sendEmail({
    to: email,
    subject: 'Reset Your FetchText Password',
    html,
    template: 'password-reset',
  });
}

/**
 * Send welcome email via N8N
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  const html = generateWelcomeHTML(userName);
  
  return sendEmail({
    to: email,
    subject: 'Welcome to FetchText!',
    html,
    template: 'welcome',
  });
}

/**
 * Send two-factor authentication code via N8N
 */
export async function sendTwoFactorEmail(
  email: string,
  code: string
): Promise<EmailResult> {
  const html = generateTwoFactorHTML(code);
  
  return sendEmail({
    to: email,
    subject: 'Your FetchText Security Code',
    html,
    template: 'two-factor',
  });
}

/**
 * Generate password reset email HTML
 */
function generatePasswordResetHTML(resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Reset Your FetchText Password</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
            .button { background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 FetchText</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
        </div>
        
        <div class="content">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p>We received a request to reset your password for your FetchText account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                <strong>This link will expire in 24 hours</strong> for security reasons.
            </p>
            
            <p style="color: #666; font-size: 14px;">
                If you didn't request this password reset, you can safely ignore this email.
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                If the button doesn't work, copy this link: <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
        </div>
        
        <div class="footer">
            <p>© 2024 FetchText. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

/**
 * Generate welcome email HTML
 */
function generateWelcomeHTML(userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Welcome to FetchText!</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
            .button { background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; }
            .feature { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 6px; }
            .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to FetchText!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your AI-Powered Document Processing Platform</p>
        </div>
        
        <div class="content">
            <h2 style="color: #333; margin-top: 0;">Hello ${userName}!</h2>
            <p>Thank you for joining FetchText! We're excited to help you revolutionize your document processing.</p>
            
            <h3 style="color: #333; margin-top: 30px;">What you can do:</h3>
            
            <div class="feature">
                <strong>🤖 AI Document Processing</strong><br>
                <span style="color: #666;">Extract data intelligently from any document</span>
            </div>
            
            <div class="feature">
                <strong>📝 Template Generation</strong><br>
                <span style="color: #666;">Create professional documents from templates</span>
            </div>
            
            <div class="feature">
                <strong>🔄 Workflow Automation</strong><br>
                <span style="color: #666;">Streamline your document processes</span>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${window.location.origin}/dashboard" class="button">Get Started</a>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
                Need help? Visit our <a href="${window.location.origin}/help-center" style="color: #667eea;">Help Center</a>
            </p>
        </div>
        
        <div class="footer">
            <p>© 2024 FetchText. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

/**
 * Generate two-factor authentication email HTML
 */
function generateTwoFactorHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Your FetchText Security Code</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
            .code-box { background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; color: #333; letter-spacing: 8px; font-family: monospace; text-align: center; margin: 30px 0; }
            .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 FetchText</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Security Verification</p>
        </div>
        
        <div class="content">
            <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
            <p>Use this code to complete your two-factor authentication:</p>
            
            <div class="code-box">${code}</div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
                <strong>This code expires in 10 minutes</strong> for security.
            </p>
            
            <p style="color: #666; font-size: 14px;">
                If you didn't request this code, please secure your account immediately.
            </p>
        </div>
        
        <div class="footer">
            <p>© 2024 FetchText. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;
}

/**
 * N8N workflow management functions
 */
export async function deployPasswordResetWorkflow(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getN8nClient();
    
    // Check if workflow already exists
    const workflows = await client.getWorkflows();
    const existingWorkflow = workflows.find((w: N8nWorkflow) => w.name === 'FetchText Password Reset Email');
    
    if (existingWorkflow) {
      // Activate if not active
      if (!existingWorkflow.active) {
        await client.activateWorkflow(existingWorkflow.id);
      }
      return { success: true };
    }
    
    // Load workflow from backup
    const workflowData = await loadWorkflowFromBackup();
    if (!workflowData) {
      return { success: false, error: 'Could not load workflow from backup' };
    }
    
    // Create and activate workflow
    const workflow = await client.createWorkflow(workflowData);
    await client.activateWorkflow(workflow.id);
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Load workflow from backup directory
 */
async function loadWorkflowFromBackup(): Promise<N8nWorkflowData | null> {
  try {
    const response = await fetch('/n8n/backup/workflows/FetchText_Password_Reset_Email.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Email service configuration and documentation
 */
export const N8N_EMAIL_SERVICE_CONFIG = {
  PROVIDER: 'N8N Workflows + SendGrid',
  VERIFIED_SENDER: 'nick@fetchtext.io',
  ARCHITECTURE: 'Frontend → N8N Webhook → SendGrid API',
  FALLBACK: 'Development mode simulation',
  WEBHOOK_URL: 'http://localhost:5678/webhook/password-reset-email',
  SUPPORTED_TEMPLATES: [
    'password-reset',
    'welcome',
    'two-factor'
  ],
  DEPLOYMENT_NOTES: [
    'N8N workflow handles SendGrid integration visually',
    'No API keys exposed in frontend code',
    'Professional HTML templates with FetchText branding',
    'Built-in error handling and validation in N8N',
    'Development mode simulation for testing',
    'Visual workflow editor for easy modifications'
  ]
}; 