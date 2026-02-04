# Template Builder with Tag Badges - Implementation Plan

## Overview

Replace React-Quill with TipTap to create a WYSIWYG Template Builder with interactive Tag Badges for template variables.

### Feature Summary

1. **WYSIWYG Editor** - TipTap-based rich text editing for template content
2. **Tag Badges** - `{{variable}}` displayed as interactive styled badges
3. **Autocomplete** - Type `{{` to trigger variable suggestions
4. **Hover Preview** - Shows extracted value on hover
5. **Format Selection** - Click badge to configure display format (date, currency, etc.)
6. **Format Storage** - Saved in `SmartVariable.post_processing.transform`
7. **Save as SmartTemplate** - With unique name validation, reusable for future uploads

---

## Phase 1: Foundation Setup

### Task 1.1: Install TipTap Dependencies

**File:** `localai-admin-dashboard/package.json`

```bash
cd localai-admin-dashboard
pnpm add @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/pm
```

**Dependencies to add:**
- `@tiptap/core` - Core editor functionality
- `@tiptap/react` - React bindings
- `@tiptap/starter-kit` - Common extensions (bold, italic, lists, etc.)
- `@tiptap/extension-placeholder` - Placeholder text
- `@tiptap/pm` - ProseMirror utilities

### Task 1.2: Create Variable Badge Extension

**File:** `localai-admin-dashboard/src/lib/tiptap/extensions/VariableBadge.ts`

Creates a custom TipTap node that:
- Renders as inline atomic element
- Stores variableId, variableName, format attributes
- Uses React component for rendering

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VariableBadgeNodeView } from '@/features/templates/components/VariableBadgeNodeView';

export interface VariableBadgeOptions {
  HTMLAttributes: Record<string, any>;
}

