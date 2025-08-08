import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  Brain, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Zap,
  Eye,
  Download
} from 'lucide-react'

import { 
  EnhancedDocumentProcessor, 
  AIEnhancedProcessingOptions,
  EnhancedProcessedDocument,
  ClassificationResult 
} from '@/lib/enhanced-document-processor'
import { AIClassificationDisplay } from './AIClassificationDisplay'
import { EnhancedContentDisplay } from './EnhancedContentDisplay'

interface AIEnhancedDocumentWorkflowProps {
  onDocumentProcessed?: (document: EnhancedProcessedDocument) => void
  className?: string
}

export function AIEnhancedDocumentWorkflow({ 
  onDocumentProcessed,
  className = ""
}: AIEnhancedDocumentWorkflowProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processingOptions, setProcessingOptions] = useState<AIEnhancedProcessingOptions>({
    extractText: true,
    extractMetadata: true,
    extractStructure: true,
    useAIEnhancement: true,
    includeQualityAssessment: true
  })
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [isClassifying, setIsClassifying] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState('')
  
  const [processedDocument, setProcessedDocument] = useState<EnhancedProcessedDocument | null>(null)
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [serviceStatus, setServiceStatus] = useState<{
    available: boolean
    aiEnabled: boolean
    ollamaConnected: boolean
  }>({ available: false, aiEnabled: false, ollamaConnected: false })

  const enhancedProcessor = new EnhancedDocumentProcessor()

  // Check service status on mount
  useState(() => {
    checkServiceStatus()
  })

  const checkServiceStatus = async () => {
    try {
      const status = await enhancedProcessor.getProcessingStatus()
      setServiceStatus({
        available: status.service_status === 'available',
        aiEnabled: status.ai_enhancement_available,
        ollamaConnected: status.ollama_connected
      })
    } catch (error) {
      console.error('Failed to check service status:', error)
      setServiceStatus({ available: false, aiEnabled: false, ollamaConnected: false })
    }
  }

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setProcessedDocument(null)
      setClassificationResult(null)
      setError(null)
      
      // Auto-classify the document if AI is enabled
      if (serviceStatus.aiEnabled) {
        classifyDocument(file)
      }
    }
  }, [serviceStatus.aiEnabled])

  const classifyDocument = async (file: File) => {
    setIsClassifying(true)
    setError(null)
    
    try {
      const result = await enhancedProcessor.classifyDocument(file, true)
      setClassificationResult(result)
    } catch (error) {
      console.error('Classification failed:', error)
      setError(`Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsClassifying(false)
    }
  }

  const handleFileProcess = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError(null)
    setProcessingProgress(0)
    setProcessingStep('Initializing...')
    
    try {
      // Simulate processing steps for better UX
      const steps = [
        'Uploading document...',
        'Extracting content...',
        processingOptions.useAIEnhancement ? 'AI analysis...' : 'Basic processing...',
        'Finalizing results...'
      ]
      
      let currentStep = 0
      const stepInterval = setInterval(() => {
        if (currentStep < steps.length) {
          setProcessingStep(steps[currentStep])
          setProcessingProgress((currentStep + 1) * 25)
          currentStep++
        }
      }, 800)

      const result = await enhancedProcessor.processDocumentWithAI(selectedFile, processingOptions)
      
      clearInterval(stepInterval)
      setProcessingProgress(100)
      setProcessingStep('Complete!')
      
      setProcessedDocument(result)
      onDocumentProcessed?.(result)
      
    } catch (error) {
      console.error('Processing failed:', error)
      setError(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setProcessingProgress(0)
        setProcessingStep('')
      }, 1000)
    }
  }

  const updateProcessingOption = (key: keyof AIEnhancedProcessingOptions, value: boolean) => {
    setProcessingOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const getFileIcon = (file: File) => {
    if (file.type.includes('pdf')) return '📄'
    if (file.type.includes('word')) return '📝'
    if (file.type.includes('excel')) return '📊'
    if (file.type.includes('powerpoint')) return '📊'
    return '📁'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Service Status Banner */}
      {!serviceStatus.available && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Enhanced document processing service is not available. Using basic processing mode.
          </AlertDescription>
        </Alert>
      )}

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Document Upload</span>
          </CardTitle>
          <CardDescription>
            Upload your document for AI-powered analysis and content extraction
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select Document</Label>
            <div className="flex items-center space-x-4">
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.html,.txt,.md,.csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <Button 
                onClick={checkServiceStatus}
                variant="outline"
                size="sm"
              >
                Refresh Status
              </Button>
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <span className="text-2xl">{getFileIcon(selectedFile)}</span>
              <div className="flex-1">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {isClassifying && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Classifying...</span>
                </div>
              )}
            </div>
          )}

          {/* Service Status Indicators */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${serviceStatus.available ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Service {serviceStatus.available ? 'Available' : 'Unavailable'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${serviceStatus.aiEnabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span>AI {serviceStatus.aiEnabled ? 'Enabled' : 'Limited'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${serviceStatus.ollamaConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Ollama {serviceStatus.ollamaConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Processing Options</span>
          </CardTitle>
          <CardDescription>
            Configure how your document should be processed and analyzed
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="extract-text">Extract Text</Label>
              <Switch
                id="extract-text"
                checked={processingOptions.extractText}
                onCheckedChange={(checked) => updateProcessingOption('extractText', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="extract-metadata">Extract Metadata</Label>
              <Switch
                id="extract-metadata"
                checked={processingOptions.extractMetadata}
                onCheckedChange={(checked) => updateProcessingOption('extractMetadata', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="extract-structure">Extract Structure</Label>
              <Switch
                id="extract-structure"
                checked={processingOptions.extractStructure}
                onCheckedChange={(checked) => updateProcessingOption('extractStructure', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="quality-assessment">Quality Assessment</Label>
              <Switch
                id="quality-assessment"
                checked={processingOptions.includeQualityAssessment}
                onCheckedChange={(checked) => updateProcessingOption('includeQualityAssessment', checked)}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="ai-enhancement" className="flex items-center space-x-2">
                <Brain className="w-4 h-4" />
                <span>AI Enhancement</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable intelligent content analysis and extraction
              </p>
            </div>
            <Switch
              id="ai-enhancement"
              checked={processingOptions.useAIEnhancement}
              onCheckedChange={(checked) => updateProcessingOption('useAIEnhancement', checked)}
              disabled={!serviceStatus.aiEnabled}
            />
          </div>
          
          {!serviceStatus.aiEnabled && processingOptions.useAIEnhancement && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                AI enhancement is not available. Processing will use basic extraction methods.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Quick Classification Preview */}
      {classificationResult && (
        <AIClassificationDisplay 
          classification={classificationResult.classification}
          showDetails={false}
        />
      )}

      {/* Process Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleFileProcess}
          disabled={!selectedFile || isProcessing}
          size="lg"
          className="px-8"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Process Document
            </>
          )}
        </Button>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{processingStep}</span>
                <span>{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {processedDocument && (
        <div className="space-y-6">
          {/* Success Banner */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Document processed successfully!</span>
              <div className="flex space-x-2">
                <Badge variant="outline">
                  {(processedDocument.processing_time * 1000).toFixed(0)}ms
                </Badge>
                {processedDocument.ai_enhancement_enabled && (
                  <Badge className="bg-blue-100 text-blue-800">
                    AI Enhanced
                  </Badge>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* AI Classification Results */}
          {processedDocument.ai_classification && (
            <AIClassificationDisplay 
              classification={processedDocument.ai_classification}
              showDetails={true}
            />
          )}

          {/* Enhanced Content Display */}
          <EnhancedContentDisplay document={processedDocument} />

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              View Raw Data
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AIEnhancedDocumentWorkflow