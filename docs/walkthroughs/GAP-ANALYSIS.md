# Gap Analysis: the design partner Demo Readiness

Consolidated view of everything the design partner asked to see vs. what we can actually demo today.

---

## the design partner's Demo Flow — Status

| # | What the design partner Wants to See | Can We Demo It? | Walkthrough |
|---|----------------------|-----------------|-------------|
| 1 | Upload a document, create record | YES | [01](01-upload-and-extract.md) |
| 2 | Upload similar doc, verify extraction | YES | [02](02-similar-document-matching.md) |
| 3 | See all documents for a template | YES | [03](03-template-documents-view.md) |
| 4 | Edit templates inline | YES — Edit Template button on detail page header | [04](04-template-editing.md) |
| 5 | Backend API upload process | YES | [06](06-api-upload-flow.md) |
| 6 | Snowflake integration | PARTIAL — config works, import route removed | [07](07-snowflake-integration.md) |

---

## the design partner's Feature Requests — Status

| Feature | Status | What Exists | What's Missing |
|---------|--------|-------------|----------------|
| **Improve semantic relevancy** | DONE | 5-factor scoring with cross-encoder re-ranking + field-level semantic scoring | Scoring breakdown not shown in UI |
| **Multiple example docs per template** | DONE | Exemplar upload/list/delete in UI + backend + Qdrant indexing | Need to demo with real multi-exemplar scenario |
| **Template-documents view** | DONE | Documents tab on template detail with match scores | — |
| **Field-level similarity search** | NOT BUILT | Plan exists (Graph RAG Batch 4) | `field_similarity_service.py` not implemented |
| **Entity extraction across corpus** | NOT BUILT | Single-doc entity extraction works. Cross-doc linking planned (Batch 2) | `entity_graph_index_service.py` not implemented |
| **Form field mapping** | NOT BUILT | Plan exists (Graph RAG Batch 4) | `field_mapping_service.py` not implemented |
| **Graph RAG / LightRAG** | NOT BUILT | Plan exists (Batch 3) | `lightrag_service.py` not implemented |
| **Vendor comparison matrix** | NOT BUILT | Plan exists (Graph RAG Batch 5) | `VendorComparisonTable.tsx` not implemented |

---

## Critical Gaps for Demo (Must Fix)

### 1. Template Edit Button on Detail Page
**Problem:** the design partner asked to see template editing. The editor exists but is only accessible from the templates list page (gear icon). The template detail page has NO edit affordance.

**Impact:** During demo, when you're on the template detail page showing documents and examples, there's no way to edit without navigating away.

**Fix:** Add an "Edit Template" button to the template detail page header. ~30 min.

**Files to change:**
- `src/routes/_authenticated/templates/$templateId.tsx` — add Edit button + import TemplateEditor

### 2. Snowflake Import Route
**Problem:** The `/documents/snowflake-import` route was removed during sidebar cleanup. No UI path to trigger Snowflake imports.

**Impact:** Can't demo the full Snowflake flow — can only show config and connection test.

**Fix:** Add an "Import Documents" button to the Snowflake integration config page. ~1 hour.

**Files to change:**
- `src/features/settings/integrations/` — add import form to Snowflake config panel

---

## Nice-to-Have Gaps (Would Improve Demo)

### 3. Scoring Breakdown in UI
**Problem:** The 5-factor scoring model runs on the backend but the UI only shows the final score (e.g., "62%"). the design partner cares about understanding WHY a template matched.

**Fix:** Add a collapsible "Scoring Details" panel to the template match card on document detail page. Show category, field coverage, semantic, re-rank, and success scores.

### 4. Side-by-Side Document Comparison
**Problem:** the design partner wants to compare similar documents' extracted fields. Currently you can only view one document at a time.

**Fix:** Add a "Compare" button on the template-documents list that opens two documents side by side with field comparison.

### 5. Exemplar Count on Template Cards
**Problem:** Templates list doesn't show how many exemplar documents each template has.

**Fix:** Query `template_exemplars` count and show as badge on template cards (like document count).

---

## Feature Roadmap Gaps (Future Batches)

These are from the design partner's longer-term vision. They're planned but not started:

| Feature | Graph RAG Batch | Dependencies |
|---------|----------------|--------------|
| Entity + relationship extraction | Batch 2 | Existing LLM extractor |
| LightRAG knowledge graph | Batch 3 | Batch 2 |
| Graph-enhanced template matching | Batch 4 | Batches 2 + 3 |
| Field-level similarity search | Batch 4 | Batch 2 |
| Vendor comparison table | Batch 5 | Batch 4 |
| Form field mapping | Batch 4 | Batch 2 |
| Graph query interface in UI | Batch 5 | Batch 3 |

---

## Recommended Demo Prep Priority

1. **Add Edit button to template detail page** (30 min) — HIGH impact, LOW effort
2. **Prep a multi-exemplar demo scenario** (30 min) — Upload 3 varied contracts as exemplars, then show improved matching
3. **Restore Snowflake import flow** (1 hour) — if Snowflake demo is confirmed
4. **Add scoring breakdown to UI** (2 hours) — impressive for technical audiences
