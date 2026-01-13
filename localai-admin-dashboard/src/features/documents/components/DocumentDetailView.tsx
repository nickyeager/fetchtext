/**
 * Simplified Document Detail View
 * Shows document content with processing capabilities
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { SimpleEditor } from '@/components/ui/simple-editor';
import { MarkdownViewer } from './MarkdownViewer';
import { templateService } from '@/services/template-service';
import { UnifiedDocumentService } from '@/services/unified-document-service';
import type { DocumentRecord } from '@/services/unified-document-service';
import { DocumentStatus } from '@/services/unified-document-service';
import type { DocumentEvaluation as SharedDocumentEvaluation } from '@/types/extraction';
import TemplateSelector from '@/components/documents/TemplateSelector';
import { GeneratedTemplateDialog } from '@/components/templates/GeneratedTemplateDialog';
import { ExtractedFieldsEditor } from './ExtractedFieldsEditor';
import { CreateTemplateFromFields } from './CreateTemplateFromFields';
import { DocumentPipelineView } from './DocumentPipelineView';
import { TemplateVariablesPanel } from './TemplateVariablesPanel';
import { DualDocumentView } from './DualDocumentView';
import { supabase } from '@/lib/supabase';

// Shared utilities - DRY refactor
import { parseExtractedFields } from '@/lib/document-utils';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface DocumentDetailViewProps {
  documentId: string;
  onBack?: () => void;
  onDownload?: (format: 'json' | 'txt' | 'csv' | 'html' | 'docx') => Promise<void>;
  onSave?: (content: string) => Promise<void>;
}

type DocumentEvaluation = SharedDocumentEvaluation;

// Removed unused ExtractedFieldValue interface

interface DocumentContent {
  original: {
    text: string;
    html?: string;
    metadata?: Record<string, unknown>;
  };
  processed: {
    text: string;
    html?: string;
    extracted_data?: Record<string, unknown>;
    template_applied?: string;
  };
}

export function DocumentDetailView({ 
  documentId, 
  onBack, 
  onDownload, 
  onSave 
}: DocumentDetailViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'dual' | 'side-by-side' | 'tabs' | 'overlay' | 'pipeline'>('dual');
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [showTemplateChanger, setShowTemplateChanger] = useState(false);
  const [showGeneratedTemplateDialog, setShowGeneratedTemplateDialog] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [fieldsForTemplate, setFieldsForTemplate] = useState<any[]>([]);
  const [documentFileUrl, setDocumentFileUrl] = useState<string | null>(null);

  const documentProcessor = React.useMemo(() => new DocumentProcessorEnhanced(), []);
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });
  
  // State for formatted template output (moved to top to avoid hooks order issues)
  const [formattedOutput, setFormattedOutput] = React.useState<string | null>(null);

  // State for template view toggle - switch between raw template and generated output
  // Default to showing template view (with {{variable}} placeholders)
  const [showTemplateView, setShowTemplateView] = React.useState(true);
  const [rawTemplateContent, setRawTemplateContent] = React.useState<string | null>(null);

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
      const data = query.state.data as DocumentRecord | null | undefined;
      // CRITICAL FIX: Keep polling if data is undefined (document not loaded yet)
      if (data === undefined || data === null) {
        console.log('⏳ Document not loaded yet, continuing to poll...');
        return 2000; // Keep polling when no data
      }

      // Debug current status
      console.log('🔄 Polling check:', {
        documentId: data.id,
        processing_status: data.processing_status,
        status: data.status,
        currentStatus: data.processing_status || data.status,
        effectiveStatus: data.processing_status || data.status,
        metadata: data.metadata
      });

      // Poll while document is being processed - check the actual status field being used
      const currentStatus = data.processing_status || data.status;
      const isProcessing = currentStatus === 'analyzing' ||
                          currentStatus === 'processing' ||
                          currentStatus === 'uploading' ||
                          currentStatus === 'pending';

      if (isProcessing) {
        console.log('🔄 Continue polling - document status:', currentStatus);
        return 2000; // Poll every 2 seconds
      }

      console.log('✅ Stop polling - document completed:', currentStatus || 'unknown');
      return false; // Stop polling
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
      skipCache: true
    },
  });

  // Force immediate refetch when component mounts or document changes
  useEffect(() => {
    if (documentId) {
      console.log('🔄 Component mounted/updated, forcing immediate refetch for document:', documentId);
      refetch();
    }
  }, [documentId, refetch]);

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
          // eslint-disable-next-line no-console
          console.error('[DocumentDetailView] Failed to get signed URL:', error);
          setDocumentFileUrl(null);
          return;
        }

        setDocumentFileUrl(data.signedUrl);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[DocumentDetailView] Error getting document URL:', error);
        setDocumentFileUrl(null);
      }
    };

    fetchDocumentUrl();
  }, [document?.file_path]);

  // Extract templateId for dependency tracking
  const documentTemplateId = (document?.metadata as Record<string, unknown> | undefined)?.template_id as number | undefined;

  // Fetch raw template content when template_id is available
  // Also check for custom_template_content in document metadata (document-specific override)
  useEffect(() => {
    const fetchTemplateContent = async () => {
      // First check for document-specific custom template content
      const metadata = document?.metadata as Record<string, unknown> | undefined;
      const customContent = metadata?.custom_template_content as string | undefined;

      if (customContent) {
        // eslint-disable-next-line no-console
        console.log('[DocumentDetailView] Using custom template content from document metadata');
        setRawTemplateContent(customContent);
        return;
      }

      // Fall back to the global template content
      if (!documentTemplateId) {
        setRawTemplateContent(null);
        return;
      }

      try {
        const template = await templateService.getTemplate(documentTemplateId);
        if (template?.template_content) {
          setRawTemplateContent(template.template_content);
        } else {
          setRawTemplateContent(null);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[DocumentDetailView] Error fetching template content:', error);
        setRawTemplateContent(null);
      }
    };

    fetchTemplateContent();
  }, [documentTemplateId, document?.metadata]);

  // Derive evaluation data from document metadata
  const evaluation = useMemo<DocumentEvaluation | null>(() => {
    if (!document?.metadata) return null;
    
    const metadata = document.metadata as Record<string, unknown>;
    
    // Only show evaluation for documents that have AI analysis results
    if (!metadata.template_suggestions && !metadata.ai_classification && !metadata.document_type) {
      return null;
    }
    
    const processingRecommendations = (metadata as any).processing_recommendations || {
      workflow: ((metadata as any).template_suggestions?.length || 0) > 0 ? 'existing_template' : 'generate_template',
      suggested_action: ((metadata as any).template_suggestions?.length || 0) > 0
        ? `Use the "${(metadata as any).template_suggestions?.[0]?.template_name || 'Recommended'}" template for best results`
        : 'Generate a new AI-powered template for this document type',
      alternative_actions: ['Generate a new template', 'Browse all templates'],
      confidence_level: ((metadata as any)?.ai_classification?.confidence_score || 0) > 0.8 ? 'high' : 'medium',
    };

    return {
      document_info: {
        filename: document.name,
        file_size: document.file_size,
        mime_type: document.file_type,
        format_supported: true,
      },
      type_evaluation: {
        primary_type: (metadata.ai_classification as any)?.primary_category || metadata.document_type || 'document',
        confidence: (metadata.ai_classification as any)?.confidence_score || metadata.type_confidence || 0.8,
        detection_method: (metadata.ai_classification as any)?.detection_method || 'automatic',
      },
      template_suggestions: (metadata.template_suggestions as any[]) || [],
      processing_recommendations: processingRecommendations,
    };
  }, [document]);

  // Comprehensive logging for extracted fields debugging
  useEffect(() => {
    if (!document) return;

    /* eslint-disable no-console */
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 [DocumentDetailView] Full Document Data Analysis');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Document ID:', documentId);
    console.log('Document Name:', document.name);
    console.log('Processing Status:', document.processing_status);
    console.log('');

    console.log('--- Top-Level extracted_fields ---');
    console.log('Type:', typeof document.extracted_fields);
    console.log('Value:', document.extracted_fields);
    console.log('Keys:', document.extracted_fields ? Object.keys(document.extracted_fields) : 'N/A');
    console.log('');

    console.log('--- Metadata Structure ---');
    console.log('Metadata keys:', Object.keys(document.metadata || {}));
    console.log('Full metadata:', JSON.stringify(document.metadata, null, 2));
    console.log('');

    if (document.metadata) {
      const meta = document.metadata as Record<string, unknown>;

      console.log('--- metadata.extracted_fields ---');
      console.log('Type:', typeof meta.extracted_fields);
      console.log('Value:', meta.extracted_fields);
      if (meta.extracted_fields && typeof meta.extracted_fields === 'object') {
        console.log('Keys:', Object.keys(meta.extracted_fields));
        console.log('Sample field:', Object.entries(meta.extracted_fields)[0]);
      }
      console.log('');

      console.log('--- metadata.extraction_result ---');
      console.log('Type:', typeof meta.extraction_result);
      console.log('Value:', meta.extraction_result);
      if (meta.extraction_result && typeof meta.extraction_result === 'object') {
        const er = meta.extraction_result as Record<string, unknown>;
        console.log('Keys:', Object.keys(er));
        console.log('extracted_values type:', typeof er.extracted_values);
        console.log('extracted_values value:', er.extracted_values);
        if (er.extracted_values && typeof er.extracted_values === 'object') {
          console.log('extracted_values keys:', Object.keys(er.extracted_values));
          console.log('Sample extracted value:', Object.entries(er.extracted_values)[0]);
        }
      }
      console.log('');

      console.log('--- metadata.extracted_data ---');
      console.log('Type:', typeof meta.extracted_data);
      console.log('Value:', meta.extracted_data);
      if (meta.extracted_data && typeof meta.extracted_data === 'object') {
        const ed = meta.extracted_data as Record<string, unknown>;
        console.log('Keys:', Object.keys(ed));
        console.log('extracted_values type:', typeof ed.extracted_values);
        console.log('extracted_values value:', ed.extracted_values);
        if (ed.extracted_values && typeof ed.extracted_values === 'object') {
          console.log('extracted_values keys:', Object.keys(ed.extracted_values));
          console.log('Sample extracted value:', Object.entries(ed.extracted_values)[0]);
        }
      }
      console.log('');

      console.log('--- metadata.fields ---');
      console.log('Type:', typeof meta.fields);
      console.log('Value:', meta.fields);
      if (meta.fields && typeof meta.fields === 'object') {
        console.log('Keys:', Object.keys(meta.fields));
        console.log('Sample field:', Object.entries(meta.fields)[0]);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    /* eslint-enable no-console */
  }, [document, documentId]);

  // Comprehensive field detection hook (reusable across components)
  const comprehensiveFieldDetection = useMemo(() => {
    if (!document) return { extractedFields: {}, confidenceScores: {}, detectionPath: 'none' };

    let extractedFields = {};
    let confidenceScores = {};
    let detectionPath = 'none';

    // Define data sources in priority order (most reliable first)
    const sources = [
      {
        name: 'metadata.extracted_data.extracted_values',
        getter: () => (document.metadata as Record<string, unknown>)?.extracted_data,
        hasConfidence: true
      },
      {
        name: 'metadata.extraction_result.extracted_values',
        getter: () => (document.metadata as Record<string, unknown>)?.extraction_result,
        hasConfidence: true
      },
      {
        name: 'document.extracted_fields',
        getter: () => document.extracted_fields,
        hasConfidence: false
      },
      {
        name: 'metadata.extracted_fields',
        getter: () => document.metadata?.extracted_fields,
        hasConfidence: false
      },
      {
        name: 'metadata.fields',
        getter: () => document.metadata?.fields,
        hasConfidence: false
      }
    ];

    // Try each source in priority order
    for (const source of sources) {
      const rawData = source.getter();
      if (!rawData) continue;

      // Parse the data (handles JSON strings and objects)
      const parsed = parseExtractedFields(rawData);
      if (Object.keys(parsed).length === 0) continue;

      // Check if this source has extracted_values structure
      if (source.hasConfidence && 'extracted_values' in parsed) {
        const data = parsed as { extracted_values?: Record<string, unknown>; confidence_scores?: Record<string, number> };
        if (data.extracted_values && Object.keys(data.extracted_values).length > 0) {
          extractedFields = parseExtractedFields(data.extracted_values);
          detectionPath = source.name;
          if (data.confidence_scores) {
            confidenceScores = data.confidence_scores;
          }
          break;
        }
      } else {
        // Direct field data without nested structure
        extractedFields = parsed;
        detectionPath = source.name;
        break;
      }
    }

    return { extractedFields, confidenceScores, detectionPath };
  }, [document]);

  // Convert document data to content format
  const documentContent: DocumentContent = useMemo(() => {
    if (!document) return { original: { text: '' }, processed: { text: '' } };

    // eslint-disable-next-line no-console
    console.log('📄 DocumentDetailView - Building content display', {
      documentId: document.id,
      documentName: document.name,
      contentTextLength: document.content_text?.length,
      contentTextPreview: document.content_text?.substring(0, 100),
      metadataKeys: Object.keys(document.metadata || {})
    });

    // Try different sources for original and processed text
    const originalText = String(
      (document.metadata as any)?.original_content ??
      (document.metadata as any)?.original_text ??
      document.content_text ??
      ''
    );

    // For processed text, try to generate formatted template output if we have extracted data
    let processedText = String(
      (document.metadata as any)?.processed_content ??
      (document.metadata as any)?.extracted_content ??
      (document.metadata as any)?.processed_text ??
      document.content_text ??
      ''
    );

    // eslint-disable-next-line no-console
    console.log('📄 DocumentDetailView - Content resolution', {
      originalTextLength: originalText.length,
      processedTextLength: processedText.length,
      originalPreview: originalText.substring(0, 100),
      processedPreview: processedText.substring(0, 100)
    });
    
    // Get extracted data from various sources
    let extractedData: Record<string, unknown> = {};
    if (document.extracted_fields && typeof document.extracted_fields === 'object') {
      extractedData = document.extracted_fields as Record<string, unknown>;
    } else if ((document.metadata as any)?.extracted_fields && typeof (document.metadata as any).extracted_fields === 'object') {
      extractedData = (document.metadata as any).extracted_fields as Record<string, unknown>;
    } else if ((document.metadata as any)?.extraction_result?.extracted_values && typeof (document.metadata as any).extraction_result.extracted_values === 'object') {
      extractedData = (document.metadata as any).extraction_result.extracted_values as Record<string, unknown>;
    }
    
    return {
      original: {
        text: originalText,
        html: (document.metadata as any)?.original_html,
        metadata: document.metadata || {}
      },
      processed: {
        text: processedText,
        html: (document.metadata as any)?.processed_html || (document.metadata as any)?.extracted_html,
        extracted_data: extractedData,
        template_applied: (document.metadata as any)?.template_name || (document.metadata as any)?.template_id?.toString()
      }
    };
  }, [document]);

  // Initialize edited content when document loads
  useEffect(() => {
    if (documentContent.processed.text && !editedContent) {
      setEditedContent(documentContent.processed.html || documentContent.processed.text);
    }
  }, [documentContent.processed.text, documentContent.processed.html, editedContent]);
  
  // Generate formatted output when document changes
  useEffect(() => {
    // Helper to extract a simple value from potentially nested structures
    const extractSimpleValue = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (typeof value !== 'object') return String(value);

      const obj = value as Record<string, unknown>;
      // If it has a 'value' property, use that
      if ('value' in obj) return String(obj.value || '');
      // If it's an array, join values
      if (Array.isArray(value)) return value.map(v => extractSimpleValue(v)).join(', ');
      // Otherwise try to stringify nicely
      return JSON.stringify(value);
    };

    // Helper function to flatten and generate structured output from extracted data
    const generateStructuredOutput = (data: Record<string, unknown>): string => {
      const lines: string[] = ['# Extracted Fields\n'];

      // Try to find the actual extracted values - check common nested structures
      let fieldsToDisplay: Record<string, unknown> = {};

      // Check if data has nested extracted_values
      if (data.extracted_values && typeof data.extracted_values === 'object') {
        fieldsToDisplay = { ...fieldsToDisplay, ...(data.extracted_values as Record<string, unknown>) };
      }
      // Check for extraction_result.extracted_values
      if (data.extraction_result && typeof data.extraction_result === 'object') {
        const result = data.extraction_result as Record<string, unknown>;
        if (result.extracted_values && typeof result.extracted_values === 'object') {
          fieldsToDisplay = { ...fieldsToDisplay, ...(result.extracted_values as Record<string, unknown>) };
        }
      }
      // If no nested structure found, use the data directly (but skip meta fields)
      if (Object.keys(fieldsToDisplay).length === 0) {
        Object.entries(data).forEach(([key, value]) => {
          // Skip meta fields like confidence_scores, extraction_method, etc.
          if (!['confidence_scores', 'extraction_method', 'template_id', 'processing_time'].includes(key)) {
            fieldsToDisplay[key] = value;
          }
        });
      }

      // Get confidence scores if available
      const confidenceScores = (data.confidence_scores ||
        (data.extraction_result as Record<string, unknown> | undefined)?.confidence_scores) as Record<string, number> | undefined;

      // Generate the display
      Object.entries(fieldsToDisplay).forEach(([key, value]) => {
        const displayValue = extractSimpleValue(value);
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const confidence = confidenceScores?.[key];
        const confidenceStr = confidence !== undefined ? ` _(${Math.round(confidence * 100)}% confidence)_` : '';
        lines.push(`**${label}:** ${displayValue}${confidenceStr}\n`);
      });

      if (lines.length === 1) {
        lines.push('_No extracted fields found_\n');
      }

      return lines.join('\n');
    };

    const generateOutput = async () => {
      const extractedData = documentContent.processed.extracted_data;
      const metadata = document?.metadata as Record<string, unknown> | undefined;
      const templateId = metadata?.template_id as number | undefined;

      // If no extracted data, return original
      if (!extractedData || Object.keys(extractedData).length === 0) {
        return documentContent.processed.text;
      }

      // If we have a template, use it to format the output
      if (templateId !== undefined && templateId !== null) {
        try {
          // Get the template used for processing (all templates are now smart templates)
          const template = await templateService.getTemplate(templateId);

          if (!template || !template.template_content) {
            // No template content, fall back to structured display
            return generateStructuredOutput(extractedData);
          }

          // Replace template variables with extracted values
          let formattedContent = template.template_content;

          // Flatten extracted data for template replacement
          let flatFields: Record<string, unknown> = {};
          if (extractedData.extracted_values && typeof extractedData.extracted_values === 'object') {
            flatFields = extractedData.extracted_values as Record<string, unknown>;
          } else {
            flatFields = extractedData;
          }

          Object.entries(flatFields).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            const displayValue = extractSimpleValue(value);
            // Escape special regex characters in placeholder
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            formattedContent = formattedContent.replace(new RegExp(escapedPlaceholder, 'g'), displayValue);
          });

          return formattedContent;
        } catch (error) {
          /* eslint-disable no-console */
          console.error('Error generating formatted output:', error);
          /* eslint-enable no-console */
          return generateStructuredOutput(extractedData);
        }
      }

      // No template yet, show structured extracted data
      return generateStructuredOutput(extractedData);
    };

    if (documentContent.processed.extracted_data && Object.keys(documentContent.processed.extracted_data).length > 0) {
      generateOutput().then(setFormattedOutput);
    } else {
      setFormattedOutput(null);
    }
  }, [(document?.metadata as any)?.template_id, documentContent.processed.extracted_data, document?.name, documentContent.processed.text]);
  

  // Navigate to correct template edit page based on template type
  const navigateToTemplateEdit = async (templateId: number, _editMode = true) => {
    try {
      // Since all templates are now smart templates, navigate directly to the smart template edit route
      navigate({ 
        to: '/templates/$templateId/edit', 
        params: { templateId: templateId.toString() }
      });
    } catch (error) {
      console.error('Error navigating to template edit:', error);
      // Fallback to view route
      navigate({ 
        to: '/templates/$templateId', 
        params: { templateId: templateId.toString() }
      });
    }
  };




  // Helper function to get file for processing
  const getDocumentFile = async (): Promise<File> => {
    if (!document) throw new Error('Document not available');
    
    // Get the file - either from storage path or Supabase storage
    if (document.file_path && document.file_path.startsWith('http')) {
      // File is accessible via direct URL
      const response = await fetch(document.file_path);
      const blob = await response.blob();
      return new File([blob], document.name, { type: blob.type || document.file_type });
    } else {
      // File needs to be fetched from Supabase storage
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);
      
      if (error || !data) {
        throw new Error(`Failed to download file: ${error?.message || 'Unknown error'}`);
      }
      
      return new File([data], document.name, { type: data.type || document.file_type });
    }
  };

  const handleProcessingAction = async (action: 'use_template' | 'generate_template', templateId?: number) => {
    if (!document || !evaluation) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    try {
      // Update document status to processing
      await documentManager.updateDocumentStatus(documentId, {
        status: DocumentStatus.PROCESSING,
        metadata: {
          processing_method: action === 'use_template' ? 'template_guided' : 'ai_enhanced',
          template_id: templateId,
          ...document.metadata,
        },
      });

      const file = await getDocumentFile();

      let result;
      if (action === 'use_template' && templateId) {
        result = await documentProcessor.processWithExistingTemplate(file, templateId);
      } else {
        // Uses unified decide-template endpoint internally (with legacy fallback)
        result = await documentProcessor.generateTemplate(
          file,
          `${evaluation.type_evaluation.primary_type} Template`,
          evaluation.type_evaluation.primary_type
        );
        
        // Show generated template dialog for review
        if (result && result.template) {
          setGeneratedTemplate(result);
          setShowGeneratedTemplateDialog(true);
          setIsProcessing(false);
          return; // Don't finalize yet, wait for user decision
        }
      }

      // Finalize document with processing results
      await documentManager.finalizeDocument(documentId, {
        content_text: result?.content || '',
        extracted_fields: result?.extractedFields || result?.extracted_fields,
        processing_method: action === 'use_template' ? 'template_guided' : 'ai_enhanced',
        quality_metrics: result?.quality_metrics,
        // Store the original and processed content in metadata
        metadata: {
          original_content: result?.content || '',
          processed_content: result?.content || '',
          extracted_content: result?.content || '',
          extraction_result: {
            extracted_values: result?.extractedFields || result?.extracted_fields || {},
            confidence_scores: result?.confidence_scores || {}
          },
          // Also store the raw API response for debugging
          raw_api_response: {
            has_content: !!result?.content,
            has_extracted_fields: !!(result?.extractedFields || result?.extracted_fields),
            content_length: result?.content?.length || 0
          }
        }
      });

      // Invalidate queries and refetch
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });
      await refetch();
    } catch (err) {
      // Error already captured in setProcessingError
      setProcessingError(err instanceof Error ? err.message : 'Document processing failed');
      
      await documentManager.markDocumentFailed(
        documentId, 
        err instanceof Error ? err.message : 'Document processing failed'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRerunExtraction = async () => {
    if (!document) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      // Reset document status to analyzing for re-evaluation
      await documentManager.updateDocumentStatus(documentId, {
        status: DocumentStatus.ANALYZING,
        metadata: {
          ...document.metadata,
          rerun_extraction: true as never,
          rerun_timestamp: new Date().toISOString(),
        },
      });

      const file = await getDocumentFile();

      // Re-evaluate document type
      const evaluationResult = await documentProcessor.evaluateDocumentType(file);

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
      });

      // Automatically run smart extraction with the best template
      if (evaluationResult.template_suggestions.length > 0) {
        const bestTemplate = evaluationResult.template_suggestions[0];
        await handleProcessingAction('use_template', bestTemplate.template_id);
      } else {
        await handleProcessingAction('generate_template');
      }

      // Invalidate queries and refetch
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });
      await refetch();
    } catch (err) {
      // Error already captured in setProcessingError
      setProcessingError(err instanceof Error ? err.message : 'Failed to rerun extraction');
      
      await documentManager.markDocumentFailed(
        documentId, 
        err instanceof Error ? err.message : 'Failed to rerun extraction'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceRetry = async () => {
    if (!document) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      console.log('🔄 Forcing retry for stuck document:', documentId);
      await UnifiedDocumentService.forceRetryAnalysis(documentId);
      
      // Refresh the document data
      refetch();
    } catch (error) {
      console.error('❌ Force retry failed:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to force retry');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceComplete = async () => {
    if (!document) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      console.log('⚡ Force completing stuck document:', documentId);
      await UnifiedDocumentService.forceCompleteDocument(documentId);
      
      // Refresh the document data
      refetch();
    } catch (error) {
      console.error('❌ Force complete failed:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to force complete');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for saving generated template
  const handleSaveGeneratedTemplate = async (_templateData: unknown) => {
    if (!document) return;

    try {
      // Save template through the dialog's mutation
      // After saving, the dialog will navigate to the template editor
    } catch (error) {
      console.error('Failed to save generated template:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to save template');
    }
  };

  // Ref for debouncing auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handler for auto-saving template content changes (debounced)
  const handleTemplateContentChange = useCallback(
    (content: string) => {
      if (!documentId) {
        console.warn('[DocumentDetailView] handleTemplateContentChange: No documentId');
        return;
      }

      // eslint-disable-next-line no-console
      console.log('[DocumentDetailView] handleTemplateContentChange called:', {
        documentId,
        contentLength: content.length,
      });

      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Debounce the save - wait 1 second after user stops typing
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          // eslint-disable-next-line no-console
          console.log('[DocumentDetailView] Auto-saving custom template content...');

          const currentDoc = document;
          if (!currentDoc) return;

          const metadata = currentDoc.metadata as Record<string, unknown> | undefined;
          const updatedMetadata = {
            ...metadata,
            custom_template_content: content,
            custom_template_updated_at: new Date().toISOString(),
          };

          // Keep current status (default to COMPLETED if not set)
          // Map string status to DocumentStatus enum
          const statusMap: Record<string, DocumentStatus> = {
            'uploaded': DocumentStatus.UPLOADED,
            'analyzing': DocumentStatus.ANALYZING,
            'processing': DocumentStatus.PROCESSING,
            'completed': DocumentStatus.COMPLETED,
            'failed': DocumentStatus.FAILED,
          };
          const currentStatus = statusMap[currentDoc.processing_status || 'completed'] || DocumentStatus.COMPLETED;

          await UnifiedDocumentService.updateDocumentStatus(documentId, {
            status: currentStatus,
            metadata: updatedMetadata,
          });

          // eslint-disable-next-line no-console
          console.log('[DocumentDetailView] Auto-save SUCCESSFUL');
        } catch (error) {
          console.error('[DocumentDetailView] Auto-save failed:', error);
        }
      }, 1000);
    },
    [documentId, document]
  );

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Handler for saving template content edits from TemplateOutputView
  const handleSaveTemplateContent = async (
    content: string,
    action: 'create' | 'modify',
    newName?: string
  ): Promise<void> => {
    if (!document) {
      console.warn('[DocumentDetailView] handleSaveTemplateContent: No document available');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[DocumentDetailView] handleSaveTemplateContent called:', {
      documentId,
      action,
      contentLength: content.length,
      newName,
    });

    try {
      if (action === 'modify') {
        // Save as document-specific custom template content
        // This overrides the template output for THIS document only
        const metadata = document.metadata as Record<string, unknown> | undefined;
        const updatedMetadata = {
          ...metadata,
          custom_template_content: content,
          custom_template_updated_at: new Date().toISOString(),
        };

        // Keep current status (default to COMPLETED if not set)
        // Map string status to DocumentStatus enum
        const statusMap: Record<string, DocumentStatus> = {
          'uploaded': DocumentStatus.UPLOADED,
          'analyzing': DocumentStatus.ANALYZING,
          'processing': DocumentStatus.PROCESSING,
          'completed': DocumentStatus.COMPLETED,
          'failed': DocumentStatus.FAILED,
        };
        const currentStatus = statusMap[document.processing_status || 'completed'] || DocumentStatus.COMPLETED;

        await UnifiedDocumentService.updateDocumentStatus(documentId, {
          status: currentStatus,
          metadata: updatedMetadata,
        });

        // eslint-disable-next-line no-console
        console.log('[DocumentDetailView] Saved custom template content SUCCESSFULLY');

        // Refresh document data to reflect the save
        await refetch();
      } else if (action === 'create' && newName) {
        // Create a new template with this content
        const templateData = {
          name: newName,
          template_content: content,
          description: `Template created from document: ${document.name}`,
          category: 'custom',
          is_public: false,
        };

        const result = await templateService.createTemplate(templateData);
        // eslint-disable-next-line no-console
        console.log('[DocumentDetailView] Created new template:', result);

        // Optionally navigate to the new template
        if (result?.id) {
          navigate({ to: '/templates/$templateId', params: { templateId: String(result.id) } });
        }
      }
    } catch (error) {
      console.error('[DocumentDetailView] Failed to save template content:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to save template');
      throw error; // Re-throw so TemplateOutputView can handle UI feedback
    }
  };

  // Handler for using generated template without saving
  const handleUseGeneratedTemplate = async (templateData: any) => {
    if (!document || !generatedTemplate) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    setShowGeneratedTemplateDialog(false);
    
    try {
      // Finalize document with the generated template result
      await documentManager.finalizeDocument(documentId, {
        content_text: generatedTemplate?.content || '',
        extracted_fields: generatedTemplate?.extractedFields || generatedTemplate?.extracted_fields || {},
        processing_method: 'ai_enhanced',
        quality_metrics: generatedTemplate?.quality_metrics,
        metadata: {
          original_content: generatedTemplate?.content || '',
          processed_content: generatedTemplate?.content || '',
          extracted_content: generatedTemplate?.content || '',
          extraction_result: {
            extracted_values: generatedTemplate?.extractedFields || generatedTemplate?.extracted_fields || {},
            confidence_scores: generatedTemplate?.confidence_scores || {}
          },
          template_used: {
            id: 'generated',
            name: templateData.template.name,
            type: 'ai_generated',
            generated_at: new Date().toISOString()
          }
        }
      });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });
      await refetch();
    } catch (error) {
      console.error('Failed to finalize document with generated template:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoComplete = async () => {
    if (!document) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      console.log('🔄 Auto-completing stuck document:', documentId);
      const wasCompleted = await UnifiedDocumentService.autoCompleteIfProcessed(documentId);
      
      if (wasCompleted) {
        console.log('✅ Document auto-completed successfully');
        refetch();
      } else {
        console.log('⚠️ Document was not auto-completed (may not meet criteria)');
        setProcessingError('Document does not meet auto-completion criteria');
      }
    } catch (error) {
      console.error('❌ Auto-complete failed:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to auto-complete');
    } finally {
      setIsProcessing(false);
    }
  };

  // Status utilities moved to @/lib/document-utils and @/components/shared/StatusBadge

  const calculateProcessingProgress = (doc: any) => {
    if (!doc) return 0;
    
    const status = doc.processing_status || doc.status;
    
    switch (status) {
      case 'analyzing': return 25;
      case 'processing': return 75;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 10;
    }
  };

  const handleSaveContent = async () => {
    if (onSave && editedContent) {
      await onSave(editedContent);
      setEditMode(false);
    }
  };

  const handleDownload = async (format: 'json' | 'txt' | 'csv' | 'html' | 'docx' | 'md' | 'pdf') => {
    // Get the content to export - use template view or generated output based on toggle
    const contentToExport = showTemplateView && rawTemplateContent
      ? rawTemplateContent
      : (formattedOutput || documentContent.processed.text);

    const fileName = document?.name?.replace(/\.[^/.]+$/, '') || 'document';

    // Helper to trigger download
    const downloadFile = (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    switch (format) {
      case 'md':
        downloadFile(contentToExport, `${fileName}.md`, 'text/markdown');
        break;

      case 'txt':
        downloadFile(contentToExport, `${fileName}.txt`, 'text/plain');
        break;

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
</html>`;
        downloadFile(htmlContent, `${fileName}.html`, 'text/html');
        break;
      }

      case 'pdf': {
        // Generate PDF using browser print
        const printWindow = window.open('', '_blank');
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
</html>`);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 250);
        }
        break;
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
</html>`;
        downloadFile(docContent, `${fileName}.doc`, 'application/msword');
        break;
      }

      case 'json': {
        const jsonContent = JSON.stringify({
          name: fileName,
          content: contentToExport,
          extractedFields: comprehensiveFieldDetection.extractedFields,
          exportedAt: new Date().toISOString(),
        }, null, 2);
        downloadFile(jsonContent, `${fileName}.json`, 'application/json');
        break;
      }

      default:
        if (onDownload) {
          await onDownload(format);
        }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add toast notification here
    } catch (err) {
      // Could add user notification here
    }
  };

  const handleSaveExtractedFields = async (fields: Record<string, any>) => {
    if (!document) return;

    try {
      // Update document metadata with new field values by marking as completed
      const existingExtraction: any = (document.metadata as any)?.extraction_result || {};
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
      });

      // Invalidate queries to refresh the document data
      queryClient.invalidateQueries({ queryKey: ['processedDocument', documentId] });
      
      console.log('✅ Extracted fields updated successfully');
    } catch (error) {
      console.error('❌ Failed to update extracted fields:', error);
      throw error;
    }
  };

  const handleCreateTemplateFromFields = async (templateData: {
    name: string;
    description: string;
    category: string;
    smart_variables: any[];
    is_public: boolean;
  }) => {
    try {
      // Generate template_content by replacing extracted values with placeholders
      const { extractedFields } = comprehensiveFieldDetection;
      let templateContent = documentContent.original.text;

      // Replace each extracted value with {{placeholder}} syntax
      Object.entries(extractedFields).forEach(([key, value]) => {
        if (value && String(value).length > 0) {
          // Escape special regex characters in the value
          const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Create regex to find the value (case-insensitive, whole word)
          const regex = new RegExp(escapedValue, 'gi');
          // Replace with placeholder
          templateContent = templateContent.replace(regex, `{{${key}}}`);
        }
      });

      // Use the unified template service to create a new template
      const newTemplate = await templateService.createTemplate({
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        smart_variables: templateData.smart_variables,
        is_public: templateData.is_public,
        template_content: templateContent, // ✨ Include generated template content
        tags: [],
      } as any);

      /* eslint-disable no-console */
      console.log('✅ Template created successfully:', newTemplate);

      // ✨ Associate the template with the document
      if (newTemplate.id && document) {
        console.log('🔗 Associating template with document:', {
          documentId,
          templateId: newTemplate.id,
          templateName: newTemplate.name
        });

        await UnifiedDocumentService.updateDocumentStatus(documentId, {
          status: DocumentStatus.COMPLETED, // Keep current status
          metadata: {
            template_id: newTemplate.id,
            template_name: newTemplate.name,
            template_associated_at: new Date().toISOString()
          }
        });

        console.log('✅ Template associated with document successfully');
      /* eslint-enable no-console */

        // Refetch document to show updated metadata
        await refetch();
      }

      setShowCreateTemplateDialog(false);

      // Invalidate template queries to refresh template lists
      queryClient.invalidateQueries({ queryKey: ['templates'] });

    } catch (error) {
      console.error('❌ Failed to create template:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Document fetch error:', error);
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error && error.message.includes('User not authenticated') 
              ? 'Please sign in to view this document'
              : error instanceof Error && error.message.includes('Failed to fetch')
              ? 'Failed to load document. Please try again.'
              : 'Error loading document'}
          </AlertDescription>
        </Alert>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Document not found. This document may have been deleted or you may not have permission to view it.
          </AlertDescription>
        </Alert>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>
      </div>
    );
  }

  // Handle different processing states - show original enhanced components for non-completed states
  // Only processing_status exists in database schema (no separate 'status' field)
  const processingStatus = document?.processing_status;
  
  // Use processing_status as the single source of truth
  // IMPORTANT: If document is completed, currentStatus should be 'completed' regardless of processingStatus
  const currentStatus = processingStatus === 'completed' ? 'completed' : (processingStatus || 'completed');
  
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
    timestamp: new Date().toISOString()
  });
  
  // Smart detection of actually completed documents that are stuck in "processing" status
  const hasProcessedContent = !!(
    document?.content_text ||
    document?.extracted_fields ||
    document?.metadata?.extracted_fields ||
    document?.metadata?.extraction_result ||
    document?.metadata?.ai_classification
  );
  
  // Override status if we detect completed processing or backend says completed
  const effectiveStatus = (currentStatus !== 'completed' && hasProcessedContent) 
    ? 'completed' 
    : currentStatus;
  
  // Debug logging for stuck documents
  console.log('🔍 Document status check:', {
    documentId,
    processing_status: document?.processing_status,
    status: document?.status,
    currentStatus,
    effectiveStatus,
    hasContent: !!document?.content_text,
    hasExtractedFields: !!(document?.extracted_fields || document?.metadata?.extracted_fields),
    statusOverridden: effectiveStatus !== currentStatus,
    metadata: document?.metadata
  });
  
  console.log('Document', document);
  
  if (effectiveStatus !== 'completed') {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 space-y-2 sm:space-y-0">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onBack || (() => navigate({ to: '/documents' }))}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Documents
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{document.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <StatusBadge status={currentStatus} />
                {document.metadata?.processing_method && (
                  <Badge variant="outline">{document.metadata.processing_method}</Badge>
                )}
                {(document.metadata?.template_name) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {document.metadata?.template_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Rerun Analysis Button - show for analyzed or completed documents */}
            {(currentStatus === 'analyzing' || currentStatus === 'processing' || currentStatus === 'completed') && (
              <Button 
                onClick={handleRerunExtraction} 
                variant="outline"
                disabled={isProcessing}
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'Reprocessing...' : 'Rerun Analysis'}
              </Button>
            )}
            
            {onDownload && (
              <Button onClick={() => onDownload('json')} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {processingError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{processingError}</AlertDescription>
          </Alert>
        )}

        {/* Status-specific content */}
        {currentStatus === 'processing' && (
          <>
            {/* Check if document needs template selection */}
            {UnifiedDocumentService.documentNeedsTemplateSelection(document) && (
              <TemplateSelector
                documentId={documentId}
                suggestions={UnifiedDocumentService.getDocumentTemplateSuggestions(document)}
                onTemplateApplied={(_templateId, _templateName) => {
                  // Force refetch after template is applied
                  refetch();
                }}
              />
            )}
            
            {/* Show processing status if template is already selected or no suggestions */}
            {!UnifiedDocumentService.documentNeedsTemplateSelection(document) && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
                      <div>
                        <h3 className="text-lg font-medium">Processing Document with Template</h3>
                        <p className="text-sm text-gray-600">Extracting information using the selected template...</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Progress value={calculateProcessingProgress(document)} className="h-3" />
                      <div className="text-xs text-center text-gray-500">
                        {calculateProcessingProgress(document)}% complete
                        {calculateProcessingProgress(document) >= 95 && (
                          <span className="block text-amber-600 mt-1">
                            Finalizing extraction...
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Show immediate complete button if at 98% */}
                    {calculateProcessingProgress(document) >= 98 && (
                      <div className="mt-4 flex justify-center">
                        <Button
                          onClick={handleAutoComplete}
                          variant="default"
                          size="sm"
                          disabled={isProcessing}
                          className="text-xs bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
                          Complete Processing
                        </Button>
                      </div>
                    )}
                    
                    {/* Show force complete button if document is stuck */}
                    {UnifiedDocumentService.isDocumentStuckInProcessing(document) && (
                      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          Document appears to be stuck in processing
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            onClick={handleAutoComplete}
                            variant="default"
                            size="sm"
                            disabled={isProcessing}
                            className="text-xs bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
                            Fix Stuck Document
                          </Button>
                          <Button
                            onClick={handleForceComplete}
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            className="text-xs"
                          >
                            <CheckCircle className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
                            Force Complete
                          </Button>
                          <Button
                            onClick={handleForceRetry}
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            className="text-xs"
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
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
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-pulse" />
                AI Analysis in Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Analyzing Document
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Our AI is analyzing your document to determine its type and suggest the best processing options. This usually takes 10-30 seconds.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please wait while we process your document...
                  </p>
                  <Button
                    onClick={handleForceRetry}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
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
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Analysis Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Type */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Detected Document Type</h4>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold capitalize">
                    {evaluation.type_evaluation.primary_type}
                  </span>
                  <Badge variant="secondary">
                    {Math.round(evaluation.type_evaluation.confidence * 100)}% confidence
                  </Badge>
                </div>
              </div>

              {/* Processing Options */}
              <div className="space-y-3">
                <h4 className="font-medium">Processing Options</h4>
                
                {/* Primary recommendation */}
                {evaluation.template_suggestions.length > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                          Recommended: Use Existing Template
                        </h5>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                          {evaluation.template_suggestions[0].template_name}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(evaluation.template_suggestions[0].match_score * 100)}% match
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleProcessingAction('use_template', evaluation.template_suggestions[0].template_id)}
                        disabled={isProcessing}
                      >
                        Use Template
                        <Zap className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Alternative actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleProcessingAction('generate_template')}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Generate New Template</span>
                    <span className="sm:hidden">Generate Template</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate({ to: '/templates' })}
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Browse All Templates</span>
                    <span className="sm:hidden">Browse Templates</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStatus === 'processing' && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-medium">
                      {document.metadata?.rerun_extraction ? 'Re-processing Document' : 'Processing Document'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {document.metadata?.rerun_extraction 
                        ? 'Re-extracting content and fields with updated AI analysis...'
                        : 'Extracting content and fields from your document...'
                      }
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={calculateProcessingProgress(document)} className="h-3" />
                  <div className="text-xs text-center text-gray-500">
                    {calculateProcessingProgress(document)}% complete
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  This typically takes 60-90 seconds depending on document complexity
                </p>
                {Boolean(document.metadata?.rerun_extraction) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <Sparkles className="w-3 h-3 inline mr-1" />
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-primary">Document Ready for Processing</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Smart Extraction
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  This document has been uploaded but processing hasn't started yet. Current status: <strong>{currentStatus}</strong>
                  <br />
                  Click "Start Smart Extraction" to begin AI analysis and content extraction.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Catch-all for other unhandled statuses */}
        {!['completed', 'processing', 'analyzing', 'failed', 'pending', 'uploaded'].includes(currentStatus) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-600">Unknown Status: {currentStatus}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Processing
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Document status: <strong>{currentStatus}</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This status is not recognized. Try starting processing to move the document forward.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStatus === 'failed' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-red-600">Processing Failed</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Retry Smart Extraction
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Processing failed: {document.metadata?.error_message || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Try running smart extraction again with updated AI analysis. This may resolve temporary processing issues.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  

  const renderTabsView = () => (
    <>
      <Tabs defaultValue="original" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-auto">
        <TabsTrigger value="original" className="text-xs sm:text-sm px-2 py-2">
          <span className="hidden sm:inline">Original Document</span>
          <span className="sm:hidden">Original</span>
        </TabsTrigger>
        <TabsTrigger value="processed" className="text-xs sm:text-sm px-2 py-2">
          <span className="hidden sm:inline">Extracted Fields</span>
          <span className="sm:hidden">Extracted</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="original" className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Original Content
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(documentContent.original.text)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy to Clipboard</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <MarkdownViewer
              content={documentContent.original.text}
              height="h-64 sm:h-96"
            />
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="processed" className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Edit3 className="w-5 h-5 mr-2" />
                Extracted Fields
                {editMode && <Badge className="ml-2">Editing</Badge>}
              </CardTitle>
              <div className="flex items-center space-x-2">
                {(document.metadata as any)?.template_id && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateToTemplateEdit((document.metadata as any).template_id, false)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit Template</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTemplateChanger(!showTemplateChanger)}
                        >
                          <RefreshCw className="w-4 h-4" />
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
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMode(!editMode)}
                    >
                      {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
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
                        variant="default"
                        size="sm"
                        onClick={handleSaveContent}
                      >
                        <Save className="w-4 h-4" />
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
              <div className="h-64 sm:h-96">
                <SimpleEditor
                  value={editedContent}
                  onChange={setEditedContent}
                  placeholder="Enter processed document content..."
                  height="100%"
                />
              </div>
            ) : (
              <>
                {showTemplateView && rawTemplateContent && (
                  <div className="mb-2 p-2 bg-muted/50 rounded-md border border-dashed">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Code className="w-4 h-4" />
                      <span>Template View - Showing placeholders</span>
                    </div>
                  </div>
                )}
                <MarkdownViewer
                  content={showTemplateView && rawTemplateContent ? rawTemplateContent : (formattedOutput || documentContent.processed.text)}
                  height="h-64 sm:h-96"
                />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

    </>
  );

  const renderPipelineView = () => {
    // Use comprehensive field detection for all fields
    const { extractedFields, confidenceScores } = comprehensiveFieldDetection;
    const templateVariables = Object.keys(extractedFields);

    // Get template content - use raw template if available, otherwise original text
    const templateContent = rawTemplateContent || documentContent.original.text || '';

    // Get metadata with proper typing
    const metadata = document?.metadata as Record<string, unknown> | undefined;
    const templateName = metadata?.template_name as string | undefined;
    const templateId = metadata?.template_id as number | undefined;
    const updatedAt = metadata?.updated_at as string | undefined;

    // Determine which output to show based on toggle
    const outputContent = showTemplateView && rawTemplateContent
      ? rawTemplateContent
      : (formattedOutput || documentContent.processed.text);

    return (
      <DocumentPipelineView
        templateContent={templateContent}
        templateVariables={templateVariables}
        extractedFields={extractedFields}
        confidenceScores={confidenceScores}
        finalOutput={outputContent}
        documentName={document?.name}
        templateName={templateName}
        templateId={templateId}
        templateUpdatedAt={updatedAt}
        onUpdateTemplate={templateId ? () => navigateToTemplateEdit(templateId) : undefined}
      />
    );
  };

  const renderDualView = () => {
    const { extractedFields } = comprehensiveFieldDetection;
    const metadata = document?.metadata as Record<string, unknown> | undefined;
    const templateName = metadata?.template_name as string | undefined;
    const templateId = metadata?.template_id as number | undefined;

    // Determine which content to show based on toggle
    let templateContent: string;
    if (showTemplateView && rawTemplateContent) {
      // Show raw template with {{variable}} placeholders
      templateContent = rawTemplateContent;
    } else if (formattedOutput) {
      // Show generated output with values filled in
      templateContent = formattedOutput;
    } else {
      // Fallback to original text
      templateContent = documentContent.original.text || '';
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
        documentText={documentContent.original.text}
        editable={true}
        onTemplateChange={handleTemplateContentChange}
        onSaveTemplate={handleSaveTemplateContent}
      />
    );
  };

  return (
    <div className={`p-4 sm:p-6 ${isFullscreen ? 'fixed inset-0 bg-white z-50' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBack ? onBack() : navigate({ to: '/documents' })}
            className="self-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{document.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
                <StatusBadge status={document.processing_status || document.metadata?.processing_status || 'completed'} />
              {document.metadata?.processing_method && (
                <Badge variant="outline">{document.metadata.processing_method}</Badge>
              )}
              {(document.metadata?.template_name) && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {document.metadata?.template_name}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {new Date(document.created_at).toLocaleDateString()}
              </span>
              {Boolean(document.metadata?.rerun_extraction) && (
                <Badge variant="secondary" className="text-xs">
                  Re-processed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRerunExtraction()}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Rerun Smart Extraction</span>
            <span className="sm:hidden">Rerun Extraction</span>
          </Button>

          {/* Toggle between Template View and Generated Output */}
          {rawTemplateContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showTemplateView ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowTemplateView(!showTemplateView)}
                  className="w-full sm:w-auto"
                >
                  {showTemplateView ? (
                    <>
                      <Code className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Template View</span>
                      <span className="sm:hidden">Template</span>
                    </>
                  ) : (
                    <>
                      <FileOutput className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Generated Output</span>
                      <span className="sm:hidden">Output</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showTemplateView
                  ? "Showing template with {{variable}} placeholders"
                  : "Showing generated output with extracted values"
                }</p>
              </TooltipContent>
            </Tooltip>
          )}

          <div className="flex gap-2">
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
                <>
                  <Workflow className="w-4 h-4 mr-2" />
                  Pipeline
                </>
              ) : (
                <>
                  <SplitSquareHorizontal className="w-4 h-4 mr-2" />
                  Tabs
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex-1 sm:flex-none"
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleDownload('pdf')}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('docx')}>
                  <FileType className="w-4 h-4 mr-2" />
                  Word Document (.doc)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload('html')}>
                  <Code className="w-4 h-4 mr-2" />
                  HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('md')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('txt')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Plain Text (.txt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload('json')}>
                  <FileJson className="w-4 h-4 mr-2" />
                  JSON (with fields)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Content Area */}
      <div className="flex-1">
        {viewMode === 'dual' ? (
          renderDualView()
        ) : viewMode === 'pipeline' ? (
          renderPipelineView()
        ) : (
          renderTabsView()
        )}
      </div>

      {/* Consolidated Template Change Functionality */}
      {showTemplateChanger && document.metadata?.template_suggestions && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Change Template</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateSelector
              documentId={documentId}
              suggestions={UnifiedDocumentService.getDocumentTemplateSuggestions(document)}
              currentTemplateId={document.metadata?.template_id}
              currentTemplateName={document.metadata?.template_name}
              onTemplateApplied={(_templateId, _templateName) => {
                setShowTemplateChanger(false);
                refetch();
              }}
              showChangeOption={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Template Variables Panel - Hover to see extracted values */}
      {document.processing_status === 'completed' && (() => {
        // Get extracted fields for the variables panel
        const extractedFieldsForPanel = (() => {
          const sources = [
            () => (document.metadata as Record<string, unknown>)?.extracted_data,
            () => (document.metadata as Record<string, unknown>)?.extraction_result,
            () => document.extracted_fields,
            () => document.metadata?.extracted_fields,
          ];

          for (const getter of sources) {
            const data = getter();
            if (!data) continue;
            const parsed = parseExtractedFields(data);
            if (Object.keys(parsed).length > 0) {
              // Handle nested extracted_values structure
              if ('extracted_values' in parsed && typeof parsed.extracted_values === 'object') {
                return parsed.extracted_values as Record<string, unknown>;
              }
              return parsed;
            }
          }
          return {};
        })();

        if (Object.keys(extractedFieldsForPanel).length === 0) return null;

        const metadata = document.metadata as Record<string, unknown> | undefined;
        const templateName = metadata?.template_name as string | undefined;

        return (
          <TemplateVariablesPanel
            title="Extracted Variables"
            templateName={templateName}
            extractedFields={extractedFieldsForPanel as Record<string, { value: string | null; confidence?: number; sourceText?: string; type?: string } | string | null>}
            editable={false}
            className="mt-6"
          />
        );
      })()}

      {/* Extracted Fields */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Extracted Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Document processed successfully
                  {Boolean(document.metadata?.rerun_extraction) && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Updated with Smart Extraction
                    </span>
                  )}
                </span>
              </div>
              {typeof (document.metadata as Record<string, unknown>)?.rerun_timestamp === 'string' && (
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {(() => {
                    const ts = (document.metadata as Record<string, unknown>).rerun_timestamp as string;
                    return `Last updated: ${new Date(ts).toLocaleString()}`;
                  })()}
                </p>
              )}
              {/* Display current template information */}
              {(() => {
                const meta = document.metadata as Record<string, unknown>;
                const tName = meta.template_name as string | undefined;
                const tId = meta.template_id as number | undefined;
                return Boolean(tName || tId);
              })() && (
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <span className="font-medium">Template Used:</span>{' '}
                    {(() => {
                      const meta = document.metadata as Record<string, unknown>;
                      const tName = meta.template_name as string | undefined;
                      const tId = meta.template_id as number | undefined;
                      return tName || `Template ID: ${tId}`;
                    })()}
                    {(() => {
                      const meta = document.metadata as Record<string, unknown>;
                      const tId = meta.template_id as number | undefined;
                      return tId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 px-2 text-xs text-green-700 hover:text-green-800 dark:text-green-300 dark:hover:text-green-200"
                        onClick={() => navigateToTemplateEdit(tId)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit Template
                      </Button>
                      ) : null;
                    })()}
                  </p>
                </div>
              )}
            </div>
            
            {/* Extracted Fields Editor */}
            {(() => {
              // Handle different possible structures for extracted fields
              let extractedFields = {};
              let confidenceScores = {};
              let detectionPath = 'none';

              /* eslint-disable no-console */
              console.log('');
              console.log('🔍 [Field Detection] Starting field detection process');
              console.log('Document ID:', documentId);

              // Define data sources in priority order (most reliable first)
              const sources = [
                {
                  name: 'metadata.extracted_data.extracted_values',
                  getter: () => (document.metadata as Record<string, unknown>)?.extracted_data,
                  hasConfidence: true
                },
                {
                  name: 'metadata.extraction_result.extracted_values',
                  getter: () => (document.metadata as Record<string, unknown>)?.extraction_result,
                  hasConfidence: true
                },
                {
                  name: 'document.extracted_fields',
                  getter: () => document.extracted_fields,
                  hasConfidence: false
                },
                {
                  name: 'metadata.extracted_fields',
                  getter: () => document.metadata?.extracted_fields,
                  hasConfidence: false
                },
                {
                  name: 'metadata.fields',
                  getter: () => document.metadata?.fields,
                  hasConfidence: false
                }
              ];

              // Try each source in priority order
              for (const source of sources) {
                const rawData = source.getter();
                if (!rawData) continue;

                // Parse the data (handles JSON strings and objects)
                const parsed = parseExtractedFields(rawData);
                if (Object.keys(parsed).length === 0) continue;

                // Check if this source has extracted_values structure
                if (source.hasConfidence && 'extracted_values' in parsed) {
                  const data = parsed as { extracted_values?: Record<string, unknown>; confidence_scores?: Record<string, number> };
                  if (data.extracted_values && Object.keys(data.extracted_values).length > 0) {
                    extractedFields = parseExtractedFields(data.extracted_values);
                    detectionPath = source.name;
                    if (data.confidence_scores) {
                      confidenceScores = data.confidence_scores;
                    }
                    console.log('✅ [Field Detection] Found fields at:', detectionPath);
                    console.log('   Field count:', Object.keys(extractedFields).length);
                    console.log('   Fields:', extractedFields);
                    console.log('   Confidence scores:', confidenceScores);
                    break;
                  }
                } else {
                  // Direct field data without nested structure
                  extractedFields = parsed;
                  detectionPath = source.name;
                  console.log('✅ [Field Detection] Found fields at:', detectionPath);
                  console.log('   Field count:', Object.keys(extractedFields).length);
                  console.log('   Fields:', extractedFields);
                  break;
                }
              }

              // Log if no fields found
              if (detectionPath === 'none') {
                console.log('❌ [Field Detection] No fields found in any expected location');
                console.log('   Checked paths:');
                sources.forEach(s => console.log(`   - ${s.name}`));
              }

              console.log('');
              console.log('📦 [Field Detection] Final Results:');
              console.log('   Detection path:', detectionPath);
              console.log('   Field count:', Object.keys(extractedFields).length);
              console.log('   Field names:', Object.keys(extractedFields));
              console.log('   Full extracted fields:', extractedFields);
              console.log('   Confidence scores:', confidenceScores);
              console.log('');
              /* eslint-enable no-console */
              
              // Get template metadata
              const metadata = document?.metadata as Record<string, unknown> | undefined;
              const templateId = metadata?.template_id as number | undefined;
              const templateName = metadata?.template_name as string | undefined;

              return (
                <ExtractedFieldsEditor
                  documentId={documentId}
                  extractedFields={extractedFields}
                  confidenceScores={confidenceScores}
                  onSave={handleSaveExtractedFields}
                  onCreateTemplate={async (fields) => {
                    setFieldsForTemplate(fields);
                    setShowCreateTemplateDialog(true);
                  }}
                  onUpdateTemplate={templateId ? async (_fields) => {
                    // Navigate to template editor
                    navigateToTemplateEdit(templateId);
                  } : undefined}
                  templateId={templateId}
                  templateName={templateName}
                  readOnly={false}
                  showCreateTemplate={true}
                />
              );
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
  );
}