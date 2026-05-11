# Change Email Sender to Professional Domain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the email sender from `yeag123@gmail.com` to `nick@fetchtext.io` for all outgoing emails.

**Architecture:** SendGrid requires sender verification before emails can be sent from a domain. The current setup uses environment variables for sender configuration, making the code change minimal. The primary work is SendGrid domain/sender verification + environment variable updates.

**Tech Stack:** SendGrid (email delivery), Environment variables, Docker Compose, N8N workflows

---

## Prerequisites (Manual Steps Required)

### SendGrid Domain Authentication (REQUIRED FIRST)

Before any code changes will work, you MUST verify the sender domain/email in SendGrid:

1. **Log in to SendGrid**: https://app.sendgrid.com
2. **Navigate to**: Settings → Sender Authentication
3. **Two options**:
   - **Option A: Domain Authentication (Recommended)**
     - Click "Authenticate Your Domain"
     - Enter domain: `fetchtext.io`
     - Add DNS records provided by SendGrid to your domain registrar
     - Wait for verification (can take up to 48 hours)
   - **Option B: Single Sender Verification (Quick)**
     - Click "Verify a Single Sender"
     - Enter: `nick@fetchtext.io`
     - Check inbox for verification email
     - Click verification link

**WARNING**: Emails will fail to send until SendGrid verification is complete!

---

## Task 1: Update Root Environment Variables

**Files:**
- Modify: `/.env`

**Step 1: Update to professional email**

Change:
```bash
SENDGRID_FROM_EMAIL=yeag123@gmail.com
SENDGRID_FROM_NAME=FetchText Support
```

To:
```bash
SENDGRID_FROM_EMAIL=nick@fetchtext.io
SENDGRID_FROM_NAME=FetchText
```

**Step 2: Verify the change**

Run: `grep SENDGRID_FROM .env`

Expected:
```
SENDGRID_FROM_EMAIL=nick@fetchtext.io
SENDGRID_FROM_NAME=FetchText
```

---

## Task 2: Update Frontend Environment Variables

**Files:**
- Modify: `/dashboard/.env.local`

**Step 1: Update to professional email**

Change all `yeag123@gmail.com` references to:
```bash
VITE_SENDGRID_FROM_EMAIL=nick@fetchtext.io
VITE_SENDGRID_FROM_NAME=FetchText
VITE_SENDGRID_REPLY_TO=nick@fetchtext.io
```

**Step 2: Verify**

Run: `grep VITE_SENDGRID dashboard/.env.local`

---

## Task 3: Update Frontend Email Config Default

**Files:**
- Modify: `/dashboard/src/config/email.ts`

**Step 1: Update fallback defaults**

Change FROM_EMAIL and REPLY_TO fallbacks from `yeag123@gmail.com` to `nick@fetchtext.io`.

**Step 2: Run build**

Run: `cd dashboard && npx pnpm build`

---

## Task 4: Update Backend Email Router Default

**Files:**
- Modify: `/document-processor/app/routers/email.py`

**Step 1: Update fallback default**

Change:
```python
FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "yeag123@gmail.com")
```

To:
```python
FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "nick@fetchtext.io")
```

**Step 2: Restart container**

Run: `docker compose -p localai restart document-processor`

---

## Task 5: Update Docker Compose Defaults

**Files:**
- Modify: `/docker-compose.yml`

**Step 1: Update default email**

Change:
```yaml
- SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL:-yeag123@gmail.com}
```

To:
```yaml
- SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL:-nick@fetchtext.io}
```

---

## Task 6: Update CLAUDE.md Documentation

**Files:**
- Modify: `/CLAUDE.md`

Change: `Verified sender: yeag123@gmail.com` → `Verified sender: nick@fetchtext.io`

---

## Task 7: Test Email Sending

**Step 1: Run test script**

Run: `cd dashboard && node scripts/test-invitation-email.mjs`

**Step 2: Verify email**

Check that received email shows sender as `nick@fetchtext.io`.

---

## Summary

| File | Change |
|------|--------|
| `/.env` | `SENDGRID_FROM_EMAIL=nick@fetchtext.io` |
| `/dashboard/.env.local` | `VITE_SENDGRID_FROM_EMAIL=nick@fetchtext.io` |
| `/dashboard/src/config/email.ts` | Update fallback defaults |
| `/document-processor/app/routers/email.py` | Update fallback default |
| `/docker-compose.yml` | Update environment default |
| `/CLAUDE.md` | Update documentation |
