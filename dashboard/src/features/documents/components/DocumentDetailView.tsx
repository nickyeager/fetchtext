/**
 * Simplified Document Detail View
 * Shows document content with processing capabilities
 *
 * All state management, effects, derived data, and action handlers
 * live in the useDocumentDetail hook. This component is purely rendering.
 */
import {
  ArrowLeft,
  Download,
  FileText,
  Copy,
  Eye,
  RefreshCw,
  Save,
  Edit3,
  SplitSquareHorizontal,
  Maximize2,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Edit,
  Zap,
  Settings,
  Workflow,
  Columns,
  Code,
  FileOutput,
  ChevronDown,
  FileJson,
  FileType,
} from 'lucide-react'
import { UnifiedDocumentService } from '@/services/unified-document-service'
import { parseExtractedFields } from '@/lib/document-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { SimpleEditor } from '@/components/ui/simple-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import TemplateSelector from '@/components/documents/TemplateSelector'
import { TemplateMatchCard } from '@/components/documents/TemplateMatchCard'
import { AddFieldFromSelectionDialog } from '@/components/documents/AddFieldFromSelectionDialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { GeneratedTemplateDialog } from '@/components/templates/GeneratedTemplateDialog'
import { CreateTemplateFromFields } from './CreateTemplateFromFields'
import { DocumentPipelineView } from './DocumentPipelineView'
import { DualDocumentView } from './DualDocumentView'
import { ExtractedFieldsEditor } from './ExtractedFieldsEditor'
import { MarkdownViewer } from './MarkdownViewer'
import { TemplateVariablesPanel } from './TemplateVariablesPanel'
import { useDocumentDetail } from '../hooks/useDocumentDetail'

interface DocumentDetailViewProps {
  documentId: string
  onBack?: () => void
  onDownload?: (
    format: 'json' | 'txt' | 'csv' | 'html' | 'docx'
  ) => Promise<void>
  onSave?: (content: string) => Promise<void>
}

