# Fix Stuck Document Processing Status

## Summary

92 documents are stuck in `processing` (79) or `analyzing` (13) status because the SSE pipeline relies entirely on the frontend `DragDropUpload` component to call `finalizeDocument()` after stream completion. If the browser tab closes, navigates away, or the SSE connection drops, the status is never updated. Fix: (1) clean up stuck documents now, (2) add server-side status updates so the backend is the source of truth.

## User Story

As an admin viewing the dashboard, I want the "processing" count to reflect only documents actively being processed, so that I can trust the dashboard metrics.

## Metadata

- **Type**: BUG_FIX
- **Complexity**: MEDIUM
- **Systems**: document-processor (Python), localai-admin-dashboard (TypeScript), Supabase (PostgreSQL)

## Root Cause

The SSE stream in `document-processor/app/routers/stream.py` processes documents and emits events, but **never writes `processing_status` back to Supabase**. The frontend `DragDropUpload.tsx:238` calls `finalizeDocument()` after stream completion, but this is fragile — if the user closes the tab, refreshes, or the SSE connection drops, the document stays stuck in `processing` forever.

## Current Flow (Broken)

```
1. Frontend creates document → status: 'uploaded'
2. Frontend sets status → 'processing' (DragDropUpload.tsx:402)
3. Backend SSE streams events (stream.py) → NO DB WRITES
4. Frontend receives 'complete' event → calls finalizeDocument() → status: 'completed'
   ⚠️ If step 4 never runs, document stays 'processing' forever
```

## Target Flow (Fixed)

```
1. Frontend creates document → status: 'uploaded'
2. Frontend sets status → 'processing' (DragDropUpload.tsx:402)
3. Backend SSE streams events (stream.py)
4. Backend writes final status to DB on stream completion → status: 'completed'
5. Backend writes final status to DB on stream error → status: 'failed'
6. Frontend still calls finalizeDocument() for metadata enrichment (idempotent)
```

## Patterns to Follow

### Supabase client in document-processor

```python
# document-processor/app/config/database.py
from app.config.database import db_config

# Usage pattern (from document_processing_pipeline.py:223-228):
result = (
    db_config.client.table("documents")
    .select("id, name, processing_status")
    .eq("id", document_id)
    .execute()
)

# Update pattern (from enhanced_documents.py):
db_config.client.table("documents").update({"field": "value"}).eq("id", doc_id).execute()
```

### SSE event emission pattern

```python
# stream.py:503-508 — completion event
yield format_sse({
    "type": "complete",
    "message": "Processing complete",
    "progress": 100,
    "result": result,
}, event="complete")
```

### Document event bus emission (stream.py:511-528)

```python
await document_event_bus.emit(
    event_type="document.processed",
    organization_id=organization_id or "",
    data={...},
)
```

### Frontend finalizeDocument (unified-document-service.ts:1311-1341)

Already idempotent — calls `updateDocumentStatus()` with `'completed'`. Safe to call even if backend already set the status.

## Files to Change

| Action | File | Purpose |
|--------|------|---------|
| UPDATE | `document-processor/app/routers/stream.py` | Add DB status update on completion/error |
| UPDATE | `document-processor/app/services/document_processing_pipeline.py` | Add `update_status()` stage method |
| — | SQL one-liner | Clean up stuck documents |

## Tasks

### Task 1: Clean up stuck documents in database

**File**: SQL command (run via docker exec)
**Action**: UPDATE stuck documents to 'completed' or 'failed'

**Implementation**:
```sql
-- Documents stuck in 'processing' or 'analyzing' for more than 1 hour are certainly done
-- Check if they have extracted fields in metadata (→ completed) or not (→ failed)
UPDATE documents
SET processing_status = CASE
    WHEN metadata->>'extracted_fields' IS NOT NULL THEN 'completed'
    WHEN metadata->>'error' IS NOT NULL THEN 'failed'
    ELSE 'completed'  -- Default to completed for old stuck docs
  END,
  updated_at = NOW()
WHERE processing_status IN ('processing', 'analyzing')
  AND updated_at < NOW() - INTERVAL '1 hour';
```

**Validation**:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT processing_status, COUNT(*) FROM documents GROUP BY processing_status ORDER BY count DESC;"
# Expected: 0 rows in 'processing' or 'analyzing' (except very recent uploads)
```

### Task 2: Add `update_status()` method to pipeline

**File**: `document-processor/app/services/document_processing_pipeline.py`
**Action**: Add a new pipeline stage method that updates `processing_status` in Supabase

**Implementation**:
Add after the `fetch_template` method (line ~232):

```python
async def update_document_status(
    self,
    document_id: int | str,
    status: str,
    metadata_updates: Optional[Dict[str, Any]] = None,
) -> None:
    """Update document processing_status in database."""
    if not db_config.client or not document_id:
        logger.warning(f"Cannot update status: client={bool(db_config.client)}, id={document_id}")
        return

    update_data: Dict[str, Any] = {"processing_status": status}

    if metadata_updates:
        # Fetch current metadata, merge, and update
        result = (
            db_config.client.table("documents")
            .select("metadata")
            .eq("id", int(document_id))
            .execute()
        )
        current_metadata = (result.data[0].get("metadata") or {}) if result.data else {}
        current_metadata.update(metadata_updates)
        update_data["metadata"] = current_metadata

    try:
        db_config.client.table("documents").update(update_data).eq("id", int(document_id)).execute()
        logger.info(f"Document {document_id} status → {status}")
    except Exception as e:
        logger.error(f"Failed to update document {document_id} status: {e}")
