# Walkthrough 5: Multi-Exemplar Training

**Josh's ask:** "Needs multiple example documents to infer that multiple templates exist — can't just have one example per template"

**Status:** Ready (Batch 1 just completed)

---

## Steps

### 1. Navigate to a Template Detail
- Sidebar: Templates > click a template card
- URL: `/templates/{id}`

### 2. Click the Examples Tab
- Click the **Examples** tab (third tab, with book icon)
- Shows current exemplar documents (empty if none uploaded yet)

### 3. Upload Example Documents
- Click **"Add Example"** button (top-right, blue)
- Select a document that represents this template type
- The system will:
  1. Extract text from the document
  2. Generate an embedding
  3. Index it in Qdrant alongside the template
  4. Record it in the database

### 4. Upload Multiple Examples
- Repeat step 3 with 2-3 more documents of the same type but different content
- Example: For a "Contract Template", upload contracts from different vendors
- Each exemplar appears in the list with:
  - Document name
  - Character count
  - "Indexed" badge (green) when vectorized
  - Upload date

### 5. Test Improved Matching
- Go to Upload Document and drop a new, similar document
- The match score should be **higher** than before because the system now has multiple reference points
- The match source will show `vector_search:document_exemplar[N]` indicating which exemplar was closest

### 6. Remove Bad Examples
- If an exemplar is hurting match quality (wrong document type uploaded by mistake):
  - Click the **trash icon** next to the exemplar
  - It's removed from both Qdrant and the database

---

## How It Works (Technical)

```
Before (1 exemplar):
  Template "Contract" → 1 embedding → 62% match

After (3 exemplars):
  Template "Contract" → 3 embeddings → best match wins
    Exemplar 0 (vendor A contract): 62%
    Exemplar 1 (vendor B contract): 78% ← winner
    Exemplar 2 (vendor C contract): 71%

  Final score: 78% (max across all exemplars)
```

Each exemplar captures a different "flavor" of documents that belong to this template. The system uses the **max score** across all exemplars — so the best-matching example determines the template's score.

---

## Demo Script

> "Josh mentioned needing multiple example documents per template. Here's how that works. I go to the Contract Template and click 'Examples'. Right now it has no examples — let me add three different contracts."
>
> [Upload 3 contracts]
>
> "Now each of these is indexed as a reference point. When a new contract comes in, the system compares it against all three examples and uses the best match. Let me upload a new contract..."
>
> [Upload new document]
>
> "See — the match score went from 62% to 78% because one of our examples was structurally very similar to this new document. More examples = better matching."

---

## What Could Go Wrong
- **Upload fails**: Backend must be running with Qdrant available. Check `/health` endpoint.
- **"Not indexed" badge**: If the embedding service is down, the exemplar is stored in DB but not vectorized. It will be indexed on next service restart.
- **Score doesn't improve**: If the new document is very different from all exemplars, the score won't improve. This is correct behavior — add a more relevant exemplar.
