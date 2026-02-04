# Environment Variables Audit - Code Review

**Date:** 2026-02-03
**Focus:** SENDGRID_API_KEY and integration API keys audit
**Reviewer:** Claude Code (validation:code-review)

## Stats

- Files Modified: 80
- Files Added: 50+
- Files Deleted: 27
- New lines: ~10,203
- Deleted lines: ~13,326

## Critical Issues Found

### 1. SENDGRID_API_KEY Missing from Docker Compose

```
severity: critical
file: docker-compose.yml
line: 378-392 (document-processor environment section)
issue: SENDGRID_API_KEY not passed to document-processor container
detail: The email router at document-processor/app/routers/email.py reads SENDGRID_API_KEY from os.getenv() but this variable is NOT listed in the docker-compose.yml environment section for the document-processor service. While env_file: .env is specified, explicit environment variables take precedence and the current setup may cause confusion.
suggestion: Add SENDGRID_API_KEY to the environment section:
  environment:
    - SENDGRID_API_KEY=${SENDGRID_API_KEY}
    - SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL:-nick@fetchtext.io}
    - SENDGRID_FROM_NAME=${SENDGRID_FROM_NAME:-FetchText}
```

### 2. SENDGRID_API_KEY Missing from .env.example

```
severity: critical
file: .env.example
line: 277 (end of file)
issue: SENDGRID_API_KEY not documented in .env.example
detail: The .env.example file lists all required and optional environment variables but SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and SENDGRID_FROM_NAME are missing. This causes confusion for developers and production deployments since email functionality silently fails.
suggestion: Add SendGrid section to .env.example after Stripe section:

############
# SendGrid - Configuration for Email Delivery
############

# SendGrid API Key (from SendGrid Dashboard -> Settings -> API Keys)
SENDGRID_API_KEY=

# From email address (must be a verified sender in SendGrid)
SENDGRID_FROM_EMAIL=nick@fetchtext.io

# From name shown in email clients
SENDGRID_FROM_NAME=FetchText
```

### 3. Stripe Environment Variables Missing from Docker Compose

```
severity: high
file: docker-compose.yml
line: 378-392 (document-processor environment section)
issue: Stripe API keys not passed to document-processor container
detail: The billing router uses settings.STRIPE_SECRET_KEY but this is not explicitly passed in docker-compose.yml environment section. While env_file includes .env, explicit listing improves clarity and debugging.
suggestion: Add Stripe variables to environment section:
  environment:
    - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
    - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    - STRIPE_PRICE_NON_MANAGED=${STRIPE_PRICE_NON_MANAGED}
    - STRIPE_PRICE_PROFESSIONAL=${STRIPE_PRICE_PROFESSIONAL}
    - STRIPE_PRICE_ENTERPRISE=${STRIPE_PRICE_ENTERPRISE}
```

### 4. OAuth Integration Keys Missing from Docker Compose

```
severity: high
file: docker-compose.yml
line: 378-392 (document-processor environment section)
issue: OAuth credentials not passed to document-processor container
detail: The integrations router and settings.py define multiple OAuth integrations (Google, Microsoft, QuickBooks, Dropbox, Slack, Xero) but none are passed to the container's environment section.
suggestion: Add OAuth variables to environment section:
  environment:
    # Google OAuth
    - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
    - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    # Microsoft 365 OAuth
    - MICROSOFT_CLIENT_ID=${MICROSOFT_CLIENT_ID}
    - MICROSOFT_CLIENT_SECRET=${MICROSOFT_CLIENT_SECRET}
    - MICROSOFT_TENANT_ID=${MICROSOFT_TENANT_ID:-common}
    # QuickBooks OAuth
    - QUICKBOOKS_CLIENT_ID=${QUICKBOOKS_CLIENT_ID}
    - QUICKBOOKS_CLIENT_SECRET=${QUICKBOOKS_CLIENT_SECRET}
    - QUICKBOOKS_SANDBOX=${QUICKBOOKS_SANDBOX:-true}
```

