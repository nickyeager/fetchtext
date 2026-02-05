# Feature: Beautiful API Documentation Portal

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files etc.

## Feature Description

Create a world-class, Stripe-quality API documentation portal for the FetchText Document Processor API. The documentation will feature multi-language code examples (cURL, Python, JavaScript/TypeScript), interactive elements, comprehensive webhook documentation, and a beautiful visual design that matches modern API documentation standards.

## User Story

As a **third-party developer integrating with FetchText**
I want to **access beautiful, comprehensive API documentation with code examples in my preferred language**
So that I can **quickly integrate document processing into my application with minimal friction and maximum confidence**

## Problem Statement

The current API documentation exists but is:
- Limited to basic markdown files (`API_ENDPOINTS.md`)
- Only shows cURL examples
- Lacks interactive "try it now" capabilities
- Missing comprehensive webhook documentation
- No multi-language SDK examples (Python, JavaScript)
- No authentication flow diagrams or guides
- Not visually appealing or scannable

## Solution Statement

Build a modern, Mintlify/ReadMe-style API documentation system that:
1. **Uses OpenAPI 3.1 spec** as single source of truth (auto-generated from FastAPI)
2. **Deploys beautiful docs** using a modern documentation platform
3. **Provides multi-language examples** for all endpoints (cURL, Python, JS/TS)
4. **Documents webhooks comprehensively** with security, payloads, and testing guides
5. **Includes interactive API playground** for live testing
6. **Features visual diagrams** for authentication flows and architecture

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium-High
**Primary Systems Affected**: Documentation, Document Processor API
**Dependencies**: OpenAPI spec generation, Documentation platform (Mintlify/Redocly)

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING!

**API Router Files (Source of Truth for Endpoints)**:
- `document-processor/app/main.py` (lines 1-49) - FastAPI app setup, router includes
- `document-processor/app/routers/api_v1.py` (entire file) - Third-party API with webhooks
- `document-processor/app/routers/enhanced_documents.py` - Enhanced document processing
- `document-processor/app/routers/documents.py` - Basic document processing
- `document-processor/app/routers/models.py` - AI provider management
- `document-processor/app/routers/health.py` - Health check endpoints
- `document-processor/app/routers/api_keys_admin.py` - API key management

**Authentication Middleware**:
- `document-processor/app/middleware/api_auth.py` - API key authentication, rate limiting
- `document-processor/app/middleware/admin_auth.py` - JWT authentication

**Webhook Service**:
- `document-processor/app/services/webhook_service.py` - Webhook delivery with HMAC

**Existing Documentation**:
- `document-processor/API_ENDPOINTS.md` - Current basic documentation
- `docs/TWO_PASS_API_INTEGRATION.md` - Two-pass extraction feature docs
- `docs/guides/DOCUMENT_PROCESSING_COMPLETE_GUIDE.md` - Processing workflow guide

**Frontend API Client (Example Patterns)**:
- `localai-admin-dashboard/src/lib/document-processor-enhanced.ts` - TypeScript interfaces

### New Files to Create

**Documentation Source Files** (if using Mintlify/docs-as-code):
```
docs/api/
├── mint.json                        # Mintlify config (if using Mintlify)
├── introduction.mdx                 # API overview and quickstart
├── authentication.mdx               # Auth guide with diagrams
├── quickstart.mdx                   # 5-minute integration guide
├── rate-limiting.mdx                # Rate limit documentation
├── errors.mdx                       # Error codes reference
├── webhooks/
│   ├── overview.mdx                 # Webhook introduction
│   ├── events.mdx                   # Event catalog
│   ├── security.mdx                 # HMAC verification guide
│   └── testing.mdx                  # Webhook testing guide
├── endpoints/
│   ├── documents.mdx                # Document processing endpoints
│   ├── templates.mdx                # Template endpoints
│   ├── jobs.mdx                     # Job status endpoints
│   └── health.mdx                   # Health check endpoints
├── sdks/
│   ├── python.mdx                   # Python SDK/examples
│   ├── javascript.mdx               # JavaScript SDK/examples
│   └── curl.mdx                     # cURL examples
└── changelog.mdx                    # API changelog
```

