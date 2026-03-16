# Event Bus & Webhooks Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up all 6 event types to their natural emission points and fix the webhook API documentation to match the actual payload format.

**Architecture:** The event bus and webhook delivery infrastructure is already complete. This plan adds `emit()` calls at the correct code locations and updates docs to match reality.

**Tech Stack:** Python/FastAPI (backend), Markdown (docs)

---

## Context

### What already works
- `document_event_bus.emit()` → fans out to `webhook_subscriptions` → `webhook_service.deliver_webhook()`
- `document.processed` emitted from `stream.py` after SSE completes (line 512)
- `document.uploaded` emitted from `sharepoint_watcher.py` (line 67)
- CRUD API at `/api/webhooks`, frontend UI at `/settings/webhooks`, database migration, tests, HMAC signing

### What's broken/missing
1. **4 event types never emitted:** `template.matched`, `template.auto_created`, `document.fields_extracted`, `document.generated`
2. **Docs show wrong payload format:** `docs/api/guides/webhooks.md` describes `job.completed`/`job.failed` events with `{job_id, status, result}` format, but the actual format is `{event, event_id, timestamp, organization_id, data}`
3. **Non-SSE evaluate endpoint doesn't emit:** `enhanced_documents.py` `/evaluate-document-type` processes documents but never fires events
4. **`document.uploaded` only fires from SharePoint**, not from general file upload

---

## Task 1: Emit `template.matched` event in stream.py

**Files:**
- Modify: `document-processor/app/routers/stream.py` (~line 317)

**Step 1: Add `template.matched` emission after the SSE stage event**

After the existing `yield _sse_event("stage", {"stage": "template_matched", ...})` block at line 312-317, add:

```python
        # Emit template.matched event for webhook subscribers
        try:
            await document_event_bus.emit(
                event_type="template.matched",
                organization_id=organization_id or "",
                data={
                    "template_id": chosen_template.get("template_id"),
                    "template_name": chosen_template.get("template_name"),
                    "match_score": match_score,
                    "extraction_quality": extraction_quality,
                    "validation_level": validation_level,
                    "document_type": primary_type,
                    "filename": file.filename,
                },
            )
        except Exception as exc:
            logger.warning(f"[Stream] Failed to emit template.matched event: {exc}")
```

This goes inside the `if chosen_template:` block (line 309), after the yield on line 317, before the `else:` on line 318.

**Step 2: Verify no import needed**

`document_event_bus` is already imported in stream.py (used at line 512). No new import required.

**Step 3: Run backend tests**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor && python -m pytest tests/ -v -k "webhook or event" --timeout=30
```

**Step 4: Commit**

```bash
git add document-processor/app/routers/stream.py
git commit -m "feat: emit template.matched event to webhook subscribers"
```

---

## Task 2: Emit `template.auto_created` event in stream.py

**Files:**
- Modify: `document-processor/app/routers/stream.py` (~line 442)

**Step 1: Add `template.auto_created` emission after template generation succeeds**

After the existing `yield _sse_event("stage", {"stage": "template_generated", ...})` block at line 437-442, add:

```python
                # Emit template.auto_created event for webhook subscribers
                try:
                    await document_event_bus.emit(
                        event_type="template.auto_created",
                        organization_id=organization_id or "",
                        data={
                            "template_name": gen_result.get("name", template_name),
                            "category": gen_result.get("category"),
                            "field_count": len(gen_vars),
                            "fields": [v.get("name") for v in gen_vars] if gen_vars else [],
                            "document_type": primary_type,
                            "filename": file.filename,
                        },
                    )
                except Exception as exc:
                    logger.warning(f"[Stream] Failed to emit template.auto_created event: {exc}")
```

This goes inside the `if gen_result:` block (line 433), after the yield on line 442, before the field extraction on line 444.

**Step 2: Run backend tests**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor && python -m pytest tests/ -v -k "webhook or event" --timeout=30
```

**Step 3: Commit**

```bash
git add document-processor/app/routers/stream.py
git commit -m "feat: emit template.auto_created event to webhook subscribers"
```

---

## Task 3: Emit `document.fields_extracted` event in stream.py

**Files:**
- Modify: `document-processor/app/routers/stream.py` (~line 488)

**Step 1: Add `document.fields_extracted` emission after fields are extracted**

After the existing `yield _sse_event("stage", {"stage": "fields_extracted", ...})` block at line 483-488, add:

```python
        # Emit document.fields_extracted event for webhook subscribers
        try:
            await document_event_bus.emit(
                event_type="document.fields_extracted",
                organization_id=organization_id or "",
                data={
                    "document_id": extraction_result.get("metadata", {}).get("document_id"),
                    "filename": file.filename,
                    "field_count": fields_count,
                    "field_names": list(extracted_fields.keys()) if extracted_fields else [],
                    "template_id": chosen_template.get("template_id") if chosen_template else None,
                    "template_name": chosen_template.get("template_name") if chosen_template else (
                        generated_template.get("name") if generated_template else None
                    ),
                },
            )
        except Exception as exc:
            logger.warning(f"[Stream] Failed to emit document.fields_extracted event: {exc}")
```

This goes inside the `if extracted_fields:` block (line 482), after the yield on line 488.

