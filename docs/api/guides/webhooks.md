# Webhooks

Webhooks allow your application to receive real-time notifications when document processing events occur, eliminating the need for polling.

## Overview

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│  Your App   │         │  FetchText API   │         │  Your Webhook       │
│             │         │                  │         │  Endpoint           │
└─────┬───────┘         └────────┬─────────┘         └──────────┬──────────┘
      │                          │                              │
      │ POST /api/v1/process     │                              │
      │ (with webhook_url)       │                              │
      │─────────────────────────>│                              │
      │                          │                              │
      │ 202 Accepted (job_id)    │                              │
      │<─────────────────────────│                              │
      │                          │                              │
      │                          │ Processing...                │
      │                          │                              │
      │                          │ POST (signed payload)        │
      │                          │─────────────────────────────>│
      │                          │                              │
      │                          │               200 OK         │
      │                          │<─────────────────────────────│
      │                          │                              │
```

---

## Webhook Events

| Event | Status | Description |
|-------|--------|-------------|
| `job.completed` | `completed` | Document processing finished successfully |
| `job.failed` | `failed` | Document processing encountered an error |

---

## Setting Up Webhooks

### 1. Configure Webhook When Processing

Include `webhook_url` and optionally `webhook_secret` in your process request:

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@document.pdf" \
  -F "webhook_url=https://your-app.com/webhooks/fetchtext" \
  -F "webhook_secret=your_secret_key_here"
```

### 2. Create Your Webhook Endpoint

Your endpoint must:
- Accept `POST` requests
- Return `2XX` status within 10 seconds
- Verify the webhook signature (strongly recommended)

---

## Webhook Payload

### Completed Job

```json
{
  "job_id": "abc123-def456-ghi789",
  "status": "completed",
  "result": {
    "template_id": "tpl_001",
    "template_name": "Invoice Template",
    "template_category": "invoice",
    "extracted_data": {
      "vendor_name": {
        "value": "Acme Corp",
        "confidence": 0.95
      },
      "invoice_number": {
        "value": "INV-2025-001",
        "confidence": 0.98
      },
      "total_amount": {
        "value": "$1,234.56",
        "confidence": 0.92
      },
      "due_date": {
        "value": "2025-03-01",
        "confidence": 0.89
      }
    },
    "extraction_method": "template_matched",
    "match_score": 0.87,
    "document_preview": "INVOICE\n\nFrom: Acme Corp\nInvoice #: INV-2025-001..."
  },
  "processing_time_ms": 2341,
  "completed_at": "2025-02-04T12:00:02Z"
}
```

### Failed Job

```json
{
  "job_id": "abc123-def456-ghi789",
  "status": "failed",
  "error": "Unable to extract text from document: file appears to be corrupted",
  "completed_at": "2025-02-04T12:00:02Z"
}
```

---

## Security: Signature Verification

All webhooks include an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the payload.

**Always verify webhook signatures in production!**

### Signature Format

```
X-Webhook-Signature: sha256=<hmac_hex_digest>
```

### Python Verification

```python
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)
WEBHOOK_SECRET = "your_webhook_secret"

@app.route('/webhooks/fetchtext', methods=['POST'])
def handle_webhook():
    # Get signature from header
    signature = request.headers.get('X-Webhook-Signature', '')

    # Get raw payload
    payload = request.get_data()

    # Calculate expected signature
    expected = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    # Verify signature (timing-safe comparison)
    if not hmac.compare_digest(expected, signature):
        return "Invalid signature", 401

    # Process the webhook
    data = request.json

    if data['status'] == 'completed':
        extracted = data['result']['extracted_data']
        # Store or process extracted data
        process_extraction(extracted)
    elif data['status'] == 'failed':
        # Handle failure
        handle_failure(data['job_id'], data['error'])

    return "OK", 200

def process_extraction(data):
    """Process the extracted data."""
    print(f"Received extraction: {data}")

def handle_failure(job_id, error):
    """Handle processing failure."""
    print(f"Job {job_id} failed: {error}")
```

### JavaScript Verification

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = 'your_webhook_secret';

