# WYSIWYG Editor with Inline Field Editing

**Date**: 2025-01-04
**Status**: Approved

## Overview

Enhance the split view document editor with:
1. TipTap WYSIWYG rich text editing (reusing existing `TemplateBuilderEditor`)
2. Inline field value editing (variable badge transforms to input on click)

## User Decisions

- **Field editing style**: Inline editing - click directly on variable badge to edit value
- **Rich text approach**: Full WYSIWYG with toolbar (bold, italic, headings, lists)
- **Value edit interaction**: Badge transforms to input, reverts on blur/save

## Architecture

### Data Flow

```
User clicks badge → Badge transforms to input → User edits value →
Blur/Enter saves → Calls onFieldOverride callback → Badge shows new value
```

The existing `fieldOverrides` system tracks per-document value overrides.

### Component Structure

**New Components**:

1. **`EditableVariableBadgeView`**
   - Wraps TipTap VariableBadge node view
   - States: `display` (badge) → `editing` (input)
   - On click: transforms to input, auto-focuses, selects all
   - On blur/Enter: saves value, transforms back
   - On Escape: cancels, reverts to original
   - Shows amber border when overridden

2. **`DocumentTemplateEditor`**
   - Wrapper around `TemplateBuilderEditor` for document context
   - Passes extracted field values and overrides
   - Handles `onFieldOverride` callback

**Modified Components**:

3. **`SplitDocumentEditor`**
   - Replace `SectionRenderer` with `DocumentTemplateEditor`
   - Keep existing toolbar, mode selector, panel controls

### Files to Create

1. `src/features/documents/components/DocumentTemplateEditor.tsx`
2. `src/features/documents/components/EditableVariableBadgeView.tsx`

### Files to Modify

1. `src/lib/tiptap/extensions/VariableBadge.ts` - Add `enableValueEditing`, `onValueChange` options
2. `src/features/templates/components/VariableBadgeNodeView.tsx` - Add editing state
3. `src/features/documents/components/SplitDocumentEditor.tsx` - Use new editor

## User Interaction

### Editing a Field Value

1. User sees variable badge showing extracted value (e.g., `✓ Acme Corp`)
2. User clicks badge → transforms to inline input with value selected
3. User types new value
4. User presses Enter or blurs → value saves, badge reappears with override indicator
5. User presses Escape → cancels, reverts to previous value

### Visual States

| State | Appearance |
|-------|------------|
| Extracted (no override) | Green badge with checkmark |
| Missing value | Amber dashed badge with `{{variable_name}}` |
| Overridden | Amber solid badge with dotted border + reset on hover |
| Editing | Inline input with focus ring |

### Mode Behavior

- **Override mode**: Field edits save as document-specific overrides
- **Template mode**: Field edits disabled (structure only)

## Testing Strategy

- Unit tests for EditableVariableBadgeView
- Integration tests for DocumentTemplateEditor
- Update existing SplitDocumentEditor tests

## Dependencies

Already installed:
- `@tiptap/react`, `@tiptap/starter-kit`
- `@tiptap/extension-placeholder`
- Custom `VariableBadge` and `VariableAutocomplete` extensions
