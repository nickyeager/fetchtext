import { useState, useCallback, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoSignupDialog } from './demo-signup-dialog'

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
  const [showSignup, setShowSignup] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Keep a ref to the uploaded file so we can save it after sign-up
  const uploadedFileRef = useRef<File | null>(null)

  const navigate = useNavigate()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const processFile = async (file: File) => {
    uploadedFileRef.current = file
    setFileName(file.name)
    setState('uploading')
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setState('processing')

      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/analyze-document`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 429) {
          throw new Error(
            errorData.detail ||
              'Demo upload limit reached. Sign up for unlimited uploads.'
          )
        }
        throw new Error(
          errorData.detail || `Processing failed: ${response.status}`
        )
      }

      const data = await response.json()

      const fields: ExtractedField[] = []
      if (data.detected_fields && Array.isArray(data.detected_fields)) {
        for (const field of data.detected_fields) {
          const sampleValue = field.sample_values?.[0]
          if (sampleValue) {
            fields.push({
              field_name: field.name,
              value: String(sampleValue),
              confidence: field.confidence,
            })
          }
        }
      }

      const processingTimeMs = data.analysis_metadata?.analysis_time
        ? data.analysis_metadata.analysis_time * 1000
        : 0

      setResult({
        fields: fields.slice(0, 6),
        processing_time_ms: processingTimeMs,
        document_type: data.document_type,
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
    if (file) processFile(file)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    []
  )

  const handleSignupSuccess = async (_user: any, session: any) => {
    setShowSignup(false)
    setIsSaving(true)

    try {
      const file = uploadedFileRef.current
      if (!file || !result) {
        throw new Error('No file or results to save')
      }

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          status: 'completed',
          created_by: session.user.id,
          metadata: {
            document_type: result.document_type,
            processing_time_ms: result.processing_time_ms,
            upload_source: 'demo_widget',
            extracted_fields: {
              extracted_values: Object.fromEntries(
                result.fields.map((f) => [
                  f.field_name,
                  { value: f.value, confidence: f.confidence },
                ])
              ),
            },
          },
        })
        .select()
        .single()

      if (docError) throw docError

      // Upload file to storage
      const storagePath = `${session.user.id}/${doc.id}/${file.name}`
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file)

      if (storageError) {
        console.warn(
          '[DemoWidget] Storage upload failed (non-fatal):',
          storageError
        )
      }

      toast.success('Document saved to your account!')
      navigate({ to: `/documents/${doc.id}` })
    } catch (err) {
      console.error('[DemoWidget] Failed to save demo results:', err)
      toast.error(
        'Failed to save results. Please try uploading again from your dashboard.'
      )
      navigate({ to: '/dashboard' })
    } finally {
      setIsSaving(false)
    }
  }

  const resetDemo = () => {
    setState('idle')
    setResult(null)
    setError(null)
    setFileName(null)
    uploadedFileRef.current = null
  }

  return (
    <>
      <div className='from-primary/20 to-primary/5 aspect-square rounded-2xl bg-gradient-to-br p-8'>
        <Card className='h-full w-full shadow-2xl'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <FileText className='text-primary h-5 w-5' />
                <CardTitle className='text-lg'>Try It Now</CardTitle>
              </div>
              {state === 'success' && (
                <Badge
                  variant='secondary'
                  className='bg-green-100 text-green-800'
                >
                  <CheckCircle className='mr-1 h-3 w-3' />
                  Extracted
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Idle State - Upload Zone */}
            {state === 'idle' && (
              <div
                data-testid='demo-upload-zone'
                className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() =>
                  document.getElementById('demo-file-input')?.click()
                }
              >
                <input
                  id='demo-file-input'
                  type='file'
                  className='hidden'
                  accept='.pdf,.png,.jpg,.jpeg,.txt,.doc,.docx'
                  onChange={handleFileSelect}
                />
                <Upload className='text-muted-foreground mx-auto mb-3 h-10 w-10' />
                <p className='text-sm font-medium'>Drop a document here</p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  or click to browse (PDF, images, text)
                </p>
              </div>
            )}

            {/* Processing State */}
            {(state === 'uploading' || state === 'processing') && (
              <div className='py-8 text-center'>
                <Loader2 className='text-primary mx-auto mb-3 h-10 w-10 animate-spin' />
                <p className='text-sm font-medium'>
                  {state === 'uploading'
                    ? 'Uploading...'
                    : 'Extracting data...'}
                </p>
                {fileName && (
                  <p className='text-muted-foreground mt-1 truncate text-xs'>
                    {fileName}
                  </p>
                )}
              </div>
            )}

            {/* Saving State */}
            {isSaving && (
              <div className='py-8 text-center'>
                <Loader2 className='text-primary mx-auto mb-3 h-10 w-10 animate-spin' />
                <p className='text-sm font-medium'>Saving to your account...</p>
              </div>
            )}

            {/* Success State - Show Results */}
            {state === 'success' && result && !isSaving && (
              <div className='space-y-4' data-testid='demo-results'>
                <div className='max-h-[180px] space-y-2 overflow-y-auto'>
                  {result.fields.length > 0 ? (
                    result.fields.map((field, i) => (
                      <div
                        key={i}
                        className='border-muted flex items-start justify-between border-b py-1 last:border-0'
                      >
                        <span className='text-muted-foreground text-xs capitalize'>
                          {field.field_name.replace(/_/g, ' ')}
                        </span>
                        <span className='max-w-[60%] truncate text-right text-xs font-medium'>
                          {field.value || '-'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className='text-muted-foreground py-2 text-center text-xs'>
                      No fields extracted
                    </p>
                  )}
                </div>

                {result.processing_time_ms > 0 && (
                  <div className='flex items-center justify-center gap-4 pt-2'>
                    <Badge variant='outline' className='text-xs'>
                      <Sparkles className='mr-1 h-3 w-3' />
                      {(result.processing_time_ms / 1000).toFixed(1)}s
                    </Badge>
                    {result.document_type && (
                      <Badge variant='outline' className='text-xs'>
                        {result.document_type}
                      </Badge>
                    )}
                  </div>
                )}

                <div className='space-y-2 pt-2'>
                  <Button
                    className='w-full'
                    size='sm'
                    onClick={() => setShowSignup(true)}
                    data-testid='demo-save-button'
                  >
                    <Save className='mr-2 h-4 w-4' />
                    Save Results
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='w-full'
                    onClick={resetDemo}
                  >
                    Try another document
                  </Button>
                </div>
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className='py-6 text-center'>
                <AlertCircle className='text-destructive mx-auto mb-3 h-10 w-10' />
                <p className='text-destructive text-sm font-medium'>
                  Processing Failed
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {error || 'Unable to process document'}
                </p>
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-4'
                  onClick={resetDemo}
                >
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inline Sign-Up Dialog */}
      <DemoSignupDialog
        open={showSignup}
        onOpenChange={setShowSignup}
        onSuccess={handleSignupSuccess}
      />
    </>
  )
}
