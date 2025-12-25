# Template Extraction Workflow View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a document detail view that displays:
1. Template variables as `{{variable_name}}` chips that show extracted values on hover
2. The original uploaded document (PDF/image preview)
3. PDF download functionality for the document

**User Experience:**
- User views a processed document
- Template variables are displayed as interactive `{{variable}}` chips
- Hovering over any chip shows the extracted value, confidence, and source text
- The actual document is displayed in a preview panel
- User can download the document as PDF

**Tech Stack:**
- Frontend: React, TypeScript, TanStack Query, shadcn/ui
- Tooltips: @radix-ui/react-tooltip (via shadcn)
- PDF Preview: Native iframe/embed or react-pdf
- PDF Download: Browser native + jsPDF for image-to-PDF conversion
- Storage: Supabase Storage via signed URLs

---

## Background & Current State

### Current Implementation
- `DocumentDetailView.tsx` displays document details and extracted fields
- `ExtractedFieldsEditor.tsx` shows extracted fields in a form layout
- Documents are stored in Supabase Storage (MinIO backend)
- Extracted fields contain `{value, confidence, sourceText, type}` structure

### What's Missing
1. **Template Variable Chips** - No `{{variable}}` display with hover-to-preview
2. **Document Preview** - Can't see the actual uploaded document inline
3. **PDF Download** - No way to download documents as PDF

### Target User Experience
```
┌─────────────────────────────────────────────────────────────────┐
│                    Document Detail View                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Template Variables (hover for values):                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  {{company_name}}  {{invoice_number}}  {{invoice_date}}  │   │
│  │  {{total_amount}}  {{vendor_name}}     {{line_items}}    │   │
│  └──────────────────────────────────────────────────────────┘   │
│          ↓ hover                                                 │
│     ┌─────────────────────┐                                     │
│     │ "Acme Corporation"  │                                     │
│     │ 95% confidence      │                                     │
│     │ Source: "Acme Corp" │                                     │
│     └─────────────────────┘                                     │
│                                                                  │
│  Document Preview:                     [Open] [Download PDF]    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │              [Embedded PDF/Image Viewer]                  │   │
│  │                                                           │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task 1: Create TemplateVariableChip Component

**Files:**
- Create: `localai-admin-dashboard/src/features/documents/components/TemplateVariableChip.tsx`

**Description:** A reusable component that displays a single variable in `{{curly_brace}}` syntax with hover-to-preview functionality.

**Step 1: Create the component file**

```typescript
import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TemplateVariableChipProps {
  /** Variable name (e.g., "company_name") */
  variableName: string;
  /** Extracted value from the document */
  extractedValue: string | null;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Source text from document */
  sourceText?: string;
  /** Field type */
  fieldType?: string;
  /** Whether the variable is editable */
  editable?: boolean;
  /** Click handler for editing */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
}

