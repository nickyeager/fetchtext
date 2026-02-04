# Homepage Demo Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive demo widget on the landing page that lets visitors upload a document and see extracted data without logging in

**Architecture:** Standalone React component with drag-and-drop upload, calls document processor API directly, displays extracted fields in a polished card. State managed locally with useState, no authentication required for demo endpoint.

**Tech Stack:** React, shadcn/ui (Card, Button, Badge), lucide-react icons, native fetch API

---

## Current State (What Exists)

The landing page hero section at `src/features/landing/landing-page-v2.tsx` (lines 152-177) shows a **static mockup**:
- Decorative card with "Document Processing" header
- Fake progress bars (skeleton placeholders)
- Hardcoded "95% Accuracy" and "10x Faster" stats

## Target State (What We're Building)

Replace the static mockup with an **interactive demo widget**:
1. **Upload Zone** - Drag & drop or click to select file (PDF, image, text)
2. **Processing State** - Show spinner and status during extraction
3. **Results Display** - Show extracted fields in clean format
4. **CTA** - "Sign up to save results" after successful extraction
5. **Error Handling** - Clear error messages for failed extractions

---

## Task 1: Create Demo Widget Component

**Files:**
- Create: `src/features/landing/components/demo-widget.tsx`

**Step 1: Create the component structure**

