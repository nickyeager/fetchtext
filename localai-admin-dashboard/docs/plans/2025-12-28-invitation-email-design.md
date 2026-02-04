# Invitation Email Feature Design

**Date:** 2025-12-28
**Status:** Approved

## Overview

Add email notifications when users are invited to organizations.

## Architecture

```
User clicks "Invite Member"
    ↓
OrganizationService.inviteMember()
    ↓
1. Insert invitation into database (existing)
2. Call sendInvitationEmail() (NEW)
    ↓
SendGrid API (direct, via @sendgrid/mail)
    ↓
Invitee receives email with accept link
```

## Components

### 1. sendInvitationEmail() function

**File:** `src/lib/email-service.ts`

```typescript
export async function sendInvitationEmail(
  email: string,
  organizationName: string,
  inviterName: string,
  inviteToken: string,
  role: string
): Promise<EmailResult>
```

### 2. Email Template

- Subject: "You've been invited to join [Organization Name] on FetchText"
- CTA: "Accept Invitation" button
- Link: `${APP_URL}/invite/accept?token=${inviteToken}`
- Expiry notice: "This invitation expires in 7 days"

### 3. Integration with OrganizationService

In `inviteMember()` after database insert:
- Fetch organization name
- Call `sendInvitationEmail()`
- Log warning on failure (don't block invitation)

## Testing

**File:** `src/__tests__/integration/invitation-email.test.ts`

Tests:
1. Direct SendGrid call with real email
2. Full flow via OrganizationService

Prerequisites:
- `VITE_SENDGRID_API_KEY` set
- Verified sender: `yeag123@gmail.com`

## Environment

| Environment | SendGrid | App URL |
|-------------|----------|---------|
| Local | Direct API | `http://localhost:5173` |
| Production | Direct API | `https://app.fetchtext.io` |

## Configuration

### Environment Variables

Add these to your deployment environment:

```bash
# SendGrid Configuration
VITE_SENDGRID_API_KEY=SG.xxx...  # Get from SendGrid dashboard
VITE_SENDGRID_FROM_EMAIL=yeag123@gmail.com
VITE_SENDGRID_FROM_NAME=FetchText Support
VITE_SENDGRID_REPLY_TO=yeag123@gmail.com

# Application URL for email links
VITE_APP_URL=https://app.fetchtext.io  # Production URL
```

### SendGrid Account Requirements

- **Verified Sender**: `yeag123@gmail.com` must be verified in SendGrid
- **API Key Permissions**: Full Access or at minimum Mail Send permission
- **Plan**: Paid plan (upgraded 2025-12-29)

### Production Deployment (Netlify)

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select the FetchText site
3. Navigate to **Site settings** → **Environment variables**
4. Add these variables:

| Variable | Value |
|----------|-------|
| `VITE_SENDGRID_API_KEY` | `***REMOVED-SENDGRID-KEY-2***` |
| `VITE_SENDGRID_FROM_EMAIL` | `yeag123@gmail.com` |
| `VITE_SENDGRID_FROM_NAME` | `FetchText Support` |
| `VITE_SENDGRID_REPLY_TO` | `yeag123@gmail.com` |
| `VITE_APP_URL` | `https://app.fetchtext.io` |

5. Trigger a redeploy for changes to take effect

### Current Status (2025-12-29)

- API key: Configured and authenticated
- Account status: **Paid plan** - no credit limits
- Integration: **Working** - emails ready to send
