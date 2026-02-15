# Feature: Template-RAG Vector Matching

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Replace the slow sequential LLM extraction loop in `/decide-template` with a vector similarity search (Template-RAG). Currently, the endpoint performs 4+ sequential LLM calls (1 for document evaluation + 3 for `test_template_extraction()` on top 3 suggestions) that take 30-60 seconds total. The new approach embeds templates at creation/update time, embeds the uploaded document at decision time, and uses Qdrant vector search to find the best match in ~200ms, then extracts with only the top 1 match. This reduces the `/decide-template` response from ~43s to ~12s.

## User Story

As a document uploader
I want template matching to complete in under 15 seconds
So that I don't see timeout errors and the upload experience feels responsive

## Problem Statement

The `/decide-template` endpoint performs 3 sequential `test_template_extraction()` LLM calls (each 5-15s) to validate extraction quality for the top 3 template suggestions. This consistently exceeds the frontend's 45-second `AbortSignal.timeout`, causing `TimeoutError: signal timed out` for users on fetchtext.io. The timeout cascades into a low-confidence fallback evaluation, degrading the template decision quality.

## Solution Statement

Implement a Template-RAG system that:
1. **Embeds templates at creation/update time** into a dedicated Qdrant collection (`template_embeddings`)
2. **Embeds the document at upload time** (already partially done in `template_matching_service.py`)
3. **Uses Qdrant vector search** (~200ms) to find the top match instead of 3 LLM extraction tests
4. **Only performs 1 LLM extraction test** on the single best match (not 3)
5. **Falls back** to the existing multi-factor scoring if vector search returns no results

This cuts the decision time from ~43s to ~12s: 2s (document embed) + 0.2s (vector search) + 5-10s (1 extraction test) = ~12s.

## Feature Metadata

**Feature Type**: Enhancement / Performance Optimization
**Estimated Complexity**: Medium
**Primary Systems Affected**: document-processor backend (template matching, vector search, embedding), Qdrant, `/decide-template` endpoint
**Dependencies**: Qdrant (already running in Docker), Azure OpenAI embeddings (already configured), `text-embedding-3-small` model (already in use)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `document-processor/app/routers/enhanced_documents.py` (lines 420-687) - Why: Contains `/decide-template` endpoint with the sequential LLM loop (lines 484-551) that must be replaced
- `document-processor/app/services/template_matching_service.py` (lines 80-163, 319-369) - Why: Current `find_matching_templates()` already generates document embeddings and scores templates; the 4-factor scoring algorithm lives here
- `document-processor/app/services/smart_field_extractor.py` (lines 730-818) - Why: Contains `test_template_extraction()` method - the expensive LLM call we're reducing from 3x to 1x
- `document-processor/app/services/embedding_service.py` (lines 80-123, 205-252) - Why: `generate_single_embedding()` and `generate_embeddings()` methods we'll use for template/document embeddings
- `document-processor/app/services/vector_search_service.py` (lines 67-214, 234-276) - Why: Qdrant integration with collection management, indexing, and hybrid search - we'll create a new `templates` collection
- `document-processor/app/services/enhanced_document_service.py` (lines 22-138) - Why: Orchestration layer showing how embedding + vector services are composed
- `document-processor/app/services/document_evaluator.py` (lines 76-160) - Why: `evaluate_document()` is called first in `/decide-template` and provides document text + type
- `supabase/migrations/001_initial_schema.sql` (lines 19-38, 79-86) - Why: `smart_templates` table schema and `template_embeddings` table (exists but not populated)
- `localai-admin-dashboard/src/lib/document-processor-enhanced.ts` (lines 1368-1479) - Why: Frontend `decideTemplate()` with 45s timeout that triggers the timeout error
- `localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx` (lines 285-310) - Why: Upload flow calling `decideTemplate()` - validates the API contract doesn't change
- `localai-admin-dashboard/src/__tests__/integration/template-matching-regression.test.ts` - Why: Existing template matching test pattern to follow
- `localai-admin-dashboard/src/__tests__/integration/env-services-regression.test.ts` - Why: CI/CD regression test pattern to follow

### New Files to Create

