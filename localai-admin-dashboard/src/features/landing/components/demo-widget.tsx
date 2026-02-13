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
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config'

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

      // Call the document analyzer API (no auth required for demo)
      const response = await fetch(`${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/analyze-document`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Processing failed: ${response.status}`)
      }

      const data = await response.json()

      // Transform detected_fields to our display format
      // API returns: { detected_fields: [{name, sample_values, confidence}, ...] }
      const fields: ExtractedField[] = []
      if (data.detected_fields && Array.isArray(data.detected_fields)) {
        for (const field of data.detected_fields) {
          const sampleValue = field.sample_values?.[0]
          if (sampleValue) {
            fields.push({
              field_name: field.name,
              value: String(sampleValue),
              confidence: field.confidence
            })
          }
        }
      }

      // Get processing time from analysis_metadata
      const processingTimeMs = data.analysis_metadata?.analysis_time
        ? data.analysis_metadata.analysis_time * 1000
        : 0

      setResult({
        fields: fields.slice(0, 6), // Limit to 6 fields for display
        processing_time_ms: processingTimeMs,
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
