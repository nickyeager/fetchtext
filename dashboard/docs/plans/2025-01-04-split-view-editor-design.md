# Split View Document Editor - Design Document

**Date**: 2025-01-04
**Author**: Claude (AI Assistant)
**Status**: Approved

## Overview

Implement a split view document editor with:
1. **Split view layout**: Original document on left, template output on right (side-by-side)
2. **Inline section editing**: Click a section to make it editable (textarea with save/cancel)
3. **Mode dropdown**: Switch between "Override this document" vs "Edit global template"
4. **Resizable panels**: Drag handle between panels (20-80% range)
5. **Single panel option**: Ability to collapse to just one panel

## Architecture: Clean Architecture Approach

### Component Hierarchy

```
SplitDocumentEditor (NEW - Orchestrator)
├── EditorToolbar (NEW)
│   ├── ModeSelector (NEW - Dropdown: Override | Template Edit)
│   ├── LayoutControls (Layout toggle buttons)
│   └── ActionButtons (Save, Export, etc.)
├── SplitPanelContainer (NEW)
│   ├── OriginalDocumentPanel (REUSE - DocumentPreviewPanel)
│   ├── ResizableDivider (NEW - Extracted from DualDocumentView)
│   └── EditableTemplatePanel (TemplateOutputView - Modified)
│       ├── SectionRenderer (NEW)
│       │   ├── TextSection (read-only text)
│       │   └── EditableSection (NEW)
│       │       └── InlineFieldEditor (REUSE)
│       └── SaveTemplateDialog (MODIFY - Add "Override" option)
└── OverrideManagementPanel (EXISTS - reuse as-is)
```

## Files to Create (7 new files)

### 1. ResizableDivider.tsx
**Purpose**: Reusable drag handle component
**Responsibilities**:
- Render vertical drag handle with grip icon
- Handle mouse events for dragging
- Visual feedback on hover

```typescript
interface ResizableDividerProps {
  onDrag: (e: React.MouseEvent) => void
  className?: string
}
```

### 2. ModeSelector.tsx
**Purpose**: Dropdown to select editing mode
**Responsibilities**:
- Display current mode (Override vs Template)
- Provide dropdown to switch modes
- Show description for each mode

```typescript
interface ModeSelectorProps {
  value: 'override' | 'template'
  onChange: (mode: 'override' | 'template') => void
  templateName?: string
  disabled?: boolean
}
```

### 3. EditableSection.tsx
**Purpose**: Click-to-edit text section wrapper
**Responsibilities**:
- Render static text with hover indicator
- Switch to edit mode on click
- Show inline editor with save/cancel
- Apply override styling when modified

```typescript
interface EditableSectionProps {
  sectionId: string
  content: string
  isEditing: boolean
  isOverride?: boolean
  originalContent?: string
  onEdit: (sectionId: string) => void
  onSave: (sectionId: string, newContent: string) => Promise<void>
  onCancel: () => void
  onReset?: (sectionId: string) => void
  readOnly?: boolean
  editMode: 'override' | 'template'
}
```

### 4. SectionRenderer.tsx
**Purpose**: Parse template content into sections
**Responsibilities**:
- Split template into text and variable sections
- Render each section appropriately
- Track section indexes for overrides
- Integrate existing variable badges

```typescript
interface SectionRendererProps {
  content: string
  extractedFields: Record<string, ExtractedField | string | null>
  editingSectionId: string | null
  sectionOverrides?: Record<string, SectionOverride>
  fieldOverrides?: Record<string, FieldOverride>
  editMode: 'override' | 'template'
  onSectionEdit: (sectionId: string) => void
  onSectionSave: (sectionId: string, newContent: string) => Promise<void>
  onSectionCancel: () => void
  onFieldEdit?: (fieldName: string, currentValue: string | number | null) => void
  onFieldOverride?: (fieldName: string, newValue: string, originalValue: string | null) => Promise<void>
  onResetSection?: (sectionId: string) => void
  onResetFieldOverride?: (fieldName: string) => Promise<void>
  readOnly?: boolean
  enableOverrides?: boolean
}
```

### 5. EditorToolbar.tsx
**Purpose**: Top toolbar with controls
**Responsibilities**:
- Render mode selector
- Render layout controls (side-by-side, original-only, output-only)
- Render action buttons (Save, Export)
- Show template name and field count

```typescript
interface EditorToolbarProps {
  editMode: 'override' | 'template'
  onEditModeChange: (mode: 'override' | 'template') => void
  layout: 'side-by-side' | 'original-only' | 'output-only'
  onLayoutChange: (layout: LayoutMode) => void
  templateName?: string
  fieldCount?: { filled: number; total: number }
  overrideCount?: number
  hasChanges: boolean
  onSave?: () => void
  onExport?: () => void
  className?: string
}
```

### 6. SplitPanelContainer.tsx
**Purpose**: Resizable two-panel layout
**Responsibilities**:
- Manage split ratio state
- Handle drag events for resizing
- Conditionally render panels based on layout
- Apply width constraints (20-80%)