export function TemplateVariableChip({
  variableName,
  extractedValue,
  confidence,
  sourceText,
  fieldType,
  editable = false,
  onClick,
  className,
}: TemplateVariableChipProps) {
  const hasValue = extractedValue !== null && extractedValue !== '';
  const confidencePercent = confidence ? Math.round(confidence * 100) : null;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400';
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={!editable && !onClick}
            className={cn(
              'inline-flex items-center gap-0.5 px-2 py-1 rounded-md',
              'font-mono text-sm transition-colors',
              'bg-primary/10 text-primary border border-primary/20',
              'hover:bg-primary/20 hover:border-primary/40',
              editable && 'cursor-pointer',
              !editable && !onClick && 'cursor-default',
              !hasValue && 'opacity-60 border-dashed',
              className
            )}
          >
            <span className="text-primary/60">{'{'}</span>
            <span className="text-primary/60">{'{'}</span>
            <span>{variableName}</span>
            <span className="text-primary/60">{'}'}</span>
            <span className="text-primary/60">{'}'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-sm p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {variableName}
            </span>
            {fieldType && (
              <Badge variant="outline" className="text-xs">
                {fieldType}
              </Badge>
            )}
          </div>

          {hasValue ? (
            <>
              <div className="font-medium text-sm border-l-2 border-primary pl-2">
                {extractedValue}
              </div>
              {confidencePercent !== null && (
                <div className={cn('text-xs flex items-center gap-1', getConfidenceColor(confidence!))}>
                  <span className="font-medium">{confidencePercent}%</span>
                  <span className="text-muted-foreground">confidence</span>
                </div>
              )}
              {sourceText && (
                <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  <span className="font-medium">Source:</span>
                  <span className="italic ml-1">"{sourceText}"</span>
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
    </TooltipProvider>
  );
}
```

**Step 2: Export from index**

Add export to `localai-admin-dashboard/src/features/documents/components/index.ts`:

```typescript
export { TemplateVariableChip } from './TemplateVariableChip';
```

**Step 3: Verify component compiles**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

Expected: Build succeeds with no TypeScript errors

**Step 4: Commit**

```bash
git add localai-admin-dashboard/src/features/documents/components/TemplateVariableChip.tsx
git add localai-admin-dashboard/src/features/documents/components/index.ts
git commit -m "feat: add TemplateVariableChip component with hover-to-preview"
```

---

## Task 2: Create TemplateVariablesPanel Component

**Files:**
- Create: `localai-admin-dashboard/src/features/documents/components/TemplateVariablesPanel.tsx`

**Description:** A panel that displays all extracted fields as `{{variable}}` chips with hover-to-preview.

**Step 1: Create the panel component**

```typescript
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TemplateVariableChip } from './TemplateVariableChip';
import { Badge } from '@/components/ui/badge';
import { Variable } from 'lucide-react';

interface ExtractedField {
  value: string | null;
  confidence?: number;
  sourceText?: string;
  type?: string;
}

interface TemplateVariablesPanelProps {
  /** Panel title */
  title?: string;
  /** Template name (if matched) */
  templateName?: string;
  /** Extracted fields from the document */
  extractedFields: Record<string, ExtractedField | string | null>;
  /** Whether variables are editable */
  editable?: boolean;
  /** Handler when a variable is clicked for editing */
  onVariableClick?: (variableName: string) => void;
  /** Custom class name */
  className?: string;
}

export function TemplateVariablesPanel({
  title = 'Extracted Variables',
  templateName,
  extractedFields,
  editable = false,
  onVariableClick,
  className,
}: TemplateVariablesPanelProps) {
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

  const fieldCount = Object.keys(normalizedFields).length;
  const filledCount = Object.values(normalizedFields).filter(f => f.value).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Variable className="h-5 w-5" />
            {title}
          </CardTitle>
          <Badge variant="secondary">
            {filledCount}/{fieldCount} filled
          </Badge>
        </div>
        {templateName && (
          <p className="text-sm text-muted-foreground">
            Template: <span className="font-medium">{templateName}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Hover over any variable to see its extracted value from this document.
        </p>
        <ScrollArea className="max-h-[200px]">
          <div className="flex flex-wrap gap-2">
            {Object.entries(normalizedFields).map(([name, field]) => (
              <TemplateVariableChip
                key={name}
                variableName={name}
                extractedValue={field.value}
                confidence={field.confidence}
                sourceText={field.sourceText}
                fieldType={field.type}
                editable={editable}
                onClick={onVariableClick ? () => onVariableClick(name) : undefined}
              />
            ))}
          </div>

          {fieldCount === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No variables extracted from this document
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Export from index**

Add to `localai-admin-dashboard/src/features/documents/components/index.ts`:

```typescript
export { TemplateVariablesPanel } from './TemplateVariablesPanel';
```

**Step 3: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add localai-admin-dashboard/src/features/documents/components/TemplateVariablesPanel.tsx
git add localai-admin-dashboard/src/features/documents/components/index.ts
git commit -m "feat: add TemplateVariablesPanel for displaying extracted variables"
```

---

## Task 3: Create DocumentPreviewPanel Component

**Files:**
- Create: `localai-admin-dashboard/src/features/documents/components/DocumentPreviewPanel.tsx`

**Description:** A panel that displays the original uploaded document (PDF/image) with download functionality.

**Step 1: Create the preview component**

```typescript
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentPreviewPanelProps {
  /** Document file URL (signed URL from Supabase storage) */
  fileUrl: string | null;
  /** Document file name */
  fileName: string;
  /** Document file type (mime type) */
  fileType: string;
  /** Document file size in bytes */
  fileSize?: number;
  /** Custom class name */
  className?: string;
}

export function DocumentPreviewPanel({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  className,
}: DocumentPreviewPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i.test(fileName);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!fileUrl) return;

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Ensure .pdf extension for PDF download
      const downloadName = isPdf && !fileName.toLowerCase().endsWith('.pdf')
        ? `${fileName}.pdf`
        : fileName;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleOpenInNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isPdf ? <FileText className="h-5 w-5" /> : <Image className="h-5 w-5" />}
            Document Preview
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              disabled={!fileUrl}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={!fileUrl}
              title="Download document"
            >
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {fileName}
          {fileSize && ` • ${formatFileSize(fileSize)}`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-[400px]">
        {!fileUrl ? (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center p-8">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No document file available</p>
              <p className="text-sm mt-1">The document file could not be loaded</p>
            </div>
          </div>
        ) : hasError ? (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center p-8">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-30 text-destructive" />
              <p className="font-medium">Unable to preview document</p>
              <p className="text-sm mt-1 mb-4">The preview could not be loaded</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in new tab
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full rounded-lg overflow-hidden border bg-muted/10">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading preview...</p>
                </div>
              </div>
            )}

            {isPdf ? (
              <iframe
                src={`${fileUrl}#view=FitH&toolbar=1`}
                className="w-full h-full min-h-[500px]"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                title={`Preview of ${fileName}`}
                style={{ border: 'none' }}
              />
            ) : isImage ? (
              <div className="w-full h-full min-h-[500px] flex items-center justify-center p-4">
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded shadow-sm"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center p-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Preview not available</p>
                  <p className="text-sm mt-1 mb-4">This file type cannot be previewed</p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download to view
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Export from index**

Add to `localai-admin-dashboard/src/features/documents/components/index.ts`:

```typescript
export { DocumentPreviewPanel } from './DocumentPreviewPanel';
```

**Step 3: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add localai-admin-dashboard/src/features/documents/components/DocumentPreviewPanel.tsx
git add localai-admin-dashboard/src/features/documents/components/index.ts
git commit -m "feat: add DocumentPreviewPanel with PDF/image preview and download"
```

---

## Task 4: Integrate Components into DocumentDetailView

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx`

**Description:** Add the TemplateVariablesPanel and DocumentPreviewPanel to show extracted variables with hover preview and the actual document.

**Step 1: Add imports**

Find the imports section (top of file) and add:

```typescript
import { TemplateVariablesPanel } from './TemplateVariablesPanel';
import { DocumentPreviewPanel } from './DocumentPreviewPanel';
```

**Step 2: Add state for document file URL**

Find the state declarations and add:

```typescript
const [documentFileUrl, setDocumentFileUrl] = useState<string | null>(null);
```

**Step 3: Add useEffect to fetch signed URL for document**

Add this effect to get the document file URL from Supabase storage:

```typescript
// Fetch signed URL for document preview
useEffect(() => {
  const fetchDocumentUrl = async () => {
    if (!document?.file_path) {
      setDocumentFileUrl(null);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (error) {
        console.error('[DocumentDetailView] Failed to get signed URL:', error);
        setDocumentFileUrl(null);
        return;
      }

      setDocumentFileUrl(data.signedUrl);
    } catch (error) {
      console.error('[DocumentDetailView] Error getting document URL:', error);
      setDocumentFileUrl(null);
    }
  };

  fetchDocumentUrl();
}, [document?.file_path]);
```

**Step 4: Add the new panels to the document detail view**

Find the section where document details are displayed. Add the TemplateVariablesPanel and DocumentPreviewPanel:

```typescript
{/* Document content section */}
{document.processing_status === 'completed' && (
  <div className="space-y-6">
    {/* Template Variables Panel - Hover to see values */}
    {Object.keys(extractedFields).length > 0 && (
      <TemplateVariablesPanel
        title="Extracted Variables"
        templateName={document.metadata?.matched_template_name}
        extractedFields={extractedFields}
        editable={false}
        onVariableClick={(variableName) => {
          console.log('[DocumentDetailView] Variable clicked:', variableName);
          // Could scroll to field in editor or highlight it
        }}
      />
    )}

    {/* Document Preview Panel - View and download */}
    <DocumentPreviewPanel
      fileUrl={documentFileUrl}
      fileName={document.name}
      fileType={document.file_type || 'application/pdf'}
      fileSize={document.file_size}
    />

    {/* Existing ExtractedFieldsEditor for detailed editing */}
    {/* ... keep existing editor below ... */}
  </div>
)}
```

**Step 5: Ensure supabase client is imported**

Make sure supabase is available:

```typescript
import { supabase } from '@/lib/supabase';
```

**Step 6: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

Expected: Build succeeds

**Step 7: Commit**

```bash
git add localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx
git commit -m "feat: integrate TemplateVariablesPanel and DocumentPreviewPanel into DocumentDetailView"
```

---

## Task 5: Write Component Tests

**Files:**
- Create: `localai-admin-dashboard/src/__tests__/features/documents/TemplateVariableChip.test.tsx`
- Create: `localai-admin-dashboard/src/__tests__/features/documents/DocumentPreviewPanel.test.tsx`

**Description:** Test the hover tooltip behavior and document preview/download functionality.

**Step 1: Create TemplateVariableChip test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateVariableChip } from '@/features/documents/components/TemplateVariableChip';

describe('TemplateVariableChip', () => {
  it('displays variable name in curly brace syntax', () => {
    render(
      <TemplateVariableChip
        variableName="company_name"
        extractedValue="Acme Corp"
        confidence={0.95}
      />
    );

    expect(screen.getByText('company_name')).toBeInTheDocument();
    // Check curly braces are rendered
    expect(screen.getAllByText('{')).toHaveLength(2);
    expect(screen.getAllByText('}')).toHaveLength(2);
  });

  it('shows extracted value on hover', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="company_name"
        extractedValue="Acme Corp"
        confidence={0.95}
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText(/95%/)).toBeInTheDocument();
    });
  });

  it('shows source text in tooltip when provided', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="company_name"
        extractedValue="Acme Corp"
        confidence={0.95}
        sourceText="Company: Acme Corporation LLC"
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      expect(screen.getByText(/Source:/)).toBeInTheDocument();
      expect(screen.getByText(/"Company: Acme Corporation LLC"/)).toBeInTheDocument();
    });
  });

  it('shows "No value extracted" when value is null', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="missing_field"
        extractedValue={null}
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      expect(screen.getByText('No value extracted')).toBeInTheDocument();
    });
  });

  it('applies dashed border style when no value', () => {
    render(
      <TemplateVariableChip
        variableName="empty_field"
        extractedValue={null}
      />
    );

    const chip = screen.getByRole('button');
    expect(chip).toHaveClass('border-dashed');
  });
});
```

**Step 2: Create DocumentPreviewPanel test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentPreviewPanel } from '@/features/documents/components/DocumentPreviewPanel';

describe('DocumentPreviewPanel', () => {
  it('displays document name and size', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="invoice.pdf"
        fileType="application/pdf"
        fileSize={1024 * 500} // 500 KB
      />
    );

    expect(screen.getByText(/invoice.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/500.0 KB/)).toBeInTheDocument();
  });

  it('shows PDF preview for PDF files', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="invoice.pdf"
        fileType="application/pdf"
      />
    );

    const iframe = screen.getByTitle('Preview of invoice.pdf');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
  });

  it('shows image preview for image files', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/receipt.png"
        fileName="receipt.png"
        fileType="image/png"
      />
    );

    const img = screen.getByAltText('receipt.png');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('shows error state when fileUrl is null', () => {
    render(
      <DocumentPreviewPanel
        fileUrl={null}
        fileName="missing.pdf"
        fileType="application/pdf"
      />
    );

    expect(screen.getByText('No document file available')).toBeInTheDocument();
  });

  it('has download and open buttons', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="invoice.pdf"
        fileType="application/pdf"
      />
    );

    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('disables buttons when no file URL', () => {
    render(
      <DocumentPreviewPanel
        fileUrl={null}
        fileName="missing.pdf"
        fileType="application/pdf"
      />
    );

    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /open/i })).toBeDisabled();
  });
});
```

