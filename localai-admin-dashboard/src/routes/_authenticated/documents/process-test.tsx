import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, CheckCircle, XCircle } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/documents/process-test')({
  component: RouteComponent,
})

interface ProcessResult {
  success: boolean
  content?: string
  metadata?: any
  error?: string
}

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [serviceStatus, setServiceStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')

  // Check service health
  const checkServiceHealth = async () => {
    try {
      const response = await fetch('http://localhost:8090/health/')
      if (response.ok) {
        setServiceStatus('online')
        return true
      } else {
        setServiceStatus('offline')
        return false
      }
    } catch (error) {
      setServiceStatus('offline')
      return false
    }
  }

  // Process document
  const processDocument = async () => {
    if (!file) return

    setIsProcessing(true)
    setResult(null)

    try {
      // Check service health first
      const isHealthy = await checkServiceHealth()
      if (!isHealthy) {
        throw new Error('Document processor service is not available')
      }

      const formData = new FormData()
      formData.append('file', file)

      // Upload document
      const uploadResponse = await fetch('http://localhost:8090/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResponse.status}`)
      }

      const uploadData = await uploadResponse.json()
      const jobId = uploadData.job_id

      // Poll for completion
      let attempts = 0
      const maxAttempts = 30
      
      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`http://localhost:8090/documents/status/${jobId}`)
        
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: HTTP ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()
        
        if (statusData.status === 'completed') {
          setResult({
            success: true,
            content: statusData.result?.content?.text || 'No text content available',
            metadata: statusData.result?.metadata || {},
          })
          return
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Processing failed')
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }

      throw new Error('Processing timed out')
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Document Processor Test</h1>
        <Button 
          variant="outline" 
          onClick={checkServiceHealth}
          className="flex items-center gap-2"
        >
          {serviceStatus === 'online' && <CheckCircle className="w-4 h-4 text-green-500" />}
          {serviceStatus === 'offline' && <XCircle className="w-4 h-4 text-red-500" />}
          Service Status: {serviceStatus}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <Button 
              onClick={processDocument}
              disabled={!file || isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isProcessing ? 'Processing...' : 'Process Document'}
            </Button>
          </div>

          {file && (
            <Alert>
              <AlertDescription>
                Selected file: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              Processing Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success ? (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Extracted Content:</h3>
                  <Textarea
                    value={result.content || ''}
                    readOnly
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                {result.metadata && (
                  <div>
                    <h3 className="font-semibold mb-2">Metadata:</h3>
                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                      {JSON.stringify(result.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  Error: {result.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Service URL:</strong> http://localhost:8090</p>
            <p><strong>Health Check:</strong> http://localhost:8090/health/</p>
            <p><strong>Upload Endpoint:</strong> http://localhost:8090/documents/upload</p>
            <p><strong>Status Endpoint:</strong> http://localhost:8090/documents/status/&#123;job_id&#125;</p>
            <p><strong>Supported Formats:</strong> PDF, DOCX, TXT, MD, PNG, JPG</p>
            <p><strong>Processing:</strong> Asynchronous with job tracking</p>
            <p><strong>API Docs:</strong> <a href="http://localhost:8090/docs" target="_blank" className="text-blue-600 hover:underline">http://localhost:8090/docs</a></p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
