# Walkthrough 1: Upload & Extract

**the design partner's ask:** "Upload a document via the admin upload flow, creating a document record"

**Status:** Ready

---

## Steps

### 1. Navigate to Upload
- Sidebar: Click **Upload Document**
- Or: Dashboard > "Upload Document" button (top-right)
- URL: `/documents/upload`

### 2. Drop or Select a File
- Drag a PDF/DOCX/TXT/image into the drop zone
- Or click the zone to open file picker
- Supported: PDF, DOCX, TXT, PNG, JPG, TIFF

### 3. Watch Real-Time Processing (SSE Stream)
Once the file is selected, the SSE pipeline kicks off automatically. You'll see each stage in real time:

| Stage | What Happens | Typical Time |
|-------|-------------|-------------|
| `received` | File received by backend | instant |
| `extracting_text` | PyMuPDF or Docling extracts text | 0.5-2s |
| `text_extracted` | Shows character count | instant |
| `evaluating` | LLM classifies document type | 2-5s |
| `evaluated` | Shows type + confidence (e.g., "contract 74%") | instant |
| `matching_template` | Qdrant vector search for best template | 1-3s |
| `template_matched` | Shows matched template + score | instant |
| `extracting_fields` | LLM extracts fields using template | 5-15s |

**Demo talking point:** "Everything streams in real time — you can see exactly what the AI is doing at each step. No black box."

### 4. View Results
After processing completes, you're auto-redirected to the document detail page showing:
- Matched template name and confidence badge
- All extracted fields with values
- Original document viewer (left pane)
- Template editor (right pane)

### 5. Verify Extracted Data
Point out specific extracted values:
- For a stucco contract: "Nicholas Yeager", "$8,000", "1000 W. Roller Coaster Rd"
- For an invoice: vendor name, total amount, line items

---

## Demo Script

> "Let me show you the upload flow. I'll drop this contract PDF in. Watch the processing panel — you can see it extracting text, classifying the document as a contract with 74% confidence, finding the best matching template, and then extracting all the fields. The whole thing takes about 15 seconds."
>
> "Now look at the results — it pulled out the contractor name, project price, job location, and all the key terms. These are real LLM extractions, not regex patterns."

---

## What Could Go Wrong
- **Slow extraction**: If using Ollama (local LLM) instead of Azure OpenAI, field extraction can take 2-3 minutes. Switch to Azure in Settings > AI Models.
- **No template match**: If this is a document type with no templates, the system will offer to generate one automatically.
- **Storage error**: The "extended attributes" Supabase storage error is cosmetic — processing still works via SSE pipeline.