### 5. Missing OAuth Section in .env.example

```
severity: high
file: .env.example
line: 277 (end of file)
issue: OAuth integration credentials not documented
detail: Settings.py defines Google, Microsoft, QuickBooks, Dropbox, Slack, and Xero OAuth credentials but these are not documented in .env.example.
suggestion: Add OAuth section to .env.example:

############
# OAuth Integrations - Third-party service connections
############

# Google OAuth (Drive, Docs, Sheets)
# Create at: https://console.cloud.google.com/apis/credentials
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# Microsoft 365 OAuth (OneDrive, Word, SharePoint)
# Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
# MICROSOFT_CLIENT_ID=
# MICROSOFT_CLIENT_SECRET=
# MICROSOFT_TENANT_ID=common

# QuickBooks Online OAuth
# Create at: https://developer.intuit.com/app/developer/qbo/docs/get-started
# QUICKBOOKS_CLIENT_ID=
# QUICKBOOKS_CLIENT_SECRET=
# QUICKBOOKS_SANDBOX=true
```

## Medium Issues

### 6. Azure Provisioning Keys Missing from .env.example

```
severity: medium
file: .env.example
line: 258 (after Azure OpenAI section)
issue: Azure Service Principal credentials not documented
detail: Settings.py defines AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID for Azure provisioning but these are not in .env.example.
suggestion: Add Azure provisioning section:

# Azure Service Principal for Provisioning (Enterprise tier only)
# Create at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
# AZURE_TENANT_ID=
# AZURE_CLIENT_ID=
# AZURE_CLIENT_SECRET=
# AZURE_SUBSCRIPTION_ID=
# AZURE_CUSTOMER_RESOURCE_GROUP=rg-fetchtext-customers-eastus
# AZURE_CUSTOMER_LOCATION=eastus
```

### 7. APP_URL Inconsistency

```
severity: medium
file: document-processor/app/routers/email.py
line: 21
issue: APP_URL default differs from FRONTEND_URL
detail: email.py uses APP_URL with default "http://localhost:5173" while integrations.py uses FRONTEND_URL (also defaulting to localhost:5173). Both should use the same variable for consistency.
suggestion: Standardize on FRONTEND_URL (defined in settings.py) throughout the codebase.
```

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Missing Docker env vars | 3 | Critical/High |
| Missing .env.example docs | 3 | High |
| Inconsistent env var naming | 1 | Medium |

## Recommended Fix Priority

1. **Immediate (blocks email tests):** Add SENDGRID_API_KEY to both docker-compose.yml and .env.example
2. **High priority:** Add Stripe and OAuth variables to docker-compose.yml
3. **Documentation:** Update .env.example with all integration credentials

## Environment Variable Inventory

### Currently Documented in .env.example
- N8N_ENCRYPTION_KEY, N8N_USER_MANAGEMENT_JWT_SECRET
- POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
- NEO4J_AUTH
- Langfuse (CLICKHOUSE_PASSWORD, MINIO_ROOT_PASSWORD, etc.)
- Caddy hostnames
- Azure OpenAI (AZURE_OPENAI_API_KEY, etc.)
- Stripe (commented out)

### Missing from .env.example (Required)
- **SENDGRID_API_KEY** - Required for email delivery
- **SENDGRID_FROM_EMAIL** - Required for email delivery
- **SENDGRID_FROM_NAME** - Required for email delivery

### Missing from .env.example (Optional)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID
- QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_SANDBOX
- DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET
- SLACK_CLIENT_ID, SLACK_CLIENT_SECRET
- XERO_CLIENT_ID, XERO_CLIENT_SECRET
- AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID

### Missing from docker-compose.yml environment section
- SENDGRID_API_KEY
- SENDGRID_FROM_EMAIL
- SENDGRID_FROM_NAME
- All Stripe variables
- All OAuth variables
- Azure provisioning variables