- `document-processor/app/services/template_vector_service.py` - Template-specific vector indexing and search service
- `document-processor/tests/test_template_rag.py` - Backend integration tests for template RAG
- `localai-admin-dashboard/src/__tests__/integration/template-rag-performance.test.ts` - Frontend integration test verifying `/decide-template` completes within timeout

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Qdrant Python Client Docs](https://python-client.qdrant.tech/) - Collection creation, point upsert, search
- [Azure OpenAI Embeddings](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/embeddings) - text-embedding-3-small model
- [Qdrant Filtering](https://qdrant.tech/documentation/concepts/filtering/) - Payload filtering for category-scoped search

### Patterns to Follow

**Naming Conventions:**
- Services: `snake_case` Python files, `CamelCase` classes (e.g., `TemplateVectorService`)
- Endpoints: RESTful paths (e.g., `/health/cors`, `/decide-template`)
- Collections: lowercase with underscores (e.g., `template_embeddings` in Qdrant)

**Error Handling:**
```python
try:
    result = await some_operation()
except Exception as e:
    logger.error(f"Operation failed: {str(e)}", exc_info=True)
    # Fallback to previous behavior
```

**Service initialization pattern** (from `vector_search_service.py`):
```python
class TemplateVectorService:
    def __init__(self):
        self.embedding_service = embedding_service
        self.collection_name = "template_embeddings"
        self.available = False
        self._initialize()
```

**Logging Pattern:**
```python
import logging
logger = logging.getLogger(__name__)
logger.info(f"Template vector search found {len(results)} matches in {elapsed:.0f}ms")
```

---

## IMPLEMENTATION PLAN

### Phase 1: Template Vector Service (Backend Foundation)

Create a dedicated service that manages template embeddings in Qdrant. This service handles:
- Creating/managing the `template_embeddings` Qdrant collection
- Embedding templates when created or updated
- Searching for matching templates by document embedding
- Syncing existing templates into Qdrant on startup

### Phase 2: Template Embedding on Create/Update

Hook into the existing template save paths so that every time a template is created or updated, its embedding is automatically computed and indexed in Qdrant.

### Phase 3: Replace Sequential LLM Loop in `/decide-template`

Modify the `/decide-template` endpoint to:
1. Generate document embedding (already happens in `template_matching_service`)
2. Vector search Qdrant for top match (~200ms)
3. Only perform extraction test on the top 1 match (not top 3)
4. Fall back to multi-factor scoring if vector search unavailable

### Phase 4: Delete Dead Code

Remove the sequential 3-template extraction loop and related dead code paths.

### Phase 5: Testing & Validation

Write backend integration tests and frontend regression tests.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: CREATE `document-processor/app/services/template_vector_service.py`

**IMPLEMENT**: New service for template-specific vector operations in Qdrant

The service must:
1. Create a `template_embeddings` Qdrant collection (1536 dims, cosine distance)
2. Build a rich text representation of a template for embedding: `"{name} {category} {description} {field_names_joined}"`
3. Index a template by generating its embedding and upserting into Qdrant
4. Search for matching templates given a document embedding
5. Sync all existing templates from Supabase `smart_templates` table into Qdrant on startup
6. Remove a template embedding when the template is deleted

**PATTERN**: Mirror `vector_search_service.py` structure (lines 67-214) for collection management

**Key methods:**
```python
class TemplateVectorService:
    collection_name = "template_embeddings"

    async def ensure_collection_exists(self) -> bool
    async def build_template_text(self, template: Dict) -> str
    async def index_template(self, template: Dict) -> bool
    async def remove_template(self, template_id: int) -> bool
    async def search_similar_templates(self, document_embedding: List[float], limit: int = 5, category_filter: Optional[str] = None) -> List[Dict]
    async def sync_all_templates(self) -> int  # Returns count synced
```

**IMPORTS**:
```python
from app.services.embedding_service import embedding_service
from app.config.database import db_config
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import uuid, logging, os
```

**GOTCHA**:
- Qdrant uses UUID string IDs for points, not integers. Use `str(template_id)` as point ID so we can update/delete by template ID.
- Template text for embedding should include field names and descriptions to capture what the template extracts, not just its name.
- The `embedding_service` may not be initialized if Azure OpenAI env vars are missing. Check `embedding_service.provider` before calling.

**VALIDATE**:
```bash
cd document-processor && python -c "from app.services.template_vector_service import template_vector_service; print('Import OK')"
```

---

### Task 2: UPDATE `document-processor/app/services/template_matching_service.py` — integrate vector search

**IMPLEMENT**: Add a `find_matching_templates_vector()` method that:
1. Takes `document_embedding` (already generated in `find_matching_templates`)
2. Calls `template_vector_service.search_similar_templates()`
3. Returns results in the same format as `find_matching_templates()` (list of dicts with `template_id`, `template_name`, `match_score`, `category`, `field_count`, etc.)

**PATTERN**: Follow existing `find_matching_templates` return format (lines 137-145)

**IMPORTS**: `from app.services.template_vector_service import template_vector_service`

**GOTCHA**:
- If Qdrant is not available or has no templates indexed, fall back to existing `find_matching_templates()`
- The `match_score` from Qdrant cosine similarity is already 0-1 range, same as the current scoring system

**VALIDATE**:
```bash
cd document-processor && python -c "from app.services.template_matching_service import template_matching_service; print('OK')"
```

---

### Task 3: UPDATE `document-processor/app/routers/enhanced_documents.py` — replace 3-template loop with vector search + 1 extraction test

**IMPLEMENT**: Modify `/decide-template` endpoint (lines 480-551):

**Before** (REMOVE this code):
```python
# 3) Test extraction quality for top suggestions (2-way validation)
if suggestions and document_text:
    logger.info(f"Testing extraction quality for top {min(len(suggestions), 3)} template suggestions")
    for i, suggestion in enumerate(suggestions[:3]):  # <-- THE BOTTLENECK
        ...  # 60+ lines of sequential extraction testing
```

**After** (REPLACE with):
```python
# 3) Vector-enhanced template matching (Template-RAG)
# Try vector search first for fast matching, fall back to multi-factor scoring
vector_suggestions = []
if document_text:
    try:
        from app.services.template_vector_service import template_vector_service
        doc_embedding = await embedding_service.generate_single_embedding(document_text[:2000])
        if doc_embedding:
            primary_type = (evaluation.get('type_evaluation') or {}).get('primary_type')
            vector_suggestions = await template_vector_service.search_similar_templates(
                document_embedding=doc_embedding,
                limit=5,
                category_filter=primary_type
            )
            if vector_suggestions:
                logger.info(f"Vector search returned {len(vector_suggestions)} matches")
                suggestions = vector_suggestions  # Replace multi-factor results with vector results
    except Exception as e:
        logger.warning(f"Vector search failed, using multi-factor scoring: {e}")

# 4) Test extraction quality for top 1 suggestion only (not top 3)
if suggestions and document_text:
    best = suggestions[0]
    template_id = best.get('template_id')
    if template_id and db_config.is_configured and db_config.client:
        try:
            template_result = db_config.client.table('smart_templates').select(
                'id, name, smart_variables, category'
            ).eq('id', template_id).single().execute()
            if template_result.data:
                smart_variables = template_result.data.get('smart_variables', [])
                if smart_variables:
                    test_result = await smart_field_extractor.test_template_extraction(
                        content=document_text,
                        template_variables=smart_variables,
                        confidence_threshold=0.6,
                        provider="azure",
                        organization_id=organization_id
                    )
                    best['extraction_quality'] = test_result.get('field_success_rate', 0.0)
                    best['avg_field_confidence'] = test_result.get('avg_confidence', 0.0)
                    best['extractable_fields'] = test_result.get('extractable_count', 0)
                    best['total_fields'] = test_result.get('total_fields', 0)
                    best['failed_fields'] = test_result.get('failed_fields', [])
                    best['extraction_test_passed'] = test_result.get('test_passed', False)
                    best['combined_score'] = best.get('match_score', 0.0) * best['extraction_quality']
        except Exception as e:
            logger.error(f"Extraction test failed for top match: {e}")
            best['extraction_quality'] = best.get('match_score', 0.0)
            best['combined_score'] = best.get('match_score', 0.0)
```

**GOTCHA**:
- The response format MUST NOT change — frontend expects `action`, `chosen_template`, `alternatives`, `evaluation`, `decision_metadata`
- Keep the 2-way validation thresholds (lines 553-607) unchanged
- The embedding import for `embedding_service` must come from the existing module: `from app.services.embedding_service import embedding_service`

**VALIDATE**:
```bash
docker compose -p localai up -d --build document-processor && sleep 10 && curl -s http://localhost:8090/health | python3 -c "import sys, json; d=json.load(sys.stdin); print('OK' if d.get('status')=='healthy' else 'FAIL')"
```

---

### Task 4: UPDATE template creation/save paths to auto-index embeddings

**IMPLEMENT**: When templates are saved via the `/decide-template` auto-save path or any other creation path, automatically index the template embedding in Qdrant.

Files to update:
1. `document-processor/app/routers/enhanced_documents.py` — after `_save_template_to_database()` call (line 658), add:
   ```python
   # Index template embedding for vector search
   try:
       from app.services.template_vector_service import template_vector_service
       await template_vector_service.index_template(saved_template)
   except Exception as e:
       logger.warning(f"Failed to index template embedding: {e}")
   ```

2. Any other template creation endpoints (search for `_save_template_to_database` and `smart_templates.*insert` calls)

**PATTERN**: Follow existing post-save hooks pattern

**GOTCHA**: Template indexing is fire-and-forget — if it fails, the template is still saved to the DB. Log a warning but don't fail the request.

**VALIDATE**:
```bash
cd document-processor && python -c "
from app.routers.enhanced_documents import decide_template_strategy
print('Endpoint imports OK')
"
```

---

### Task 5: ADD startup sync — index all existing templates on service boot

**IMPLEMENT**: On service startup, sync all existing `smart_templates` from Supabase into Qdrant.

In `document-processor/app/main.py`, add a startup event:
```python
@app.on_event("startup")
async def startup_sync_template_embeddings():
    try:
        from app.services.template_vector_service import template_vector_service
        count = await template_vector_service.sync_all_templates()
        logger.info(f"Synced {count} template embeddings to Qdrant on startup")
    except Exception as e:
        logger.warning(f"Template embedding sync failed on startup (non-fatal): {e}")
```

**GOTCHA**:
- This must be non-blocking and non-fatal — if Qdrant is down, the service should still start
- Use `@app.on_event("startup")` or `lifespan` context manager depending on existing patterns
- Check `main.py` for existing startup patterns before adding

**VALIDATE**:
```bash
docker compose -p localai up -d --build document-processor && sleep 15 && docker compose -p localai logs document-processor --tail=30 | grep -i "template.*embedding\|sync\|qdrant"
```

---

### Task 6: DELETE dead code — remove the sequential 3-template extraction loop

**IMPLEMENT**: After Task 3 is verified working, ensure all traces of the old sequential loop are cleaned up:

1. In `enhanced_documents.py`: The old `for i, suggestion in enumerate(suggestions[:3])` loop and all its nested code (was lines 484-551) should be fully replaced, not left commented out
2. Remove any `# TODO` or `# OLD:` comments left from the refactor
3. Verify no other endpoint calls `test_template_extraction()` in a loop over multiple templates

**GOTCHA**: `test_template_extraction()` itself is NOT dead code — it's still used once for the top match. Only the loop calling it 3 times is dead.

**VALIDATE**:
```bash
cd document-processor && grep -n "suggestions\[:3\]" app/routers/enhanced_documents.py && echo "FAIL: old loop still present" || echo "PASS: old loop removed"
```

---

### Task 7: CREATE backend integration test `document-processor/tests/test_template_rag.py`

**IMPLEMENT**: Integration test that verifies the Template-RAG flow:

1. Health check — backend must be running
2. Create a test template via the API (or directly insert into Supabase)
3. Verify template is indexed in Qdrant (check `template_vector_service` collection)
4. Upload a document that matches the template via `/decide-template`
5. Assert response time is under 30 seconds (was ~45s before)
6. Assert `action` is `use_existing` and `chosen_template.template_id` matches
7. Assert `decision_metadata.extraction_tested` is true
8. Clean up: delete test template from both Supabase and Qdrant

**PATTERN**: Follow `template-matching-regression.test.ts` structure for the `/decide-template` call pattern

**IMPORTS**: `pytest`, `httpx` (or `requests`), `asyncio`, `time`

**GOTCHA**:
- Use real fixture files from `document-processor/tests/` or `localai-admin-dashboard/tests/fixtures/`
- Must call real backend — no mocking per CLAUDE.md rules
- Test must fail loudly if backend is unavailable

**VALIDATE**:
```bash
cd document-processor && python -m pytest tests/test_template_rag.py -v --timeout=120
```

---

### Task 8: CREATE frontend integration test `localai-admin-dashboard/src/__tests__/integration/template-rag-performance.test.ts`

**IMPLEMENT**: Integration test that verifies the `/decide-template` endpoint responds within the 45s timeout:

1. Check backend availability (fail if not running)
2. Load a real fixture file (e.g., `Stucco Contract V1.pdf` or a text fixture)
3. Call `/decide-template` via `fetch()` with FormData
4. Measure response time
5. Assert response time < 30_000ms (30 seconds — well within 45s timeout)
6. Assert response has valid `action`, `evaluation`, `decision_metadata`
7. If `action === 'use_existing'`, assert `chosen_template` has `template_id`, `match_score`

**PATTERN**: Follow `template-matching-regression.test.ts` structure exactly (lines 1-80)

**GOTCHA**:
- Use `@vitest-environment node` pragma
- Load fixtures from `tests/fixtures/` directory
- No mocks — calls real backend
- Set test timeout to 60_000ms

**VALIDATE**:
```bash
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/template-rag-performance.test.ts
```

---

### Task 9: UPDATE existing regression tests with CORS check for Qdrant

**IMPLEMENT**: Add a check in `env-services-regression.test.ts` that verifies:
1. `docker-compose.yml` has a `qdrant` service defined
2. Qdrant health endpoint is reachable (optional, only when services are running)

**PATTERN**: Follow existing CI/CD workflow validation pattern in the file

**VALIDATE**:
```bash
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/env-services-regression.test.ts
```

---

## TESTING STRATEGY

### Unit Tests

**Backend** (`document-processor/tests/test_template_rag.py`):
- Test `TemplateVectorService.build_template_text()` produces meaningful text
- Test `TemplateVectorService.index_template()` succeeds with valid template
- Test `TemplateVectorService.search_similar_templates()` returns results
- Test the full `/decide-template` flow with vector search enabled
- Test fallback when Qdrant is unavailable (should use multi-factor scoring)

### Integration Tests

**Backend** (`document-processor/tests/test_template_rag.py`):
- Upload a real fixture document via `/decide-template`
- Measure response time (must be under 30s)
- Verify extraction test runs on only 1 template (not 3)
- Verify response format matches existing API contract

**Frontend** (`localai-admin-dashboard/src/__tests__/integration/template-rag-performance.test.ts`):
- Call `/decide-template` from Node.js with a real fixture
- Verify response time under 30s
- Verify response schema matches `DocumentDecisionResult` type

### Edge Cases

- Qdrant is down → falls back to multi-factor scoring gracefully
- No templates exist in Qdrant → falls back to multi-factor scoring
- Template embedding fails → template still saved to DB, warning logged
- Document text is empty → skips vector search, uses pattern matching
- Very short document (< 50 chars) → embedding may be low quality, fallback to multi-factor

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Service Health

```bash
# Verify document processor starts cleanly
docker compose -p localai up -d --build document-processor
docker compose -p localai ps document-processor
curl -s http://localhost:8090/health | python3 -m json.tool

# Verify Qdrant is running
curl -s http://localhost:6333/collections | python3 -m json.tool
```

### Level 2: Backend Tests

```bash
cd document-processor && pip install -r requirements.txt
cd document-processor && python -m pytest tests/test_template_rag.py -v --timeout=120
```

### Level 3: Frontend Tests

```bash
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run src/__tests__/integration/template-rag-performance.test.ts
npx vitest run src/__tests__/integration/template-matching-regression.test.ts
npx vitest run src/__tests__/integration/env-services-regression.test.ts
```

### Level 4: Manual Validation

```bash
# 1. Upload a test document and measure response time
time curl -X POST http://localhost:8090/api/enhanced-documents/decide-template \
  -F "file=@localai-admin-dashboard/tests/fixtures/Stucco Contract V1.pdf" \
  -F "quick_scan=true" -F "min_match_confidence=0.6" -F "allow_generation=true"

# 2. Verify Qdrant has templates indexed
curl -s http://localhost:6333/collections/template_embeddings | python3 -m json.tool

# 3. Check logs for vector search timing
docker compose -p localai logs document-processor --tail=50 | grep -i "vector.*search\|template.*match\|rag"
```

### Level 5: E2E Validation

```bash
# Run the production PDF upload test locally
cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20
E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/production/pdf-upload-production.pw.spec.ts
```

---

## ACCEPTANCE CRITERIA

- [ ] `/decide-template` responds in under 30 seconds for standard documents (was ~43s)
- [ ] Vector search finds the correct template when one exists (same as old multi-factor)
- [ ] Only 1 `test_template_extraction()` call is made per request (was 3)
- [ ] Templates are automatically embedded in Qdrant when created/updated
- [ ] Existing templates are synced to Qdrant on service startup
- [ ] Graceful fallback to multi-factor scoring when Qdrant is unavailable
- [ ] Response format of `/decide-template` is unchanged (no frontend breaking changes)
- [ ] All existing tests pass (no regressions)
- [ ] Backend integration test validates the full RAG flow
- [ ] Frontend integration test validates response time under 30s
- [ ] Sequential 3-template extraction loop is removed (dead code deleted)
- [ ] No `suggestions[:3]` loop remains in `enhanced_documents.py`

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (1-9)
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] Full test suite passes (backend + frontend integration)
- [ ] No linting or type checking errors
- [ ] Manual testing confirms `/decide-template` responds faster
- [ ] Acceptance criteria all met
- [ ] Dead code removed (old 3-template loop)
- [ ] Container rebuilt and service healthy

---

## NOTES

### Design Decisions

1. **Separate Qdrant collection for templates** (`template_embeddings`) rather than reusing the `documents` collection. Rationale: templates and documents have different payloads/metadata, and template search is queried differently (by category, not by document_id).

2. **Template text representation** includes field names and descriptions, not just the template name. Rationale: Two templates with different names but similar fields should match similar documents. The embedding should capture what the template *extracts*, not just what it's called.

3. **1 extraction test instead of 3**. Rationale: Vector similarity with 35% semantic weight (already proven in `_calculate_template_score`) is sufficient to identify the best match. The extraction test validates quality, not ranking. Testing 3 candidates adds 10-30s for marginal accuracy improvement.

4. **Fire-and-forget embedding on template save**. Rationale: Template creation is rare (user action), so a failure to embed shouldn't block the template save. The startup sync catches any missed embeddings.

5. **Keeping `test_template_extraction()` for the top 1 match**. Rationale: Vector similarity alone can't guarantee field extractability. The 2-way validation (match score + extraction quality) is the system's core innovation and should be preserved, just applied to 1 template instead of 3.

### Performance Estimates

| Operation | Before | After |
|-----------|--------|-------|
| Document evaluation | 3-5s | 3-5s (unchanged) |
| Text extraction | 3-8s | 3-8s (unchanged) |
| Template matching | 1-2s | 0.2s (vector search) |
| Extraction testing | 15-45s (3 templates) | 5-15s (1 template) |
| **Total** | **22-60s** | **11-28s** |

### Risk Assessment

- **Low risk**: Qdrant is already running in Docker and proven working for document search
- **Low risk**: Embedding service is already production-ready with retry logic
- **Medium risk**: Startup sync could be slow if there are many templates (mitigate with batch processing)
- **Low risk**: Fallback to multi-factor scoring ensures no regression if vector search fails
