# Dual Document + Template View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a document detail view that shows both:
1. The **original uploaded document** (PDF/image preview) on one side
2. A **generated template output** with extracted fields laid out on the other side

**User Experience:**
- User views a processed document
- Left panel: Original document (PDF/image) with zoom, pan, download
- Right panel: Template layout showing fields in context with extracted values filled in
- Variables displayed as `{{variable_name}}` chips integrated into the template text
- Can toggle between side-by-side and tabbed views

**Tech Stack:**
- Frontend: React, TypeScript, TanStack Router, shadcn/ui
- Document Preview: iframe for PDF, img for images
- Template Rendering: Custom component that merges template content with extracted values
- Layout: Resizable split pane using CSS grid or react-resizable-panels

---

## Background & Current State

### What Exists
- `DocumentDetailView.tsx` - Main document detail component with multiple view modes
- `DocumentPreviewPanel.tsx` - Shows PDF/image preview with download (just created)
- `TemplateVariablesPanel.tsx` - Shows extracted variables as `{{var}}` chips (just created)
- `DocumentPipelineView.tsx` - Shows template → extraction → output pipeline
- `MarkdownViewer.tsx` - Renders markdown content

### What's Missing
1. **Side-by-side original + processed view** - No dual panel showing original alongside filled template
2. **Template Layout View** - No visual representation of the template with fields in context
3. **Generated Document Preview** - No rendered output showing how the filled template looks

### Target User Experience
```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Document: invoice-2025-001.pdf                       │
│  [Back] [Rerun Extraction] [View: Side-by-Side ▼] [Fullscreen] [Download]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────┐   ┌─────────────────────────────────────┐  │
│  │   Original Document     │   │   Generated Output (Template)       │  │
│  │                         │   │                                     │  │
│  │  ┌───────────────────┐  │   │   INVOICE                           │  │
│  │  │                   │  │   │   ────────                          │  │
│  │  │   [PDF Preview]   │  │   │                                     │  │
│  │  │                   │  │   │   From: {{company_name}}            │  │
│  │  │    Embedded PDF   │  │   │         → "Acme Corp" ✓             │  │
│  │  │    with zoom      │  │   │                                     │  │
│  │  │                   │  │   │   Invoice #: {{invoice_number}}     │  │
│  │  │                   │  │   │              → "INV-2025-001" ✓     │  │
│  │  └───────────────────┘  │   │                                     │  │
│  │                         │   │   Date: {{invoice_date}}            │  │
│  │  [Zoom In] [Zoom Out]   │   │         → "2025-01-15" ✓            │  │
│  │  [Open] [Download]      │   │                                     │  │
│  └─────────────────────────┘   │   Total: {{total_amount}}           │  │
│                                │          → "$1,234.56" ✓             │  │
│                                │                                     │  │
│                                │   [Edit Template] [Export]          │  │
│                                └─────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Task 1: Create TemplateOutputView Component

**Files:**
- Create: `localai-admin-dashboard/src/features/documents/components/TemplateOutputView.tsx`

**Description:** A component that renders the template content with extracted values filled in, showing both the template variable placeholders AND the extracted values.

**Step 1: Create the component**

```typescript
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FileOutput, Check, AlertCircle, Edit, Download, Copy } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExtractedField {
  value: string | null;
  confidence?: number;
  sourceText?: string;
  type?: string;
}

interface TemplateOutputViewProps {
  /** Template content with {{variable}} placeholders */
  templateContent: string;
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>;
  /** Template name */
  templateName?: string;
  /** Template ID for editing */
  templateId?: number;
  /** Whether to show the raw template vs filled */
  showRaw?: boolean;
  /** Handler for editing the template */
  onEditTemplate?: () => void;
  /** Handler for exporting the filled document */
  onExport?: () => void;
  /** Custom class name */
  className?: string;
}

