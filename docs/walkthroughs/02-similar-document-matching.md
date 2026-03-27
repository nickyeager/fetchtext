# Walkthrough 2: Similar Document Matching

**Josh's ask:** "Upload a second document that is similar (same or slightly different) and verify correct text extraction" + "Improve the semantic relevancy score"

**Status:** Ready

---

## Steps

### 1. Upload First Document
Follow [Walkthrough 1](01-upload-and-extract.md) to upload your first document (e.g., a stucco contract).

Note the matched template and score (e.g., "Contract Template — 62%").

### 2. Upload a Similar Document
Go back to Upload Document and drop a **second, similar document** — same type but different vendor/values.

Example: A different stucco contract from another contractor, or the same contract with different pricing.

### 3. Observe Template Matching
Watch the processing panel. The system should:
- Classify as the same document type (e.g., "contract")
- Match to the **same template** as the first document
- Show a similar or higher match score

**Demo talking point:** "Notice it matched the same template — the system understands that both documents are contracts with the same field structure, even though the vendor and pricing are different."

### 4. Compare Extracted Fields
Navigate to both document detail pages and compare:
- Same fields extracted (contractor name, price, location, etc.)
- Different values for each vendor
- Similar confidence levels

### 5. Show the Scoring Breakdown
**Demo talking point:** "Under the hood, we use a 5-factor scoring model:"
- **Category alignment (25%)** — Is the document type compatible with the template category?
- **Field semantic coverage (20%)** — Do the template's field definitions semantically match what's in the document? (embedding-based, not keyword matching)
- **Semantic similarity (30%)** — How similar is the document's overall content to the template?
- **Cross-encoder re-ranking (15%)** — An LLM directly judges how well this document fits this template
- **Historical success (10%)** — How well has this template worked on past documents?

---

## Demo Script

> "Now watch what happens when I upload a similar contract from a different vendor. The system matches it to the same Contract Template — because it understands the document structure, not just keywords."
>
> "We use a 5-factor scoring model. The key innovation is the cross-encoder re-ranking — we actually ask the LLM to judge the fit, which catches matches that pure vector similarity would miss."

---

## What Could Go Wrong
- **Different template matched**: If the second document is too different (e.g., different contract type), it may match a different template. This is actually correct behavior.
- **Low match score**: If there's only one template for this document type, the score may be lower because there's less training data. This is where [Walkthrough 5 (Multi-Exemplar)](05-multi-exemplar-training.md) helps.

---

## Gaps

| Gap | Impact | Status |
|-----|--------|--------|
| No side-by-side document comparison view | Can't visually compare two docs' extracted fields in one screen | Not built |
| No "similarity reasoning" shown in UI | Backend computes it but UI doesn't surface the scoring breakdown | Not built |
| Field-level similarity search not exposed in UI | Backend Batch 4 (field_similarity_service) not implemented yet | Planned (Graph RAG Batch 4) |