**Step 3: Run tests**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm test src/__tests__/features/documents/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add localai-admin-dashboard/src/__tests__/features/documents/
git commit -m "test: add tests for TemplateVariableChip and DocumentPreviewPanel"
```

---

## Task 6: Manual Testing and Verification

**Files:**
- None (testing only)

**Description:** Manually verify the complete user workflow in the browser.

**Step 1: Start services**

```bash
python start_services.py --profile cpu
```

**Step 2: Build frontend**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

**Step 3: Manual testing checklist**

1. Navigate to http://localhost:5173
2. Login with test credentials
3. Go to Documents page
4. Click on any processed document (status: completed)
5. Verify the new UI components:

**Template Variables Panel:**
- [ ] Shows "Extracted Variables" header with count badge (e.g., "5/7 filled")
- [ ] Variables display as `{{variable_name}}` chips
- [ ] Filled variables have solid border
- [ ] Empty/missing variables have dashed border and lower opacity
- [ ] Hovering over a chip shows tooltip with:
  - [ ] The extracted value (e.g., "Acme Corp")
  - [ ] Confidence percentage (e.g., "95% confidence")
  - [ ] Source text if available (e.g., Source: "Company: Acme Corporation")
- [ ] Hovering over empty variable shows "No value extracted"

**Document Preview Panel:**
- [ ] Shows "Document Preview" header
- [ ] Displays file name and size
- [ ] Has "Open" button that opens document in new tab
- [ ] Has "Download PDF" button that downloads the file
- [ ] PDF documents show in embedded iframe viewer
- [ ] Image documents show inline preview
- [ ] Loading spinner appears while document loads
- [ ] Error state shows if document fails to load

**Step 4: Document any issues found**

If issues found, create follow-up tasks.

**Step 5: Final commit if any fixes made**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## Success Criteria

- [ ] `{{variable}}` chips display for all extracted fields
- [ ] Hovering shows extracted value, confidence, and source text
- [ ] Variables with values have solid borders, missing values have dashed borders
- [ ] Document preview panel shows PDF/image content inline
- [ ] "Open" button opens document in new browser tab
- [ ] "Download PDF" button downloads the file
- [ ] Loading and error states are handled gracefully
- [ ] All tests pass
- [ ] Build succeeds without errors

---

## Future Enhancements

1. **Inline Variable Editing** - Click a chip to edit its value in a popover
2. **Variable Insertion** - Type `{{` in a text field to see autocomplete of available variables
3. **Image-to-PDF Conversion** - Convert image documents to PDF for download
4. **Bulk Variable Export** - Export all extracted variables as JSON/CSV
5. **Variable Validation** - Show warnings for values that don't match expected format

---

**End of Plan**

Plan saved to: `docs/plans/2025-12-16-template-extraction-workflow-view.md`