```typescript
interface SplitPanelContainerProps {
  layout: 'side-by-side' | 'original-only' | 'output-only'
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  className?: string
}
```

### 7. SplitDocumentEditor.tsx
**Purpose**: Main orchestrator component
**Responsibilities**:
- Manage all editor state (editMode, layout, editing section)
- Coordinate between toolbar and panels
- Handle save operations (override vs template)
- Connect to document override service

```typescript
interface SplitDocumentEditorProps {
  documentId: string
  fileUrl: string | null
  fileName: string
  fileType: string
  fileSize?: number
  templateContent: string
  extractedFields: Record<string, ExtractedField | string | null>
  templateName?: string
  templateId?: number
  documentText?: string
  fieldOverrides?: Record<string, FieldOverride>
  sectionOverrides?: Record<string, SectionOverride>
  onSaveOverride?: (content: string) => Promise<void>
  onSaveTemplate?: (content: string, action: 'create' | 'modify', newName?: string) => Promise<void>
  onFieldOverride?: (fieldName: string, newValue: string, originalValue: string | null) => Promise<void>
  onSectionOverride?: (sectionId: string, newContent: string, originalContent: string) => Promise<void>
  onResetFieldOverride?: (fieldName: string) => Promise<void>
  onResetSectionOverride?: (sectionId: string) => Promise<void>
  onExport?: () => void
  className?: string
}
```

## Files to Modify (2 files)

### 1. SaveTemplateDialog.tsx
**Changes**:
- Add third RadioGroup option: "Save as Document Override"
- Reorder options with "Override" as recommended (first)
- Add visual emphasis (badge) to recommended option
- Update action type: `'override' | 'create' | 'modify'`

### 2. document-override-service.ts
**Changes**:
- Add `saveSectionOverride` method
- Add `resetSectionOverride` method
- Add `SectionOverride` interface

## Data Flow

### Override Mode Save Flow
```
User clicks text section
    ↓
EditableSection enters edit mode
    ↓
InlineFieldEditor appears
    ↓
User edits, clicks Save
    ↓
SplitDocumentEditor.handleSectionSave()
    ↓
Check editMode === 'override'
    ↓
onSectionOverride(sectionId, newContent, originalContent)
    ↓
DocumentOverrideService.saveSectionOverride()
    ↓
Database: documents.field_overrides.sections[sectionId]
    ↓
UI: Section shows amber override styling
```

### Template Edit Mode Save Flow
```
User clicks text section
    ↓
EditableSection enters edit mode
    ↓
User edits, clicks Save
    ↓
SplitDocumentEditor.handleSectionSave()
    ↓
Check editMode === 'template'
    ↓
Reconstruct template content with modification
    ↓
Update local state, hasChanges = true
    ↓
User clicks "Save Template"
    ↓
SaveTemplateDialog opens
    ↓
User selects "Modify" or "Create New"
    ↓
onSaveTemplate(content, action, newName?)
```

## Build Sequence

### Phase 1: Foundation (2-3 hours)
1. ResizableDivider component + tests
2. ModeSelector component + tests

### Phase 2: Section Editing (3-4 hours)
3. EditableSection component + tests
4. SectionRenderer component + tests

### Phase 3: Layout (2-3 hours)
5. EditorToolbar component + tests
6. SplitPanelContainer component + tests

### Phase 4: Orchestration (3-4 hours)
7. SplitDocumentEditor component + tests
8. SaveTemplateDialog modifications + tests

### Phase 5: Integration (2-3 hours)
9. Connect to DocumentDetailView
10. Service layer updates
11. End-to-end testing

## Visual Design

### Mode Selector
```
┌─────────────────────────────────────┐
│ Edit Mode: Override this document ▾ │
└─────────────────────────────────────┘
        ↓ (click to expand)
┌─────────────────────────────────────┐
│ ✓ Override this document            │
│   Only affects this document.       │
│   Template remains unchanged.       │
├─────────────────────────────────────┤
│ ○ Edit global template              │
│   Changes apply to all documents    │
│   using this template.              │
└─────────────────────────────────────┘
```

### Editable Section States
- **Normal**: No border, cursor pointer on hover
- **Hover**: Light blue background (`bg-blue-50`)
- **Editing**: Input field with amber border, Save/Cancel buttons
- **Override**: Amber dotted bottom border (`border-amber-300 border-dotted`)

### Layout Controls
```
[⫿] Side-by-side (default)
[▫▸] Original only
[◂▫] Output only
```

## Testing Strategy

### Unit Tests (per component)
- Render states
- User interactions
- Prop handling
- Edge cases

### Integration Tests
- Override save flow end-to-end
- Template edit flow end-to-end
- Mode switching behavior
- Layout changes

### E2E Tests (Playwright)
- Full user journey
- Database persistence verification

## Success Criteria

1. User can view original document and template output side-by-side
2. User can resize panels by dragging the divider
3. User can click any text section to edit it inline
4. User can choose to save as document override or template edit
5. Override saves persist per-document without affecting template
6. Template edits update the global template
7. All interactions are keyboard accessible
8. Performance: <100ms response for all interactions
