# Document Override Feature Design

**Status**: Draft
**Created**: 2025-12-29
**Purpose**: Allow one-off modifications to generated documents without changing global templates

---

## Problem Statement

Currently, when a user wants to modify how a document is generated:
- They can **edit the template** - but this affects ALL documents using that template
- They can **create a new template** - but this clutters the template library with one-off variations

Users need the ability to make document-specific overrides that:
1. Modify extracted field values for a single document
2. Optionally modify template content/structure for a single document
3. Preserve the link to the original template (for updates/comparison)
4. Show clear visual indicators when a document has custom overrides

---

## Design Direction: **Editorial Precision**

A refined, document-focused aesthetic with clear visual language for distinguishing custom overrides from template defaults.

### Visual Language
- **Amber/Gold accent** for override indicators (like manuscript annotations)
- **Dotted borders** for overridden fields
- **Subtle glow effects** for hover states on editable fields
- **Before/After comparison** toggle for template content overrides

---

## 1. Data Model

### DocumentOverrides Interface

```typescript
// New type: Document-level overrides
interface DocumentOverrides {
  // Track if document has any overrides
  has_overrides: boolean;

  // Last modification timestamp
  overrides_modified_at?: string;

  // Field value overrides (key = variable name)
  field_overrides?: Record<string, FieldOverride>;

  // Template content override (structural changes)
  template_content_override?: TemplateContentOverride;

  // Generation settings override
  generation_settings_override?: Partial<TemplateGenerationSettings>;
}

interface FieldOverride {
  // The overridden value
  value: string | number | null;

  // The original extracted value (for comparison/reset)
  original_value?: string | number | null;

  // Original confidence (preserved for reference)
  original_confidence?: number;

  // Why was this overridden?
  override_reason?: 'manual_edit' | 'correction' | 'custom_value';

  // When was it modified?
  modified_at: string;
}

interface TemplateContentOverride {
  // The modified template content
  content: string;

  // Original template content (for diff/reset)
  original_content: string;

  // Template ID this was based on
  source_template_id: number;

  // Template version/updated_at when snapshot was taken
  source_template_version: string;

  // When was it modified?
  modified_at: string;
}
```

### Extended DocumentMetadata

```typescript
// In unified-document-service.ts
export interface DocumentMetadata {
  // ... existing fields ...

  // NEW: Document-level overrides
  document_overrides?: DocumentOverrides;
}
```

### Database Column

The `documents.metadata` JSONB column already exists and can store the `document_overrides` object without schema changes.

---

## 2. UI Components

### 2.1 Enhanced SaveTemplateDialog

Add a third option: **"Save as Document Override"**

```
+--------------------------------------------------+
|  Save Changes                                     |
|--------------------------------------------------|
|                                                  |
|  [How do you want to save your changes?]         |
|                                                  |
|  ( ) Save as Document Override      [Recommended]|
|      Only affects this document. The template    |
|      remains unchanged for other documents.      |
|                                                  |
|  ( ) Modify Existing Template                    |
|      Update "Invoice Template" for all documents |
|                                                  |
|  ( ) Create New Template                         |
|      Save as a new template for future use       |
|      [ New template name...              ]       |
|                                                  |
|  [Cancel]                      [Save Changes]    |
+--------------------------------------------------+
```

### 2.2 Override Indicator Badge

When a document has overrides, show a badge in the header:

```
+--------------------------------------------------+
|  Generated Output    [3/5 fields]  [2 overrides] |
|                                      ^^^^^^^^^^^  |
|                                      Amber badge  |
+--------------------------------------------------+
```

### 2.3 Field-Level Override Indicators

In the template output view, overridden fields have distinct styling:

```
Normal extracted field:
+------------------------------------------+
| [check] John Smith                        |  <- Green background
+------------------------------------------+

Overridden field:
+------------------------------------------+
| [edit] John A. Smith  [x]                 |  <- Amber dotted border
|   ^                    ^                  |
|   Override icon        Reset button       |
+------------------------------------------+
```

### 2.4 Inline Field Editing

Double-click any field value to edit it directly:

