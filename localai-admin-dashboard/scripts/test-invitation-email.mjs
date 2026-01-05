#!/usr/bin/env node
/**
 * Test Script: Invitation Email via SendGrid
 *
 * Tests the sendInvitationEmail functionality directly.
 * Run with: node scripts/test-invitation-email.mjs
 *
 * Requires VITE_SENDGRID_API_KEY in .env.local
 */

import sgMail from '@sendgrid/mail';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const SENDGRID_API_KEY = process.env.VITE_SENDGRID_API_KEY;
const FROM_EMAIL = process.env.VITE_SENDGRID_FROM_EMAIL || 'nick@fetchtext.io';
const FROM_NAME = process.env.VITE_SENDGRID_FROM_NAME || 'FetchText';
const REPLY_TO = process.env.VITE_SENDGRID_REPLY_TO || 'nick@fetchtext.io';
const APP_URL = process.env.VITE_APP_URL || 'http://localhost:5173';

// Validate configuration
if (!SENDGRID_API_KEY) {
  console.error('ERROR: VITE_SENDGRID_API_KEY not set in .env.local');
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

console.log('=== SendGrid Invitation Email Test ===\n');
console.log('Configuration:');
console.log(`  API Key: ${SENDGRID_API_KEY.substring(0, 10)}...`);
console.log(`  From: ${FROM_NAME} <${FROM_EMAIL}>`);
console.log(`  Reply-To: ${REPLY_TO}`);
console.log(`  App URL: ${APP_URL}`);
console.log('');

async function sendTestInvitation() {
  const testToken = `test-token-${Date.now()}`;
  const acceptUrl = `${APP_URL}/invite/accept?token=${testToken}`;
  const organizationName = 'Test Organization';
  const inviterEmail = 'admin@fetchtext.local';
  const role = 'member';

  const message = {
    to: FROM_EMAIL, // Send to ourselves for testing
    from: {
      email: FROM_EMAIL,
      name: FROM_NAME,
    },
    replyTo: REPLY_TO,
    subject: `[TEST] You've been invited to join ${organizationName} on FetchText`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation - FetchText</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">FetchText</h1>
          <p style="color: white; margin: 10px 0 0; opacity: 0.9;">Team Invitation</p>
        </div>

        <div style="background: white; padding: 40px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-bottom: 20px;">You're Invited!</h2>

          <p>Hi there!</p>

          <p><strong>${inviterEmail}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 5px;
                      font-weight: bold;
                      display: inline-block;
                      font-size: 16px;">
              Accept Invitation
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            <strong>This invitation expires in 7 days.</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Test email sent at ${new Date().toISOString()}
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      [TEST] You're Invited to Join ${organizationName} on FetchText!

      ${inviterEmail} has invited you to join ${organizationName} as a ${role}.

      Accept link: ${acceptUrl}

      This invitation expires in 7 days.

      Test sent at: ${new Date().toISOString()}
    `,
  };

  console.log(`Sending test invitation email to: ${FROM_EMAIL}`);
  console.log('');

  try {
    const response = await sgMail.send(message);
    const statusCode = response[0]?.statusCode;
    const messageId = response[0]?.headers?.['x-message-id'];

    console.log('SUCCESS!');
    console.log(`  Status: ${statusCode}`);
    console.log(`  Message ID: ${messageId}`);
    console.log('');
    console.log(`Check your inbox at: ${FROM_EMAIL}`);

    return { success: true, statusCode, messageId };
  } catch (error) {
    console.error('FAILED!');
    console.error(`  Error: ${error.message}`);

    if (error.response?.body?.errors) {
      console.error('  SendGrid errors:');
      error.response.body.errors.forEach(e => {
        console.error(`    - ${e.message}`);
      });
    }

    return { success: false, error: error.message };
  }
}

// Run the test
sendTestInvitation().then(result => {
  process.exit(result.success ? 0 : 1);
});