export const VariableBadge = Node.create<VariableBadgeOptions>({
  name: 'variableBadge',
  group: 'inline',
  inline: true,
  atom: true, // Cannot be edited directly, treated as single unit

  addAttributes() {
    return {
      variableId: { default: null },
      variableName: { default: null },
      format: { default: 'raw' },
    };
  },

  parseHTML() {
    return [{ tag: 'variable-badge' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['variable-badge', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableBadgeNodeView);
  },
});
```

### Task 1.3: Create Variable Badge React Component

**File:** `localai-admin-dashboard/src/features/templates/components/VariableBadgeNodeView.tsx`

React component that renders the badge with:
- Styled badge appearance
- Hover tooltip showing extracted value
- Click handler to open format dialog

```typescript
import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VariableBadgeNodeViewProps {
  node: {
    attrs: {
      variableId: string;
      variableName: string;
      format: string;
    };
  };
  selected: boolean;
  extension: any;
}

export function VariableBadgeNodeView({
  node,
  selected,
  extension,
}: VariableBadgeNodeViewProps) {
  const { variableId, variableName, format } = node.attrs;
  const extractedValue = extension.options.extractedData?.[variableId];

  const handleClick = () => {
    extension.options.onVariableClick?.(variableId);
  };

  return (
    <NodeViewWrapper className="inline">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              className={cn(
                'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md mx-0.5',
                'font-mono text-sm transition-all cursor-pointer',
                'bg-primary/10 text-primary border border-primary/20',
                'hover:bg-primary/20 hover:border-primary/40',
                selected && 'ring-2 ring-primary ring-offset-1'
              )}
            >
              <span className="text-primary/60">{'{'}</span>
              <span className="text-primary/60">{'{'}</span>
              <span>{variableName}</span>
              <span className="text-primary/60">{'}'}</span>
              <span className="text-primary/60">{'}'}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-mono text-xs text-muted-foreground">{variableId}</p>
              {format !== 'raw' && (
                <Badge variant="outline" className="text-xs">
                  Format: {format}
                </Badge>
              )}
              {extractedValue ? (
                <p className="text-sm font-medium border-l-2 border-primary pl-2">
                  {extractedValue}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No value extracted</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </NodeViewWrapper>
  );
}
```

---

## Phase 2: Autocomplete System

### Task 2.1: Create Autocomplete Extension

**File:** `localai-admin-dashboard/src/lib/tiptap/extensions/VariableAutocomplete.ts`

Detects `{{` trigger and shows variable suggestions:

```typescript
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { SmartVariable } from '@/types/unified-template';

export interface VariableAutocompleteOptions {
  variables: SmartVariable[];
  onSelect: (variable: SmartVariable) => void;
}

export const VariableAutocomplete = Extension.create<VariableAutocompleteOptions>({
  name: 'variableAutocomplete',

  addOptions() {
    return {
      variables: [],
      onSelect: () => {},
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '{{',
        items: ({ query }) => {
          return this.options.variables
            .filter(v =>
              v.name.toLowerCase().includes(query.toLowerCase()) ||
              v.id.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 8);
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'variableBadge',
              attrs: {
                variableId: props.id,
                variableName: props.name,
                format: props.post_processing?.transform || 'raw',
              },
            })
            .run();
        },
        render: () => {
          // Return render functions for the suggestion popup
          // Implementation uses React portal
        },
      }),
    ];
  },
});
```

### Task 2.2: Create Autocomplete Popover Component

**File:** `localai-admin-dashboard/src/features/templates/components/VariableAutocompletePopover.tsx`

React component for the autocomplete dropdown:

```typescript
import React from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import type { SmartVariable } from '@/types/unified-template';

interface VariableAutocompletePopoverProps {
  items: SmartVariable[];
  selectedIndex: number;
  onSelect: (variable: SmartVariable) => void;
}

export function VariableAutocompletePopover({
  items,
  selectedIndex,
  onSelect,
}: VariableAutocompletePopoverProps) {
  return (
    <Command className="rounded-lg border shadow-md">
      <CommandList>
        <CommandEmpty>No variables found</CommandEmpty>
        <CommandGroup heading="Variables">
          {items.map((variable, index) => (
            <CommandItem
              key={variable.id}
              onSelect={() => onSelect(variable)}
              className={index === selectedIndex ? 'bg-accent' : ''}
            >
              <span className="font-mono text-sm">{variable.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{variable.type}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
```

---

## Phase 3: Format Configuration

### Task 3.1: Create Format Configuration Dialog

**File:** `localai-admin-dashboard/src/features/templates/components/VariableFormatDialog.tsx`

Dialog for selecting variable display format:

```typescript
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { SmartVariable } from '@/types/unified-template';

interface VariableFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: SmartVariable;
  extractedValue?: any;
  onSave: (variableId: string, format: string) => void;
}

const FORMAT_OPTIONS: Record<string, { label: string; formats: { value: string; label: string }[] }> = {
  date: {
    label: 'Date Formats',
    formats: [
      { value: 'raw', label: 'Raw Value' },
      { value: 'date_short', label: 'MM/DD/YYYY' },
      { value: 'date_long', label: 'January 1, 2025' },
      { value: 'date_iso', label: 'YYYY-MM-DD' },
    ],
  },
  number: {
    label: 'Number Formats',
    formats: [
      { value: 'raw', label: 'Raw Value' },
      { value: 'number_comma', label: '1,234.56' },
      { value: 'number_rounded', label: '1,235' },
    ],
  },
  currency: {
    label: 'Currency Formats',
    formats: [
      { value: 'raw', label: 'Raw Value' },
      { value: 'currency_usd', label: '$1,234.56' },
      { value: 'currency_eur', label: '€1.234,56' },
    ],
  },
  text: {
    label: 'Text Formats',
    formats: [
      { value: 'raw', label: 'Raw Value' },
      { value: 'uppercase', label: 'UPPERCASE' },
      { value: 'lowercase', label: 'lowercase' },
      { value: 'capitalize', label: 'Title Case' },
    ],
  },
  phone: {
    label: 'Phone Formats',
    formats: [
      { value: 'raw', label: 'Raw Value' },
      { value: 'phone_us', label: '(555) 123-4567' },
      { value: 'phone_intl', label: '+1 555 123 4567' },
    ],
  },
};

export function VariableFormatDialog({
  open,
  onOpenChange,
  variable,
  extractedValue,
  onSave,
}: VariableFormatDialogProps) {
  const [selectedFormat, setSelectedFormat] = React.useState(
    variable.post_processing?.transform || 'raw'
  );

  const formatOptions = FORMAT_OPTIONS[variable.type] || FORMAT_OPTIONS.text;

  const handleSave = () => {
    onSave(variable.id, selectedFormat);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Display Format</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{variable.name}</Badge>
            <span className="text-sm text-muted-foreground">Type: {variable.type}</span>
          </div>

          <div className="space-y-2">
            <Label>Display Format</Label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.formats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {extractedValue && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-3 bg-muted rounded-md font-mono text-sm">
                {formatValue(extractedValue, selectedFormat)}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Format</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatValue(value: any, format: string): string {
  // Format transformation logic
  // Will be implemented in a utility function
  return String(value);
}
```

### Task 3.2: Create Format Utility Functions

**File:** `localai-admin-dashboard/src/lib/format-utils.ts`

```typescript
export function formatValue(value: any, format: string): string {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'raw':
      return String(value);

    // Text formats
    case 'uppercase':
      return String(value).toUpperCase();
    case 'lowercase':
      return String(value).toLowerCase();
    case 'capitalize':
      return String(value)
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    // Date formats
    case 'date_short':
      return new Date(value).toLocaleDateString('en-US');
    case 'date_long':
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'date_iso':
      return new Date(value).toISOString().split('T')[0];

    // Number formats
    case 'number_comma':
      return new Intl.NumberFormat('en-US').format(Number(value));
    case 'number_rounded':
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value));

    // Currency formats
    case 'currency_usd':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
    case 'currency_eur':
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(value));

    // Phone formats
    case 'phone_us':
      const cleaned = String(value).replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      return String(value);
    case 'phone_intl':
      const digits = String(value).replace(/\D/g, '');
      if (digits.length === 10) {
        return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      }
      return String(value);

    default:
      return String(value);
  }
}
```

---

## Phase 4: Template Builder Editor

### Task 4.1: Create Template Builder Editor Component

**File:** `localai-admin-dashboard/src/features/templates/components/TemplateBuilderEditor.tsx`

Main TipTap editor wrapper:

```typescript
import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Undo, Redo } from 'lucide-react';
import { VariableBadge } from '@/lib/tiptap/extensions/VariableBadge';
import { VariableAutocomplete } from '@/lib/tiptap/extensions/VariableAutocomplete';
import { VariableFormatDialog } from './VariableFormatDialog';
import type { SmartVariable } from '@/types/unified-template';
import { cn } from '@/lib/utils';

interface TemplateBuilderEditorProps {
  content: string;
  onChange: (content: string) => void;
  variables: SmartVariable[];
  onVariableFormatChange: (variableId: string, format: string) => void;
  extractedData?: Record<string, any>;
  readOnly?: boolean;
}

export function TemplateBuilderEditor({
  content,
  onChange,
  variables,
  onVariableFormatChange,
  extractedData = {},
  readOnly = false,
}: TemplateBuilderEditorProps) {
  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null);
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);

  const handleVariableClick = useCallback((variableId: string) => {
    setSelectedVariableId(variableId);
    setFormatDialogOpen(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Type your template content here. Use {{ to insert variables...',
      }),
      VariableBadge.configure({
        extractedData,
        onVariableClick: handleVariableClick,
      }),
      VariableAutocomplete.configure({
        variables,
        onSelect: (variable) => {
          console.log('Variable selected:', variable.name);
        },
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const selectedVariable = variables.find(v => v.id === selectedVariableId);

  if (!editor) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Template Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        {!readOnly && (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(editor.isActive('bold') && 'bg-muted')}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(editor.isActive('italic') && 'bg-muted')}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={cn(editor.isActive('heading', { level: 1 }) && 'bg-muted')}
              >
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(editor.isActive('heading', { level: 2 }) && 'bg-muted')}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(editor.isActive('bulletList') && 'bg-muted')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(editor.isActive('orderedList') && 'bg-muted')}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
            <Separator />
          </>
        )}

        {/* Editor */}
        <EditorContent
          editor={editor}
          className={cn(
            'min-h-[300px] max-h-[500px] overflow-y-auto',
            'prose prose-sm dark:prose-invert max-w-none',
            'p-4 border rounded-lg focus-within:ring-2 focus-within:ring-ring',
            readOnly && 'bg-muted/30'
          )}
        />

        {/* Format Dialog */}
        {selectedVariable && (
          <VariableFormatDialog
            open={formatDialogOpen}
            onOpenChange={setFormatDialogOpen}
            variable={selectedVariable}
            extractedValue={extractedData[selectedVariableId!]}
            onSave={onVariableFormatChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Phase 5: Integration

### Task 5.1: Create Variable Library Panel

**File:** `localai-admin-dashboard/src/features/templates/components/VariableLibraryPanel.tsx`

Side panel showing available variables:

```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Variable } from 'lucide-react';
import type { SmartVariable } from '@/types/unified-template';

interface VariableLibraryPanelProps {
  variables: SmartVariable[];
  onInsertVariable: (variable: SmartVariable) => void;
  onAddVariable: () => void;
}

export function VariableLibraryPanel({
  variables,
  onInsertVariable,
  onAddVariable,
}: VariableLibraryPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Variable className="h-5 w-5" />
            Variables
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAddVariable}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {variables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No variables defined yet
              </p>
            ) : (
              variables.map((variable) => (
                <div
                  key={variable.id}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{variable.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {variable.type}
                      </Badge>
                      {variable.post_processing?.transform && (
                        <Badge variant="secondary" className="text-xs">
                          {variable.post_processing.transform}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onInsertVariable(variable)}
                  >
                    Insert
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

### Task 5.2: Update TemplateEditor to Use New Components

**File:** `localai-admin-dashboard/src/components/templates/TemplateEditor.tsx`

Replace the Textarea with TemplateBuilderEditor. Key changes:

1. Import new components
2. Replace Textarea with TemplateBuilderEditor
3. Add handleVariableFormatChange function
4. Pass variables and extractedData to editor

---

## Phase 6: Remove React-Quill Completely

### Task 6.1: Remove Quill Dependencies from package.json

**File:** `localai-admin-dashboard/package.json`

Remove these dependencies:
```bash
cd localai-admin-dashboard
pnpm remove quill react-quill-new
```

Lines to remove:
- `"quill": "^2.0.3"` (line 83)
- `"react-quill-new": "^3.6.0"` (line 89)

### Task 6.2: Delete WysiwygEditor.tsx

**File to DELETE:** `localai-admin-dashboard/src/features/documents/components/WysiwygEditor.tsx`

This file contains:
- `WysiwygEditor` component (main Quill wrapper)
- `DocumentEditor` component (pre-configured variant)
- `SimpleEditor` component (pre-configured variant)

All will be replaced by TipTap-based components.

### Task 6.3: Create Simple TipTap Editor for DocumentDetailView

**File:** `localai-admin-dashboard/src/components/ui/simple-editor.tsx`

A basic TipTap editor without variable support (for simple document editing):

```typescript
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';

interface SimpleEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export function SimpleEditor({
  value = '',
  onChange,
  placeholder = 'Enter text...',
  readOnly = false,
  className,
}: SimpleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Sync external value changes
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return <div className={cn('h-64 bg-muted animate-pulse rounded-lg', className)} />;
  }

  return (
    <EditorContent
      editor={editor}
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'min-h-[200px] p-4 border rounded-lg',
        'focus-within:ring-2 focus-within:ring-ring',
        readOnly && 'bg-muted/30',
        className
      )}
    />
  );
}
```

### Task 6.4: Update DocumentDetailView.tsx

**File:** `localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx`

**Changes required:**

1. **Update import** (line 40):
```typescript
// BEFORE:
import { WysiwygEditor } from './WysiwygEditor';

// AFTER:
import { SimpleEditor } from '@/components/ui/simple-editor';
```

2. **Replace WysiwygEditor usage** (lines 1676-1679):
```typescript
// BEFORE:
<WysiwygEditor
  value={editedContent}
  onChange={setEditedContent}
  placeholder="Enter processed document content..."

// AFTER:
<SimpleEditor
  value={editedContent}
  onChange={setEditedContent}
  placeholder="Enter processed document content..."
```

3. **Replace second WysiwygEditor usage** (lines 1820-1823):
```typescript
// BEFORE:
<WysiwygEditor
  value={editedContent}
  onChange={setEditedContent}
  placeholder="Enter processed document content..."

// AFTER:
<SimpleEditor
  value={editedContent}
  onChange={setEditedContent}
  placeholder="Enter processed document content..."
```

---

## File Summary

### New Files (10)

| File | Purpose |
|------|---------|
| `src/lib/tiptap/extensions/VariableBadge.ts` | Custom TipTap node for variable badges |
| `src/lib/tiptap/extensions/VariableAutocomplete.ts` | Autocomplete extension for `{{` trigger |
| `src/lib/tiptap/index.ts` | Export all TipTap extensions |
| `src/lib/format-utils.ts` | Format transformation utilities |
| `src/components/ui/simple-editor.tsx` | Basic TipTap editor (replaces WysiwygEditor) |
| `src/features/templates/components/VariableBadgeNodeView.tsx` | React component for badge rendering |
| `src/features/templates/components/VariableAutocompletePopover.tsx` | Autocomplete dropdown component |
| `src/features/templates/components/VariableFormatDialog.tsx` | Format configuration dialog |
| `src/features/templates/components/TemplateBuilderEditor.tsx` | Main TipTap editor wrapper with variables |
| `src/features/templates/components/VariableLibraryPanel.tsx` | Side panel for variables |

### Modified Files (3)

| File | Changes |
|------|---------|
| `package.json` | Add TipTap deps, remove quill and react-quill-new |
| `src/components/templates/TemplateEditor.tsx` | Replace Textarea with TemplateBuilderEditor |
| `src/features/documents/components/DocumentDetailView.tsx` | Replace WysiwygEditor with SimpleEditor |

### Deleted Files (1)

| File | Reason |
|------|--------|
| `src/features/documents/components/WysiwygEditor.tsx` | Completely replaced by TipTap components |

---

## Build Sequence

### Step 1: Dependencies & Cleanup
- [ ] Install TipTap dependencies (`pnpm add @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/pm`)
- [ ] Remove Quill dependencies (`pnpm remove quill react-quill-new`)

### Step 2: Create SimpleEditor (Quill Replacement)
- [ ] Create `src/components/ui/simple-editor.tsx`
- [ ] Update DocumentDetailView.tsx to use SimpleEditor
- [ ] Delete WysiwygEditor.tsx
- [ ] Test: DocumentDetailView works with new editor

### Step 3: Foundation - Variable Badge
- [ ] Create `src/lib/tiptap/extensions/VariableBadge.ts`
- [ ] Create `src/features/templates/components/VariableBadgeNodeView.tsx`
- [ ] Create `src/lib/tiptap/index.ts` (exports)
- [ ] Test: Badge renders in TipTap editor

### Step 4: Autocomplete System
- [ ] Create `src/lib/tiptap/extensions/VariableAutocomplete.ts`
- [ ] Create `src/features/templates/components/VariableAutocompletePopover.tsx`
- [ ] Test: Type `{{` shows variable suggestions

### Step 5: Format System
- [ ] Create `src/lib/format-utils.ts`
- [ ] Create `src/features/templates/components/VariableFormatDialog.tsx`
- [ ] Test: Click badge opens format dialog with preview

### Step 6: Template Builder Editor
- [ ] Create `src/features/templates/components/TemplateBuilderEditor.tsx`
- [ ] Create `src/features/templates/components/VariableLibraryPanel.tsx`
- [ ] Wire up toolbar, autocomplete, and format dialog
- [ ] Test: Full editor experience works

### Step 7: Integration
- [ ] Update `src/components/templates/TemplateEditor.tsx` to use TemplateBuilderEditor
- [ ] Test: Full template creation and save workflow
- [ ] Test: Existing templates load correctly
- [ ] Run full build (`pnpm build`)

---

## Verification Checklist

- [ ] TipTap editor renders correctly
- [ ] Variables display as styled badges
- [ ] `{{` triggers autocomplete dropdown
- [ ] Arrow keys navigate autocomplete
- [ ] Enter/click inserts variable badge
- [ ] Clicking badge opens format dialog
- [ ] Format selection updates SmartVariable.post_processing.transform
- [ ] Hover on badge shows extracted value preview
- [ ] Template saves to database correctly
- [ ] Unique template name validation works
- [ ] All existing templates still load correctly