```
Before click:
| [check] $1,500.00 |

During edit:
| [$1,750.00____]  [Save] [Cancel] |

After save (becomes override):
| [edit] $1,750.00  [x] |
```

### 2.5 Override Management Panel

Collapsible panel showing all overrides with reset options:

```
+--------------------------------------------------+
|  Document Overrides                    [Collapse] |
|--------------------------------------------------|
|  2 field overrides | 0 template changes          |
|                                                  |
|  amount:     $1,500.00 -> $1,750.00    [Reset]   |
|  client_name: John Smith -> John A. Smith [Reset]|
|                                                  |
|  [Reset All Overrides]                           |
+--------------------------------------------------+
```

---

## 3. Component Architecture

### New Components

```
src/features/documents/components/
├── SaveTemplateDialog.tsx          # MODIFY: Add override option
├── TemplateOutputView.tsx          # MODIFY: Add override indicators
├── UnifiedDocumentView.tsx         # MODIFY: Add override management
├── FieldOverrideIndicator.tsx      # NEW: Visual indicator component
├── InlineFieldEditor.tsx           # NEW: Double-click edit component
├── OverrideManagementPanel.tsx     # NEW: Override list with reset
└── DocumentOverrideBadge.tsx       # NEW: Header badge component
```

### New Service

```
src/services/
└── document-override-service.ts    # NEW: Override CRUD operations
```

### Service Interface

```typescript
// document-override-service.ts
export class DocumentOverrideService {
  // Save a field override
  async saveFieldOverride(
    documentId: string,
    fieldName: string,
    newValue: string,
    originalValue?: string
  ): Promise<void>;

  // Save template content override
  async saveTemplateContentOverride(
    documentId: string,
    newContent: string,
    originalContent: string,
    templateId: number
  ): Promise<void>;

  // Reset a single field override
  async resetFieldOverride(
    documentId: string,
    fieldName: string
  ): Promise<void>;

  // Reset all overrides for a document
  async resetAllOverrides(documentId: string): Promise<void>;

  // Get overrides for a document
  async getOverrides(documentId: string): Promise<DocumentOverrides | null>;

  // Check if document has overrides
  async hasOverrides(documentId: string): Promise<boolean>;

  // Get effective field values (merged: extracted + overrides)
  async getEffectiveFieldValues(
    documentId: string,
    extractedFields: Record<string, ExtractedField>
  ): Promise<Record<string, ExtractedField>>;
}
```

---

## 4. User Flow

### Flow 1: Manual Field Edit (Primary Use Case)

```
1. User views document with generated output
2. User notices an extracted value is incorrect
3. User double-clicks the field value
4. Inline editor appears
5. User types the correct value
6. User clicks "Save" or presses Enter
7. Field shows override indicator (amber border)
8. Override is saved to document.metadata.document_overrides
9. Override badge appears in header: "1 override"
```

### Flow 2: Template Content Override

```
1. User is in edit mode (editable=true)
2. User modifies the template structure (adds/removes text, variables)
3. User clicks "Save Template"
4. SaveTemplateDialog appears with 3 options
5. User selects "Save as Document Override" (default/recommended)
6. Content override is saved to document.metadata
7. Template remains unchanged
8. Document shows "Content modified" indicator
```

### Flow 3: Reset Override

```
1. User sees field with override indicator
2. User hovers over field, sees "Reset to original" tooltip
3. User clicks the reset (x) button
4. Confirmation appears: "Reset to 'John Smith'?"
5. User confirms
6. Field returns to original extracted value
7. Override removed from metadata
```

### Flow 4: Reset All Overrides

```
1. User opens Override Management Panel
2. User sees list of all overrides
3. User clicks "Reset All Overrides"
4. Confirmation: "Reset 3 overrides to original values?"
5. User confirms
6. All overrides removed
7. Document returns to pure template-extracted state
```

---

## 5. Visual Design Specifications

### Color Palette

