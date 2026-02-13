# FetchText Document Processor API

Welcome to the FetchText API documentation. Transform documents into structured data with AI-powered extraction.

## Overview

FetchText is an API that extracts structured data from documents (PDFs, DOCX, images) using AI-powered template matching and field extraction.

## Quick Links

| Resource | Description |
|----------|-------------|
| [Quick Start](guides/quickstart.md) | Get up and running in 5 minutes |
| [Authentication](guides/authentication.md) | API keys and JWT tokens |
| [Webhooks](guides/webhooks.md) | Real-time event notifications |
| [API Reference](../document-processor/openapi.json) | Complete endpoint documentation |

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
Production:  https://api.fetchtext.io
Development: http://localhost:8090
```

## Authentication

All API requests require authentication via API key:

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key_here" \
  -F "file=@document.pdf"
```

## Getting Started

### 1. Get Your API Key

Log into the FetchText dashboard and navigate to **Settings → API Keys**.

### 2. Process Your First Document

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@invoice.pdf" \
  -F "auto_generate_template=true"
```

### 3. Get Results

```bash
curl https://api.fetchtext.io/api/v1/jobs/{job_id} \
  -H "Authorization: Bearer ftxt_your_api_key"
```

## Support

- **Email**: support@fetchtext.io
- **Documentation**: https://docs.fetchtext.io
- **Status**: https://status.fetchtext.io