```

**Validation**:
```bash
cd document-processor && python -c "from app.services.document_processing_pipeline import pipeline; print('OK')"
```

### Task 3: Add status updates to SSE stream handler

**File**: `document-processor/app/routers/stream.py`
**Action**: Call `pipeline.update_document_status()` on completion and error in `_process_document_stream()`

**Implementation**:

The stream receives `document_id` from the frontend (passed in the SSE request or extracted from the result). We need to:

1. **Extract document_id** early in the stream — it comes from the request params or is in the result metadata. Check how it's currently obtained. Look at the SSE endpoint params and the `result` dict built during processing.

2. **On completion** (near line 503-508, before the `yield format_sse(... event="complete")`):
```python
# Update document status in database
doc_id = result.get("metadata", {}).get("document_id")
if doc_id:
    await pipeline.update_document_status(
        doc_id,
        "completed",
        metadata_updates={
            "processing_completed_at": __import__("datetime").datetime.utcnow().isoformat(),
            "processing_method": "sse_stream",
        },
    )
```

3. **On error** (in each error handler — text extraction ~line 138, evaluation ~line 186, field extraction ~line 368):
```python
# In the error yield blocks, after yielding the error event:
doc_id = result.get("metadata", {}).get("document_id") if result else None
# OR from the outer scope if document_id was captured earlier
if doc_id:
    await pipeline.update_document_status(
        doc_id,
        "failed",
        metadata_updates={"error_message": str(e)},
    )
```

**Key detail**: The `document_id` must be determined. Check the SSE endpoint signature — it may receive `document_id` as a query param, or the frontend may pass it in the multipart form data. The `result` dict accumulates metadata including `document_id` set by the frontend. Look at `DragDropUpload.tsx` to see what params are sent with the SSE request.

**Validation**:
```bash
docker compose -p localai up -d --build document-processor
# Wait for startup
curl http://localhost:8090/health
# Then run the stucco gate test:
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20
E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/stucco-upload-e2e.pw.spec.ts --reporter=list
# After test, verify the new document has processing_status = 'completed':
docker exec supabase-db psql -U postgres -d postgres -c "SELECT id, processing_status, updated_at FROM documents ORDER BY id DESC LIMIT 3;"
```

### Task 4: Verify frontend finalizeDocument is still called (idempotent)

**File**: No changes needed — just verify
**Action**: Confirm `DragDropUpload.tsx:238` `finalizeDocument()` still works when status is already 'completed'

**Validation**:
The `updateDocumentStatus()` call in `unified-document-service.ts:1265-1270` does a `.update().eq('id', documentId)` — this is idempotent. Setting `processing_status = 'completed'` when it's already `'completed'` is a no-op. The frontend enriches metadata (extracted fields, confidence scores) which the backend doesn't write, so both writes are complementary.

Run stucco gate test and verify both backend AND frontend status updates succeed without conflict:
```bash
E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/stucco-upload-e2e.pw.spec.ts --reporter=list
```

## Validation Commands

```bash
# 1. Verify no stuck documents
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT processing_status, COUNT(*) FROM documents GROUP BY processing_status ORDER BY count DESC;"

# 2. Verify backend health after rebuild
curl http://localhost:8090/health

# 3. Run stucco gate test (mandatory)
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20
E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/stucco-upload-e2e.pw.spec.ts --reporter=list

# 4. Verify new document has 'completed' status set by backend
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, processing_status, metadata->>'processing_completed_at' as completed_at FROM documents ORDER BY id DESC LIMIT 3;"

# 5. Dashboard should show 0 (or near-0) processing
# Open http://localhost:5173/dashboard and verify
```

## Acceptance Criteria

- [ ] All 92 stuck documents cleaned up (processing_status → completed/failed)
- [ ] Dashboard "processing" count drops to 0 (or only shows actively processing docs)
- [ ] New document uploads via SSE get `processing_status = 'completed'` set by backend
- [ ] SSE stream errors set `processing_status = 'failed'` in database
- [ ] Frontend `finalizeDocument()` still works (idempotent, adds metadata)
- [ ] Stucco gate test passes (2/2)
- [ ] No regression in existing E2E tests

## Risks

| Risk | Mitigation |
|------|------------|
| `document_id` not available in SSE stream | Check stream params — frontend sends it as form data or query param. If not, extract from DB after document creation. |
| Race condition: backend and frontend both update simultaneously | Supabase `.update()` is last-writer-wins for same fields. Backend sets status + timestamps; frontend adds extracted_fields metadata. Both are safe. |
| Pipeline `db_config.client` is None in test environments | Guard with `if not db_config.client` check (already in pattern). Status update is non-fatal. |
| Sync Supabase call blocks async event loop | Use `asyncio.to_thread()` wrapper or accept minor blocking (Supabase Python client is sync). Keep it simple — one fast UPDATE query. |
