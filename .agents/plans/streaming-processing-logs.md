# Feature: Streaming Processing Logs During Document Upload

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

When a user uploads a document, the backend performs 5-7 sequential processing steps that take 5-60+ seconds total. Currently the user sees a static "Processing..." spinner with zero visibility into what's happening. This feature adds Server-Sent Events (SSE) streaming so the UI shows a real-time log panel with progress bar, stage completion indicators, and timing information as each processing step completes.

## User Story

As a document uploader
I want to see real-time progress logs as my document is being processed
So that I know what's happening, can estimate remaining time, and can identify which step fails if something goes wrong

## Problem Statement

The current upload flow makes 3 sequential blocking HTTP calls (`decideTemplate` → `processDocumentWithDocling` → `processWithExistingTemplate`) totaling 5-60+ seconds. During this time the user sees only a pulsing icon and "Processing Document with AI" text. There is no indication of:
- Which step is currently running
- How far along processing is
- How long each step took
- What specifically failed if an error occurs

This creates anxiety ("is it frozen?"), prevents users from estimating wait time, and makes debugging failures opaque.

## Solution Statement

Create a **single SSE streaming endpoint** (`POST /api/enhanced-documents/process-document-stream`) that combines the current multi-step processing pipeline into one streaming connection. The endpoint yields structured JSON events after each processing stage completes. The frontend replaces its sequential fetch calls with a single SSE connection and renders a real-time log panel with progress bar.

**Architecture choice: Single streaming endpoint (not event bus)**
- Simpler than a separate SSE subscription channel
- No need for Redis/pub-sub or document-ID correlation
- Reuses existing service functions directly (no modification needed)
- Frontend gets both progress events AND final result from one connection
- Uses `@microsoft/fetch-event-source` on frontend (supports POST with FormData, unlike native EventSource which is GET-only)

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Primary Systems Affected**: document-processor backend (new endpoint), localai-admin-dashboard frontend (upload page + new component)
**Dependencies**: `@microsoft/fetch-event-source` (npm), no new Python deps (FastAPI `StreamingResponse` is built-in)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

**Backend - Processing Pipeline (what gets streamed):**
- `document-processor/app/routers/enhanced_documents.py` (lines 421-580) - Why: The `/decide-template` endpoint contains the full processing pipeline that we will replicate in the streaming endpoint. This is the PRIMARY reference for what steps to stream.
- `document-processor/app/services/document_evaluator.py` (lines 120-260) - Why: `evaluate_document()` is step 1 of the pipeline, called at line 454 of enhanced_documents.py
- `document-processor/app/services/enhanced_docling_service.py` (lines 30-120) - Why: `process_document()` is the text extraction step, called at line 469
- `document-processor/app/services/template_vector_service.py` (lines 228-302) - Why: `search_similar_templates()` is the vector search step, called at line 490
- `document-processor/app/services/smart_field_extractor.py` (lines 55-120) - Why: `extract_fields_intelligently()` is the field extraction step, called at line 920
- `document-processor/app/services/template_matching_service.py` (lines 90-165) - Why: `find_matching_templates()` is the fallback matching step
- `document-processor/app/services/embedding_service.py` (lines 197-203) - Why: `generate_single_embedding()` generates document embeddings for vector search
- `document-processor/app/main.py` (lines 1-89) - Why: Router registration pattern - new router must be included here
- `document-processor/app/routers/enhanced_documents.py` (lines 1-30) - Why: Import pattern for services

**Frontend - Current Upload Flow (what gets replaced):**
- `localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx` (entire file, 977 lines) - Why: This is the upload page that currently makes sequential calls. Lines 194-591 (`handleFileSelect`) is the function that will be refactored to use SSE. Lines 857-936 are the current static status cards that will be replaced with the log panel.
- `localai-admin-dashboard/src/lib/document-processor-enhanced.ts` (lines 1301-1362) - Why: `evaluateDocumentType()` and `decideTemplate()` are the current backend calls that the SSE stream replaces
- `localai-admin-dashboard/src/services/unified-document-service.ts` (lines 799-898) - Why: `createDocumentRecord()` is the DB/storage step that stays BEFORE the stream starts
- `localai-admin-dashboard/src/hooks/use-document-manager.ts` - Why: `createDocument()`, `finalizeDocument()`, `markDocumentFailed()` are still needed before/after the stream
- `localai-admin-dashboard/src/components/ui/sonner.tsx` - Why: Toast notification pattern used for errors

