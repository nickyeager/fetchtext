/**
 * useDocumentDetail hook
 * Extracted from DocumentDetailView.tsx (3246 lines) to separate state/logic from rendering.
 * Contains ALL useState, useEffect, useMemo, useCallback, useRef, useQuery calls
 * and ALL action handlers from the original component.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { templateService } from '@/services/template-service'
import { UnifiedDocumentService } from '@/services/unified-document-service'
import type { DocumentRecord } from '@/services/unified-document-service'
import { DocumentStatus } from '@/services/unified-document-service'
import type { DocumentEvaluation as SharedDocumentEvaluation } from '@/types/extraction'
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced'
import { parseExtractedFields } from '@/lib/document-utils'
import {
  getExtractedFields,
  getSimpleFieldValues,
  createMetadataWithExtractedFields,
  type ExtractedFieldsMap,
} from '@/lib/extracted-fields-utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import { useDocumentManager } from '@/hooks/use-document-manager'
import { useTextSelection } from '@/hooks/use-text-selection'
import type { NewFieldData } from '@/components/documents/AddFieldFromSelectionDialog'

export type DocumentEvaluation = SharedDocumentEvaluation

export interface DocumentContent {
  original: {
    text: string
    html?: string
    metadata?: Record<string, unknown>
  }
  processed: {
    text: string
    html?: string
    extracted_data?: Record<string, unknown>
    template_applied?: string
  }
}

interface UseDocumentDetailProps {
  documentId: string
  onBack?: () => void
  onDownload?: (
    format: 'json' | 'txt' | 'csv' | 'html' | 'docx'
  ) => Promise<void>
  onSave?: (content: string) => Promise<void>
}

export interface UseDocumentDetailReturn {
  // Navigation
  navigate: ReturnType<typeof useNavigate>

  // Query state
  document: DocumentRecord | null | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void

  // UI state
  viewMode: 'dual' | 'side-by-side' | 'tabs' | 'overlay' | 'pipeline'
  setViewMode: React.Dispatch<React.SetStateAction<'dual' | 'side-by-side' | 'tabs' | 'overlay' | 'pipeline'>>
  editMode: boolean
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>
  editedContent: string
  setEditedContent: React.Dispatch<React.SetStateAction<string>>
  isFullscreen: boolean
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>
  isProcessing: boolean
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
  processingError: string | null
  setProcessingError: React.Dispatch<React.SetStateAction<string | null>>
  showTemplateChanger: boolean
  setShowTemplateChanger: React.Dispatch<React.SetStateAction<boolean>>
  showGeneratedTemplateDialog: boolean
  setShowGeneratedTemplateDialog: React.Dispatch<React.SetStateAction<boolean>>
  generatedTemplate: any
  setGeneratedTemplate: React.Dispatch<React.SetStateAction<any>>
  showCreateTemplateDialog: boolean
  setShowCreateTemplateDialog: React.Dispatch<React.SetStateAction<boolean>>
  fieldsForTemplate: any[]
  setFieldsForTemplate: React.Dispatch<React.SetStateAction<any[]>>
  documentFileUrl: string | null
  setDocumentFileUrl: React.Dispatch<React.SetStateAction<string | null>>
  formattedOutput: string | null
  setFormattedOutput: React.Dispatch<React.SetStateAction<string | null>>
  showTemplateView: boolean
  setShowTemplateView: React.Dispatch<React.SetStateAction<boolean>>
  rawTemplateContent: string | null
  setRawTemplateContent: React.Dispatch<React.SetStateAction<string | null>>
  activeHighlightField: string | null
  setActiveHighlightField: React.Dispatch<React.SetStateAction<string | null>>
  fieldPositions: Map<string, { page: number; bbox: { x: number; y: number; width: number; height: number } | null }>
  setFieldPositions: React.Dispatch<React.SetStateAction<Map<string, { page: number; bbox: { x: number; y: number; width: number; height: number } | null }>>>
  isLoadingPositions: boolean

  // Refs
  contentRef: React.RefObject<HTMLDivElement | null>
  textSelection: ReturnType<typeof useTextSelection>

  // Services/managers
  documentProcessor: DocumentProcessorEnhanced
  documentManager: ReturnType<typeof useDocumentManager>
  queryClient: ReturnType<typeof useQueryClient>
  session: ReturnType<typeof useAuth>['session']

  // Derived data
  evaluation: DocumentEvaluation | null
  comprehensiveFieldDetection: {
    extractedFields: Record<string, unknown>
    confidenceScores: Record<string, unknown>
    detectionPath: string
  }
  documentContent: DocumentContent
  documentTemplateId: number | string | undefined

  // Action handlers
  handleAddFieldFromSelection: (templateId: number, field: NewFieldData) => Promise<void>
  navigateToTemplateEdit: (templateId: number | string, editMode?: boolean) => Promise<void>
  getDocumentFile: () => Promise<File>
  handleProcessingAction: (action: 'use_template' | 'generate_template', templateId?: number | string) => Promise<void>
  handleRerunExtraction: () => Promise<void>
  handleForceRetry: () => Promise<void>
  handleForceComplete: () => Promise<void>
  handleSaveGeneratedTemplate: (templateData: unknown) => Promise<void>
  handleTemplateContentChange: (content: string) => void
  handleAutoComplete: () => Promise<void>
  handleSaveContent: () => Promise<void>
  handleDownload: (format: 'json' | 'txt' | 'csv' | 'html' | 'docx' | 'md' | 'pdf') => Promise<void>
  copyToClipboard: (text: string) => Promise<void>
  handleSaveExtractedFields: (fields: Record<string, any>) => Promise<void>
  handleFieldsChange: (newFields: Record<string, { value: string | null; confidence?: number; sourceText?: string; type?: string }>) => Promise<void>
  handleCreateTemplateFromFields: (templateData: { name: string; description: string; category: string; smart_variables: any[]; is_public: boolean }) => Promise<void>
  handleSaveTemplateContent: (content: string, action: 'create' | 'modify', newName?: string) => Promise<void>
  handleUseGeneratedTemplate: (templateData: any) => Promise<void>

  // Utility
  calculateProcessingProgress: (doc: any) => number
}

export function useDocumentDetail({
  documentId,
  onBack,
  onDownload,
  onSave,
}: UseDocumentDetailProps): UseDocumentDetailReturn {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [viewMode, setViewMode] = useState<
    'dual' | 'side-by-side' | 'tabs' | 'overlay' | 'pipeline'
  >('dual')
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [showTemplateChanger, setShowTemplateChanger] = useState(false)
  const [showGeneratedTemplateDialog, setShowGeneratedTemplateDialog] =
    useState(false)
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null)
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] =
    useState(false)
  const [fieldsForTemplate, setFieldsForTemplate] = useState<any[]>([])
  const [documentFileUrl, setDocumentFileUrl] = useState<string | null>(null)

  const documentProcessor = React.useMemo(() => {
    const dp = new DocumentProcessorEnhanced()
    dp.setAccessToken(session?.access_token)
    return dp
  }, [session?.access_token])
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true })

  // State for formatted template output (moved to top to avoid hooks order issues)
  const [formattedOutput, setFormattedOutput] = React.useState<string | null>(
    null
  )

  // State for template view toggle - switch between raw template and generated output
  // Default to showing template view (with {{variable}} placeholders)
  const [showTemplateView, setShowTemplateView] = React.useState(true)
  const [rawTemplateContent, setRawTemplateContent] = React.useState<
    string | null
  >(null)

  // State for field highlighting in document preview
  const [activeHighlightField, setActiveHighlightField] = React.useState<
    string | null
  >(null)

  // State for field positions (bounding boxes) fetched from backend
  const [fieldPositions, setFieldPositions] = React.useState<
    Map<
      string,
      {
        page: number
        bbox: { x: number; y: number; width: number; height: number } | null
      }
    >
  >(new Map())
  const [isLoadingPositions, setIsLoadingPositions] = React.useState(false)

  // Text selection for adding template fields
  const contentRef = useRef<HTMLDivElement>(null)
  const textSelection = useTextSelection(contentRef)

  // Fetch document data with real-time updates
  const {
    data: document,
    isLoading,
    error,
    refetch,
  } = useQuery<DocumentRecord | null>({
    queryKey: ['processedDocument', documentId],
    // Explicit return type helps TS infer the query's data shape
    queryFn: async (): Promise<DocumentRecord | null> =>
      UnifiedDocumentService.getDocumentById(documentId),
    refetchInterval: (query) => {
      const data = query.state.data as DocumentRecord | null | undefined
      // CRITICAL FIX: Keep polling if data is undefined (document not loaded yet)
      if (data === undefined || data === null) {
        console.log('⏳ Document not loaded yet, continuing to poll...')
        return 2000 // Keep polling when no data
      }

      // Debug current status
      console.log('🔄 Polling check:', {
        documentId: data.id,
        processing_status: data.processing_status,
        status: data.status,
        currentStatus: data.processing_status || data.status,
        effectiveStatus: data.processing_status || data.status,
        metadata: data.metadata,
      })

      // Poll while document is being processed - check the actual status field being used
      const currentStatus = data.processing_status || data.status
      const isProcessing =
        currentStatus === 'analyzing' ||
        currentStatus === 'processing' ||
        currentStatus === 'uploading' ||
        currentStatus === 'pending'

      if (isProcessing) {
        console.log('🔄 Continue polling - document status:', currentStatus)
        return 2000 // Poll every 2 seconds
      }

      console.log(
        '✅ Stop polling - document completed:',
        currentStatus || 'unknown'
      )
      return false // Stop polling
    },
    refetchIntervalInBackground: true, // Continue polling even when window is not focused
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 0, // Don't cache at all - always fresh data (TanStack Query v5)
    enabled: !!documentId,
    // Add retry logic for resilience
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Force fresh data on every fetch
    meta: {
      skipCache: true,
    },
  })

  // Force immediate refetch when component mounts or document changes
  useEffect(() => {
    if (documentId) {
      console.log(
        '🔄 Component mounted/updated, forcing immediate refetch for document:',
        documentId
      )
      refetch()
    }
  }, [documentId, refetch])

  // Fetch signed URL for document preview
  useEffect(() => {
    const fetchDocumentUrl = async () => {
      if (!document?.file_path) {
        setDocumentFileUrl(null)
        return
      }

      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(document.file_path, 3600) // 1 hour expiry

        if (error) {
          // eslint-disable-next-line no-console
          console.warn('[DocumentDetailView] Failed to get signed URL:', error)
          setDocumentFileUrl(null)
          return
        }

        setDocumentFileUrl(data.signedUrl)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[DocumentDetailView] Error getting document URL:', error)
        setDocumentFileUrl(null)
      }
    }

    fetchDocumentUrl()
  }, [document?.file_path])

  // Fetch field positions (bounding boxes) for highlighting
  // This runs after we have the document URL and extracted fields
  useEffect(() => {
    const fetchFieldPositions = async () => {
      // Need both document URL and extracted fields to fetch positions
      if (!documentFileUrl || !document?.metadata) {
        return
      }

      // Use consolidated utility to get extracted fields from all legacy paths
      const extractedFields = getExtractedFields(document)
      const simpleValues = getSimpleFieldValues(document)

      if (Object.keys(extractedFields).length === 0) {
        return
      }

      // eslint-disable-next-line no-console
      console.log(
        '[DocumentDetailView] fetchFieldPositions: Using consolidated utility',
        {
          totalFields: Object.keys(extractedFields).length,
          fieldNames: Object.keys(extractedFields),
        }
      )

      // Prepare field values for position lookup using the simple values
      const fieldValuesToFind: Array<{ fieldName: string; value: string }> = []
      for (const [fieldName, value] of Object.entries(simpleValues)) {
        if (
          value !== null &&
          value !== undefined &&
          String(value).trim().length > 0
        ) {
          fieldValuesToFind.push({ fieldName, value: String(value).trim() })
        }
      }

      if (fieldValuesToFind.length === 0) {
        return
      }

      setIsLoadingPositions(true)
      try {
        const result = await documentProcessor.getFieldPositions(
          documentFileUrl,
          fieldValuesToFind,
          session?.access_token
        )

        // Convert positions array to a Map for efficient lookup
        const positionsMap = new Map<
          string,
          {
            page: number
            bbox: { x: number; y: number; width: number; height: number } | null
          }
        >()
        for (const pos of result.positions) {
          if (pos.fieldName && !positionsMap.has(pos.fieldName)) {
            positionsMap.set(pos.fieldName, {
              page: pos.page,
              bbox: pos.bbox,
            })
          }
        }

        setFieldPositions(positionsMap)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          '[DocumentDetailView] Error fetching field positions:',
          error
        )
      } finally {
        setIsLoadingPositions(false)
      }
    }

    fetchFieldPositions()
  }, [documentFileUrl, document, documentProcessor])

  // Extract templateId for dependency tracking
  const documentTemplateId = (
    document?.metadata as Record<string, unknown> | undefined
  )?.template_id as number | string | undefined

  // Fetch raw template content when template_id is available
  // Also check for custom_template_content in document metadata (document-specific override)
  useEffect(() => {
    const fetchTemplateContent = async () => {
      // First check for document-specific custom template content
      const metadata = document?.metadata as Record<string, unknown> | undefined
      const customContent = metadata?.custom_template_content as
        | string
        | undefined

      if (customContent) {
        // eslint-disable-next-line no-console
        console.log(
          '[DocumentDetailView] Using custom template content from document metadata'
        )
        setRawTemplateContent(customContent)
        return
      }

      // Fall back to the global template content
      if (!documentTemplateId) {
        setRawTemplateContent(null)
        return
      }

      try {
        const template = await templateService.getTemplate(documentTemplateId)
        if (template?.template_content) {
          setRawTemplateContent(template.template_content)
        } else {
          setRawTemplateContent(null)
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          '[DocumentDetailView] Error fetching template content:',
          error
        )
        setRawTemplateContent(null)
      }
    }

    fetchTemplateContent()
  }, [documentTemplateId, document?.metadata])

  // Derive evaluation data from document metadata
  const evaluation = useMemo<DocumentEvaluation | null>(() => {
    if (!document?.metadata) return null

    const metadata = document.metadata as Record<string, unknown>

    // Only show evaluation for documents that have AI analysis results
    if (
      !metadata.template_suggestions &&
      !metadata.ai_classification &&
      !metadata.document_type
    ) {
      return null
    }

    const processingRecommendations = (metadata as any)
      .processing_recommendations || {
      workflow:
        ((metadata as any).template_suggestions?.length || 0) > 0
          ? 'existing_template'
          : 'generate_template',
      suggested_action:
        ((metadata as any).template_suggestions?.length || 0) > 0
          ? `Use the "${(metadata as any).template_suggestions?.[0]?.template_name || 'Recommended'}" template for best results`
          : 'Generate a new AI-powered template for this document type',
      alternative_actions: ['Generate a new template', 'Browse all templates'],
      confidence_level:
        ((metadata as any)?.ai_classification?.confidence_score || 0) > 0.8
          ? 'high'
          : 'medium',
    }

    return {
      document_info: {
        filename: document.name,
        file_size: document.file_size,
        mime_type: document.file_type,
        format_supported: true,
      },
      type_evaluation: {
        primary_type:
          (metadata.ai_classification as any)?.primary_category ||
          metadata.document_type ||
          'document',
        confidence:
          (metadata.ai_classification as any)?.confidence_score ||
          metadata.type_confidence ||
          0.8,
        detection_method:
          (metadata.ai_classification as any)?.detection_method || 'automatic',
      },
      template_suggestions: (metadata.template_suggestions as any[]) || [],
      processing_recommendations: processingRecommendations,
    }
  }, [document])

  // Comprehensive logging for extracted fields debugging
  useEffect(() => {
    if (!document) return

    /* eslint-disable no-console */
    console.log('═══════════════════════════════════════════════════════')
    console.log('📊 [DocumentDetailView] Full Document Data Analysis')
    console.log('═══════════════════════════════════════════════════════')
    console.log('Document ID:', documentId)
    console.log('Document Name:', document.name)
    console.log('Processing Status:', document.processing_status)
    console.log('')

    console.log('--- Top-Level extracted_fields ---')
    console.log('Type:', typeof document.extracted_fields)
    console.log('Value:', document.extracted_fields)
    console.log(
      'Keys:',
      document.extracted_fields ? Object.keys(document.extracted_fields) : 'N/A'
    )
    console.log('')

    console.log('--- Metadata Structure ---')
    console.log('Metadata keys:', Object.keys(document.metadata || {}))
    console.log('Full metadata:', JSON.stringify(document.metadata, null, 2))
    console.log('')

    if (document.metadata) {
      const meta = document.metadata as Record<string, unknown>

      console.log('--- metadata.extracted_fields ---')
      console.log('Type:', typeof meta.extracted_fields)
      console.log('Value:', meta.extracted_fields)
      if (meta.extracted_fields && typeof meta.extracted_fields === 'object') {
        console.log('Keys:', Object.keys(meta.extracted_fields))
        console.log('Sample field:', Object.entries(meta.extracted_fields)[0])
      }
      console.log('')

      console.log('--- metadata.extraction_result ---')
      console.log('Type:', typeof meta.extraction_result)
      console.log('Value:', meta.extraction_result)
      if (
        meta.extraction_result &&
        typeof meta.extraction_result === 'object'
      ) {
        const er = meta.extraction_result as Record<string, unknown>
        console.log('Keys:', Object.keys(er))
        console.log('extracted_values type:', typeof er.extracted_values)
        console.log('extracted_values value:', er.extracted_values)
        if (er.extracted_values && typeof er.extracted_values === 'object') {
          console.log(
            'extracted_values keys:',
            Object.keys(er.extracted_values)
          )
          console.log(
            'Sample extracted value:',
            Object.entries(er.extracted_values)[0]
          )
        }
      }
      console.log('')

      console.log('--- metadata.extracted_data ---')
      console.log('Type:', typeof meta.extracted_data)
      console.log('Value:', meta.extracted_data)
      if (meta.extracted_data && typeof meta.extracted_data === 'object') {
        const ed = meta.extracted_data as Record<string, unknown>
        console.log('Keys:', Object.keys(ed))
        console.log('extracted_values type:', typeof ed.extracted_values)
        console.log('extracted_values value:', ed.extracted_values)
        if (ed.extracted_values && typeof ed.extracted_values === 'object') {
          console.log(
            'extracted_values keys:',
            Object.keys(ed.extracted_values)
          )
          console.log(
            'Sample extracted value:',
            Object.entries(ed.extracted_values)[0]
          )
        }
      }
      console.log('')

      console.log('--- metadata.fields ---')
      console.log('Type:', typeof meta.fields)
      console.log('Value:', meta.fields)
      if (meta.fields && typeof meta.fields === 'object') {
        console.log('Keys:', Object.keys(meta.fields))
        console.log('Sample field:', Object.entries(meta.fields)[0])
      }
    }

    console.log('═══════════════════════════════════════════════════════')
    /* eslint-enable no-console */
  }, [document, documentId])

  // Comprehensive field detection hook (reusable across components)
  const comprehensiveFieldDetection = useMemo(() => {
    if (!document)
      return {
        extractedFields: {},
        confidenceScores: {},
        detectionPath: 'none',
      }

    let extractedFields = {}
    let confidenceScores = {}
    let detectionPath = 'none'

    // Define data sources in priority order (most reliable first)
    const sources = [
      {
        name: 'metadata.extracted_data.extracted_values',
        getter: () =>
          (document.metadata as Record<string, unknown>)?.extracted_data,
        hasConfidence: true,
      },
      {
        name: 'metadata.extraction_result.extracted_values',
        getter: () =>
          (document.metadata as Record<string, unknown>)?.extraction_result,
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
        hasConfidence: true,
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
      console.log('rawData sources', rawData)
      if (!rawData) continue

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
          extractedFields = parseExtractedFields(data.extracted_values)
          detectionPath = source.name
          if (data.confidence_scores) {
            confidenceScores = data.confidence_scores
          }
          break
        }
      } else {
        // Direct field data without nested structure
        extractedFields = parsed
        detectionPath = source.name
        break
      }
    }

    return { extractedFields, confidenceScores, detectionPath }
  }, [document])

  // Convert document data to content format
  const documentContent: DocumentContent = useMemo(() => {
    if (!document) return { original: { text: '' }, processed: { text: '' } }

    // eslint-disable-next-line no-console
    console.log('📄 DocumentDetailView - Building content display', {
      documentId: document.id,
      documentName: document.name,
      contentTextLength: document.content_text?.length,
      contentTextPreview: document.content_text?.substring(0, 100),
      metadataKeys: Object.keys(document.metadata || {}),
    })

    // Try different sources for original and processed text
    const originalText = String(
      (document.metadata as any)?.original_content ??
        (document.metadata as any)?.original_text ??
        document.content_text ??
        ''
    )

    // For processed text, try to generate formatted template output if we have extracted data
    let processedText = String(
      (document.metadata as any)?.processed_content ??
        (document.metadata as any)?.extracted_content ??
        (document.metadata as any)?.processed_text ??
        document.content_text ??
        ''
    )

    // eslint-disable-next-line no-console
    console.log('📄 DocumentDetailView - Content resolution', {
      originalTextLength: originalText.length,
      processedTextLength: processedText.length,
      originalPreview: originalText.substring(0, 100),
      processedPreview: processedText.substring(0, 100),
    })

    // Get extracted data using consolidated utility (reads from all legacy paths)
    const extractedData = getSimpleFieldValues(document)

    return {
      original: {
        text: originalText,
        html: (document.metadata as any)?.original_html,
        metadata: document.metadata || {},
      },
      processed: {
        text: processedText,
        html:
          (document.metadata as any)?.processed_html ||
          (document.metadata as any)?.extracted_html,
        extracted_data: extractedData,
        template_applied:
          (document.metadata as any)?.template_name ||
          (document.metadata as any)?.template_id?.toString(),
      },
    }
  }, [document])

  // Initialize edited content when document loads
  useEffect(() => {
    if (documentContent.processed.text && !editedContent) {
      setEditedContent(
        documentContent.processed.html || documentContent.processed.text
      )
    }
  }, [
    documentContent.processed.text,
    documentContent.processed.html,
    editedContent,
  ])

  // Generate formatted output when document changes
  useEffect(() => {
    // Helper to extract a simple value from potentially nested structures
    const extractSimpleValue = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      if (typeof value !== 'object') return String(value)

      const obj = value as Record<string, unknown>
      // If it has a 'value' property, use that
      if ('value' in obj) return String(obj.value || '')
      // If it's an array, join values
      if (Array.isArray(value))
        return value.map((v) => extractSimpleValue(v)).join(', ')
      // Otherwise try to stringify nicely
      return JSON.stringify(value)
    }

    // Helper function to flatten and generate structured output from extracted data
    const generateStructuredOutput = (
      data: Record<string, unknown>
    ): string => {
      const lines: string[] = ['# Extracted Fields\n']

      // Try to find the actual extracted values - check common nested structures
      let fieldsToDisplay: Record<string, unknown> = {}

      // Check if data has nested extracted_values
      if (data.extracted_values && typeof data.extracted_values === 'object') {
        fieldsToDisplay = {
          ...fieldsToDisplay,
          ...(data.extracted_values as Record<string, unknown>),
        }
      }
      // Check for extraction_result.extracted_values
      if (
        data.extraction_result &&
        typeof data.extraction_result === 'object'
      ) {
        const result = data.extraction_result as Record<string, unknown>
        if (
          result.extracted_values &&
          typeof result.extracted_values === 'object'
        ) {
          fieldsToDisplay = {
            ...fieldsToDisplay,
            ...(result.extracted_values as Record<string, unknown>),
          }
        }
      }
      // If no nested structure found, use the data directly (but skip meta fields)
      if (Object.keys(fieldsToDisplay).length === 0) {
        Object.entries(data).forEach(([key, value]) => {
          // Skip meta fields like confidence_scores, extraction_method, etc.
          if (
            ![
              'confidence_scores',
              'extraction_method',
              'template_id',
              'processing_time',
            ].includes(key)
          ) {
            fieldsToDisplay[key] = value
          }
        })
      }

      // Get confidence scores if available
      const confidenceScores = (data.confidence_scores ||
        (data.extraction_result as Record<string, unknown> | undefined)
          ?.confidence_scores) as Record<string, number> | undefined

      // Generate the display
      Object.entries(fieldsToDisplay).forEach(([key, value]) => {
        const displayValue = extractSimpleValue(value)
        const label = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        const confidence = confidenceScores?.[key]
        const confidenceStr =
          confidence !== undefined
            ? ` _(${Math.round(confidence * 100)}% confidence)_`
            : ''
        lines.push(`**${label}:** ${displayValue}${confidenceStr}\n`)
      })

      if (lines.length === 1) {
        lines.push('_No extracted fields found_\n')
      }

      return lines.join('\n')
    }

    const generateOutput = async () => {
      const extractedData = documentContent.processed.extracted_data
      const metadata = document?.metadata as Record<string, unknown> | undefined
      const templateId = metadata?.template_id as number | string | undefined

      // If no extracted data, return original
      if (!extractedData || Object.keys(extractedData).length === 0) {
        return documentContent.processed.text
      }

      // If we have a template, use it to format the output
      if (templateId !== undefined && templateId !== null) {
        try {
          // Get the template used for processing (all templates are now smart templates)
          const template = await templateService.getTemplate(templateId)

          if (!template || !template.template_content) {
            // No template content, fall back to structured display
            return generateStructuredOutput(extractedData)
          }

          // Replace template variables with extracted values
          let formattedContent = template.template_content

          // Flatten extracted data for template replacement
          let flatFields: Record<string, unknown> = {}
          if (
            extractedData.extracted_values &&
            typeof extractedData.extracted_values === 'object'
          ) {
            flatFields = extractedData.extracted_values as Record<
              string,
              unknown
            >
          } else {
            flatFields = extractedData
          }

          Object.entries(flatFields).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`
            const displayValue = extractSimpleValue(value)
            // Escape special regex characters in placeholder
            const escapedPlaceholder = placeholder.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            )
            formattedContent = formattedContent.replace(
              new RegExp(escapedPlaceholder, 'g'),
              displayValue
            )
          })

          return formattedContent
        } catch (error) {
          /* eslint-disable no-console */
          console.error('Error generating formatted output:', error)
          /* eslint-enable no-console */
          return generateStructuredOutput(extractedData)
        }
      }

      // No template yet, show structured extracted data
      return generateStructuredOutput(extractedData)
    }

    if (
      documentContent.processed.extracted_data &&
      Object.keys(documentContent.processed.extracted_data).length > 0
    ) {
      generateOutput().then(setFormattedOutput)
    } else {
      setFormattedOutput(null)
    }
  }, [
    (document?.metadata as any)?.template_id,
    documentContent.processed.extracted_data,
    document?.name,
    documentContent.processed.text,
  ])

  // Add a field to the document's matched template from text selection
  const handleAddFieldFromSelection = useCallback(
    async (_templateId: number, field: NewFieldData) => {
      await templateService.addVariableToTemplate(_templateId, field)
      // Refresh template data
      queryClient.invalidateQueries({ queryKey: ['template', _templateId] })
      refetch()
    },
    [queryClient, refetch],
  )

  // Navigate to correct template edit page based on template type
  const navigateToTemplateEdit = async (
    templateId: number | string,
    _editMode = true
  ) => {
    try {
      navigate({
        to: '/templates/$templateId',
        params: { templateId: templateId.toString() },
      })
    } catch (error) {
      console.error('Error navigating to template:', error)
    }
  }

  // Helper function to get file for processing
  const getDocumentFile = async (): Promise<File> => {
    if (!document) throw new Error('Document not available')

    // Get the file - either from storage path or Supabase storage
    if (document.file_path && document.file_path.startsWith('http')) {
      // File is accessible via direct URL
      const response = await fetch(document.file_path)
      const blob = await response.blob()
      return new File([blob], document.name, {
        type: blob.type || document.file_type,
      })
    } else {
      // File needs to be fetched from Supabase storage
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path)

      if (error || !data) {
        throw new Error(
          `Failed to download file: ${error?.message || 'Unknown error'}`
        )
      }

      return new File([data], document.name, {
        type: data.type || document.file_type,
      })
    }
  }

  const handleProcessingAction = async (
    action: 'use_template' | 'generate_template',
    templateId?: number | string
  ) => {
    if (!document || !evaluation) return

    setIsProcessing(true)
    setProcessingError(null)
    try {
      // Update document status to processing
      await documentManager.updateDocumentStatus(documentId, {
        status: DocumentStatus.PROCESSING,
        metadata: {
          processing_method:
            action === 'use_template' ? 'template_guided' : 'ai_enhanced',
          template_id: templateId,
          ...document.metadata,
        },
      })

      const file = await getDocumentFile()

      let result
      if (action === 'use_template' && templateId) {
        result = await documentProcessor.processWithExistingTemplate(
          file,
          templateId
        )
      } else {
        // Uses unified decide-template endpoint internally (with legacy fallback)
        result = await documentProcessor.generateTemplate(
          file,
          `${evaluation.type_evaluation.primary_type} Template`,
          evaluation.type_evaluation.primary_type
        )

        // Show generated template dialog for review
        if (result && result.template) {
          setGeneratedTemplate(result)
          setShowGeneratedTemplateDialog(true)
          setIsProcessing(false)
          return // Don't finalize yet, wait for user decision
        }
      }

      // Finalize document with processing results
      await documentManager.finalizeDocument(documentId, {
        content_text: result?.content || '',
        extracted_fields: result?.extractedFields || result?.extracted_fields,
        processing_method:
          action === 'use_template' ? 'template_guided' : 'ai_enhanced',
        quality_metrics: result?.quality_metrics,
        // Store the original and processed content in metadata
        metadata: {
          original_content: result?.content || '',
          processed_content: result?.content || '',
          extracted_content: result?.content || '',
          extraction_result: {
            extracted_values:
              result?.extractedFields || result?.extracted_fields || {},
            confidence_scores: result?.confidence_scores || {},
          },
          // Also store the raw API response for debugging
          raw_api_response: {
            has_content: !!result?.content,
            has_extracted_fields: !!(
              result?.extractedFields || result?.extracted_fields
            ),
            content_length: result?.content?.length || 0,
          },
        },
      })

      // Invalidate queries and refetch
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] })
      await refetch()
    } catch (err) {
      // Error already captured in setProcessingError
      setProcessingError(
        err instanceof Error ? err.message : 'Document processing failed'
      )

      await documentManager.markDocumentFailed(
        documentId,
        err instanceof Error ? err.message : 'Document processing failed'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRerunExtraction = async () => {
    if (!document) return

    setIsProcessing(true)
    setProcessingError(null)

    try {
      // Reset document status to analyzing for re-evaluation
      await documentManager.updateDocumentStatus(documentId, {
        status: DocumentStatus.ANALYZING,
        metadata: {
          ...document.metadata,
          rerun_extraction: true as never,
          rerun_timestamp: new Date().toISOString(),
        },
      })

      const file = await getDocumentFile()

      // Re-evaluate document type
      const evaluationResult =
        await documentProcessor.evaluateDocumentType(file)

      // Update document with new analysis results
      await documentManager.updateDocumentStatus(documentId, {
        status: DocumentStatus.ANALYZING,
        metadata: {
          ...document.metadata,
          document_type: evaluationResult.type_evaluation.primary_type,
          type_confidence: evaluationResult.type_evaluation.confidence,
          ai_classification: {
            primary_category: evaluationResult.type_evaluation.primary_type,
            confidence_score: evaluationResult.type_evaluation.confidence,
            detection_method: evaluationResult.type_evaluation.detection_method,
          },
          template_suggestions: evaluationResult.template_suggestions,
          rerun_extraction: true as never,
          rerun_timestamp: new Date().toISOString(),
        },
      })

      // Automatically run smart extraction with the best template
      if (evaluationResult.template_suggestions.length > 0) {
        const bestTemplate = evaluationResult.template_suggestions[0]
        await handleProcessingAction('use_template', bestTemplate.template_id)
      } else {
        await handleProcessingAction('generate_template')
      }

      // Invalidate queries and refetch
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] })
      await refetch()
    } catch (err) {
      // Error already captured in setProcessingError
      setProcessingError(
        err instanceof Error ? err.message : 'Failed to rerun extraction'
      )

      await documentManager.markDocumentFailed(
        documentId,
        err instanceof Error ? err.message : 'Failed to rerun extraction'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleForceRetry = async () => {
    if (!document) return

    setIsProcessing(true)
    setProcessingError(null)

    try {
      console.log('🔄 Forcing retry for stuck document:', documentId)
      await UnifiedDocumentService.forceRetryAnalysis(documentId)

      // Refresh the document data
      refetch()
    } catch (error) {
      console.error('❌ Force retry failed:', error)
      setProcessingError(
        error instanceof Error ? error.message : 'Failed to force retry'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleForceComplete = async () => {
    if (!document) return

    setIsProcessing(true)
    setProcessingError(null)

    try {
      console.log('⚡ Force completing stuck document:', documentId)
      await UnifiedDocumentService.forceCompleteDocument(documentId)

      // Refresh the document data
      refetch()
    } catch (error) {
      console.error('❌ Force complete failed:', error)
      setProcessingError(
        error instanceof Error ? error.message : 'Failed to force complete'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  // Handler for saving generated template
  const handleSaveGeneratedTemplate = async (_templateData: unknown) => {
    if (!document) return

    try {
      // Save template through the dialog's mutation
      // After saving, the dialog will navigate to the template editor
    } catch (error) {
      console.error('Failed to save generated template:', error)
      setProcessingError(
        error instanceof Error ? error.message : 'Failed to save template'
      )
    }
  }

  // Ref for debouncing auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Handler for auto-saving template content changes (debounced)
  const handleTemplateContentChange = useCallback(
    (content: string) => {
      if (!documentId) {
        console.warn(
          '[DocumentDetailView] handleTemplateContentChange: No documentId'
        )
        return
      }

      // eslint-disable-next-line no-console
      console.log('[DocumentDetailView] handleTemplateContentChange called:', {
        documentId,
        contentLength: content.length,
      })

      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }

      // Debounce the save - wait 1 second after user stops typing
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          // eslint-disable-next-line no-console
          console.log(
            '[DocumentDetailView] Auto-saving custom template content...'
          )

          const currentDoc = document
          if (!currentDoc) return

          const metadata = currentDoc.metadata as
            | Record<string, unknown>
            | undefined
          const updatedMetadata = {
            ...metadata,
            custom_template_content: content,
            custom_template_updated_at: new Date().toISOString(),
          }

          // Keep current status (default to COMPLETED if not set)
          // Map string status to DocumentStatus enum
          const statusMap: Record<string, DocumentStatus> = {
            uploaded: DocumentStatus.UPLOADED,
            analyzing: DocumentStatus.ANALYZING,
            processing: DocumentStatus.PROCESSING,
            completed: DocumentStatus.COMPLETED,
            failed: DocumentStatus.FAILED,
          }
          const currentStatus =
            statusMap[currentDoc.processing_status || 'completed'] ||
            DocumentStatus.COMPLETED

          await UnifiedDocumentService.updateDocumentStatus(documentId, {
            status: currentStatus,
            metadata: updatedMetadata,
          })

          // eslint-disable-next-line no-console
          console.log('[DocumentDetailView] Auto-save SUCCESSFUL')
        } catch (error) {
          console.error('[DocumentDetailView] Auto-save failed:', error)
        }
      }, 1000)
    },
    [documentId, document]
  )

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // Handler for saving template content edits from TemplateOutputView
  const handleSaveTemplateContent = async (
    content: string,
    action: 'create' | 'modify',
    newName?: string
  ): Promise<void> => {
    if (!document) {
      console.warn(
        '[DocumentDetailView] handleSaveTemplateContent: No document available'
      )
      return
    }

    // eslint-disable-next-line no-console
    console.log('[DocumentDetailView] handleSaveTemplateContent called:', {
      documentId,
      action,
      contentLength: content.length,
      newName,
    })

    try {
      if (action === 'modify') {
        // Save as document-specific custom template content
        // This overrides the template output for THIS document only
        const metadata = document.metadata as
          | Record<string, unknown>
          | undefined
        const updatedMetadata = {
          ...metadata,
          custom_template_content: content,
          custom_template_updated_at: new Date().toISOString(),
        }

        // Keep current status (default to COMPLETED if not set)
        // Map string status to DocumentStatus enum
        const statusMap: Record<string, DocumentStatus> = {
          uploaded: DocumentStatus.UPLOADED,
          analyzing: DocumentStatus.ANALYZING,
          processing: DocumentStatus.PROCESSING,
          completed: DocumentStatus.COMPLETED,
          failed: DocumentStatus.FAILED,
        }
        const currentStatus =
          statusMap[document.processing_status || 'completed'] ||
          DocumentStatus.COMPLETED

        await UnifiedDocumentService.updateDocumentStatus(documentId, {
          status: currentStatus,
          metadata: updatedMetadata,
        })

        // eslint-disable-next-line no-console
        console.log(
          '[DocumentDetailView] Saved custom template content SUCCESSFULLY'
        )

        // Refresh document data to reflect the save
        await refetch()
      } else if (action === 'create' && newName) {
        // Create a new template with this content
        const templateData = {
          name: newName,
          template_content: content,
          description: `Template created from document: ${document.name}`,
          category: 'custom',
          is_public: false,
        }

        const result = await templateService.createTemplate(templateData)
        // eslint-disable-next-line no-console
        console.log('[DocumentDetailView] Created new template:', result)

        // Optionally navigate to the new template
        if (result?.id) {
          navigate({
            to: '/templates/$templateId',
            params: { templateId: String(result.id) },
          })
        }
      }
    } catch (error) {
      console.error(
        '[DocumentDetailView] Failed to save template content:',
        error
      )
      setProcessingError(
        error instanceof Error ? error.message : 'Failed to save template'
      )
      throw error // Re-throw so TemplateOutputView can handle UI feedback
    }
  }

  // Handler for using generated template without saving
  const handleUseGeneratedTemplate = async (templateData: any) => {
    if (!document || !generatedTemplate) return

    setIsProcessing(true)
    setProcessingError(null)
    setShowGeneratedTemplateDialog(false)

    try {
      // Finalize document with the generated template result
      await documentManager.finalizeDocument(documentId, {
        content_text: generatedTemplate?.content || '',
        extracted_fields:
          generatedTemplate?.extractedFields ||
          generatedTemplate?.extracted_fields ||
          {},
        processing_method: 'ai_enhanced',
        quality_metrics: generatedTemplate?.quality_metrics,
        metadata: {
          original_content: generatedTemplate?.content || '',
          processed_content: generatedTemplate?.content || '',
          extracted_content: generatedTemplate?.content || '',
          extraction_result: {
            extracted_values:
              generatedTemplate?.extractedFields ||
              generatedTemplate?.extracted_fields ||
              {},
            confidence_scores: generatedTemplate?.confidence_scores || {},
          },
          template_used: {
            id: 'generated',
            name: templateData.template.name,
            type: 'ai_generated',
            generated_at: new Date().toISOString(),
          },
        },
      })

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] })
      await refetch()
    } catch (error) {
      console.error(
        'Failed to finalize document with generated template:',
        error
      )
      setProcessingError(
        error instanceof Error ? error.message : 'Failed to process document'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAutoComplete = async () => {
    if (!document) return

    setIsProcessing(true)
    setProcessingError(null)

    try {
      console.log('🔄 Auto-completing stuck document:', documentId)
      const wasCompleted =
        await UnifiedDocumentService.autoCompleteIfProcessed(documentId)

      if (wasCompleted) {
        console.log('✅ Document auto-completed successfully')
        refetch()
      } else {
        console.log(
          '⚠️ Document was not auto-completed (may not meet criteria)'
        )
        setProcessingError('Document does not meet auto-completion criteria')
      }
    } catch (error) {
      console.error('❌ Auto-complete failed:', error)
      setProcessingError(
        error instanceof Error ? error.message : 'Failed to auto-complete'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  // Status utilities moved to @/lib/document-utils and @/components/shared/StatusBadge

  const calculateProcessingProgress = (doc: any) => {
    if (!doc) return 0

    const status = doc.processing_status || doc.status

    switch (status) {
      case 'analyzing':
        return 25
      case 'processing':
        return 75
      case 'completed':
        return 100
      case 'failed':
        return 0
      default:
        return 10
    }
  }

  const handleSaveContent = async () => {
    if (onSave && editedContent) {
      await onSave(editedContent)
      setEditMode(false)
    }
  }

  const handleDownload = async (
    format: 'json' | 'txt' | 'csv' | 'html' | 'docx' | 'md' | 'pdf'
  ) => {
    // Get the content to export - use template view or generated output based on toggle
    const contentToExport =
      showTemplateView && rawTemplateContent
        ? rawTemplateContent
        : formattedOutput || documentContent.processed.text

    const fileName = document?.name?.replace(/\.[^/.]+$/, '') || 'document'

    // Helper to trigger download
    const downloadFile = (
      content: string,
      filename: string,
      mimeType: string
    ) => {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = filename
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    switch (format) {
      case 'md':
        downloadFile(contentToExport, `${fileName}.md`, 'text/markdown')
        break

      case 'txt':
        downloadFile(contentToExport, `${fileName}.txt`, 'text/plain')
        break

      case 'html': {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3 { color: #1a1a1a; }
    p { margin: 1em 0; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
${contentToExport.replace(/\n/g, '<br>\n')}
</body>
</html>`
        downloadFile(htmlContent, `${fileName}.html`, 'text/html')
        break
      }

      case 'pdf': {
        // Generate PDF using browser print
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @media print { @page { margin: 1in; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3 { color: #1a1a1a; }
    p { margin: 1em 0; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
  </style>
</head>
<body>
<h1>${fileName}</h1>
${contentToExport.replace(/\n/g, '<br>\n')}
</body>
</html>`)
          printWindow.document.close()
          printWindow.focus()
          setTimeout(() => {
            printWindow.print()
            printWindow.close()
          }, 250)
        }
        break
      }

      case 'docx': {
        // For DOCX, create a simple HTML-based document that Word can open
        const docContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
</head>
<body>
<h1>${fileName}</h1>
${contentToExport.replace(/\n/g, '<br>\n')}
</body>
</html>`
        downloadFile(docContent, `${fileName}.doc`, 'application/msword')
        break
      }

      case 'json': {
        const jsonContent = JSON.stringify(
          {
            name: fileName,
            content: contentToExport,
            extractedFields: comprehensiveFieldDetection.extractedFields,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        )
        downloadFile(jsonContent, `${fileName}.json`, 'application/json')
        break
      }

      default:
        if (onDownload) {
          await onDownload(format)
        }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add toast notification here
    } catch (err) {
      // Could add user notification here
    }
  }

  const handleSaveExtractedFields = async (fields: Record<string, any>) => {
    if (!document) return

    try {
      // Update document metadata with new field values by marking as completed
      const existingExtraction: any =
        (document.metadata as any)?.extraction_result || {}
      await UnifiedDocumentService.updateDocumentStatus(documentId, {
        status: DocumentStatus.COMPLETED,
        metadata: {
          ...(document.metadata as any),
          extracted_fields: fields,
          extraction_result: {
            ...existingExtraction,
            extracted_values: fields,
          },
        },
      })

      // Invalidate queries to refresh the document data
      queryClient.invalidateQueries({
        queryKey: ['processedDocument', documentId],
      })

      console.log('✅ Extracted fields updated successfully')
    } catch (error) {
      console.error('❌ Failed to update extracted fields:', error)
      throw error
    }
  }

  // Handler for when TemplateOutputView extracts new fields in real-time
  const handleFieldsChange = useCallback(
    async (
      newFields: Record<
        string,
        {
          value: string | null
          confidence?: number
          sourceText?: string
          type?: string
        }
      >
    ) => {
      if (!document) return

      try {
        // eslint-disable-next-line no-console
        console.log(
          '[DocumentDetailView] handleFieldsChange: New fields extracted',
          {
            fieldCount: Object.keys(newFields).length,
            fields: newFields,
          }
        )

        // Convert new fields to ExtractedFieldsMap format
        const newFieldsMap: ExtractedFieldsMap = {}
        for (const [key, fieldData] of Object.entries(newFields)) {
          newFieldsMap[key] = {
            value: fieldData.value,
            confidence: fieldData.confidence,
            sourceText: fieldData.sourceText,
          }
        }

        // Use consolidated utility to merge and write to canonical path
        const updatedMetadata = createMetadataWithExtractedFields(
          document.metadata as Record<string, unknown>,
          newFieldsMap
        )

        // Update document metadata with merged fields in canonical location
        await UnifiedDocumentService.updateDocumentStatus(documentId, {
          status: DocumentStatus.COMPLETED,
          metadata: updatedMetadata as Record<string, unknown>,
        })

        // Invalidate queries to refresh the document data
        await queryClient.invalidateQueries({
          queryKey: ['processedDocument', documentId],
        })

        // eslint-disable-next-line no-console
        console.log('✅ New fields saved and document refreshed')
      } catch (error) {
        console.error('❌ Failed to save new extracted fields:', error)
      }
    },
    [document, documentId, queryClient]
  )

  const handleCreateTemplateFromFields = async (templateData: {
    name: string
    description: string
    category: string
    smart_variables: any[]
    is_public: boolean
  }) => {
    try {
      // Generate template_content by replacing extracted values with placeholders
      const { extractedFields } = comprehensiveFieldDetection
      let templateContent = documentContent.original.text

      // Replace each extracted value with {{placeholder}} syntax
      Object.entries(extractedFields).forEach(([key, value]) => {
        if (value && String(value).length > 0) {
          // Escape special regex characters in the value
          const escapedValue = String(value).replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )
          // Create regex to find the value (case-insensitive, whole word)
          const regex = new RegExp(escapedValue, 'gi')
          // Replace with placeholder
          templateContent = templateContent.replace(regex, `{{${key}}}`)
        }
      })

      // Use the unified template service to create a new template
      const newTemplate = await templateService.createTemplate({
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        smart_variables: templateData.smart_variables,
        is_public: templateData.is_public,
        template_content: templateContent, // Include generated template content
        tags: [],
      } as any)

      /* eslint-disable no-console */
      console.log('✅ Template created successfully:', newTemplate)

      // Associate the template with the document
      if (newTemplate.id && document) {
        console.log('🔗 Associating template with document:', {
          documentId,
          templateId: newTemplate.id,
          templateName: newTemplate.name,
        })

        await UnifiedDocumentService.updateDocumentStatus(documentId, {
          status: DocumentStatus.COMPLETED, // Keep current status
          metadata: {
            template_id: newTemplate.id,
            template_name: newTemplate.name,
            template_associated_at: new Date().toISOString(),
          },
        })

        console.log('✅ Template associated with document successfully')
        /* eslint-enable no-console */

        // Refetch document to show updated metadata
        await refetch()
      }

      setShowCreateTemplateDialog(false)

      // Invalidate template queries to refresh template lists
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    } catch (error) {
      console.error('❌ Failed to create template:', error)
      throw error
    }
  }

  return {
    // Navigation
    navigate,

    // Query state
    document,
    isLoading,
    error: error as Error | null,
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
    setIsProcessing,
    processingError,
    setProcessingError,
    showTemplateChanger,
    setShowTemplateChanger,
    showGeneratedTemplateDialog,
    setShowGeneratedTemplateDialog,
    generatedTemplate,
    setGeneratedTemplate,
    showCreateTemplateDialog,
    setShowCreateTemplateDialog,
    fieldsForTemplate,
    setFieldsForTemplate,
    documentFileUrl,
    setDocumentFileUrl,
    formattedOutput,
    setFormattedOutput,
    showTemplateView,
    setShowTemplateView,
    rawTemplateContent,
    setRawTemplateContent,
    activeHighlightField,
    setActiveHighlightField,
    fieldPositions,
    setFieldPositions,
    isLoadingPositions,

    // Refs
    contentRef,
    textSelection,

    // Services/managers
    documentProcessor,
    documentManager,
    queryClient,
    session,

    // Derived data
    evaluation,
    comprehensiveFieldDetection,
    documentContent,
    documentTemplateId,

    // Action handlers
    handleAddFieldFromSelection,
    navigateToTemplateEdit,
    getDocumentFile,
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
  }
}