export function DocumentDetailView({
  documentId,
  onBack,
  onDownload,
  onSave,
}: DocumentDetailViewProps) {
  const {
    // Navigation
    navigate,

    // Query state
    document,
    isLoading,
    error,
    refetch,

    // UI state
    viewMode,
    setViewMode,
    editMode,
    setEditMode,
    editedContent,
    setEditedContent,
    isFullscreen,
    setIsFullscreen,
    isProcessing,
    processingError,
    showTemplateChanger,
    setShowTemplateChanger,
    showGeneratedTemplateDialog,
    setShowGeneratedTemplateDialog,
    generatedTemplate,
    showCreateTemplateDialog,
    setShowCreateTemplateDialog,
    fieldsForTemplate,
    setFieldsForTemplate,
    documentFileUrl,
    formattedOutput,
    showTemplateView,
    setShowTemplateView,
    rawTemplateContent,
    activeHighlightField,
    setActiveHighlightField,
    fieldPositions,
    pdfPageDimensions,

    // Refs
    contentRef,
    textSelection,

    // Derived data
    evaluation,
    comprehensiveFieldDetection,
    documentContent,

    // Action handlers
    handleAddFieldFromSelection,
    navigateToTemplateEdit,
    handleProcessingAction,
    handleRerunExtraction,
    handleForceRetry,
    handleForceComplete,
    handleSaveGeneratedTemplate,
    handleTemplateContentChange,
    handleAutoComplete,
    handleSaveContent,
    handleDownload,
    copyToClipboard,
    handleSaveExtractedFields,
    handleFieldsChange,
    handleCreateTemplateFromFields,
    handleSaveTemplateContent,
    handleUseGeneratedTemplate,

    // Utility
    calculateProcessingProgress,
  } = useDocumentDetail({ documentId, onBack, onDownload, onSave })

  if (isLoading) {
    return (
      <div className='container mx-auto p-6'>
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-gray-500' />
        </div>
      </div>
    )
  }

  if (error) {
    console.error('Document fetch error:', error)
    return (
      <div className='container mx-auto p-6'>
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            {error instanceof Error &&
            error.message.includes('User not authenticated')
              ? 'Please sign in to view this document'
              : error instanceof Error &&
                  error.message.includes('Failed to fetch')
                ? 'Failed to load document. Please try again.'
                : 'Error loading document'}
          </AlertDescription>
        </Alert>
        <Button onClick={onBack} className='mt-4'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Documents
        </Button>
      </div>
    )
  }

  if (!document) {
    return (
      <div className='container mx-auto p-6'>
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            Document not found. This document may have been deleted or you may
            not have permission to view it.
          </AlertDescription>
        </Alert>
        <Button onClick={onBack} className='mt-4'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Documents
        </Button>
      </div>
    )
  }

  // Handle different processing states - show original enhanced components for non-completed states
  // Only processing_status exists in database schema (no separate 'status' field)
  const processingStatus = document?.processing_status

  // Use processing_status as the single source of truth
  // IMPORTANT: If document is completed, currentStatus should be 'completed' regardless of processingStatus
  const currentStatus =
    processingStatus === 'completed'
      ? 'completed'
      : processingStatus || 'completed'

  // Debug logging for document status
  console.log('📊 DocumentDetailView: Document data received', {
    documentId,
    processingStatus,
    currentStatus,
    hasDocument: !!document,
    documentName: document?.name,
    contentText: document?.content_text ? 'Present' : 'Missing',
    extractedFields: document?.extracted_fields ? 'Present' : 'Missing',
    metadata: document?.metadata,
    timestamp: new Date().toISOString(),
  })

  // Smart detection of actually completed documents that are stuck in "processing" status
  const hasProcessedContent = !!(
    document?.content_text ||
    document?.extracted_fields ||
    document?.metadata?.extracted_fields ||
    document?.metadata?.extraction_result ||
    document?.metadata?.ai_classification
  )

  // Override status if we detect completed processing or backend says completed
  const effectiveStatus =
    currentStatus !== 'completed' && hasProcessedContent
      ? 'completed'
      : currentStatus

  // Debug logging for stuck documents
  console.log('🔍 Document status check:', {
    documentId,
    processing_status: document?.processing_status,
    status: document?.status,
    currentStatus,
    effectiveStatus,
    hasContent: !!document?.content_text,
    hasExtractedFields: !!(
      document?.extracted_fields || document?.metadata?.extracted_fields
    ),
    statusOverridden: effectiveStatus !== currentStatus,
    metadata: document?.metadata,
  })

  console.log('Document', document)

  if (effectiveStatus !== 'completed') {
    return (
      <div className='container mx-auto space-y-6 p-4 sm:p-6'>
        {/* Header */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-col space-y-2 sm:flex-row sm:items-center sm:gap-4 sm:space-y-0'>
            <Button
              variant='outline'
              size='sm'
              onClick={onBack || (() => navigate({ to: '/documents' }))}
              className='flex items-center gap-2'
            >
              <ArrowLeft className='h-4 w-4' />
              Back to Documents
            </Button>
            <div className='min-w-0'>
              <h1 className='truncate text-xl font-bold text-gray-900 sm:text-2xl dark:text-white'>
                {document.name}
              </h1>
              <div className='mt-1 flex flex-wrap items-center gap-2'>
                <StatusBadge status={currentStatus} />
                {document.metadata?.processing_method && (
                  <Badge variant='outline'>
                    {document.metadata.processing_method}
                  </Badge>
                )}
                {document.metadata?.template_name && (
                  <Badge
                    variant='secondary'
                    className='flex items-center gap-1'
                  >
                    <FileText className='h-3 w-3' />
                    {document.metadata?.template_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {/* Rerun Analysis Button - show for analyzed or completed documents */}
            {(currentStatus === 'analyzing' ||
              currentStatus === 'processing' ||
              currentStatus === 'completed') && (
              <Button
                onClick={handleRerunExtraction}
                variant='outline'
                disabled={isProcessing}
                size='sm'
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}
                />
                {isProcessing ? 'Reprocessing...' : 'Rerun Analysis'}
              </Button>
            )}

            {onDownload && (
              <Button onClick={() => onDownload('json')} variant='outline'>
                <Download className='mr-2 h-4 w-4' />
                Download
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {processingError && (
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription>{processingError}</AlertDescription>
          </Alert>
        )}

        {/* Status-specific content */}
        {currentStatus === 'processing' && (
          <>
            {/* Check if document needs template selection */}
            {UnifiedDocumentService.documentNeedsTemplateSelection(
              document
            ) && (
              <TemplateSelector
                documentId={documentId}
                suggestions={UnifiedDocumentService.getDocumentTemplateSuggestions(
                  document
                )}
                onTemplateApplied={(_templateId, _templateName) => {
                  // Force refetch after template is applied
                  refetch()
                }}
              />
            )}

            {/* Show processing status if template is already selected or no suggestions */}
            {!UnifiedDocumentService.documentNeedsTemplateSelection(
              document
            ) && (
              <Card>
                <CardContent className='p-6'>
                  <div className='space-y-4'>
                    <div className='flex items-center gap-3'>
                      <Sparkles className='h-6 w-6 animate-pulse text-purple-500' />
                      <div>
                        <h3 className='text-lg font-medium'>
                          Processing Document with Template
                        </h3>
                        <p className='text-sm text-gray-600'>
                          Extracting information using the selected template...
                        </p>
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Progress
                        value={calculateProcessingProgress(document)}
                        className='h-3'
                      />
                      <div className='text-center text-xs text-gray-500'>
                        {calculateProcessingProgress(document)}% complete
                        {calculateProcessingProgress(document) >= 95 && (
                          <span className='mt-1 block text-amber-600'>
                            Finalizing extraction...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Show immediate complete button if at 98% */}
                    {calculateProcessingProgress(document) >= 98 && (
                      <div className='mt-4 flex justify-center'>
                        <Button
                          onClick={handleAutoComplete}
                          variant='default'
                          size='sm'
                          disabled={isProcessing}
                          className='bg-green-600 text-xs hover:bg-green-700'
                        >
                          <CheckCircle
                            className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
                          />
                          Complete Processing
                        </Button>
                      </div>
                    )}

                    {/* Show force complete button if document is stuck */}
                    {UnifiedDocumentService.isDocumentStuckInProcessing(
                      document
                    ) && (
                      <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950'>
                        <p className='mb-2 text-xs text-amber-800 dark:text-amber-200'>
                          <AlertTriangle className='mr-1 inline h-3 w-3' />
                          Document appears to be stuck in processing
                        </p>
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            onClick={handleAutoComplete}
                            variant='default'
                            size='sm'
                            disabled={isProcessing}
                            className='bg-blue-600 text-xs hover:bg-blue-700'
                          >
                            <CheckCircle
                              className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
                            />
                            Fix Stuck Document
                          </Button>
                          <Button
                            onClick={handleForceComplete}
                            variant='outline'
                            size='sm'
                            disabled={isProcessing}
                            className='text-xs'
                          >
                            <CheckCircle
                              className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
                            />
                            Force Complete
                          </Button>
                          <Button
                            onClick={handleForceRetry}
                            variant='outline'
                            size='sm'
                            disabled={isProcessing}
                            className='text-xs'
                          >
                            <RefreshCw
                              className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`}
                            />
                            Retry Analysis
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {currentStatus === 'analyzing' && !evaluation && (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Sparkles className='h-5 w-5 animate-pulse' />
                AI Analysis in Progress
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950'>
                <div className='flex items-start gap-3'>
                  <Loader2 className='mt-0.5 h-5 w-5 animate-spin text-blue-600' />
                  <div>
                    <h4 className='mb-1 font-medium text-blue-900 dark:text-blue-100'>
                      Analyzing Document
                    </h4>
                    <p className='text-sm text-blue-700 dark:text-blue-300'>
                      Our AI is analyzing your document to determine its type
                      and suggest the best processing options. This usually
                      takes 10-30 seconds.
                    </p>
                  </div>
                </div>
              </div>
              <div className='flex items-center justify-center p-8'>
                <div className='space-y-4 text-center'>
                  <div className='flex justify-center space-x-1'>
                    <div className='h-2 w-2 animate-bounce rounded-full bg-blue-500'></div>
                    <div
                      className='h-2 w-2 animate-bounce rounded-full bg-blue-500'
                      style={{ animationDelay: '0.1s' }}
                    ></div>
                    <div
                      className='h-2 w-2 animate-bounce rounded-full bg-blue-500'
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                  </div>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    Please wait while we process your document...
                  </p>
                  <Button
                    onClick={handleForceRetry}
                    variant='outline'
                    size='sm'
                    disabled={isProcessing}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}
                    />
                    {isProcessing ? 'Retrying...' : 'Force Retry'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStatus === 'analyzing' && evaluation && (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Sparkles className='h-5 w-5' />
                AI Analysis Complete
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Document Type */}
              <div className='rounded-lg bg-gray-50 p-4 dark:bg-gray-800'>
                <h4 className='mb-2 font-medium'>Detected Document Type</h4>
                <div className='flex items-center justify-between'>
                  <span className='text-lg font-semibold capitalize'>
                    {evaluation.type_evaluation.primary_type}
                  </span>
                  <Badge variant='secondary'>
                    {Math.round(evaluation.type_evaluation.confidence * 100)}%
                    confidence
                  </Badge>
                </div>
              </div>

              {/* Processing Options */}
              <div className='space-y-3'>
                <h4 className='font-medium'>Processing Options</h4>

                {/* Template Match Results */}
                {evaluation.template_suggestions.length > 0 && (
                  <TemplateMatchCard
                    suggestions={evaluation.template_suggestions}
                    onSelectTemplate={(templateId) =>
                      handleProcessingAction('use_template', templateId)
                    }
                    compact
                  />
                )}

                {/* Alternative actions */}
                <div className='flex flex-col gap-3 sm:flex-row'>
                  <Button
                    variant='outline'
                    onClick={() => handleProcessingAction('generate_template')}
                    disabled={isProcessing}
                    className='flex-1'
                  >
                    <Sparkles className='mr-2 h-4 w-4' />
                    <span className='hidden sm:inline'>
                      Generate New Template
                    </span>
                    <span className='sm:hidden'>Generate Template</span>
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => navigate({ to: '/templates' })}
                    disabled={isProcessing}
                    className='flex-1'
                  >
                    <Settings className='mr-2 h-4 w-4' />
                    <span className='hidden sm:inline'>
                      Browse All Templates
                    </span>
                    <span className='sm:hidden'>Browse Templates</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStatus === 'processing' && (
          <Card>
            <CardContent className='p-6'>
              <div className='space-y-4'>
                <div className='flex items-center gap-3'>
                  <Zap className='h-6 w-6 animate-pulse text-blue-500' />
                  <div>
                    <h3 className='text-lg font-medium'>
                      {document.metadata?.rerun_extraction
                        ? 'Re-processing Document'
                        : 'Processing Document'}
                    </h3>
                    <p className='text-sm text-gray-600'>
                      {document.metadata?.rerun_extraction
                        ? 'Re-extracting content and fields with updated AI analysis...'
                        : 'Extracting content and fields from your document...'}
                    </p>
                  </div>
                </div>
                <div className='space-y-2'>
                  <Progress
                    value={calculateProcessingProgress(document)}
                    className='h-3'
                  />
                  <div className='text-center text-xs text-gray-500'>
                    {calculateProcessingProgress(document)}% complete
                  </div>
                </div>
                <p className='text-center text-xs text-gray-500'>
                  This typically takes 60-90 seconds depending on document
                  complexity
                </p>
                {Boolean(document.metadata?.rerun_extraction) && (
                  <div className='rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950'>
                    <p className='text-xs text-blue-800 dark:text-blue-200'>
                      <Sparkles className='mr-1 inline h-3 w-3' />
                      Using improved AI analysis for better extraction results
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(currentStatus === 'pending' || currentStatus === 'uploaded') && (
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-primary'>
                  Document Ready for Processing
                </CardTitle>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className='mr-2 h-4 w-4' />
                  Start Smart Extraction
                </Button>
              </div>
            </CardHeader>
            <CardContent className='p-6'>
              <Alert>
                <Sparkles className='h-4 w-4' />
                <AlertDescription>
                  This document has been uploaded but processing hasn't started
                  yet. Current status: <strong>{currentStatus}</strong>
                  <br />
                  Click "Start Smart Extraction" to begin AI analysis and
                  content extraction.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Catch-all for other unhandled statuses */}
        {![
          'completed',
          'processing',
          'analyzing',
          'failed',
          'pending',
          'uploaded',
        ].includes(currentStatus) && (
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-gray-600'>
                  Unknown Status: {currentStatus}
                </CardTitle>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className='mr-2 h-4 w-4' />
                  Start Processing
                </Button>
              </div>
            </CardHeader>
            <CardContent className='p-6'>
              <div className='rounded-lg bg-gray-50 p-4 dark:bg-gray-800'>
                <p className='mb-2 text-sm text-gray-700 dark:text-gray-300'>
                  Document status: <strong>{currentStatus}</strong>
                </p>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  This status is not recognized. Try starting processing to move
                  the document forward.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStatus === 'failed' && (
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-red-600'>
                  Processing Failed
                </CardTitle>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className='mr-2 h-4 w-4' />
                  Retry Smart Extraction
                </Button>
              </div>
            </CardHeader>
            <CardContent className='p-6'>
              <Alert variant='destructive'>
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription>
                  Processing failed:{' '}
                  {document.metadata?.error_message || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>
              <div className='mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800'>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  Try running smart extraction again with updated AI analysis.
                  This may resolve temporary processing issues.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderTabsView = () => (
    <>
      <Tabs defaultValue='original' className='w-full'>
        <TabsList className='grid h-auto w-full grid-cols-2'>
          <TabsTrigger
            value='original'
            className='px-2 py-2 text-xs sm:text-sm'
          >
            <span className='hidden sm:inline'>Original Document</span>
            <span className='sm:hidden'>Original</span>
          </TabsTrigger>
          <TabsTrigger
            value='processed'
            className='px-2 py-2 text-xs sm:text-sm'
          >
            <span className='hidden sm:inline'>Extracted Fields</span>
            <span className='sm:hidden'>Extracted</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='original' className='mt-4'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='flex items-center text-lg'>
                  <FileText className='mr-2 h-5 w-5' />
                  Original Content
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        copyToClipboard(documentContent.original.text)
                      }
                    >
                      <Copy className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy to Clipboard</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={contentRef} className='relative'>
                <MarkdownViewer
                  content={documentContent.original.text}
                  height='h-64 sm:h-96'
                />
                {textSelection.selectedText &&
                  textSelection.position &&
                  (document.metadata as any)?.template_id && (
                    <AddFieldFromSelectionDialog
                      selectedText={textSelection.selectedText}
                      position={textSelection.position}
                      templateId={Number(
                        (document.metadata as any).template_id,
                      )}
                      onAddField={handleAddFieldFromSelection}
                      onClose={textSelection.clearSelection}
                    />
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='processed' className='mt-4'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='flex items-center text-lg'>
                  <Edit3 className='mr-2 h-5 w-5' />
                  Extracted Fields
                  {editMode && <Badge className='ml-2'>Editing</Badge>}
                </CardTitle>
                <div className='flex items-center space-x-2'>
                  {(document.metadata as any)?.template_id && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              navigateToTemplateEdit(
                                (document.metadata as any).template_id,
                                false
                              )
                            }
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Template</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              setShowTemplateChanger(!showTemplateChanger)
                            }
                          >
                            <RefreshCw className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Change Template</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setEditMode(!editMode)}
                      >
                        {editMode ? (
                          <Eye className='h-4 w-4' />
                        ) : (
                          <Edit3 className='h-4 w-4' />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{editMode ? 'View Mode' : 'Edit Mode'}</p>
                    </TooltipContent>
                  </Tooltip>
                  {editMode && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='default'
                          size='sm'
                          onClick={handleSaveContent}
                        >
                          <Save className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save Changes</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editMode ? (
                <div className='h-64 sm:h-96'>
                  <SimpleEditor
                    value={editedContent}
                    onChange={setEditedContent}
                    placeholder='Enter processed document content...'
                    height='100%'
                  />
                </div>
              ) : (
                <>
                  {showTemplateView && rawTemplateContent && (
                    <div className='bg-muted/50 mb-2 rounded-md border border-dashed p-2'>
                      <div className='text-muted-foreground mb-1 flex items-center gap-2 text-sm'>
                        <Code className='h-4 w-4' />
                        <span>Template View - Showing placeholders</span>
                      </div>
                    </div>
                  )}
                  <MarkdownViewer
                    content={
                      showTemplateView && rawTemplateContent
                        ? rawTemplateContent
                        : formattedOutput || documentContent.processed.text
                    }
                    height='h-64 sm:h-96'
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )

  const renderPipelineView = () => {
    // Use comprehensive field detection for all fields
    const { extractedFields, confidenceScores } = comprehensiveFieldDetection
    const templateVariables = Object.keys(extractedFields)

    // Get template content - use raw template if available, otherwise original text
    const templateContent =
      rawTemplateContent || documentContent.original.text || ''

    // Get metadata with proper typing
    const metadata = document?.metadata as Record<string, unknown> | undefined
    const templateName = metadata?.template_name as string | undefined
    const templateId = metadata?.template_id as number | string | undefined
    const updatedAt = metadata?.updated_at as string | undefined

    // Determine which output to show based on toggle
    const outputContent =
      showTemplateView && rawTemplateContent
        ? rawTemplateContent
        : formattedOutput || documentContent.processed.text

    return (
      <DocumentPipelineView
        templateContent={templateContent}
        templateVariables={templateVariables}
        extractedFields={extractedFields}
        confidenceScores={confidenceScores as Record<string, number>}
        finalOutput={outputContent}
        documentName={document?.name}
        templateName={templateName}
        templateId={templateId}
        templateUpdatedAt={updatedAt}
        onUpdateTemplate={
          templateId ? () => navigateToTemplateEdit(templateId) : undefined
        }
      />
    )
  }

  const renderDualView = () => {
    const { extractedFields, confidenceScores } = comprehensiveFieldDetection
    const metadata = document?.metadata as Record<string, unknown> | undefined
    const templateName = metadata?.template_name as string | undefined
    const templateId = metadata?.template_id as number | string | undefined

    // Determine which content to show based on toggle
    let templateContent: string
    if (showTemplateView && rawTemplateContent) {
      // Show raw template with {{variable}} placeholders
      templateContent = rawTemplateContent
    } else if (formattedOutput) {
      // Show generated output with values filled in
      templateContent = formattedOutput
    } else {
      // Fallback to original text
      templateContent = documentContent.original.text || ''
    }

    // Prepare highlight fields with location data for document preview
    // This maps extractedFields to the format expected by DocumentPreviewPanel
    // Includes bbox data from fieldPositions state (fetched from backend)
    // Coordinates are normalized to 0-1 range using pdfPageDimensions so they
    // scale correctly with the viewer's zoom level
    const normalizeBbox = (
      bbox: { x: number; y: number; width: number; height: number } | null | undefined,
      page: number | undefined
    ) => {
      if (!bbox || !page) return undefined
      const dims = pdfPageDimensions[String(page)]
      if (!dims) return bbox // Fallback: return raw coordinates
      return {
        x: bbox.x / dims.width,
        y: bbox.y / dims.height,
        width: bbox.width / dims.width,
        height: bbox.height / dims.height,
        normalized: true, // Flag for DocumentPreviewPanel to use 'normalized' coordinateType
      }
    }

    const highlightFields = Object.entries(extractedFields).reduce(
      (acc, [fieldName, fieldData]) => {
        if (fieldData === null || fieldData === undefined) return acc

        // Get position data (including bbox) for this field from the fetched positions
        const positionData = fieldPositions.get(fieldName)

        // Handle both simple string values and structured field objects
        if (typeof fieldData === 'string') {
          acc[fieldName] = {
            value: fieldData,
            confidence: (confidenceScores[fieldName] as number) ?? 0.5,
            location: positionData
              ? {
                  page: positionData.page,
                  bbox: normalizeBbox(positionData.bbox, positionData.page),
                }
              : undefined,
          }
        } else if (typeof fieldData === 'object') {
          const field = fieldData as Record<string, unknown>
          const existingLocation = field.location as
            | { page?: number; position?: number }
            | undefined
          const page = positionData?.page ?? existingLocation?.page
          acc[fieldName] = {
            value: field.value ?? field,
            confidence:
              (field.confidence as number) ??
              (confidenceScores[fieldName] as number) ??
              0.5,
            sourceText: field.sourceText as string | undefined,
            location: {
              page,
              position: existingLocation?.position,
              bbox: normalizeBbox(positionData?.bbox, page),
            },
          }
        }
        return acc
      },
      {} as Record<
        string,
        {
          value: unknown
          confidence?: number
          sourceText?: string
          location?: {
            page?: number
            position?: number
            bbox?: { x: number; y: number; width: number; height: number; normalized?: boolean }
          }
        }
      >
    )

    // Handler for when a highlight is clicked in the document preview
    const handleFieldHighlightClick = (fieldName: string, _value: string) => {
      setActiveHighlightField(fieldName)
      // Could also scroll to the field in the template output view
    }

    return (
      <DualDocumentView
        fileUrl={documentFileUrl}
        fileName={document?.name || 'document'}
        fileType={document?.file_type || 'application/pdf'}
        fileSize={document?.file_size}
        templateContent={templateContent}
        extractedFields={extractedFields as Record<string, string | { value: string | null; confidence?: number; sourceText?: string } | null>}
        templateName={templateName}
        templateId={templateId}
        onEditTemplate={
          templateId ? () => navigateToTemplateEdit(templateId) : undefined
        }
        onExport={() => handleDownload('html')}
        className='h-[70vh]'
        documentText={documentContent.original.text}
        documentId={documentId}
        editable={true}
        onTemplateChange={handleTemplateContentChange}
        onFieldsChange={handleFieldsChange}
        onSaveTemplate={handleSaveTemplateContent}
        highlightFields={highlightFields}
        activeField={activeHighlightField}
        onFieldHighlightClick={handleFieldHighlightClick}
        showHighlights={true}
      />
    )
  }

  return (
    <div
      className={`p-4 sm:p-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
    >
      {/* Header */}
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => (onBack ? onBack() : navigate({ to: '/documents' }))}
            className='self-start'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
          <div className='min-w-0'>
            <h1 className='truncate text-xl font-semibold sm:text-2xl'>
              {document.name}
            </h1>
            <div className='mt-1 flex flex-wrap items-center gap-2'>
              <StatusBadge
                status={
                  document.processing_status ||
                  document.metadata?.processing_status ||
                  'completed'
                }
              />
              {document.metadata?.processing_method && (
                <Badge variant='outline'>
                  {document.metadata.processing_method}
                </Badge>
              )}
              {document.metadata?.template_name && (
                <Badge variant='secondary' className='flex items-center gap-1'>
                  <FileText className='h-3 w-3' />
                  {document.metadata?.template_name}
                </Badge>
              )}
              <span className='text-muted-foreground text-sm'>
                {document.created_at
                  ? new Date(document.created_at).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : ''}
              </span>
              {Boolean(document.metadata?.rerun_extraction) && (
                <Badge variant='secondary' className='text-xs'>
                  Re-processed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className='flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleRerunExtraction()}
            disabled={isProcessing}
            className='w-full sm:w-auto'
          >
            <Sparkles className='mr-2 h-4 w-4' />
            <span className='hidden sm:inline'>Rerun Smart Extraction</span>
            <span className='sm:hidden'>Rerun Extraction</span>
          </Button>

          {/* Toggle between Template View and Generated Output */}
          {rawTemplateContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showTemplateView ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setShowTemplateView(!showTemplateView)}
                  className='w-full sm:w-auto'
                >
                  {showTemplateView ? (
                    <>
                      <Code className='mr-2 h-4 w-4' />
                      <span className='hidden sm:inline'>Template View</span>
                      <span className='sm:hidden'>Template</span>
                    </>
                  ) : (
                    <>
                      <FileOutput className='mr-2 h-4 w-4' />
                      <span className='hidden sm:inline'>Generated Output</span>
                      <span className='sm:hidden'>Output</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {showTemplateView
                    ? 'Showing template with {{variable}} placeholders'
                    : 'Showing generated output with extracted values'}
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                const modes: Array<
                  'dual' | 'side-by-side' | 'tabs' | 'pipeline'
                > = ['dual', 'side-by-side', 'tabs', 'pipeline']
                const currentIndex = modes.indexOf(
                  viewMode as 'dual' | 'side-by-side' | 'tabs' | 'pipeline'
                )
                const nextIndex = (currentIndex + 1) % modes.length
                setViewMode(modes[nextIndex])
              }}
              className='flex-1 sm:flex-none'
            >
              {viewMode === 'dual' ? (
                <>
                  <Columns className='mr-2 h-4 w-4' />
                  Dual
                </>
              ) : viewMode === 'pipeline' ? (
                <>
                  <Workflow className='mr-2 h-4 w-4' />
                  Pipeline
                </>
              ) : (
                <>
                  <SplitSquareHorizontal className='mr-2 h-4 w-4' />
                  Tabs
                </>
              )}
            </Button>

            <Button
              variant='outline'
              size='sm'
              onClick={() => setIsFullscreen(!isFullscreen)}
              className='flex-1 sm:flex-none'
            >
              <Maximize2 className='mr-2 h-4 w-4' />
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='flex-1 sm:flex-none'
                >
                  <Download className='mr-2 h-4 w-4' />
                  Export
                  <ChevronDown className='ml-1 h-3 w-3' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuItem onClick={() => handleDownload('pdf')}>
                  <FileText className='mr-2 h-4 w-4' />
                  PDF Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('docx')}>
                  <FileType className='mr-2 h-4 w-4' />
                  Word Document (.doc)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload('html')}>
                  <Code className='mr-2 h-4 w-4' />
                  HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('md')}>
                  <FileText className='mr-2 h-4 w-4' />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('txt')}>
                  <FileText className='mr-2 h-4 w-4' />
                  Plain Text (.txt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload('json')}>
                  <FileJson className='mr-2 h-4 w-4' />
                  JSON (with fields)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant='outline'
              size='sm'
              onClick={() => refetch()}
              className='flex-1 sm:flex-none'
            >
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>

      <Separator className='mb-6' />

      {/* Content Area */}
      <div className='flex-1'>
        {viewMode === 'dual'
          ? renderDualView()
          : viewMode === 'pipeline'
            ? renderPipelineView()
            : renderTabsView()}
      </div>

      {/* Consolidated Template Change Functionality */}
      {showTemplateChanger && document.metadata?.template_suggestions && (
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle>Change Template</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateSelector
              documentId={documentId}
              suggestions={UnifiedDocumentService.getDocumentTemplateSuggestions(
                document
              )}
              currentTemplateId={document.metadata?.template_id ? Number(document.metadata.template_id) : undefined}
              currentTemplateName={document.metadata?.template_name}
              onTemplateApplied={(_templateId, _templateName) => {
                setShowTemplateChanger(false)
                refetch()
              }}
              showChangeOption={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Template Variables Panel - Hover to see extracted values */}
      {document.processing_status === 'completed' &&
        (() => {
          // Get extracted fields for the variables panel
          const extractedFieldsForPanel = (() => {
            const sources = [
              () =>
                (document.metadata as Record<string, unknown>)?.extracted_data,
              () =>
                (document.metadata as Record<string, unknown>)
                  ?.extraction_result,
              () => document.extracted_fields,
              () => document.metadata?.extracted_fields,
            ]

            for (const getter of sources) {
              const data = getter()
              if (!data) continue
              const parsed = parseExtractedFields(data)
              if (Object.keys(parsed).length > 0) {
                // Handle nested extracted_values structure
                if (
                  'extracted_values' in parsed &&
                  typeof parsed.extracted_values === 'object'
                ) {
                  return parsed.extracted_values as Record<string, unknown>
                }
                return parsed
              }
            }
            return {}
          })()

          if (Object.keys(extractedFieldsForPanel).length === 0) return null

          const metadata = document.metadata as
            | Record<string, unknown>
            | undefined
          const templateName = metadata?.template_name as string | undefined

          return (
            <TemplateVariablesPanel
              title='Extracted Variables'
              templateName={templateName}
              extractedFields={
                extractedFieldsForPanel as Record<
                  string,
                  | {
                      value: string | null
                      confidence?: number
                      sourceText?: string
                      type?: string
                    }
                  | string
                  | null
                >
              }
              editable={false}
              className='mt-6'
            />
          )
        })()}

      {/* Extracted Fields */}
      <Card className='mt-6'>
        <CardHeader>
          <CardTitle>Extracted Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='rounded-lg bg-green-50 p-4 dark:bg-green-950'>
              <div className='flex items-center gap-2 text-green-800 dark:text-green-200'>
                <CheckCircle className='h-5 w-5' />
                <span className='font-medium'>
                  Document processed successfully
                  {Boolean(document.metadata?.rerun_extraction) && (
                    <span className='ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800'>
                      Updated with Smart Extraction
                    </span>
                  )}
                </span>
              </div>
              {typeof (document.metadata as Record<string, unknown>)
                ?.rerun_timestamp === 'string' && (
                <p className='mt-1 text-xs text-green-700 dark:text-green-300'>
                  {(() => {
                    const ts = (document.metadata as Record<string, unknown> | null | undefined)
                      ?.rerun_timestamp as string
                    return `Last updated: ${new Date(ts).toLocaleString()}`
                  })()}
                </p>
              )}
              {/* Display current template information */}
              {(() => {
                const meta = document.metadata as Record<string, unknown> | null | undefined
                const tName = meta?.template_name as string | undefined
                const tId = meta?.template_id as number | string | undefined
                return Boolean(tName || tId)
              })() && (
                <div className='mt-3 border-t border-green-200 pt-3 dark:border-green-800'>
                  <p className='text-sm text-green-700 dark:text-green-300'>
                    <span className='font-medium'>Template Used:</span>{' '}
                    {(() => {
                      const meta = document.metadata as Record<string, unknown> | null | undefined
                      const tName = meta?.template_name as string | undefined
                      const tId = meta?.template_id as number | string | undefined
                      return tName || `Template ID: ${tId}`
                    })()}
                    {(() => {
                      const meta = document.metadata as Record<string, unknown> | null | undefined
                      const tId = meta?.template_id as number | string | undefined
                      return tId ? (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='ml-2 h-6 px-2 text-xs text-green-700 hover:text-green-800 dark:text-green-300 dark:hover:text-green-200'
                          onClick={() => navigateToTemplateEdit(tId)}
                        >
                          <Edit className='mr-1 h-3 w-3' />
                          Edit Template
                        </Button>
                      ) : null
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Extracted Fields Editor */}
            {(() => {
              // Handle different possible structures for extracted fields
              let extractedFields = {}
              let confidenceScores = {}
              let detectionPath = 'none'

              /* eslint-disable no-console */
              console.log('')
              console.log(
                '🔍 [Field Detection] Starting field detection process'
              )
              console.log('Document ID:', documentId)

              // Define data sources in priority order (most reliable first)
              const sources = [
                {
                  name: 'metadata.extracted_data.extracted_values',
                  getter: () =>
                    (document.metadata as Record<string, unknown>)
                      ?.extracted_data,
                  hasConfidence: true,
                },
                {
                  name: 'metadata.extraction_result.extracted_values',
                  getter: () =>
                    (document.metadata as Record<string, unknown>)
                      ?.extraction_result,
                  hasConfidence: true,
                },
                {
                  name: 'document.extracted_fields',
                  getter: () => document.extracted_fields,
                  hasConfidence: false,
                },
                {
                  name: 'metadata.extracted_fields',
                  getter: () => document.metadata?.extracted_fields,
                  hasConfidence: false,
                },
                {
                  name: 'metadata.fields',
                  getter: () => document.metadata?.fields,
                  hasConfidence: false,
                },
              ]

              // Try each source in priority order
              for (const source of sources) {
                const rawData = source.getter()
                if (!rawData) continue
                console.log('rawData', rawData)
                // Parse the data (handles JSON strings and objects)
                const parsed = parseExtractedFields(rawData)
                if (Object.keys(parsed).length === 0) continue

                // Check if this source has extracted_values structure
                if (source.hasConfidence && 'extracted_values' in parsed) {
                  const data = parsed as {
                    extracted_values?: Record<string, unknown>
                    confidence_scores?: Record<string, number>
                  }
                  if (
                    data.extracted_values &&
                    Object.keys(data.extracted_values).length > 0
                  ) {
                    extractedFields = parseExtractedFields(
                      data.extracted_values
                    )
                    detectionPath = source.name
                    if (data.confidence_scores) {
                      confidenceScores = data.confidence_scores
                    }
                    console.log(
                      '✅ [Field Detection] Found fields at:',
                      detectionPath
                    )
                    console.log(
                      '   Field count:',
                      Object.keys(extractedFields).length
                    )
                    console.log('   Fields:', extractedFields)
                    console.log('   Confidence scores:', confidenceScores)
                    break
                  }
                } else {
                  // Direct field data without nested structure
                  extractedFields = parsed
                  detectionPath = source.name
                  console.log(
                    '✅ [Field Detection] Found fields at:',
                    detectionPath
                  )
                  console.log(
                    '   Field count:',
                    Object.keys(extractedFields).length
                  )
                  console.log('   Fields:', extractedFields)
                  break
                }
              }

              // Log if no fields found
              if (detectionPath === 'none') {
                console.log(
                  '❌ [Field Detection] No fields found in any expected location'
                )
                console.log('   Checked paths:')
                sources.forEach((s) => console.log(`   - ${s.name}`))
              }

              console.log('')
              console.log('📦 [Field Detection] Final Results:')
              console.log('   Detection path:', detectionPath)
              console.log(
                '   Field count:',
                Object.keys(extractedFields).length
              )
              console.log('   Field names:', Object.keys(extractedFields))
              console.log('   Full extracted fields:', extractedFields)
              console.log('   Confidence scores:', confidenceScores)
              console.log('')
              /* eslint-enable no-console */

              // Get template metadata
              const metadata = document?.metadata as
                | Record<string, unknown>
                | undefined
              const templateId = metadata?.template_id as number | string | undefined
              const templateName = metadata?.template_name as string | undefined

              return (
                <ExtractedFieldsEditor
                  documentId={documentId}
                  extractedFields={extractedFields}
                  confidenceScores={confidenceScores}
                  onSave={handleSaveExtractedFields}
                  onCreateTemplate={async (fields) => {
                    setFieldsForTemplate(fields)
                    setShowCreateTemplateDialog(true)
                  }}
                  onUpdateTemplate={
                    templateId
                      ? async (_fields) => {
                          // Navigate to template editor
                          navigateToTemplateEdit(templateId)
                        }
                      : undefined
                  }
                  templateId={templateId}
                  templateName={templateName}
                  readOnly={false}
                  showCreateTemplate={true}
                />
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Generated Template Dialog */}
      <GeneratedTemplateDialog
        open={showGeneratedTemplateDialog}
        onOpenChange={setShowGeneratedTemplateDialog}
        generatedTemplate={generatedTemplate}
        onSaveTemplate={handleSaveGeneratedTemplate}
        onUseTemplate={handleUseGeneratedTemplate}
        isLoading={isProcessing}
      />

      {/* Create Template From Fields Dialog */}
      <CreateTemplateFromFields
        isOpen={showCreateTemplateDialog}
        onClose={() => setShowCreateTemplateDialog(false)}
        fields={fieldsForTemplate}
        documentType={evaluation?.type_evaluation?.primary_type}
        documentName={document?.name}
        onCreateTemplate={handleCreateTemplateFromFields}
      />
    </div>
  )
}