app.post('/webhooks/fetchtext', express.raw({ type: 'application/json' }), (req, res) => {
  // Get signature from header
  const signature = req.headers['x-webhook-signature'] || '';

  // Calculate expected signature
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  // Verify signature (timing-safe comparison)
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(401).send('Invalid signature');
    }
  } catch (e) {
    return res.status(401).send('Invalid signature');
  }

  // Parse and process the webhook
  const data = JSON.parse(req.body);

  if (data.status === 'completed') {
    const extracted = data.result.extracted_data;
    console.log('Extracted:', extracted);
    // Process extracted data...
  } else if (data.status === 'failed') {
    console.error(`Job ${data.job_id} failed: ${data.error}`);
    // Handle failure...
  }

  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### Go Verification

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "io"
    "net/http"
)

const webhookSecret = "your_webhook_secret"

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    // Read body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Failed to read body", http.StatusBadRequest)
        return
    }

    // Get signature
    signature := r.Header.Get("X-Webhook-Signature")

    // Calculate expected signature
    mac := hmac.New(sha256.New, []byte(webhookSecret))
    mac.Write(body)
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))

    // Verify
    if !hmac.Equal([]byte(expected), []byte(signature)) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }

    // Parse payload
    var data map[string]interface{}
    json.Unmarshal(body, &data)

    // Process...
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}
```

---

## Retry Policy

FetchText automatically retries failed webhook deliveries with exponential backoff:

| Attempt | Delay After Failure |
|---------|---------------------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts, the webhook is marked as failed and no further retries are attempted.

### What Triggers a Retry?

- HTTP status codes 5xx (server errors)
- Connection timeouts (>10 seconds)
- Connection failures

### What Does NOT Trigger a Retry?

- HTTP status codes 2xx (success)
- HTTP status codes 4xx (client errors)

---

## Best Practices

### 1. Respond Quickly

Return a `2XX` response within 10 seconds. Process data asynchronously:

```python
from threading import Thread

@app.route('/webhooks/fetchtext', methods=['POST'])
def handle_webhook():
    data = request.json

    # Respond immediately
    Thread(target=process_async, args=(data,)).start()

    return "OK", 200

def process_async(data):
    """Process webhook data in background."""
    # Your processing logic here
    pass
```

### 2. Handle Duplicates

Webhooks may be delivered more than once. Use `job_id` for idempotency:

```python
processed_jobs = set()

def process_webhook(data):
    job_id = data['job_id']

    if job_id in processed_jobs:
        return  # Already processed

    processed_jobs.add(job_id)
    # Process the data...
```

### 3. Use HTTPS

Always use HTTPS URLs for webhook endpoints in production.

### 4. Validate Signatures

Never skip signature verification in production environments.

### 5. Log Everything

Log webhook receipts for debugging:

```python
import logging

logger = logging.getLogger(__name__)

@app.route('/webhooks/fetchtext', methods=['POST'])
def handle_webhook():
    logger.info(f"Received webhook: {request.json.get('job_id')}")
    # ...
```

---

## Testing Webhooks

### Using webhook.site

1. Go to [webhook.site](https://webhook.site)
2. Copy your unique URL
3. Use it as your `webhook_url`:

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@test.pdf" \
  -F "webhook_url=https://webhook.site/your-unique-id"
```

### Using ngrok for Local Testing

1. Install ngrok: `brew install ngrok`
2. Start your local server: `python app.py`
3. Create tunnel: `ngrok http 3000`
4. Use the ngrok URL:

```bash
curl -X POST https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@test.pdf" \
  -F "webhook_url=https://abc123.ngrok.io/webhooks/fetchtext" \
  -F "webhook_secret=test_secret"
```

---

## Checking Webhook Status

You can check if a webhook was delivered by querying the job:

```bash
curl https://api.fetchtext.io/api/v1/jobs/abc123-def456 \
  -H "Authorization: Bearer ftxt_your_api_key"
```

Response includes webhook delivery info:

```json
{
  "job_id": "abc123-def456",
  "status": "completed",
  "webhook": {
    "url": "https://your-app.com/webhooks/fetchtext",
    "delivered": true,
    "attempts": 1
  }
}
```

---

## Troubleshooting

### Webhook Not Received

1. Check the job status includes `webhook.delivered: true`
2. Verify your endpoint is publicly accessible
3. Check your server logs for incoming requests
4. Ensure HTTPS is configured correctly

### Signature Verification Failing

1. Ensure you're using the raw request body, not parsed JSON
2. Verify the webhook secret matches exactly
3. Check for encoding issues (UTF-8)

### Timeouts

If your endpoint takes >10 seconds:
1. Respond immediately with 200
2. Process data asynchronously
3. Consider using a message queue
