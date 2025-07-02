import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface EmailRequest {
  type: 'password-reset' | 'welcome' | 'two-factor';
  email: string;
  data: {
    resetToken?: string;
    userName?: string;
    code?: string;
  };
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'support@fetchtext.io';
const FROM_NAME = Deno.env.get('FROM_NAME') || 'FetchText Support';
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:5173';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    if (!SENDGRID_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'SendGrid API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const emailRequest: EmailRequest = await req.json();
    
    // Validate request
    if (!emailRequest.email || !emailRequest.type) {
      return new Response(
        JSON.stringify({ error: 'Email and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let emailContent: any;

    // Generate email content based on type
    switch (emailRequest.type) {
      case 'password-reset':
        if (!emailRequest.data.resetToken) {
          return new Response(
            JSON.stringify({ error: 'Reset token is required for password reset emails' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        emailContent = generatePasswordResetEmail(emailRequest.email, emailRequest.data.resetToken);
        break;

      case 'welcome':
        if (!emailRequest.data.userName) {
          return new Response(
            JSON.stringify({ error: 'User name is required for welcome emails' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        emailContent = generateWelcomeEmail(emailRequest.email, emailRequest.data.userName);
        break;

      case 'two-factor':
        if (!emailRequest.data.code) {
          return new Response(
            JSON.stringify({ error: 'Code is required for two-factor emails' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        emailContent = generateTwoFactorEmail(emailRequest.email, emailRequest.data.code);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid email type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Send email via SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailContent),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SendGrid API error:', errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `SendGrid API error: ${response.status}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: EmailResult = {
      success: true,
      messageId: response.headers.get('x-message-id') || 'unknown',
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generatePasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  
  return {
    personalizations: [
      {
        to: [{ email }],
        subject: 'Reset Your FetchText Password',
      },
    ],
    from: {
      email: FROM_EMAIL,
      name: FROM_NAME,
    },
    content: [
      {
        type: 'text/html',
        value: `
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
                This email was sent by FetchText • <a href="mailto:${FROM_EMAIL}" style="color: #667eea;">${FROM_EMAIL}</a>
                <br>© ${new Date().getFullYear()} FetchText. All rights reserved.
              </p>
            </div>
          </body>
          </html>
        `,
      },
      {
        type: 'text/plain',
        value: `
          Reset Your FetchText Password
          
          Hello,
          
          We received a request to reset the password for your FetchText account (${email}).
          
          To reset your password, click the link below or copy and paste it into your browser:
          ${resetUrl}
          
          This link will expire in 1 hour for security reasons.
          
          If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
          
          Best regards,
          The FetchText Team
          ${FROM_EMAIL}
          
          © ${new Date().getFullYear()} FetchText. All rights reserved.
        `,
      },
    ],
  };
}

function generateWelcomeEmail(email: string, userName: string) {
  const dashboardUrl = `${APP_URL}/dashboard`;
  
  return {
    personalizations: [
      {
        to: [{ email }],
        subject: 'Welcome to FetchText! 🎉',
      },
    ],
    from: {
      email: FROM_EMAIL,
      name: FROM_NAME,
    },
    content: [
      {
        type: 'text/html',
        value: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to FetchText</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to FetchText!</h1>
              <p style="color: white; margin: 10px 0 0; opacity: 0.9;">Your account is ready</p>
            </div>
            
            <div style="background: white; padding: 40px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hi ${userName}!</h2>
              
              <p>Thank you for joining FetchText! We're excited to have you on board.</p>
              
              <p>Your account has been successfully created and verified. You can now access all of our powerful document processing and AI-powered features.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          font-weight: bold; 
                          display: inline-block;
                          font-size: 16px;">
                  Go to Dashboard
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                If you have any questions or need help getting started, don't hesitate to reach out to our support team.
              </p>
              
              <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
                This email was sent by FetchText • <a href="mailto:${FROM_EMAIL}" style="color: #667eea;">${FROM_EMAIL}</a>
                <br>© ${new Date().getFullYear()} FetchText. All rights reserved.
              </p>
            </div>
          </body>
          </html>
        `,
      },
    ],
  };
}

function generateTwoFactorEmail(email: string, code: string) {
  return {
    personalizations: [
      {
        to: [{ email }],
        subject: 'Your FetchText Verification Code',
      },
    ],
    from: {
      email: FROM_EMAIL,
      name: FROM_NAME,
    },
    content: [
      {
        type: 'text/html',
        value: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Verification Code - FetchText</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔐 FetchText</h1>
              <p style="color: white; margin: 10px 0 0; opacity: 0.9;">Verification Code</p>
            </div>
            
            <div style="background: white; padding: 40px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-bottom: 20px;">Your Verification Code</h2>
              
              <p>Hello,</p>
              
              <p>Here is your verification code for FetchText:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: #f8f9fa; 
                           border: 2px solid #667eea; 
                           padding: 20px; 
                           border-radius: 10px; 
                           font-size: 32px; 
                           font-weight: bold; 
                           letter-spacing: 5px; 
                           color: #667eea;">
                  ${code}
                </div>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                <strong>This code will expire in 10 minutes</strong> for security reasons.
              </p>
              
              <p style="color: #666; font-size: 14px;">
                If you didn't request this verification code, please ignore this email.
              </p>
              
              <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
                This email was sent by FetchText • <a href="mailto:${FROM_EMAIL}" style="color: #667eea;">${FROM_EMAIL}</a>
                <br>© ${new Date().getFullYear()} FetchText. All rights reserved.
              </p>
            </div>
          </body>
          </html>
        `,
      },
    ],
  };
} 