```css
/* Override indicators - Amber/Gold */
--override-bg: oklch(0.95 0.05 85);           /* Light amber background */
--override-border: oklch(0.75 0.15 70);       /* Amber border */
--override-text: oklch(0.45 0.12 60);         /* Dark amber text */
--override-icon: oklch(0.65 0.18 65);         /* Amber icon */

/* Reset button */
--reset-hover: oklch(0.55 0.18 25);           /* Red-ish on hover */

/* Original value (in comparison) */
--original-text: oklch(0.6 0 0);              /* Muted gray */
--original-strikethrough: oklch(0.7 0 0);     /* Light strikethrough */
```

### Field States

| State | Background | Border | Icon |
|-------|------------|--------|------|
| Extracted (no override) | Green-100 | Solid green | Check |
| Overridden | Amber-100 | Dotted amber | Edit/Pen |
| Loading | Blue-100 | Solid blue | Spinner |
| No value | Amber-100 | Dashed amber | Alert |

### Override Badge

```tsx
<Badge
  variant="outline"
  className="border-amber-300 bg-amber-50 text-amber-700 gap-1"
>
  <Pencil className="h-3 w-3" />
  {overrideCount} override{overrideCount !== 1 ? 's' : ''}
</Badge>
```

---

## 6. Implementation Plan

### Phase 1: Data Layer (Day 1)
- [ ] Create DocumentOverrides type definitions
- [ ] Create document-override-service.ts
- [ ] Add override CRUD operations
- [ ] Unit tests for service

### Phase 2: UI Components (Day 2)
- [ ] Create FieldOverrideIndicator component
- [ ] Create InlineFieldEditor component
- [ ] Create DocumentOverrideBadge component
- [ ] Create OverrideManagementPanel component

### Phase 3: Integration (Day 3)
- [ ] Modify SaveTemplateDialog with third option
- [ ] Modify TemplateOutputView for inline editing
- [ ] Modify UnifiedDocumentView for override management
- [ ] Add override indicators to field display

### Phase 4: Testing & Polish (Day 4)
- [ ] Integration tests for override flow
- [ ] Edge cases: multiple overrides, reset, comparison
- [ ] Accessibility audit
- [ ] Performance testing with many overrides

---

## 7. Edge Cases & Considerations

### Template Updates
When the global template is updated:
- **Field overrides**: Keep user overrides, merge with new template variables
- **Template content override**: Show "Template has been updated" warning
- **Option to re-sync**: "Apply template updates while keeping my overrides"

### Override Conflicts
If a template variable is renamed:
- Orphaned overrides are preserved but marked as "unmatched"
- User can manually re-map or delete orphaned overrides

### Performance
- Overrides are stored as JSONB, indexed by document ID
- No additional database queries needed (loaded with document metadata)
- Override comparison is done client-side

### Data Migration
- No database migration needed (uses existing metadata JSONB column)
- Frontend gracefully handles documents without overrides

---

## 8. API Considerations

If the override is applied before document generation (backend side):

```python
# In document-processor FastAPI
@router.post("/generate-with-overrides")
async def generate_document_with_overrides(
    document_id: str,
    template_id: int,
    field_overrides: Optional[Dict[str, str]] = None,
    template_content_override: Optional[str] = None
):
    # Apply overrides before generation
    effective_fields = merge_overrides(extracted_fields, field_overrides)
    effective_content = template_content_override or template.content

    return fill_template(effective_content, effective_fields)
```

---

## Approval Checklist

- [ ] Data model reviewed and approved
- [ ] UI/UX design reviewed and approved
- [ ] Component architecture approved
- [ ] Implementation plan timeline approved
- [ ] Edge cases addressed

---

## Questions for User

1. **Override Persistence**: Should overrides persist if the document is re-processed (re-uploaded or re-extracted)?
   - Option A: Keep overrides, show "re-extracted values differ" warning
   - Option B: Clear overrides on re-process, require manual re-entry

2. **Override Scope**: Should template content overrides be allowed, or only field value overrides?
   - Simpler: Field overrides only
   - Full: Both field and template content overrides

3. **Collaboration**: If multiple users can access the same document, how should overrides be handled?
   - Single user: Whoever saves last wins
   - Track changes: Show who made each override