```typescript
// src/features/landing/components/demo-widget.tsx
import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from '@tanstack/react-router'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react'

type DemoState = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

interface ExtractedField {
  field_name: string
  value: string
  confidence?: number
}

interface DemoResult {
  fields: ExtractedField[]
  processing_time_ms: number
  document_type?: string
}

export function DemoWidget() {
  const [state, setState] = useState<DemoState>('idle')
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const processFile = async (file: File) => {
    setFileName(file.name)
    setState('uploading')
    setError(null)
    setResult(null)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)

      setState('processing')

      // Call the document processor API (no auth required for demo)
      const response = await fetch('http://localhost:8090/api/enhanced-documents/process-with-ai', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Processing failed: ${response.status}`)
      }

      const data = await response.json()

      // Transform response to our format
      const fields: ExtractedField[] = []
      if (data.extracted_fields) {
        for (const [key, value] of Object.entries(data.extracted_fields)) {
          if (value && typeof value === 'object' && 'value' in value) {
            fields.push({
              field_name: key,
              value: String((value as any).value || ''),
              confidence: (value as any).confidence
            })
          } else if (value !== null && value !== undefined) {
            fields.push({
              field_name: key,
              value: String(value)
            })
          }
        }
      }

      setResult({
        fields: fields.slice(0, 6), // Limit to 6 fields for display
        processing_time_ms: data.processing_time_ms || 0,
        document_type: data.document_type
      })
      setState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      setState('error')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const resetDemo = () => {
    setState('idle')
    setResult(null)
    setError(null)
    setFileName(null)
  }

  return (
    <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8">
      <Card className="h-full w-full shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Try It Now</CardTitle>
            </div>
            {state === 'success' && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Extracted
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Idle State - Upload Zone */}
          {state === 'idle' && (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('demo-file-input')?.click()}
            >
              <input
                id="demo-file-input"
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                onChange={handleFileSelect}
              />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a document here</p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse (PDF, images, text)
              </p>
            </div>
          )}

          {/* Processing State */}
          {(state === 'uploading' || state === 'processing') && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 mx-auto mb-3 text-primary animate-spin" />
              <p className="text-sm font-medium">
                {state === 'uploading' ? 'Uploading...' : 'Extracting data...'}
              </p>
              {fileName && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {fileName}
                </p>
              )}
            </div>
          )}

          {/* Success State - Show Results */}
          {state === 'success' && result && (
            <div className="space-y-4">
              {/* Extracted Fields */}
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {result.fields.length > 0 ? (
                  result.fields.map((field, i) => (
                    <div key={i} className="flex justify-between items-start py-1 border-b border-muted last:border-0">
                      <span className="text-xs text-muted-foreground capitalize">
                        {field.field_name.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-medium text-right max-w-[60%] truncate">
                        {field.value || '-'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No fields extracted
                  </p>
                )}
              </div>

              {/* Stats */}
              {result.processing_time_ms > 0 && (
                <div className="flex items-center justify-center gap-4 pt-2">
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {(result.processing_time_ms / 1000).toFixed(1)}s
                  </Badge>
                  {result.document_type && (
                    <Badge variant="outline" className="text-xs">
                      {result.document_type}
                    </Badge>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="pt-2 space-y-2">
                <Button asChild className="w-full" size="sm">
                  <Link to="/sign-up">
                    Sign up to save results
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={resetDemo}
                >
                  Try another document
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center py-6">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
              <p className="text-sm font-medium text-destructive">Processing Failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error || 'Unable to process document'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={resetDemo}
              >
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Task 2: Update Landing Page to Use Demo Widget

**Files:**
- Modify: `src/features/landing/landing-page-v2.tsx`

**Step 1: Import the DemoWidget component**

At the top of the file, add import:
```typescript
import { DemoWidget } from './components/demo-widget'
```

**Step 2: Replace static mockup with DemoWidget**

Find and replace the static mockup (lines 152-176):

```typescript
// OLD CODE (to remove):
<div className="relative">
  <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8">
    <div className="h-full w-full rounded-xl bg-card border shadow-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-primary" />
        <span className="font-semibold">Document Processing</span>
      </div>
      <div className="space-y-2">
        <div className="h-2 bg-muted rounded w-full" />
        <div className="h-2 bg-muted rounded w-4/5" />
        <div className="h-2 bg-muted rounded w-3/5" />
      </div>
      <div className="pt-4 grid grid-cols-2 gap-3">
        <div className="bg-primary/10 rounded p-3 text-center">
          <div className="text-2xl font-bold text-primary">95%</div>
          <div className="text-xs text-muted-foreground">Accuracy</div>
        </div>
        <div className="bg-primary/10 rounded p-3 text-center">
          <div className="text-2xl font-bold text-primary">10x</div>
          <div className="text-xs text-muted-foreground">Faster</div>
        </div>
      </div>
    </div>
  </div>
</div>

// NEW CODE (to add):
<div className="relative">
  <DemoWidget />
</div>
```

---

## Task 3: Add Demo Endpoint to Document Processor (if needed)

**Check first:** Test if the existing endpoint works without authentication.

Run: `curl -X POST -F "file=@test.pdf" http://localhost:8090/api/enhanced-documents/process-with-ai`

**If authentication is required**, we need to add a demo-specific endpoint that:
- Limits file size to 2MB
- Limits processing time to 30 seconds
- Only returns basic extracted fields (no full document storage)
- Rate limits to prevent abuse

**Files (if needed):**
- Modify: `document-processor/app/routers/enhanced_documents.py`

**Step 1: Add demo endpoint (only if needed)**

```python
@router.post("/demo-extract")
async def demo_extract(
    file: UploadFile = File(...),
    request: Request = None
):
    """
    Demo endpoint for homepage widget - no authentication required.
    Limited to 2MB files, returns only extracted fields.
    """
    # Limit file size
    MAX_DEMO_SIZE = 2 * 1024 * 1024  # 2MB

    content = await file.read()
    if len(content) > MAX_DEMO_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Demo files must be under 2MB. Sign up for larger files."
        )

    # Process document (reuse existing extraction logic)
    start_time = time.time()

    # ... extraction logic ...

    processing_time_ms = (time.time() - start_time) * 1000

    return {
        "extracted_fields": extracted_fields,
        "processing_time_ms": processing_time_ms,
        "document_type": detected_type
    }
```

---

## Task 4: Build and Test

**Step 1: Build the frontend**

Run: `cd localai-admin-dashboard && npx pnpm build`
Expected: Build succeeds with no errors

**Step 2: Manual testing**

1. Navigate to http://localhost:5173 (landing page)
2. Scroll down to hero section
3. Verify the demo widget appears instead of static mockup
4. Test upload flow:
   - Drag and drop a PDF
   - Click to select a file
5. Verify processing state shows spinner
6. Verify extracted fields display after success
7. Click "Sign up to save results" - verify navigation to /sign-up
8. Click "Try another document" - verify reset

**Step 3: Error testing**

1. Upload an unsupported file type
2. Verify error state displays correctly
3. Click "Try again" - verify reset

---

## Success Criteria

After implementation:
- [ ] Demo widget replaces static mockup on landing page
- [ ] Drag and drop file upload works
- [ ] Click to browse file upload works
- [ ] Processing spinner shows during extraction
- [ ] Extracted fields display after success
- [ ] Processing time badge shows
- [ ] "Sign up to save results" navigates to /sign-up
- [ ] "Try another document" resets the widget
- [ ] Error states display correctly
- [ ] No TypeScript errors
- [ ] Build succeeds

---

## Files Summary

**Create:**
- `src/features/landing/components/demo-widget.tsx`

**Modify:**
- `src/features/landing/landing-page-v2.tsx` (import and use DemoWidget)

**Potentially Modify (if auth required):**
- `document-processor/app/routers/enhanced_documents.py` (add demo endpoint)