**Frontend - UI Component Patterns:**
- `localai-admin-dashboard/src/components/ui/card.tsx` - Why: Card component pattern for the log panel
- `localai-admin-dashboard/src/components/ui/badge.tsx` - Why: Badge component for status indicators
- `localai-admin-dashboard/src/components/ui/progress.tsx` - Why: Progress bar component (Radix-based, already installed: `@radix-ui/react-progress@1.1.7`)

### New Files to Create

- `document-processor/app/routers/stream.py` - SSE streaming endpoint for document processing
- `localai-admin-dashboard/src/components/ui/processing-log.tsx` - Real-time log panel component
- `localai-admin-dashboard/src/hooks/use-processing-stream.ts` - Hook for managing SSE connection
- `document-processor/tests/test_streaming_endpoint.py` - Backend integration tests
- `localai-admin-dashboard/src/__tests__/integration/streaming-processing.test.ts` - Frontend integration tests

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
  - How to return streaming responses from FastAPI
  - Why: Core backend pattern for SSE
- [SSE Specification](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
  - SSE event format: `event: name\ndata: json\n\n`
  - Why: Must follow this exact format for client compatibility
- [@microsoft/fetch-event-source](https://github.com/Azure/fetch-event-source)
  - Supports POST method with body (unlike native EventSource which is GET-only)
  - Why: We need to POST FormData with the file
- [How to use SSE with FastAPI and React](https://www.softgrade.org/sse-with-fastapi-react-langgraph/)
  - Complete working example of FastAPI SSE + React EventSource client
  - Why: Reference implementation pattern

### Patterns to Follow

**SSE Event Format (must follow exactly):**
```
event: stage\n
data: {"stage":"evaluated","message":"Document type: invoice","progress":25,"elapsed_ms":3200}\n
\n
```

**Backend Router Registration Pattern** (from `main.py` lines 10-12):
```python
from app.routers import health, enhanced_documents, models, google_docs, email
from app.routers import api_v1, api_keys_admin
from app.routers import integrations, billing, snowflake
# ... then ...
app.include_router(stream.router)
```

**Backend Logging Pattern** (from `enhanced_documents.py`):
```python
logger = logging.getLogger(__name__)
logger.info(f"Vector search returned {len(vector_suggestions)} matches")
```

**Frontend Hook Pattern** (from `use-document-manager.ts`):
```typescript
export function useProcessingStream() {
  const [logs, setLogs] = useState<ProcessingEvent[]>([]);
  const [progress, setProgress] = useState(0);
  // ...
}
```

**Error Handling Pattern** (from `DocumentUploadPage.tsx` line 576-590):
```typescript
} catch (err) {
  console.error('Document evaluation failed:', err);
  setError(err instanceof Error ? err.message : 'Document evaluation failed');
  if (documentId) {
    await documentManager.markDocumentFailed(documentId, err.message);
  }
} finally {
  setIsEvaluating(false);
  setIsProcessing(false);
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Backend SSE Endpoint

Create a new FastAPI router with a single streaming endpoint that runs the full document processing pipeline and yields SSE events after each stage.

**Key Design Decisions:**
- New router file `stream.py` (not added to existing `enhanced_documents.py` which is already 1386 lines)
- Reuses existing service instances directly (no modification to services)
- SSE events use `event: stage` for progress and `event: complete` for the final result
- Each event includes: `stage` (enum), `message` (human-readable), `progress` (0-100), `elapsed_ms`, optional `details`
- Heartbeat every 15s to keep connection alive through proxies
- Error events use `event: error` with error details

**Tasks:**
1. Create `document-processor/app/routers/stream.py` with `POST /api/enhanced-documents/process-document-stream`
2. Register the router in `main.py`

### Phase 2: Frontend SSE Hook + Log Component

Create a reusable hook for SSE connections and a visual log panel component.

**Key Design Decisions:**
- `@microsoft/fetch-event-source` for POST+FormData support
- Hook manages connection lifecycle, reconnection, and cleanup
- Log component is a standalone Card with progress bar + scrolling log entries
- Each log entry shows: checkmark/spinner icon, message, elapsed time

**Tasks:**
3. Install `@microsoft/fetch-event-source`
4. Create `use-processing-stream.ts` hook
5. Create `processing-log.tsx` component

### Phase 3: Integration

Wire the SSE stream into the existing upload flow, replacing the sequential fetch calls.

**Key Design Decisions:**
- Frontend still creates document record + uploads to storage BEFORE starting the stream (existing code, unchanged)
- The SSE stream replaces the three sequential calls: `decideTemplate` + `processDocumentWithDocling` + `processWithExistingTemplate`
- On stream completion, frontend finalizes document in DB (existing code, unchanged)
- Fallback: if SSE connection fails, fall back to the existing non-streaming flow

**Tasks:**
6. Update `DocumentUploadPage.tsx` to use the streaming hook
7. Remove or gate the old sequential processing code

### Phase 4: Testing & Validation

**Tasks:**
8. Backend integration test
9. Frontend integration test

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: CREATE `document-processor/app/routers/stream.py`

**IMPLEMENT**: New SSE streaming endpoint for document processing.

The endpoint mirrors the logic in `enhanced_documents.py` `/decide-template` (lines 421-580) but yields SSE events between each step.

**Processing Pipeline Stages** (yield SSE event after each):

| # | Stage ID | What It Does | Service Call | Progress |
|---|----------|--------------|-------------|----------|
| 1 | `received` | File saved to temp | `save_uploaded_file(file)` | 5% |
| 2 | `evaluating` | Document type detection | `document_evaluator.evaluate_document(...)` | 20% |
| 3 | `extracting_text` | Full text extraction via Docling | `enhanced_docling_service.process_document(...)` | 40% |
| 4 | `matching_templates` | Vector search + scoring | `template_vector_service.search_similar_templates(...)` | 55% |
| 5 | `testing_extraction` | Single-template extraction test | `smart_field_extractor.test_template_extraction(...)` | 70% |
| 6 | `extracting_fields` | Full field extraction | `smart_field_extractor.extract_fields_intelligently(...)` | 85% |
| 7 | `complete` | Final result with all data | N/A (assembles response) | 100% |

**SSE Event Format:**
```python
def sse_event(event_type: str, data: dict) -> str:
    import json
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
```

**Endpoint Signature:**
```python
@router.post("/process-document-stream")
async def process_document_stream(
    file: UploadFile = File(...),
    min_match_confidence: float = Query(0.6),
    allow_generation: bool = Query(True),
    organization_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
):
```

**IMPORTS** (mirror from `enhanced_documents.py` lines 1-17):
```python
from fastapi import APIRouter, File, UploadFile, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import json, logging, time, asyncio
from pathlib import Path

from app.services.document_evaluator import document_evaluator
from app.services.enhanced_docling_service import enhanced_docling_service
from app.services.smart_field_extractor import smart_field_extractor
from app.services.embedding_service import embedding_service
from app.services.template_vector_service import template_vector_service
from app.services.ai_template_generator import ai_template_generator
from app.config.database import db_config
from app.routers.enhanced_documents import save_uploaded_file, cleanup_temp_file
```

**GOTCHA**: The `save_uploaded_file` and `cleanup_temp_file` helpers are defined in `enhanced_documents.py`, not in a shared utils module. Import them from there, or if they're not exported, define local versions.

**GOTCHA**: FastAPI's `StreamingResponse` with `text/event-stream` does NOT buffer when using `uvicorn`. But nginx/proxy in front might buffer. Include `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers.

**GOTCHA**: The async generator must handle exceptions internally and yield error events rather than raising — once streaming starts, HTTP status is already 200.

**GOTCHA**: Include a heartbeat comment line (`:\n\n`) every 15s during long operations to prevent proxy timeouts. Use `asyncio.create_task` + `asyncio.Queue` pattern: one task runs the processing pipeline and pushes events to the queue, another task reads from the queue and yields SSE events (with heartbeat fallback if queue is empty for 15s).

**PATTERN**: Follow the router prefix pattern from `enhanced_documents.py`:
```python
router = APIRouter(prefix="/api/enhanced-documents", tags=["streaming"])
```

**VALIDATE**:
```bash
docker compose -p localai up -d --build document-processor && sleep 15 && curl -N -X POST http://localhost:8090/api/enhanced-documents/process-document-stream -F "file=@localai-admin-dashboard/tests/fixtures/real-test-contract.txt" 2>&1 | head -30
```

### Task 2: UPDATE `document-processor/app/main.py`

**IMPLEMENT**: Register the new stream router.

Add import and `include_router`:
```python
from app.routers import health, enhanced_documents, models, google_docs, email
from app.routers import api_v1, api_keys_admin
from app.routers import integrations, billing, snowflake, stream  # ADD stream

# ... later ...
app.include_router(stream.router)  # ADD
```

**PATTERN**: `main.py` lines 10-12 and 52-63 for existing router registration
**VALIDATE**: `docker compose -p localai up -d --build document-processor && sleep 10 && curl http://localhost:8090/openapi.json | python3 -c "import json,sys; paths=json.load(sys.stdin)['paths']; print('/api/enhanced-documents/process-document-stream' in paths)"`

### Task 3: ADD `@microsoft/fetch-event-source` dependency

**IMPLEMENT**: Install the npm package for SSE POST support.

```bash
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm add @microsoft/fetch-event-source
```

**GOTCHA**: This is a Microsoft-maintained package. It's the standard way to do SSE with POST/body. The native `EventSource` API only supports GET requests, which won't work for file uploads.

**VALIDATE**: `cd localai-admin-dashboard && cat package.json | grep fetch-event-source`

### Task 4: CREATE `localai-admin-dashboard/src/hooks/use-processing-stream.ts`

**IMPLEMENT**: React hook that manages the SSE connection for document processing.

**Interface:**
```typescript
interface ProcessingEvent {
  stage: string;
  message: string;
  progress: number;
  elapsed_ms: number;
  timestamp: string;
  details?: Record<string, any>;
}

interface ProcessingStreamResult {
  // The final processing result (same shape as current decideTemplate + extraction)
  evaluation?: any;
  chosen_template?: any;
  extracted_fields?: Record<string, any>;
  content_text?: string;
  decision_metadata?: any;
}

interface UseProcessingStreamReturn {
  startProcessing: (file: File, options?: StreamOptions) => Promise<ProcessingStreamResult>;
  logs: ProcessingEvent[];
  progress: number;
  currentStage: string;
  isStreaming: boolean;
  error: string | null;
  abort: () => void;
}

interface StreamOptions {
  minMatchConfidence?: number;
  allowGeneration?: boolean;
  organizationId?: string;
  userId?: string;
}
```

**Key Implementation Details:**
- Uses `fetchEventSource` from `@microsoft/fetch-event-source`
- Constructs `FormData` with file + query params
- Parses SSE events and updates state
- Returns a `Promise` that resolves when `event: complete` arrives with the final result
- Cleans up on unmount via `AbortController`
- The `BACKEND_URL` should come from `import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'`

**PATTERN**: Follow hook patterns from `use-document-manager.ts`
**IMPORTS**: `import { fetchEventSource } from '@microsoft/fetch-event-source'`
**GOTCHA**: `fetchEventSource` uses callbacks (`onmessage`, `onerror`, `onclose`), not async iterators. Wrap in a Promise to make `startProcessing` awaitable.
**GOTCHA**: Must call `abort()` in the hook's cleanup function to prevent memory leaks.

**VALIDATE**: `cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm build 2>&1 | tail -5`

### Task 5: CREATE `localai-admin-dashboard/src/components/ui/processing-log.tsx`

**IMPLEMENT**: Visual component that renders the real-time processing log.

**UI Layout:**
```
┌──────────────────────────────────────────────────┐
│ Processing Document                         75%  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░     │
├──────────────────────────────────────────────────┤
│ ✓ File received                         0.1s     │
│ ✓ Document evaluated: invoice           3.2s     │
│ ✓ Template matched: Invoice (87%)       0.8s     │
│ ✓ Text extracted: 4,521 chars           2.1s     │
│ ⟳ Extracting fields...                  --       │
│   Using template: Invoice Extractor              │
└──────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface ProcessingLogProps {
  logs: ProcessingEvent[];
  progress: number;
  currentStage: string;
  isStreaming: boolean;
  error?: string | null;
}
```

**Component Details:**
- Uses `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
- Uses `Progress` from `@/components/ui/progress` for the progress bar (already installed: `@radix-ui/react-progress`)
- Uses `Badge` for status indicators
- Each log entry: icon (CheckCircle2 for done, Loader2 with animate-spin for active) + message + elapsed time
- Auto-scrolls to bottom as new entries appear (use `useRef` + `scrollIntoView`)
- Error state shows red alert at bottom
- Uses Lucide icons: `CheckCircle2`, `Loader2`, `AlertCircle`, `FileText`

**PATTERN**: Follow component patterns from existing `@/components/ui/` files. Use Tailwind classes, no inline styles.
**GOTCHA**: Import `Progress` from `@/components/ui/progress`. If this file doesn't exist yet, check if `@radix-ui/react-progress` is installed and create a minimal progress component following shadcn pattern.

**VALIDATE**: `cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm build 2>&1 | tail -5`

### Task 6: UPDATE `localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx`

**IMPLEMENT**: Replace the sequential processing calls with the streaming hook.

**Changes:**
1. Import the new hook and component:
   ```typescript
   import { useProcessingStream } from '@/hooks/use-processing-stream';
   import { ProcessingLog } from '@/components/ui/processing-log';
   ```

2. Add the hook to the component:
   ```typescript
   const processingStream = useProcessingStream();
   ```

3. In `handleFileSelect` (line 194), KEEP steps 1-2 (create document record, upload to storage) UNCHANGED.

4. REPLACE the processing section (roughly lines 289-574) with:
   ```typescript
   // Step 3: Stream the processing pipeline
   const result = await processingStream.startProcessing(file, {
     minMatchConfidence: 0.6,
     allowGeneration: true,
     organizationId: activeOrganization.id,
     userId: user?.id,
   });

   // Step 4: Finalize document with streaming results
   await documentManager.finalizeDocument(documentRecord.id, {
     status: 'completed',
     content_text: result.content_text,
     extracted_fields: result.extracted_fields ? {
       extracted_values: result.extracted_fields,
       confidence_scores: Object.entries(result.extracted_fields || {}).reduce((acc, [key, field]: [string, any]) => {
         acc[key] = field.confidence || 0;
         return acc;
       }, {} as Record<string, number>)
     } : null,
     metadata: {
       document_type: result.evaluation?.type_evaluation?.primary_type,
       type_confidence: result.evaluation?.type_evaluation?.confidence,
       template_id: result.chosen_template?.template_id,
       template_name: result.chosen_template?.template_name,
       template_decision: result.decision_metadata,
       processing_method: 'streaming',
     },
   });

   navigate({ to: `/documents/${documentRecord.id}` });
   ```

5. REPLACE the static status cards (lines 857-936) with:
   ```tsx
   {processingStream.isStreaming && (
     <ProcessingLog
       logs={processingStream.logs}
       progress={processingStream.progress}
       currentStage={processingStream.currentStage}
       isStreaming={processingStream.isStreaming}
       error={processingStream.error}
     />
   )}
   ```

6. Keep the `preSelectedTemplate` flow (lines 238-282) working. For pre-selected templates, the streaming endpoint should accept an optional `template_id` param to skip template matching and go directly to extraction.

**GOTCHA**: The existing `handleActionSelect` callback (lines 94-192) handles manual template selection AFTER evaluation is shown. This flow should still work — if the stream completes with evaluation but the user wants to choose a different template, the non-streaming path kicks in.

**GOTCHA**: The existing `isEvaluating` and `isProcessing` states can be replaced by `processingStream.isStreaming`, but keep them for the manual template selection flow.

**VALIDATE**: `cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm build 2>&1 | tail -5`

### Task 7: CREATE `document-processor/tests/test_streaming_endpoint.py`

**IMPLEMENT**: Integration tests for the SSE streaming endpoint.

**Tests:**
1. `test_stream_returns_sse_content_type` - Verify `Content-Type: text/event-stream`
2. `test_stream_emits_stage_events` - Upload a fixture file, verify at least 3 stage events received
3. `test_stream_completes_with_result` - Verify final `event: complete` contains `evaluation`, `action`
4. `test_stream_performance_under_30s` - Full stream must complete within 30 seconds
5. `test_stream_handles_invalid_file` - Verify error event for unsupported file type

**Pattern**: Follow `test_template_rag.py` patterns (real API calls, no mocks, backend health check)
**Fixture**: Use `localai-admin-dashboard/tests/fixtures/real-test-contract.txt`

**GOTCHA**: Python `requests` library doesn't natively parse SSE. Use `stream=True` and iterate `response.iter_lines()`. Parse lines starting with `data:`.

**VALIDATE**: `cd document-processor && python -m pytest tests/test_streaming_endpoint.py -v --tb=short`

### Task 8: CREATE `localai-admin-dashboard/src/__tests__/integration/streaming-processing.test.ts`

**IMPLEMENT**: Frontend integration tests for the streaming endpoint.

**Tests:**
1. `test_stream_endpoint_returns_events` - Fetch the stream endpoint, verify SSE events received
2. `test_stream_completes_within_timeout` - Full processing under 30 seconds
3. `test_stream_final_event_has_result` - Complete event includes evaluation and action

**Pattern**: Follow `template-rag-performance.test.ts` patterns
**Fixture**: Use `tests/fixtures/real-test-contract.txt`

**GOTCHA**: Vitest runs in Node.js where native `EventSource` isn't available. Use raw `fetch` with streaming response parsing instead of `@microsoft/fetch-event-source` for tests.

**VALIDATE**: `cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/streaming-processing.test.ts`

---

## TESTING STRATEGY

### Integration Tests (Backend)

Using pytest with real services (no mocks per CLAUDE.md):
- Health check preflight
- SSE event format validation
- End-to-end processing with real fixture
- Performance budget (30s)
- Error handling for bad input

### Integration Tests (Frontend)

Using vitest with `@vitest-environment node`:
- Raw fetch against streaming endpoint
- Event parsing and format validation
- Timeout compliance

### Manual Validation

1. Start services: `python start_services.py --profile cpu`
2. Navigate to `http://localhost:5173/documents/upload`
3. Upload `real-test-contract.txt`
4. Verify log panel appears with:
   - Progress bar advancing
   - Stage completion messages with checkmarks
   - Elapsed time for each stage
   - Final navigation to document detail page
5. Verify the processed document has extracted fields

---

## VALIDATION COMMANDS

### Level 1: Syntax & Build

```bash
# Backend - rebuild and verify startup
docker compose -p localai up -d --build document-processor && sleep 15 && curl http://localhost:8090/health

# Frontend - build
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm build
```

### Level 2: Endpoint Verification

```bash
# Verify SSE endpoint exists in OpenAPI
curl -s http://localhost:8090/openapi.json | python3 -c "import json,sys; paths=json.load(sys.stdin)['paths']; print('/api/enhanced-documents/process-document-stream' in paths)"

# Quick SSE test with curl
curl -N -X POST http://localhost:8090/api/enhanced-documents/process-document-stream \
  -F "file=@localai-admin-dashboard/tests/fixtures/real-test-contract.txt" \
  --max-time 60 2>&1 | head -40
```

### Level 3: Integration Tests

```bash
# Backend tests
cd document-processor && python -m pytest tests/test_streaming_endpoint.py -v --tb=short

# Frontend tests
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/streaming-processing.test.ts

# Regression - ensure existing tests still pass
cd document-processor && python -m pytest tests/test_template_rag.py -v --tb=short
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/env-services-regression.test.ts
```

### Level 4: Manual Validation

1. Open `http://localhost:5173/documents/upload` in browser
2. Upload `localai-admin-dashboard/tests/fixtures/real-test-contract.txt`
3. Observe: log panel appears with real-time progress
4. Observe: each stage shows completion time
5. Observe: progress bar advances smoothly
6. Observe: redirects to document detail page on completion
7. Observe: extracted fields are present on detail page

---

## ACCEPTANCE CRITERIA

- [ ] SSE endpoint `POST /api/enhanced-documents/process-document-stream` exists and streams events
- [ ] Events follow SSE format: `event: stage\ndata: {...}\n\n`
- [ ] At minimum these stages are streamed: received, evaluating, extracting_text, matching_templates, extracting_fields, complete
- [ ] Each event includes: stage, message, progress (0-100), elapsed_ms
- [ ] Final `complete` event includes full processing result (evaluation, chosen_template, extracted_fields)
- [ ] Frontend shows real-time log panel with progress bar during upload
- [ ] Each log entry shows checkmark when complete, spinner when active
- [ ] Elapsed time shown per stage
- [ ] Document is finalized in DB after stream completes
- [ ] Navigation to document detail page works after completion
- [ ] Error states are shown in the log panel (not just toast)
- [ ] Existing non-streaming flow still works for manual template selection
- [ ] All integration tests pass
- [ ] No regressions in existing test suites
- [ ] Full processing completes under 30 seconds with Azure OpenAI

---

## COMPLETION CHECKLIST

- [ ] Task 1: Backend SSE endpoint created and functional
- [ ] Task 2: Router registered in main.py
- [ ] Task 3: `@microsoft/fetch-event-source` installed
- [ ] Task 4: `use-processing-stream` hook created
- [ ] Task 5: `ProcessingLog` component created
- [ ] Task 6: `DocumentUploadPage` updated to use streaming
- [ ] Task 7: Backend integration tests pass
- [ ] Task 8: Frontend integration tests pass
- [ ] All validation commands executed successfully
- [ ] Manual testing confirms real-time log panel works
- [ ] Acceptance criteria all met

---

## NOTES

### Architecture Trade-offs

**Why SSE over WebSocket:**
- SSE is simpler (unidirectional, automatic reconnection)
- Works through HTTP/1.1 proxies and CDNs
- No need for WebSocket upgrade negotiation
- FastAPI has built-in support via `StreamingResponse`
- We only need server→client communication

**Why single endpoint over event bus:**
- No need for Redis/pub-sub infrastructure
- Simpler correlation (no document ID matching)
- Single connection = single response = easier error handling
- Works immediately without infrastructure changes

**Why `@microsoft/fetch-event-source` over native EventSource:**
- Native `EventSource` only supports GET requests
- We need POST to upload the file as FormData
- Microsoft library has good TypeScript types and error handling
- Small bundle (~2KB gzipped)

### Future Enhancements (out of scope for this plan)

- Per-field streaming during extraction (stream each extracted field as it's found)
- Cancellation (abort processing from the UI)
- Reconnection with replay (use `Last-Event-ID` header)
- Processing history log (persist events for later viewing)

### Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Proxy buffering breaks SSE | Medium | Set `X-Accel-Buffering: no` header, heartbeat every 15s |
| Long processing exceeds browser timeout | Low | Heartbeat keeps connection alive |
| Concurrent uploads cause resource contention | Low | Same as current (each request is independent) |
| Frontend unmounts during stream | Medium | AbortController cleanup in hook |

**Confidence Score: 8/10** - Well-understood patterns, existing services reused without modification, main risk is proxy buffering in production which is mitigated by headers and heartbeat.