export function TemplateOutputView({
  templateContent,
  extractedFields,
  templateName,
  templateId,
  showRaw = false,
  onEditTemplate,
  onExport,
  className,
}: TemplateOutputViewProps) {
  // Normalize fields to consistent structure
  const normalizedFields = useMemo(() => {
    const result: Record<string, ExtractedField> = {};
    for (const [key, value] of Object.entries(extractedFields)) {
      if (value === null || value === undefined) {
        result[key] = { value: null };
      } else if (typeof value === 'string') {
        result[key] = { value };
      } else if (typeof value === 'object' && 'value' in value) {
        result[key] = value as ExtractedField;
      } else {
        result[key] = { value: JSON.stringify(value) };
      }
    }
    return result;
  }, [extractedFields]);

  // Parse template content and replace variables with interactive elements
  const renderedContent = useMemo(() => {
    if (!templateContent) return null;

    // Split content by variable placeholders
    const parts: Array<{ type: 'text' | 'variable'; content: string; field?: ExtractedField }> = [];
    const regex = /\{\{(\w+)\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(templateContent)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: templateContent.slice(lastIndex, match.index),
        });
      }

      // Add the variable
      const varName = match[1];
      const field = normalizedFields[varName] || { value: null };
      parts.push({
        type: 'variable',
        content: varName,
        field,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < templateContent.length) {
      parts.push({
        type: 'text',
        content: templateContent.slice(lastIndex),
      });
    }

    return parts;
  }, [templateContent, normalizedFields]);

  const filledCount = Object.values(normalizedFields).filter(f => f.value).length;
  const totalCount = Object.keys(normalizedFields).length;

  const getConfidenceColor = (conf?: number) => {
    if (!conf) return 'text-muted-foreground';
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400';
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const copyToClipboard = async () => {
    // Generate filled text for clipboard
    let filledText = templateContent;
    for (const [key, field] of Object.entries(normalizedFields)) {
      const placeholder = `{{${key}}}`;
      const value = field.value || `[${key}]`;
      filledText = filledText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    await navigator.clipboard.writeText(filledText);
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            Generated Output
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filledCount}/{totalCount} fields
            </Badge>
            {onEditTemplate && templateId && (
              <Button variant="outline" size="sm" onClick={onEditTemplate}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
            {onExport && (
              <Button variant="default" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
        {templateName && (
          <p className="text-sm text-muted-foreground">
            Template: <span className="font-medium">{templateName}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/30 rounded-lg font-mono text-sm whitespace-pre-wrap">
            <TooltipProvider delayDuration={200}>
              {renderedContent?.map((part, index) => {
                if (part.type === 'text') {
                  return <span key={index}>{part.content}</span>;
                }

                const field = part.field!;
                const hasValue = field.value !== null && field.value !== '';
                const confidencePercent = field.confidence ? Math.round(field.confidence * 100) : null;

                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded mx-0.5',
                          'transition-colors cursor-help',
                          hasValue
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 border-dashed'
                        )}
                      >
                        {showRaw ? (
                          <span>{`{{${part.content}}}`}</span>
                        ) : hasValue ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>{field.value}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            <span className="italic">{`{{${part.content}}}`}</span>
                          </>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm p-3 space-y-2">
                      <div className="font-mono text-xs text-muted-foreground">
                        {part.content}
                      </div>
                      {hasValue ? (
                        <>
                          <div className="font-medium text-sm border-l-2 border-primary pl-2">
                            {field.value}
                          </div>
                          {confidencePercent !== null && (
                            <div className={cn('text-xs', getConfidenceColor(field.confidence))}>
                              {confidencePercent}% confidence
                            </div>
                          )}
                          {field.sourceText && (
                            <div className="text-xs text-muted-foreground border-t pt-2">
                              Source: "{field.sourceText}"
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-muted-foreground text-sm italic">
                          No value extracted
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Export from index**

Add to `localai-admin-dashboard/src/features/documents/components/index.ts`:

```typescript
export { TemplateOutputView } from './TemplateOutputView';
```

**Step 3: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

---

## Task 2: Create DualDocumentView Component

**Files:**
- Create: `localai-admin-dashboard/src/features/documents/components/DualDocumentView.tsx`

**Description:** A layout component that shows the original document preview side-by-side with the template output view.

**Step 1: Create the component**

```typescript
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PanelLeftClose,
  PanelRightClose,
  Columns,
  Rows,
  GripVertical,
} from 'lucide-react';
import { DocumentPreviewPanel } from './DocumentPreviewPanel';
import { TemplateOutputView } from './TemplateOutputView';

interface ExtractedField {
  value: string | null;
  confidence?: number;
  sourceText?: string;
  type?: string;
}

interface DualDocumentViewProps {
  /** Original document file URL */
  fileUrl: string | null;
  /** Original document file name */
  fileName: string;
  /** Original document file type */
  fileType: string;
  /** Original document file size */
  fileSize?: number;
  /** Template content with {{variable}} placeholders */
  templateContent: string;
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>;
  /** Template name */
  templateName?: string;
  /** Template ID */
  templateId?: number;
  /** Handler for editing template */
  onEditTemplate?: () => void;
  /** Handler for export */
  onExport?: () => void;
  /** Custom class name */
  className?: string;
}

type LayoutMode = 'side-by-side' | 'stacked' | 'original-only' | 'output-only';

export function DualDocumentView({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  templateContent,
  extractedFields,
  templateName,
  templateId,
  onEditTemplate,
  onExport,
  className,
}: DualDocumentViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('side-by-side');
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for left panel

  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = splitRatio;
    const container = e.currentTarget.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newRatio = Math.max(20, Math.min(80, startRatio + deltaPercent));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Layout Controls */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button
          variant={layout === 'side-by-side' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('side-by-side')}
          title="Side by side view"
        >
          <Columns className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === 'stacked' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('stacked')}
          title="Stacked view"
        >
          <Rows className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === 'original-only' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('original-only')}
          title="Original only"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === 'output-only' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('output-only')}
          title="Output only"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div
        className={cn(
          'flex-1 min-h-0',
          layout === 'side-by-side' && 'flex gap-0 relative',
          layout === 'stacked' && 'flex flex-col gap-4'
        )}
      >
        {/* Original Document Panel */}
        {layout !== 'output-only' && (
          <div
            className={cn(
              layout === 'side-by-side' && 'overflow-hidden',
              layout === 'stacked' && 'flex-1 min-h-[300px]',
              layout === 'original-only' && 'h-full'
            )}
            style={
              layout === 'side-by-side'
                ? { width: `${splitRatio}%` }
                : undefined
            }
          >
            <DocumentPreviewPanel
              fileUrl={fileUrl}
              fileName={fileName}
              fileType={fileType}
              fileSize={fileSize}
              className="h-full"
            />
          </div>
        )}

        {/* Resizable Divider (side-by-side only) */}
        {layout === 'side-by-side' && (
          <div
            className="w-2 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center transition-colors"
            onMouseDown={handleDrag}
          >
            <GripVertical className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        {/* Template Output Panel */}
        {layout !== 'original-only' && (
          <div
            className={cn(
              layout === 'side-by-side' && 'flex-1 overflow-hidden',
              layout === 'stacked' && 'flex-1 min-h-[300px]',
              layout === 'output-only' && 'h-full'
            )}
            style={
              layout === 'side-by-side'
                ? { width: `${100 - splitRatio}%` }
                : undefined
            }
          >
            <TemplateOutputView
              templateContent={templateContent}
              extractedFields={extractedFields}
              templateName={templateName}
              templateId={templateId}
              onEditTemplate={onEditTemplate}
              onExport={onExport}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Export from index**

Add to index.ts:

```typescript
export { DualDocumentView } from './DualDocumentView';
```

**Step 3: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

---

## Task 3: Integrate DualDocumentView into DocumentDetailView

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx`

**Description:** Add a new view mode that uses the DualDocumentView component.

**Step 1: Add import**

```typescript
import { DualDocumentView } from './DualDocumentView';
```

**Step 2: Update viewMode type**

Find the viewMode state declaration and update:

```typescript
const [viewMode, setViewMode] = useState<'side-by-side' | 'tabs' | 'overlay' | 'pipeline' | 'dual'>('dual');
```

**Step 3: Add renderDualView function**

Add this function alongside the other render functions:

```typescript
const renderDualView = () => {
  const { extractedFields } = comprehensiveFieldDetection;
  const metadata = document?.metadata as Record<string, unknown> | undefined;
  const templateName = metadata?.template_name as string | undefined;
  const templateId = metadata?.template_id as number | undefined;

  // Get template content - use original text if no template
  let templateContent = documentContent.original.text || '';

  // If we have a formatted output with template variables, use that
  if (formattedOutput && formattedOutput.includes('{{')) {
    templateContent = formattedOutput;
  }

  return (
    <DualDocumentView
      fileUrl={documentFileUrl}
      fileName={document?.name || 'document'}
      fileType={document?.file_type || 'application/pdf'}
      fileSize={document?.file_size}
      templateContent={templateContent}
      extractedFields={extractedFields}
      templateName={templateName}
      templateId={templateId}
      onEditTemplate={templateId ? () => navigateToTemplateEdit(templateId) : undefined}
      onExport={() => handleDownload('html')}
      className="h-[70vh]"
    />
  );
};
```

**Step 4: Update view mode toggle button**

Find the view mode toggle button section and update to include 'dual':

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const modes: Array<'dual' | 'side-by-side' | 'tabs' | 'pipeline'> = ['dual', 'side-by-side', 'tabs', 'pipeline'];
    const currentIndex = modes.indexOf(viewMode as 'dual' | 'side-by-side' | 'tabs' | 'pipeline');
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  }}
  className="flex-1 sm:flex-none"
>
  {viewMode === 'dual' ? (
    <>
      <Columns className="w-4 h-4 mr-2" />
      Dual
    </>
  ) : viewMode === 'pipeline' ? (
    // ... existing pipeline case
  ) : // ... other cases
  }
</Button>
```

**Step 5: Update content area rendering**

Find the content area rendering and add the dual case:

```typescript
{/* Content Area */}
<div className="flex-1">
  {viewMode === 'dual' ? (
    renderDualView()
  ) : viewMode === 'pipeline' ? (
    renderPipelineView()
  ) : viewMode === 'side-by-side' ? (
    renderSideBySideView()
  ) : (
    renderTabsView()
  )}
</div>
```

**Step 6: Add Columns import**

```typescript
import { Columns } from 'lucide-react';
```

**Step 7: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

---

## Task 4: Write Component Tests

**Files:**
- Create: `localai-admin-dashboard/src/__tests__/features/documents/TemplateOutputView.test.tsx`
- Create: `localai-admin-dashboard/src/__tests__/features/documents/DualDocumentView.test.tsx`

**Step 1: Create TemplateOutputView test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateOutputView } from '@/features/documents/components/TemplateOutputView';

describe('TemplateOutputView', () => {
  const mockTemplate = `Invoice
From: {{company_name}}
Invoice #: {{invoice_number}}
Date: {{invoice_date}}
Total: {{total_amount}}`;

  const mockFields = {
    company_name: { value: 'Acme Corp', confidence: 0.95 },
    invoice_number: { value: 'INV-001', confidence: 0.88 },
    invoice_date: { value: '2025-01-15', confidence: 0.92 },
    total_amount: { value: null },
  };

  it('displays filled count badge', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplate}
        extractedFields={mockFields}
      />
    );

    expect(screen.getByText('3/4 fields')).toBeInTheDocument();
  });

  it('renders template with extracted values', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplate}
        extractedFields={mockFields}
      />
    );

    // Values should be visible
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
  });

  it('shows missing field indicator for null values', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplate}
        extractedFields={mockFields}
      />
    );

    // total_amount has null value, should show placeholder
    expect(screen.getByText(/\{\{total_amount\}\}/)).toBeInTheDocument();
  });

  it('shows confidence on hover', async () => {
    const user = userEvent.setup();

    render(
      <TemplateOutputView
        templateContent={mockTemplate}
        extractedFields={mockFields}
      />
    );

    const valueElement = screen.getByText('Acme Corp');
    await user.hover(valueElement);

    await waitFor(() => {
      expect(screen.getAllByText(/95%/).length).toBeGreaterThan(0);
    });
  });

  it('displays template name when provided', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplate}
        extractedFields={mockFields}
        templateName="Invoice Template"
      />
    );

    expect(screen.getByText(/Invoice Template/)).toBeInTheDocument();
  });
});
```

**Step 2: Create DualDocumentView test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DualDocumentView } from '@/features/documents/components/DualDocumentView';

describe('DualDocumentView', () => {
  const defaultProps = {
    fileUrl: 'https://example.com/doc.pdf',
    fileName: 'invoice.pdf',
    fileType: 'application/pdf',
    templateContent: 'From: {{company_name}}',
    extractedFields: {
      company_name: { value: 'Acme Corp', confidence: 0.95 },
    },
  };

  it('renders both document preview and template output panels', () => {
    render(<DualDocumentView {...defaultProps} />);

    expect(screen.getByText('Document Preview')).toBeInTheDocument();
    expect(screen.getByText('Generated Output')).toBeInTheDocument();
  });

  it('shows layout toggle buttons', () => {
    render(<DualDocumentView {...defaultProps} />);

    // Should have 4 layout buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('can toggle to original-only view', async () => {
    const user = userEvent.setup();

    render(<DualDocumentView {...defaultProps} />);

    // Click original-only button (PanelRightClose)
    const buttons = screen.getAllByRole('button');
    const originalOnlyBtn = buttons.find(b => b.getAttribute('title') === 'Original only');
    expect(originalOnlyBtn).toBeTruthy();

    await user.click(originalOnlyBtn!);

    // Should show document preview but not generated output
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
    expect(screen.queryByText('Generated Output')).not.toBeInTheDocument();
  });

  it('can toggle to output-only view', async () => {
    const user = userEvent.setup();

    render(<DualDocumentView {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    const outputOnlyBtn = buttons.find(b => b.getAttribute('title') === 'Output only');
    expect(outputOnlyBtn).toBeTruthy();

    await user.click(outputOnlyBtn!);

    // Should show generated output but not document preview
    expect(screen.queryByText('Document Preview')).not.toBeInTheDocument();
    expect(screen.getByText('Generated Output')).toBeInTheDocument();
  });

  it('displays extracted value in template output', () => {
    render(<DualDocumentView {...defaultProps} />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });
});
```

**Step 3: Run tests**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx vitest run --environment jsdom src/__tests__/features/documents/
```

---

## Task 5: Manual Testing and Verification

**Step 1: Build the frontend**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

**Step 2: Manual testing checklist**

1. Navigate to http://localhost:5173
2. Login with test credentials
3. Go to Documents page
4. Click on any processed document (status: completed)
5. Verify the new Dual view mode:

**Dual View:**
- [ ] Shows layout toggle buttons (side-by-side, stacked, original-only, output-only)
- [ ] Original document panel shows PDF/image preview
- [ ] Generated output panel shows template with filled values
- [ ] Filled fields show green background with checkmark
- [ ] Missing fields show amber background with alert icon
- [ ] Hovering over any value shows tooltip with confidence
- [ ] Can resize panels by dragging the divider
- [ ] Can toggle to original-only view
- [ ] Can toggle to output-only view
- [ ] Can toggle to stacked view

**Template Output:**
- [ ] Shows "Generated Output" header
- [ ] Shows template name when available
- [ ] Shows field count badge (e.g., "3/4 fields")
- [ ] Edit button navigates to template editor
- [ ] Copy button copies filled text to clipboard
- [ ] Export button downloads document

---

## Success Criteria

- [ ] DualDocumentView shows original document alongside template output
- [ ] Template variables display with extracted values filled in
- [ ] Filled values have green styling with checkmark
- [ ] Missing values have amber dashed styling with alert icon
- [ ] Hovering over values shows confidence and source text
- [ ] Layout can be toggled between side-by-side, stacked, original-only, output-only
- [ ] Panels can be resized by dragging
- [ ] All tests pass
- [ ] Build succeeds without errors

---

## Future Enhancements

1. **PDF Annotation Overlay** - Highlight where values were extracted from in the original PDF
2. **Side-by-side Highlighting** - When hovering over a field, highlight the corresponding area in the PDF
3. **Live Template Editing** - Edit template content directly in the output view
4. **Multi-page Support** - Navigate between pages in multi-page documents
5. **Comparison Mode** - Compare extraction results from different templates

---

**End of Plan**
