# N8N Email Integration Guide

## Overview

FetchText now uses **N8N workflows** for all email delivery, following the repository rules. This provides better email template management, workflow automation, and debugging capabilities compared to direct SendGrid integration.

## Architecture

```
Frontend Component → N8N Email Client → N8N Webhook → N8N Workflow → SendGrid API
```

### Components

1. **N8N Email Client** (`src/lib/email-client.ts`)
   - Handles all email requests from the frontend
   - Calls N8N webhook endpoints
   - Generates professional HTML email templates
   - Provides proper error handling and logging

2. **N8N Webhooks** (Port 5678)
   - `http://localhost:5678/webhook/password-reset-email`
   - `http://localhost:5678/webhook/welcome-email`
   - `http://localhost:5678/webhook/two-factor-email`

3. **N8N Workflows**
   - Process webhook requests
   - Handle email template rendering
   - Send emails via SendGrid
   - Manage error handling and retries

## Email Client API

### Interface

```typescript
interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  templateType: 'password-reset' | 'welcome' | 'two-factor';
  variables?: Record<string, string>;
}

interface EmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}
```

### Methods

```typescript
// Send password reset email
await emailClient.sendPasswordResetEmail(email, resetToken);

// Send welcome email
await emailClient.sendWelcomeEmail(email, userName);

// Send two-factor email
await emailClient.sendTwoFactorEmail(email, code);

// Send generic email
await emailClient.sendGenericEmail(request);
```

## Configuration

### Email Configuration (`src/config/email.ts`)

```typescript
export const EMAIL_CONFIG = {
  FROM_EMAIL: 'yeag123@gmail.com',
  FROM_NAME: 'FetchText Support',
  // ... other configuration
}
```

### N8N Webhook Endpoints

```typescript
const N8N_WEBHOOKS = {
  'password-reset': 'http://localhost:5678/webhook/password-reset-email',
  'welcome': 'http://localhost:5678/webhook/welcome-email',
  'two-factor': 'http://localhost:5678/webhook/two-factor-email'
};
```

## Email Templates

### Built-in HTML Templates

The N8N email client now generates professional HTML email templates automatically:

#### Password Reset Email
- Professional styling with FetchText branding
- Clear call-to-action button
- Security warnings and expiration notices
- Fallback text link for accessibility

#### Welcome Email
- Personalized greeting with user name
- Feature highlights and dashboard link
- Support contact information
- Professional styling

#### Two-Factor Authentication
- Large, prominent verification code display
- Clear instructions and security warnings
- Expiration notice (10 minutes)
- Professional layout with branding

### Template Customization

All templates include:
- Responsive design
- Professional typography (Arial, sans-serif)
- Consistent FetchText branding
- Proper color scheme
- Accessibility considerations

## Testing

### Unit Tests
Run the comprehensive test suite:
```bash
npm test -- src/lib/__tests__/n8n-email-client.test.ts
```

### Integration Testing
1. Start the mock N8N webhook server:
```bash
node mock-n8n-webhook.cjs
```

2. Test the integration:
```bash
node test-n8n-integration.js
```

### Manual Testing
Test individual endpoints:
```bash
# Health check
curl http://localhost:5678/health

# Password reset email
curl -X POST http://localhost:5678/webhook/password-reset-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "resetToken": "test-token",
    "resetUrl": "http://localhost:5173/reset-password?token=test-token",
    "messageHTML": "<div>Professional HTML email content here</div>",
    "fromEmail": "yeag123@gmail.com",
    "fromName": "FetchText Support"
  }'
```

## Usage Examples

### Password Reset Flow
```typescript
import { emailClient } from '@/lib/email-client';

async function handleForgotPassword(email: string) {
  const resetToken = generateResetToken();
  
  const result = await emailClient.sendPasswordResetEmail(email, resetToken);
  
  if (result.success) {
    toast.success('Password reset email sent!');
  } else {
    toast.error(result.error || 'Failed to send email');
  }
}
```

### Welcome Email Flow
```typescript
import { emailClient } from '@/lib/email-client';

async function handleSignupConfirmation(email: string, userName: string) {
  const result = await emailClient.sendWelcomeEmail(email, userName);
  
  if (result.success) {
    console.log('Welcome email sent successfully');
  } else {
    console.error('Welcome email failed:', result.error);
  }
}
```

## Error Handling

The N8N email client provides comprehensive error handling:

### Network Errors
```typescript
{
  success: false,
  error: "Network error connecting to N8N"
}
```

### Webhook Errors
```typescript
{
  success: false,
  error: "N8N webhook failed: 500 Internal Server Error"
}
```

### Validation Errors
```typescript
{
  success: false,
  error: "Unknown email template type: invalid-type"
}
```

## N8N Workflow Requirements

Each N8N workflow should:

1. **Accept webhook requests** with the expected payload format
2. **Validate input data** (email, required fields)
3. **Use the messageHTML parameter** for email content
4. **Send emails via SendGrid** using the configured API key
5. **Return proper responses** with success/error status
6. **Handle retries** for transient failures
7. **Log activities** for debugging

### Expected Payload Formats

#### Password Reset Email
```json
{
  "to": "user@example.com",
  "resetToken": "abc123",
  "resetUrl": "https://app.fetchtext.io/reset-password?token=abc123",
  "messageHTML": "<div style='font-family: Arial, sans-serif;'>...Professional HTML content...</div>",
  "fromEmail": "yeag123@gmail.com",
  "fromName": "FetchText Support"
}
```

#### Welcome Email
```json
{
  "to": "user@example.com",
  "userName": "John Doe",
  "dashboardUrl": "https://app.fetchtext.io/dashboard",
  "messageHTML": "<div style='font-family: Arial, sans-serif;'>...Welcome HTML content...</div>",
  "fromEmail": "yeag123@gmail.com",
  "fromName": "FetchText Support"
}
```

#### Two-Factor Email
```json
{
  "to": "user@example.com",
  "code": "123456",
  "messageHTML": "<div style='font-family: Arial, sans-serif;'>...Verification code HTML...</div>",
  "fromEmail": "yeag123@gmail.com",
  "fromName": "FetchText Support"
}
```

### N8N Workflow Implementation

Your N8N workflows should use the `messageHTML` parameter as the email body content:

1. **Webhook Trigger**: Accept the payload with messageHTML
2. **SendGrid Node**: Use messageHTML as the email HTML content
3. **Response**: Return success/error status

Example N8N workflow structure:
```
Webhook → Validate Email → SendGrid API → Response
```

## Deployment

### Development Mode
1. Start the mock N8N webhook server: `node mock-n8n-webhook.cjs`
2. All email requests will be logged to the console
3. messageHTML content will be logged as "Included" or "Not included"
4. No actual emails are sent

### Production Mode
1. Deploy N8N workflows to the existing N8N container
2. Configure SendGrid API key in the parent `.env` file
3. Use the messageHTML parameter for email content
4. Update webhook URLs if needed (they should point to the N8N container)

## Benefits

### Compared to Direct SendGrid Integration:
- ✅ Better email template management
- ✅ Professional HTML email templates included
- ✅ Workflow automation capabilities
- ✅ Visual debugging interface
- ✅ Retry mechanisms
- ✅ No API key exposure in frontend
- ✅ Better error tracking
- ✅ Follows repository rules

### Compared to Supabase Edge Functions:
- ✅ Already available in the Docker stack
- ✅ No additional deployment required
- ✅ Better debugging capabilities
- ✅ More flexible workflow management
- ✅ Repository compliance
- ✅ Built-in HTML templates

## Monitoring

### Health Checks
The mock server provides a health endpoint:
```bash
curl http://localhost:5678/health
```

### Logging
All email requests are logged with:
- Email recipient
- Email type
- messageHTML status (included/not included)
- Timestamp
- Request payload
- Response status

### Error Tracking
Errors are properly categorized:
- Network errors
- Webhook failures
- Validation errors
- Unknown template types

## Migration from Previous Implementation

The N8N email client maintains backward compatibility with the previous API:

```typescript
// These functions still work as before
await sendPasswordResetEmail(email, token);
await sendWelcomeEmail(email, userName);
await sendTwoFactorEmail(email, code);
```

But now they internally use the N8N client with professional HTML templates.

## Next Steps

1. **Create N8N Workflows**: Set up the actual N8N workflows in the N8N container
2. **Configure SendGrid**: Add the SendGrid API key to the parent `.env` file
3. **Use messageHTML**: Configure workflows to use the messageHTML parameter
4. **Test End-to-End**: Verify the complete flow from frontend to email delivery
5. **Monitor Performance**: Set up alerts and monitoring for email delivery
6. **Customize Templates**: Modify HTML templates as needed for branding 