**Step 2: Run backend tests**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor && python -m pytest tests/ -v -k "webhook or event" --timeout=30
```

**Step 3: Commit**

```bash
git add document-processor/app/routers/stream.py
git commit -m "feat: emit document.fields_extracted event to webhook subscribers"
```

---

## Task 4: Emit `document.uploaded` from the SSE upload endpoint

**Files:**
- Modify: `document-processor/app/routers/stream.py` (~line 170, near start of `_process_document_pipeline`)

**Step 1: Add `document.uploaded` emission at the start of the pipeline**

The SSE pipeline generator in `_process_document_pipeline` should emit `document.uploaded` right after the file is received and the first SSE event is yielded. Find the first `yield _sse_event("stage", ...)` call (the one for "extracting_text" stage) and add before it:

```python
    # Emit document.uploaded event for webhook subscribers
    try:
        await document_event_bus.emit(
            event_type="document.uploaded",
            organization_id=organization_id or "",
            data={
                "filename": file.filename,
                "content_type": file.content_type,
                "source": "web_upload",
            },
        )
    except Exception as exc:
        logger.warning(f"[Stream] Failed to emit document.uploaded event: {exc}")
```

**Step 2: Run backend tests**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor && python -m pytest tests/ -v -k "webhook or event" --timeout=30
```

**Step 3: Commit**

```bash
git add document-processor/app/routers/stream.py
git commit -m "feat: emit document.uploaded event from SSE upload endpoint"
```

---

## Task 5: Remove `document.generated` from EVENT_TYPES (no feature exists yet)

**Files:**
- Modify: `document-processor/app/services/document_event_bus.py` (line 40-47)

**Step 1: Remove `document.generated` from EVENT_TYPES**

The `document.generated` event type implies a "generate a new document from extracted data" feature that doesn't exist yet. Keeping it in EVENT_TYPES is misleading — it shows up in `/api/webhooks/events` and users could subscribe to it but never receive events. Remove it and add it back when the feature is built.

Change:
```python
EVENT_TYPES = {
    "document.uploaded",
    "document.processed",
    "document.fields_extracted",
    "document.generated",
    "template.matched",
    "template.auto_created",
}
```

To:
```python
EVENT_TYPES = {
    "document.uploaded",
    "document.processed",
    "document.fields_extracted",
    "template.matched",
    "template.auto_created",
}
```

**Step 2: Run backend tests**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor && python -m pytest tests/ -v -k "webhook or event" --timeout=30
```

**Step 3: Commit**

```bash
git add document-processor/app/services/document_event_bus.py
git commit -m "fix: remove document.generated from EVENT_TYPES (feature not yet built)"
```

---

## Task 6: Update webhook documentation to match actual event format

**Files:**
- Modify: `docs/api/guides/webhooks.md`

**Step 1: Replace the webhook documentation**

The current docs describe old `job.completed`/`job.failed` events with `{job_id, status, result}` format. Replace with the actual event-bus format.

Key changes:
- **Event types table:** Replace `job.completed`/`job.failed` with the 5 real event types
- **Payload examples:** Show actual `{event, event_id, timestamp, organization_id, data}` format
- **Signature header:** Replace `X-Webhook-Signature` with `X-FetchText-Signature` (what the code actually sends)
- **Signature format:** Update to include timestamp in HMAC (`timestamp.payload` format)
- **Subscription management:** Document the CRUD API at `/api/webhooks`
- **Keep:** Retry policy, best practices, testing sections (these are still accurate)
- **Verification code examples:** Update Python/JS/Go to use `X-FetchText-Signature` and the `timestamp.payload` signing scheme

**Step 2: Verify docs render correctly**

Read the file back and check for formatting issues.

**Step 3: Commit**

```bash
git add docs/api/guides/webhooks.md
git commit -m "docs: update webhook guide to match actual event-bus payload format"
```

---

## Task 7: Add event emission to non-SSE evaluate endpoint

**Files:**
- Modify: `document-processor/app/routers/enhanced_documents.py`

**Step 1: Import the event bus**

At the top of `enhanced_documents.py`, add:
```python
from app.services.document_event_bus import document_event_bus
```

**Step 2: Emit `document.processed` at the end of `evaluate_document_type`**

Before the `return JSONResponse(content=evaluation_result)` at the end of the endpoint (~line 765), add:

```python
    # Emit document.processed event for webhook subscribers
    try:
        await document_event_bus.emit(
            event_type="document.processed",
            organization_id=organization_id or "",
            data={
                "filename": file.filename,
                "document_type": evaluation_result.get("document_type"),
                "confidence": evaluation_result.get("confidence"),
                "source": "evaluate_endpoint",
            },
        )
    except Exception as exc:
        logger.warning(f"[EnhancedDocs] Failed to emit document.processed event: {exc}")
```

**Step 3: Run backend tests**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor && python -m pytest tests/ -v -k "webhook or event or enhanced" --timeout=30
```

**Step 4: Commit**

```bash
git add document-processor/app/routers/enhanced_documents.py
git commit -m "feat: emit document.processed event from non-SSE evaluate endpoint"
```

---

## Task 8: Rebuild container and verify

**Step 1: Rebuild the document processor container**

```bash
cd /Users/nickyeager/Code/agents/local-ai-packaged && docker compose -p localai up -d --build document-processor
```

**Step 2: Wait for healthy**

```bash
sleep 10 && curl -sf http://localhost:8090/health
```

**Step 3: Verify event types endpoint**

```bash
curl -s http://localhost:8090/api/webhooks/events | python3 -m json.tool
```

Expected: 5 event types (no `document.generated`).

**Step 4: Push all changes**

```bash
git push
```
