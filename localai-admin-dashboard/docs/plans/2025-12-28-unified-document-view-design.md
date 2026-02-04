# Unified Document View Design

**Date:** 2025-12-28
**Status:** Approved

## Summary

Replace the 4-button split-screen layout with a simple toggle switch between Original Document and Generated Output views.

## User Requirements

1. **Simple toggle** instead of split screen
2. **Dynamic `{{variable}}` extraction** stays in Generated Output view
3. **Toggle switch UI** (not tabs or icon buttons)
4. **Default to Generated Output** when opening a document

## UI Design

```
┌─────────────────────────────────────────────────────────┐
│  [Header: Document Name, Status, Actions]               │
│                                                         │
│  Original ○────────● Output                             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │     [Full-width content area]                     │  │
│  │                                                   │  │
│  │     Shows either:                                 │  │
│  │     - PDF/Image viewer (Original)                 │  │
│  │     - Template with filled variables (Output)     │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Toggle Behavior

- **Default state**: Output (right position, checked)
- **Toggle left**: Shows original document (PDF/image)
- **Toggle right**: Shows generated output with editable `{{variable}}` support

## Implementation

### Files to Change

| File | Action | Description |
|------|--------|-------------|
| `UnifiedDocumentView.tsx` | Create | New component replacing DualDocumentView |
| `DocumentDetailView.tsx` | Modify | Swap import from DualDocumentView to UnifiedDocumentView |
| `DualDocumentView.tsx` | Delete | Remove after migration |

### Component Structure

```tsx
function UnifiedDocumentView({
  fileUrl, fileName, fileType, fileSize,
  templateContent, extractedFields, templateName, templateId,
  onEditTemplate, onExport, className,
  documentText, editable, onTemplateChange, onFieldsChange, onSaveTemplate
}) {
  const [showOutput, setShowOutput] = useState(true) // Default: Output

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toggle Switch */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <span className={cn('text-sm', !showOutput && 'font-medium')}>
          Original
        </span>
        <Switch checked={showOutput} onCheckedChange={setShowOutput} />
        <span className={cn('text-sm', showOutput && 'font-medium')}>
          Output
        </span>
      </div>

      {/* Content Area - conditionally render one or the other */}
      <div className="flex-1 min-h-0">
        {showOutput ? (
          <TemplateOutputView
            templateContent={templateContent}
            extractedFields={extractedFields}
            templateName={templateName}
            templateId={templateId}
            onEditTemplate={onEditTemplate}
            onExport={onExport}
            className="h-full"
            documentText={documentText}
            editable={editable}
            onTemplateChange={onTemplateChange}
            onFieldsChange={onFieldsChange}
            onSaveTemplate={onSaveTemplate}
          />
        ) : (
          <DocumentPreviewPanel
            fileUrl={fileUrl}
            fileName={fileName}
            fileType={fileType}
            fileSize={fileSize}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
```

### What Stays the Same

- `TemplateOutputView.tsx` - No changes (already has `{{variable}}` extraction)
- `DocumentPreviewPanel.tsx` - No changes
- All extraction/save logic - No changes
- Props interface - Same props, just passed through differently

## Scope

### In Scope

- Replace 4-button layout with toggle switch
- Single full-width content area (no split)
- Default to Output view
- Keep `{{variable}}` editing in Output view

### Out of Scope

- Changes to extraction logic
- New features for TemplateOutputView
- Backend changes
- Mobile-specific layouts

## Testing

1. Navigate to document detail page
2. Verify default view is Generated Output
3. Toggle to Original - verify PDF/image displays
4. Toggle back to Output - verify template with variables displays
5. Type `{{new_variable}}` - verify extraction still works
6. Save template - verify save dialog still works