**OpenAPI Enhancement**:
- `document-processor/app/openapi_config.py` - Custom OpenAPI schema configuration
- `document-processor/openapi.json` - Generated OpenAPI 3.1 spec (versioned)

**SDK Packages** (optional Phase 2):
```
sdks/
├── python/
│   ├── fetchtext/
│   │   ├── __init__.py
│   │   ├── client.py
│   │   └── models.py
│   └── pyproject.toml
└── javascript/
    ├── src/
    │   ├── index.ts
    │   ├── client.ts
    │   └── types.ts
    └── package.json
```

### Relevant Documentation - READ BEFORE IMPLEMENTING!

**OpenAPI & FastAPI**:
- [FastAPI OpenAPI Docs](https://fastapi.tiangolo.com/tutorial/metadata/) - OpenAPI customization
- [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0) - Full specification

**Documentation Platforms**:
- [Mintlify Docs](https://mintlify.com/docs) - Mintlify setup and configuration
- [Redocly Quickstart](https://redocly.com/docs/redoc/quickstart/) - Redocly alternative
- [ReadMe Docs](https://docs.readme.com/) - ReadMe platform docs

**Code Example Best Practices**:
- [Stripe API Docs](https://docs.stripe.com/api) - Gold standard reference
- [Twilio Code Samples](https://www.twilio.com/docs/usage/api) - Multi-language patterns

**Webhook Security**:
- [GitHub Webhooks Best Practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- [Stripe Webhook Signatures](https://stripe.com/docs/webhooks/signatures)

### Patterns to Follow

**Naming Conventions:**
- Endpoints: kebab-case paths (`/api/v1/process`, `/api/v1/jobs/{job_id}`)
- Models: PascalCase classes (`DocumentProcessingResponse`, `SmartVariable`)
- Files: snake_case (`api_v1.py`, `webhook_service.py`)

**API Response Pattern:**
```python
# Success response
{
    "job_id": "uuid",
    "status": "completed",
    "result": {...},
    "processing_time_ms": 1234
}

# Error response
{
    "detail": "Error message here"
}
```

**Webhook Payload Pattern:**
```python
{
    "job_id": "uuid",
    "status": "completed|failed",
    "result": {...},  # if completed
    "error": "...",   # if failed
    "processing_time_ms": 1234,
    "completed_at": "ISO8601"
}
```

**Authentication Header Pattern:**
```
Authorization: Bearer ftxt_<key>
```

---

## IMPLEMENTATION PLAN

### Phase 1: OpenAPI Enhancement (Foundation)

**Goal**: Create a comprehensive, well-documented OpenAPI 3.1 specification that serves as the single source of truth for all documentation.

**Tasks:**
1. Enhance FastAPI app with rich OpenAPI metadata
2. Add detailed descriptions to all endpoints, parameters, and responses
3. Define request/response examples for all endpoints
4. Configure security schemes properly
5. Export and version the OpenAPI spec

### Phase 2: Documentation Content

**Goal**: Write comprehensive, developer-friendly documentation content following the SOP Creator principles (scannable, actionable, specific).

**Tasks:**
1. Create introduction and quickstart guide (5-minute integration)
2. Write authentication documentation with diagrams
3. Document all endpoints with multi-language examples
4. Create comprehensive webhook documentation
5. Build error reference with troubleshooting guides

### Phase 3: Documentation Platform Setup

**Goal**: Deploy documentation using a modern platform (Mintlify recommended for beautiful design).

**Tasks:**
1. Choose and configure documentation platform
2. Set up docs-as-code workflow (GitHub integration)
3. Configure navigation and branding
4. Add interactive API playground
5. Deploy and configure custom domain

### Phase 4: Code Examples & SDKs

**Goal**: Provide copy-paste-ready code examples in multiple languages.

**Tasks:**
1. Create cURL examples for all endpoints
2. Create Python examples with type hints
3. Create JavaScript/TypeScript examples
4. (Optional) Build and publish official SDK packages

---

## STEP-BY-STEP TASKS

### Phase 1: OpenAPI Enhancement

#### Task 1.1: CREATE `document-processor/app/openapi_config.py`

- **IMPLEMENT**: OpenAPI configuration with rich metadata, tags, and security schemes
- **PATTERN**: Follow FastAPI metadata patterns from [FastAPI docs](https://fastapi.tiangolo.com/tutorial/metadata/)
- **IMPORTS**: `from fastapi import FastAPI`
- **GOTCHA**: Tags must match router tags exactly
- **CONTENT**:
```python
"""OpenAPI configuration for FetchText Document Processor API."""

from typing import Dict, Any

# API metadata
API_TITLE = "FetchText Document Processor API"
API_VERSION = "1.0.0"
API_DESCRIPTION = """
## Overview

FetchText Document Processor API provides AI-powered document processing,
template matching, and field extraction capabilities.

### Key Features

- **Document Processing**: Upload PDFs, DOCX, images and extract structured data
- **Template Matching**: Automatically match documents to templates or generate new ones
- **Field Extraction**: AI-powered extraction of specific fields with confidence scores
- **Webhooks**: Receive real-time notifications when processing completes

### Authentication

All API endpoints (except health checks) require authentication:

- **Dashboard Users**: JWT Bearer token from Supabase
- **Third-Party Integrations**: API Key (starts with `ftxt_`)

### Rate Limits

| Limit Type | Default | Configurable |
|------------|---------|--------------|
| General requests | 60/minute | Yes |
| Upload operations | 10/minute | Yes |

### Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.fetchtext.io` |
| Local Development | `http://localhost:8090` |
"""

API_CONTACT = {
    "name": "FetchText Support",
    "url": "https://fetchtext.io/support",
    "email": "support@fetchtext.io"
}

API_LICENSE = {
    "name": "Proprietary",
    "url": "https://fetchtext.io/terms"
}

# Tag definitions with descriptions
API_TAGS = [
    {
        "name": "Third-Party API v1",
        "description": "External API for third-party integrations. Requires API key authentication.",
        "externalDocs": {
            "description": "Integration Guide",
            "url": "https://docs.fetchtext.io/quickstart"
        }
    },
    {
        "name": "Documents",
        "description": "Basic document upload and processing endpoints."
    },
    {
        "name": "Enhanced Documents",
        "description": "AI-enhanced document processing with template matching and field extraction."
    },
    {
        "name": "Models",
        "description": "AI provider and model configuration management."
    },
    {
        "name": "Health",
        "description": "Service health and readiness checks."
    },
    {
        "name": "API Key Management",
        "description": "Create and manage API keys for third-party access. Requires admin authentication."
    },
    {
        "name": "Google Docs",
        "description": "Google Docs/Drive integration for document import."
    },
    {
        "name": "Email",
        "description": "Email notification service."
    }
]

# Security scheme definitions
SECURITY_SCHEMES = {
    "APIKeyAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "API Key",
        "description": "API Key authentication for third-party integrations. Keys start with `ftxt_`."
    },
    "JWTAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT Bearer token from Supabase for dashboard users."
    }
}

def get_openapi_config() -> Dict[str, Any]:
    """Return OpenAPI configuration dict."""
    return {
        "title": API_TITLE,
        "version": API_VERSION,
        "description": API_DESCRIPTION,
        "contact": API_CONTACT,
        "license_info": API_LICENSE,
        "openapi_tags": API_TAGS
    }
```
- **VALIDATE**: `python -c "from app.openapi_config import get_openapi_config; print(get_openapi_config())"`

#### Task 1.2: UPDATE `document-processor/app/main.py`

- **IMPLEMENT**: Integrate OpenAPI config and add endpoint examples
- **PATTERN**: Use existing FastAPI app structure
- **IMPORTS**: Add `from app.openapi_config import get_openapi_config, API_TAGS, SECURITY_SCHEMES`
- **GOTCHA**: Don't break existing functionality
- **CHANGES**:
```python
# After imports, add:
from app.openapi_config import get_openapi_config, API_TAGS

# Modify FastAPI initialization:
config = get_openapi_config()

app = FastAPI(
    title=config["title"],
    description=config["description"],
    version=config["version"],
    contact=config["contact"],
    license_info=config["license_info"],
    openapi_tags=API_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)
```
- **VALIDATE**: `curl http://localhost:8090/openapi.json | python -m json.tool | head -50`

#### Task 1.3: CREATE OpenAPI export script

- **IMPLEMENT**: Script to export and version OpenAPI spec
- **FILE**: `document-processor/scripts/export_openapi.py`
- **CONTENT**:
```python
#!/usr/bin/env python3
"""Export OpenAPI specification to JSON file."""
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

def export_openapi():
    """Export the OpenAPI schema to a JSON file."""
    openapi_schema = app.openapi()

    output_path = Path(__file__).parent.parent / "openapi.json"

    with open(output_path, "w") as f:
        json.dump(openapi_schema, f, indent=2)

    print(f"OpenAPI spec exported to: {output_path}")
    print(f"Endpoints documented: {len(openapi_schema.get('paths', {}))}")

if __name__ == "__main__":
    export_openapi()
```
- **VALIDATE**: `cd document-processor && python scripts/export_openapi.py && cat openapi.json | python -m json.tool | head -100`

### Phase 2: Documentation Content

#### Task 2.1: CREATE `docs/api/introduction.mdx`

- **IMPLEMENT**: API overview and value proposition
- **PATTERN**: Follow Stripe/Mintlify documentation style
- **CONTENT**:
```mdx
---
title: 'Introduction'
description: 'Welcome to the FetchText Document Processor API'
---

# FetchText Document Processor API

Transform documents into structured data with AI-powered extraction.

## What is FetchText?

FetchText is an API that extracts structured data from documents (PDFs, DOCX, images) using AI-powered template matching and field extraction.

<CardGroup cols={2}>
  <Card title="Quick Start" icon="rocket" href="/quickstart">
    Get up and running in 5 minutes
  </Card>
  <Card title="API Reference" icon="code" href="/api-reference">
    Complete endpoint documentation
  </Card>
  <Card title="Webhooks" icon="webhook" href="/webhooks/overview">
    Real-time event notifications
  </Card>
  <Card title="SDKs" icon="cube" href="/sdks/python">
    Official client libraries
  </Card>
</CardGroup>

## Key Features

| Feature | Description |
|---------|-------------|
| **Document Processing** | Upload PDFs, DOCX, images and extract text, tables, metadata |
| **Template Matching** | Automatically match documents to extraction templates |
| **Auto-Generation** | Generate new templates from document samples |
| **Field Extraction** | Extract specific fields with AI confidence scores |
| **Webhooks** | Receive notifications when processing completes |

## Base URLs

```
Production: https://api.fetchtext.io
Development: http://localhost:8090
```

## Authentication

All API requests require authentication via API key:

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key_here" \
  -F "file=@document.pdf"
```

[Get your API key →](/authentication)
```
- **VALIDATE**: Review rendered markdown locally

#### Task 2.2: CREATE `docs/api/quickstart.mdx`

- **IMPLEMENT**: 5-minute getting started guide
- **PATTERN**: Scannable, actionable steps (SOP Creator principles)
- **CONTENT**:
```mdx
---
title: 'Quick Start'
description: 'Process your first document in 5 minutes'
---

# Quick Start Guide

> **TL;DR:** Get an API key, upload a document, poll for results or receive a webhook.

## Definition of Done

Your integration is complete when:
- [ ] API key created and stored securely
- [ ] Document uploaded successfully (202 response)
- [ ] Job status retrieved or webhook received
- [ ] Extracted data parsed and used

## Prerequisites

- FetchText account with API access
- API key (starts with `ftxt_`)
- A document to process (PDF, DOCX, or image)

## Step 1: Get Your API Key

<Tabs>
  <Tab title="Dashboard">
    1. Go to **Settings** → **API Keys**
    2. Click **Create New Key**
    3. Copy the key (shown only once!)
  </Tab>
  <Tab title="API">
    ```bash
    curl -X POST https://api.fetchtext.io/api/admin/keys/create \
      -H "Authorization: Bearer YOUR_JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "My Integration", "organization_id": "org_xxx"}'
    ```
  </Tab>
</Tabs>

<Warning>
  Store your API key securely. It's shown only once and cannot be retrieved later.
</Warning>

## Step 2: Process a Document

<CodeGroup>

```bash cURL
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@invoice.pdf" \
  -F "auto_generate_template=true" \
  -F "webhook_url=https://your-app.com/webhooks/fetchtext"
```

```python Python
import requests

response = requests.post(
    "https://api.fetchtext.io/api/v1/process",
    headers={"Authorization": "Bearer ftxt_your_api_key"},
    files={"file": open("invoice.pdf", "rb")},
    data={
        "auto_generate_template": True,
        "webhook_url": "https://your-app.com/webhooks/fetchtext"
    }
)

job = response.json()
print(f"Job ID: {job['job_id']}")  # Job ID: abc123-def456-...
```

```javascript JavaScript
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('invoice.pdf'));
form.append('auto_generate_template', 'true');
form.append('webhook_url', 'https://your-app.com/webhooks/fetchtext');

const response = await fetch('https://api.fetchtext.io/api/v1/process', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ftxt_your_api_key'
  },
  body: form
});

const job = await response.json();
console.log(`Job ID: ${job.job_id}`);
```

</CodeGroup>

**Response (202 Accepted):**
```json
{
  "job_id": "abc123-def456-ghi789",
  "status": "pending",
  "message": "Document processing started",
  "webhook_url": "https://your-app.com/webhooks/fetchtext",
  "estimated_completion_seconds": 30,
  "created_at": "2025-02-04T12:00:00Z"
}
```

## Step 3: Get Results

### Option A: Poll for Status

<CodeGroup>

```bash cURL
curl https://api.fetchtext.io/api/v1/jobs/abc123-def456-ghi789 \
  -H "Authorization: Bearer ftxt_your_api_key"
```

```python Python
import time

while True:
    response = requests.get(
        f"https://api.fetchtext.io/api/v1/jobs/{job['job_id']}",
        headers={"Authorization": "Bearer ftxt_your_api_key"}
    )
    status = response.json()

    if status['status'] == 'completed':
        print("Extracted data:", status['result']['extracted_data'])
        break
    elif status['status'] == 'failed':
        print("Error:", status['error'])
        break

    time.sleep(2)  # Poll every 2 seconds
```

```javascript JavaScript
const pollForResults = async (jobId) => {
  while (true) {
    const response = await fetch(
      `https://api.fetchtext.io/api/v1/jobs/${jobId}`,
      { headers: { 'Authorization': 'Bearer ftxt_your_api_key' } }
    );
    const status = await response.json();

    if (status.status === 'completed') {
      return status.result.extracted_data;
    } else if (status.status === 'failed') {
      throw new Error(status.error);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
};
```

</CodeGroup>

### Option B: Receive Webhook

Your webhook endpoint will receive:

```json
{
  "job_id": "abc123-def456-ghi789",
  "status": "completed",
  "result": {
    "template_id": "tpl_invoice_001",
    "template_name": "Invoice Template",
    "extracted_data": {
      "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
      "invoice_number": {"value": "INV-2025-001", "confidence": 0.98},
      "total_amount": {"value": "$1,234.56", "confidence": 0.92},
      "due_date": {"value": "2025-03-01", "confidence": 0.89}
    },
    "extraction_method": "template_matched"
  },
  "processing_time_ms": 2341,
  "completed_at": "2025-02-04T12:00:02Z"
}
```

## Next Steps

- [Authentication Deep Dive](/authentication) - JWT, API keys, permissions
- [Webhook Integration](/webhooks/overview) - Security, events, testing
- [Template Management](/templates) - Create and manage extraction templates
- [Error Handling](/errors) - Handle failures gracefully
```
- **VALIDATE**: Ensure all code examples are syntactically correct

#### Task 2.3: CREATE `docs/api/authentication.mdx`

- **IMPLEMENT**: Complete authentication documentation
- **CONTENT**: Include API key creation, JWT tokens, rate limits, security best practices
- **VALIDATE**: Examples should be copy-paste ready

#### Task 2.4: CREATE `docs/api/webhooks/overview.mdx`

- **IMPLEMENT**: Webhook documentation overview
- **CONTENT**:
```mdx
---
title: 'Webhooks Overview'
description: 'Receive real-time notifications when document processing completes'
---

# Webhooks

Webhooks allow your application to receive real-time notifications when document processing events occur, eliminating the need for polling.

## How Webhooks Work

```mermaid
sequenceDiagram
    participant App as Your App
    participant FT as FetchText API
    participant WH as Your Webhook Endpoint

    App->>FT: POST /api/v1/process (with webhook_url)
    FT-->>App: 202 Accepted (job_id)
    Note over FT: Processing document...
    FT->>WH: POST webhook_url (signed payload)
    WH-->>FT: 200 OK
    Note over App: Process extracted data
```

## Webhook Events

| Event | Description | When Triggered |
|-------|-------------|----------------|
| `job.completed` | Document processing finished successfully | Extraction complete |
| `job.failed` | Document processing failed | Error during processing |

## Setting Up Webhooks

### 1. Create a Webhook Endpoint

Your endpoint must:
- Accept `POST` requests
- Return `2XX` status within 10 seconds
- Verify the webhook signature (recommended)

<CodeGroup>

```python Python (Flask)
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)
WEBHOOK_SECRET = "your_webhook_secret"

@app.route('/webhooks/fetchtext', methods=['POST'])
def handle_webhook():
    # Verify signature
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data()

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(f"sha256={expected}", signature):
        return "Invalid signature", 401

    # Process the webhook
    data = request.json

    if data['status'] == 'completed':
        extracted = data['result']['extracted_data']
        # Store or process extracted data
        print(f"Extracted: {extracted}")
    elif data['status'] == 'failed':
        print(f"Job failed: {data['error']}")

    return "OK", 200
```

```javascript JavaScript (Express)
const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = 'your_webhook_secret';

app.post('/webhooks/fetchtext', express.raw({type: 'application/json'}), (req, res) => {
  // Verify signature
  const signature = req.headers['x-webhook-signature'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).send('Invalid signature');
  }

  // Process the webhook
  const data = JSON.parse(req.body);

  if (data.status === 'completed') {
    const extracted = data.result.extracted_data;
    console.log('Extracted:', extracted);
  } else if (data.status === 'failed') {
    console.error('Job failed:', data.error);
  }

  res.status(200).send('OK');
});
```

</CodeGroup>

### 2. Configure Webhook When Processing

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@document.pdf" \
  -F "webhook_url=https://your-app.com/webhooks/fetchtext" \
  -F "webhook_secret=your_webhook_secret"
```

## Webhook Payload

```json
{
  "job_id": "abc123-def456-ghi789",
  "status": "completed",
  "result": {
    "template_id": "tpl_001",
    "template_name": "Invoice Template",
    "extracted_data": {
      "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
      "total_amount": {"value": "$1,234.56", "confidence": 0.92}
    },
    "extraction_method": "template_matched"
  },
  "processing_time_ms": 2341,
  "completed_at": "2025-02-04T12:00:02Z"
}
```

## Security Best Practices

<AccordionGroup>
  <Accordion title="Always verify webhook signatures">
    Never trust webhook payloads without verifying the HMAC signature.
    FetchText signs all webhooks with `sha256=<hmac>` in the `X-Webhook-Signature` header.
  </Accordion>

  <Accordion title="Use HTTPS endpoints">
    Always use HTTPS for your webhook URLs to prevent man-in-the-middle attacks.
  </Accordion>

  <Accordion title="Respond quickly">
    Return a `2XX` response within 10 seconds. Process data asynchronously.
  </Accordion>

  <Accordion title="Handle duplicates">
    Use `job_id` to deduplicate. Webhooks may be retried on failure.
  </Accordion>
</AccordionGroup>

## Retry Policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts, the webhook is marked as failed in the job record.

## Testing Webhooks

Use tools like [webhook.site](https://webhook.site) or [ngrok](https://ngrok.com) to test webhooks locally:

```bash
# Start ngrok tunnel
ngrok http 3000

# Use the ngrok URL as your webhook_url
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@test.pdf" \
  -F "webhook_url=https://abc123.ngrok.io/webhooks/fetchtext"
```
```
- **VALIDATE**: Test webhook verification code examples

#### Task 2.5: CREATE `docs/api/errors.mdx`

- **IMPLEMENT**: Comprehensive error reference
- **CONTENT**: All HTTP status codes, error formats, troubleshooting

### Phase 3: Documentation Platform Setup

#### Task 3.1: CREATE `docs/api/mint.json` (Mintlify config)

- **IMPLEMENT**: Mintlify configuration file
- **CONTENT**:
```json
{
  "$schema": "https://mintlify.com/schema.json",
  "name": "FetchText API Documentation",
  "logo": {
    "dark": "/logo/dark.svg",
    "light": "/logo/light.svg"
  },
  "favicon": "/favicon.svg",
  "colors": {
    "primary": "#0D9488",
    "light": "#14B8A6",
    "dark": "#0D9488",
    "anchors": {
      "from": "#0D9488",
      "to": "#0F766E"
    }
  },
  "topbarLinks": [
    {
      "name": "Support",
      "url": "mailto:support@fetchtext.io"
    }
  ],
  "topbarCtaButton": {
    "name": "Dashboard",
    "url": "https://app.fetchtext.io"
  },
  "tabs": [
    {
      "name": "API Reference",
      "url": "api-reference"
    },
    {
      "name": "SDKs",
      "url": "sdks"
    }
  ],
  "anchors": [
    {
      "name": "Changelog",
      "icon": "list",
      "url": "https://fetchtext.io/changelog"
    },
    {
      "name": "Community",
      "icon": "discord",
      "url": "https://discord.gg/fetchtext"
    }
  ],
  "navigation": [
    {
      "group": "Get Started",
      "pages": [
        "introduction",
        "quickstart",
        "authentication"
      ]
    },
    {
      "group": "Webhooks",
      "pages": [
        "webhooks/overview",
        "webhooks/events",
        "webhooks/security",
        "webhooks/testing"
      ]
    },
    {
      "group": "API Reference",
      "pages": [
        "api-reference/introduction",
        {
          "group": "Documents",
          "pages": [
            "api-reference/endpoints/process-document",
            "api-reference/endpoints/get-job-status",
            "api-reference/endpoints/list-templates"
          ]
        },
        {
          "group": "Health",
          "pages": [
            "api-reference/endpoints/health"
          ]
        }
      ]
    },
    {
      "group": "SDKs & Libraries",
      "pages": [
        "sdks/python",
        "sdks/javascript",
        "sdks/curl"
      ]
    },
    {
      "group": "Resources",
      "pages": [
        "errors",
        "rate-limiting",
        "changelog"
      ]
    }
  ],
  "footerSocials": {
    "twitter": "https://twitter.com/fetchtext",
    "github": "https://github.com/fetchtext"
  },
  "openapi": "openapi.json",
  "api": {
    "baseUrl": "https://api.fetchtext.io",
    "auth": {
      "method": "bearer"
    }
  }
}
```
- **VALIDATE**: `npx mintlify dev` (if Mintlify CLI installed)

#### Task 3.2: CREATE GitHub Actions workflow for docs deployment

- **FILE**: `.github/workflows/deploy-docs.yml`
- **IMPLEMENT**: Auto-deploy docs on changes to `docs/api/`

### Phase 4: Code Examples & SDKs

#### Task 4.1: CREATE Python examples file

- **FILE**: `docs/api/sdks/python.mdx`
- **IMPLEMENT**: Complete Python examples for all endpoints
- **PATTERN**: Use requests library, include type hints, error handling

#### Task 4.2: CREATE JavaScript examples file

- **FILE**: `docs/api/sdks/javascript.mdx`
- **IMPLEMENT**: Complete JavaScript/TypeScript examples
- **PATTERN**: Use fetch API, async/await, TypeScript interfaces

#### Task 4.3: CREATE cURL examples file

- **FILE**: `docs/api/sdks/curl.mdx`
- **IMPLEMENT**: Complete cURL examples for all endpoints
- **PATTERN**: Include all headers, proper escaping

---

## TESTING STRATEGY

### Documentation Testing

1. **Link Validation**: Check all internal/external links work
2. **Code Example Testing**: Run all code examples against local API
3. **OpenAPI Validation**: Validate spec against OpenAPI 3.1 schema
4. **Accessibility Check**: Verify docs meet WCAG guidelines

### Code Example Validation

```bash
# Test Python examples
cd docs/examples
python -m pytest test_python_examples.py

# Test JavaScript examples
cd docs/examples
npm test

# Validate OpenAPI spec
npx @apidevtools/swagger-cli validate document-processor/openapi.json
```

---

## VALIDATION COMMANDS

### Level 1: OpenAPI Validation

```bash
# Export OpenAPI spec
cd document-processor && python scripts/export_openapi.py

# Validate spec structure
npx @apidevtools/swagger-cli validate openapi.json

# Check spec renders in Swagger UI
docker compose -p localai up -d document-processor
curl http://localhost:8090/openapi.json | python -m json.tool
```

### Level 2: Code Example Testing

```bash
# Python examples
python -c "
import requests
response = requests.get('http://localhost:8090/health/')
assert response.status_code == 200
print('✓ Python example works')
"

# JavaScript examples (Node.js)
node -e "
fetch('http://localhost:8090/health/')
  .then(r => r.json())
  .then(d => console.log('✓ JS example works:', d.status))
"

# cURL examples
curl -s http://localhost:8090/health/ | grep -q "healthy" && echo "✓ cURL example works"
```

### Level 3: Documentation Build

```bash
# If using Mintlify
cd docs/api && npx mintlify build

# If using Redocly
npx @redocly/cli build-docs openapi.json -o docs/index.html
```

### Level 4: Manual Validation

- [ ] Open docs in browser, verify all pages render
- [ ] Click through all navigation links
- [ ] Test API playground with real credentials
- [ ] Verify webhook documentation matches actual behavior
- [ ] Check mobile responsiveness

---

## ACCEPTANCE CRITERIA

- [ ] OpenAPI 3.1 spec generated from FastAPI with rich descriptions
- [ ] All endpoints documented with request/response examples
- [ ] Multi-language code examples (cURL, Python, JavaScript) for all major endpoints
- [ ] Webhook documentation complete with security guide and testing instructions
- [ ] Authentication flows documented with diagrams
- [ ] Error codes reference with troubleshooting
- [ ] Documentation deployed and accessible
- [ ] All code examples tested and working
- [ ] Documentation follows project branding

---

## COMPLETION CHECKLIST

- [ ] Phase 1: OpenAPI Enhancement complete
- [ ] Phase 2: Documentation content written
- [ ] Phase 3: Documentation platform configured
- [ ] Phase 4: Code examples for all languages
- [ ] All validation commands pass
- [ ] Documentation deployed to production URL
- [ ] Internal review completed
- [ ] Link to docs added to README.md

---

## NOTES

### Platform Decision

**Recommended: Mintlify**
- Stripe-quality design out of the box
- MDX support for interactive components
- Built-in API playground
- $300/month for Pro (includes custom domain)

**Alternative: Redocly**
- Open-source core option
- Strong OpenAPI rendering
- Good for self-hosted needs

### Future Enhancements

1. **Official SDKs**: Publish `fetchtext-python` and `@fetchtext/sdk` packages
2. **Changelog Automation**: Auto-generate changelog from git commits
3. **API Versioning**: Implement v2 versioning strategy
4. **Interactive Tutorials**: Add guided walkthroughs

### External Resources

- [Stripe API Docs](https://docs.stripe.com/api) - Reference for structure
- [Twilio Docs](https://www.twilio.com/docs) - Multi-language example patterns
- [GitHub Webhooks Guide](https://docs.github.com/en/webhooks) - Webhook best practices
