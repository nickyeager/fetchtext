# Walkthrough 6: API Upload Flow

**Josh's ask:** "Show the backend upload process via the API"

**Status:** Ready

---

## Steps

### 1. Show the SSE Endpoint
Open a terminal and demonstrate the raw API:

```bash
curl -X POST http://localhost:8090/api/enhanced-documents/process-document-stream \
  -F "file=@/path/to/contract.pdf" \
  -H "Accept: text/event-stream" \
  --no-buffer
```

### 2. Watch SSE Events Stream
The response is a Server-Sent Events stream:

```
event: received
data: {"stage": "received", "message": "File received: contract.pdf", "document_id": "123"}

event: extracting_text
data: {"stage": "extracting_text", "message": "Extracting document text..."}

event: text_extracted
data: {"stage": "text_extracted", "message": "Text extracted: 2,264 chars", "char_count": 2264}

event: evaluating
data: {"stage": "evaluating", "message": "Evaluating document type...", "progress": 30}

event: evaluated
data: {"stage": "evaluated", "message": "Document type: contract (74% confidence)", "document_type": "contract", "confidence": 0.74}

event: matching_template
data: {"stage": "matching_template", "message": "Searching for matching templates..."}

event: template_matched
data: {"stage": "template_matched", "message": "Template matched: Contract Template (62%)", "template_id": 4, "match_score": 0.62}

event: extracting_fields
data: {"stage": "extracting_fields", "message": "Extracting fields...", "progress": 65}

event: complete
data: {"stage": "complete", "document_id": "123", "extracted_fields": {...}}
```

### 3. Show the REST Endpoints
For non-streaming use cases:

```bash
# Health check
curl http://localhost:8090/health

# Evaluate document type (no extraction)
curl -X POST http://localhost:8090/api/enhanced-documents/evaluate-document-type \
  -F "file=@contract.pdf"

# Full decide-template flow (synchronous)
curl -X POST http://localhost:8090/api/enhanced-documents/decide-template \
  -F "file=@contract.pdf" \
  -F "allow_generation=true"

# Batch process multiple files
curl -X POST http://localhost:8090/api/enhanced-documents/batch-process-with-ai \
  -F "files=@contract1.pdf" \
  -F "files=@contract2.pdf"
```

### 4. Show Exemplar API
```bash
# Upload an exemplar document to improve matching
curl -X POST http://localhost:8090/api/enhanced-documents/templates/4/exemplars \
  -F "file=@example-contract.pdf"

# List exemplars for a template
curl http://localhost:8090/api/enhanced-documents/templates/4/exemplars

# Delete an exemplar
curl -X DELETE http://localhost:8090/api/enhanced-documents/templates/4/exemplars/1
```

---

## Demo Script

> "Let me show you what's happening under the hood. I'll call the API directly with curl. Watch the events stream in — each one is a processing stage. The frontend renders these same events as the progress log you saw earlier."
>
> "This API is what you'd integrate into your own systems. You can call it from N8N workflows, from your own applications, or from scheduled batch jobs."

---

## What Could Go Wrong
- **Auth required**: The SSE endpoint requires a valid JWT token in production. For local demos, auth is configured but tokens come from the local Supabase.
- **CORS**: If calling from a different origin, ensure the backend allows it.
