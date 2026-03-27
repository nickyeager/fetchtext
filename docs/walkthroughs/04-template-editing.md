# Walkthrough 4: Template Editing

**Josh's ask:** "Show 'editing' of templates (inline editing in template detail)"

**Status:** Has Gaps

---

## Steps (Current State)

### 1. Navigate to Templates List
- Sidebar: Click **Templates**
- URL: `/templates`

### 2. Open the Template Editor
- On a template card, click the **gear/settings icon**
- This opens the **TemplateEditor** as an overlay/modal

### 3. Edit Template Metadata
In the editor you can modify:
- **Name** — text input in the header bar
- **Description** — textarea in collapsible "Template Settings" panel
- **Category** — dropdown with preset options (legal, finance, business, etc.)

### 4. Edit Smart Variables
In the left sidebar of the editor:
- **Add variable** — click "+" to add a new field
- **Edit variable** — click a variable to edit its name, type, description, extraction hints
- **Remove variable** — delete button per variable
- **Reorder** — drag to reorder fields

### 5. Edit Template Content
The main editor area uses a TipTap rich text editor:
- Type `{{` to autocomplete variable names
- Insert variables as highlighted chips in the document
- Format with bold, italic, headings, lists

### 6. Save Changes
- Click **Save** in the sticky header bar
- Changes are persisted to Supabase and Qdrant re-indexes the template

---

## Demo Script (Adapted for Gaps)

> "Let me show you how to edit a template. From the templates list, I click the settings icon and get the full editor. I can change the template name, add or remove fields, and adjust the extraction hints that guide the AI."
>
> "For example, let me add a new field called 'warranty_period'. I set the type to 'text', add extraction hints like 'warranty', 'guarantee', 'period'. Now when we process the next contract, the AI will look for this field too."

---

## Gaps

| Gap | Impact | Priority | Notes |
|-----|--------|----------|-------|
| **No edit button on template detail page** | Users land on detail page and can't figure out how to edit | HIGH | Detail page (`$templateId.tsx`) only has a read-only TemplateViewer. Need an "Edit" button that either opens the editor inline or navigates to the editor. |
| **Editor is only accessible from templates list** | Must navigate away from detail page to edit | HIGH | Josh specifically asked to see editing on the template detail page |
| **No inline editing on detail page** | Can't quickly tweak a field name or hint without opening full editor | MEDIUM | Would be ideal for demos — click a variable, edit in place |
| **Template editor doesn't show extraction preview** | Can't see "what would this extract?" while editing | LOW | Nice-to-have for iterating on templates |

---

## Recommended Fix

Add an **"Edit Template"** button to the template detail page header (next to "Back to Templates") that:

**Option A (quick):** Navigates to `/templates?edit={templateId}` to open the existing editor

**Option B (better for demo):** Opens the TemplateEditor as a modal/drawer on the detail page itself, so the user stays in context
