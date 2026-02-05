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

---

## Step 1: Get Your API Key

### Via Dashboard

1. Log into the FetchText dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create New Key**
4. Copy the key (shown only once!)

### Via API

```bash
curl -X POST https://api.fetchtext.io/api/admin/keys/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "organization_id": "org_xxx"
  }'
```

> **Warning:** Store your API key securely. It's shown only once and cannot be retrieved later.

---

## Step 2: Process a Document

### cURL

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@invoice.pdf" \
  -F "auto_generate_template=true" \
  -F "webhook_url=https://your-app.com/webhooks/fetchtext"
```

### Python

```python
import requests

response = requests.post(
    "https://api.fetchtext.io/api/v1/process",
    headers={"Authorization": "Bearer ftxt_your_api_key"},
    files={"file": open("invoice.pdf", "rb")},
    data={
        "auto_generate_template": "true",
        "webhook_url": "https://your-app.com/webhooks/fetchtext"
    }
)

job = response.json()
print(f"Job ID: {job['job_id']}")
```

### JavaScript

```javascript
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

### Response (202 Accepted)

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

---

## Step 3: Get Results

### Option A: Poll for Status

#### cURL

```bash
curl https://api.fetchtext.io/api/v1/jobs/abc123-def456-ghi789 \
  -H "Authorization: Bearer ftxt_your_api_key"
```

#### Python

```python
import time
import requests

job_id = "abc123-def456-ghi789"

while True:
    response = requests.get(
        f"https://api.fetchtext.io/api/v1/jobs/{job_id}",
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

#### JavaScript

```javascript
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

// Usage
const data = await pollForResults('abc123-def456-ghi789');
console.log('Extracted:', data);
```

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

---

## Understanding the Response

### Extraction Methods

| Method | Description |
|--------|-------------|
| `template_provided` | Used the template ID you specified |
| `template_matched` | Automatically matched to an existing template |
| `template_generated` | Created a new template from the document |
| `no_match` | No template found, enable `auto_generate_template` |

### Confidence Scores

Each extracted field includes a confidence score (0.0 - 1.0):

- **0.9 - 1.0**: Very high confidence
- **0.7 - 0.9**: High confidence
- **0.5 - 0.7**: Medium confidence
- **Below 0.5**: Low confidence, may need review

---

## Next Steps

- [Authentication Deep Dive](authentication.md) - JWT, API keys, permissions
- [Webhook Integration](webhooks.md) - Security, events, testing
- [Error Handling](errors.md) - Handle failures gracefully
- [API Reference](../../document-processor/openapi.json) - Complete endpoint documentation
