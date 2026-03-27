# Walkthrough 3: Template-Documents View

**Josh's ask:** "See all documents associated with a template"

**Status:** Ready

---

## Steps

### 1. Navigate to Templates
- Sidebar: Click **Templates**
- URL: `/templates`

### 2. Select a Template
- Click any template card (e.g., "Contract Key Terms Extractor")
- You'll land on the **Overview** tab showing template metadata

### 3. Click the Documents Tab
- Click the **Documents** tab in the template detail page
- Shows a table of all documents processed with this template

### 4. Review Document List
The table shows:
| Column | Description |
|--------|-------------|
| Document | Filename of the processed document |
| Size | File size |
| Status | Processing status (Completed, Failed, etc.) |
| Match | Template match percentage for this document |
| Uploaded | Date the document was uploaded |

### 5. Upload a New Document for This Template
- Click **"Upload New"** button (top-right of Documents tab)
- This navigates to the upload page with the template pre-selected
- The new document will appear in this list after processing

### 6. Click a Document to View Details
- Click any document row to navigate to its detail page
- From there you can see extracted fields, edit the template, etc.

---

## Demo Script

> "Let's look at it from the template side. Here's our Contract Key Terms Extractor template — it has 29 documents processed with it. You can see every document, its match score, and status."
>
> "This is important for Josh's use case — when you have a procurement template, you want to see every contract that's been processed with it, compare the extracted fields across vendors, and spot anomalies."

---

## What Could Go Wrong
- **Empty list**: If no documents have been processed with this template yet, you'll see an empty state with a prompt to upload. Use the "Upload New" button to add one.
- **Documents show 0% match**: Older documents processed before template matching was implemented won't have match scores.
