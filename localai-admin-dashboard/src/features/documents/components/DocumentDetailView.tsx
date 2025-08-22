/**
 * Enhanced Document Detail View with WYSIWYG Editor
 * Shows original document content and generated/processed content side by side
 * 
 * Displays document details and handles all processing states:
 * - Uploaded: Shows AI analysis and processing options
 * - Analyzing: Shows progress while evaluating document
 * - Processing: Shows progress while extracting content
 * - Completed: Shows full extraction results with editing capabilities
 * - Failed: Shows error information
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Settings,
  Sparkles,
  Zap,
  AlertTriangle,
  Loader2,
  CheckCircle,
  BarChart3,
  Clock,
  Layers,
  Target,
  Database,
  TrendingUp,
  ExternalLink,
  Edit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { ProcessedDocumentsService, ProcessedDocument } from '../services/processed-documents-service';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { WysiwygEditor } from './WysiwygEditor';
import { MarkdownViewer } from './MarkdownViewer';
import { masterTemplateService } from '@/services/master-template-service';
import { UnifiedDocumentService } from '@/services/unified-document-service';

interface DocumentDetailViewProps {
  documentId: string;
  onBack?: () => void;
  onDownload?: (format: 'json' | 'txt' | 'csv' | 'html' | 'docx') => Promise<void>;
  onSave?: (content: string) => Promise<void>;
}

interface DocumentEvaluation {
  type_evaluation: {
    primary_type: string;
    confidence: number;
    detection_method: string;
  };
  template_suggestions: Array<{
    template_id: number;
    template_name: string;
    match_score: number;
    category: string;
    field_count: number;
  }>;
  processing_recommendations: {
    workflow: string;
    suggested_action: string;
    alternative_actions: string[];
    confidence_level: string;
  };
}

interface ExtractedFieldValue {
  value?: unknown;
  confidence?: number;
  sourceText?: string;
}

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
  const [viewMode, setViewMode] = useState<'side-by-side' | 'tabs' | 'overlay'>('side-by-side');
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluation, setEvaluation] = useState<DocumentEvaluation | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const documentProcessor = React.useMemo(() => new DocumentProcessorEnhanced(), []);
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });

  // Debug check on mount
  useEffect(() => {
    if (documentId) {
      ProcessedDocumentsService.debugCheckDocument(documentId).then(result => {
        console.log('📄 Document debug check for ID', documentId, ':', result);
      });
      
      // Also list recent documents to help debug
      ProcessedDocumentsService.getProcessedDocuments().then(docs => {
        console.log('📄 Recent documents:', docs.slice(0, 5).map(d => ({ 
          id: d.id, 
          name: d.name, 
          status: d.processing_status || d.status,
          created: d.created_at 
        })));
      }).catch(err => {
        console.error('📄 Error listing documents:', err);
      });
    }
  }, [documentId]);

  // Fetch document data with real-time updates
  const { 
    data: document, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['processedDocument', documentId],
    queryFn: () => ProcessedDocumentsService.getProcessedDocumentById(documentId),
    refetchInterval: (data: ProcessedDocument | null | undefined) => {
      // Poll while document is being processed
      if (data?.processing_status === 'analyzing' || data?.processing_status === 'processing' ||
          data?.status === 'analyzing' || data?.status === 'processing') {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling
    },
    enabled: !!documentId,
  });

  // Load evaluation data from document metadata if available
  useEffect(() => {
    const status = document?.processing_status || document?.status;
    console.log('🔍 DocumentDetailView: Document status check:', {
      documentId,
      status,
      hasEvaluation: !!evaluation,
      hasMetadata: !!document?.metadata,
      metadataKeys: document?.metadata ? Object.keys(document.metadata) : []
    });
    
    if ((status === 'analyzing' || status === 'processing') && !evaluation && document?.metadata) {
      const metadata = document.metadata as Record<string, unknown>;
      console.log('📊 DocumentDetailView: Checking metadata for evaluation reconstruction:', metadata);
      
      // Check if we have either template suggestions OR ai classification data (more flexible)
      if (metadata.template_suggestions || metadata.ai_classification || metadata.document_type) {
        // Reconstruct evaluation from metadata
        setEvaluation({
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
          processing_recommendations: metadata.processing_recommendations || {
            workflow: (metadata.template_suggestions as any[])?.length > 0 ? 'existing_template' : 'generate_template',
            suggested_action: (metadata.template_suggestions as any[])?.length > 0 
              ? `Use the "${(metadata.template_suggestions as any[])[0].template_name}" template for best results`
              : 'Generate a new AI-powered template for this document type',
            alternative_actions: ['Generate a new template', 'Browse all templates'],
            confidence_level: ((metadata.ai_classification as any)?.confidence_score || 0) > 0.8 ? 'high' : 'medium',
          },
        });
        console.log('✅ DocumentDetailView: Evaluation reconstructed from metadata');
      } else {
        console.log('⚠️ DocumentDetailView: No sufficient metadata for evaluation reconstruction');
      }
    }
  }, [document?.processing_status, document?.status, document?.metadata, evaluation]);

  // Convert document data to content format
  const documentContent: DocumentContent = useMemo(() => {
    if (!document) return { original: { text: '' }, processed: { text: '' } };

    // Try different sources for original and processed text
    const originalText = document.metadata?.original_content || 
                        document.metadata?.original_text || 
                        document.content_text || '';
    
    // For processed text, try to generate formatted template output if we have extracted data
    let processedText = document.metadata?.processed_content || 
                       document.metadata?.extracted_content ||
                       document.metadata?.processed_text ||
                       document.content_text || '';
    
    // Get extracted data from various sources
    const extractedData = document.extracted_fields || 
                         document.metadata?.extracted_fields ||
                         document.metadata?.extraction_result?.extracted_values || 
                         {};
    
    return {
      original: {
        text: originalText,
        html: document.metadata?.original_html,
        metadata: document.metadata || {}
      },
      processed: {
        text: processedText,
        html: document.metadata?.processed_html || document.metadata?.extracted_html,
        extracted_data: extractedData,
        template_applied: document.template_name || document.template_id?.toString()
      }
    };
  }, [document]);

  // Initialize edited content when document loads
  useEffect(() => {
    if (documentContent.processed.text && !editedContent) {
      setEditedContent(documentContent.processed.html || documentContent.processed.text);
    }
  }, [documentContent, editedContent]);

  // Navigate to correct template edit page based on template type
  const navigateToTemplateEdit = async (templateId: number, editMode = true) => {
    try {
      // Get all templates to find the correct one and determine its type
      const templates = await masterTemplateService.getTemplates();
      const template = templates.find(t => t.id === templateId || t.id?.toString() === templateId?.toString());
      
      if (!template) {
        console.error('Template not found:', templateId);
        return;
      }

      // Navigate based on template type
      if (template.type === 'smart') {
        navigate({ 
          to: '/templates/smart/$templateId/edit', 
          params: { templateId: templateId.toString() }
        });
      } else if (template.type === 'workflow') {
        // Navigate to workflow template edit when we have that route
        navigate({ 
          to: '/templates/$templateId', 
          params: { templateId: templateId.toString() },
          search: editMode ? { mode: 'edit' } : undefined
        });
      } else {
        // Standard template
        navigate({ 
          to: '/templates/$templateId', 
          params: { templateId: templateId.toString() },
          search: editMode ? { mode: 'edit' } : undefined
        });
      }
    } catch (error) {
      console.error('Error navigating to template edit:', error);
      // Fallback to standard template route
      navigate({ 
        to: '/templates/$templateId', 
        params: { templateId: templateId.toString() },
        search: editMode ? { mode: 'edit' } : undefined
      });
    }
  };

  // Generate formatted template output from extracted data
  const generateFormattedOutput = async () => {
    const extractedData = documentContent.processed.extracted_data;
    const templateId = document?.template_id;
    
    if (!extractedData || !templateId || Object.keys(extractedData).length === 0) {
      return documentContent.processed.text;
    }

    try {
      // Get the template used for processing
      const templates = await masterTemplateService.getTemplates();
      const templateItem = templates.find(t => t.id === templateId || t.id?.toString() === templateId?.toString());
      
      if (!templateItem) {
        return documentContent.processed.text;
      }

      // Get the full template with content
      const template = await masterTemplateService.getTemplate(templateItem.id, templateItem.type);

      // Replace template variables with extracted values
      let formattedContent = template.template_content || (template as any).content || '';
      
      Object.entries(extractedData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        const displayValue = typeof value === 'object' && value !== null && 'value' in value 
          ? String((value as any).value || '') 
          : String(value || '');
        formattedContent = formattedContent.replace(new RegExp(placeholder, 'g'), displayValue);
      });

      return formattedContent;
    } catch (error) {
      console.error('Error generating formatted output:', error);
      return documentContent.processed.text;
    }
  };

  // State for formatted template output
  const [formattedOutput, setFormattedOutput] = React.useState<string | null>(null);

  // Generate formatted output when document changes
  useEffect(() => {
    if (document?.template_id && documentContent.processed.extracted_data) {
      generateFormattedOutput().then(setFormattedOutput);
    }
  }, [document?.template_id, documentContent.processed.extracted_data]);

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
        status: 'processing',
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
        result = await documentProcessor.generateTemplate(
          file,
          `${evaluation.type_evaluation.primary_type} Template`,
          evaluation.type_evaluation.primary_type
        );
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
        status: 'analyzing',
        metadata: {
          ...document.metadata,
          rerun_extraction: true as never,
          rerun_timestamp: new Date().toISOString(),
        },
      });

      const file = await getDocumentFile();

      // Re-evaluate document type
      const evaluationResult = await documentProcessor.evaluateDocumentType(file);
      setEvaluation(evaluationResult);

      // Update document with new analysis results
      await documentManager.updateDocumentStatus(documentId, {
        status: 'analyzing',
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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'analyzing': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-purple-100 text-purple-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'analyzing': return <Sparkles className="w-4 h-4" />;
      case 'pending': return <Sparkles className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleSaveContent = async () => {
    if (onSave && editedContent) {
      await onSave(editedContent);
      setEditMode(false);
    }
  };

  const handleDownload = async (format: 'json' | 'txt' | 'csv' | 'html' | 'docx') => {
    if (onDownload) {
      await onDownload(format);
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
  const currentStatus = document.processing_status || document.status || 'completed';
  if (currentStatus !== 'completed') {
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
                <Badge className={getStatusColor(currentStatus)}>
                  {getStatusIcon(currentStatus)}
                  <span className="ml-1">{currentStatus || 'pending'}</span>
                </Badge>
                {document.processing_method && (
                  <Badge variant="outline">{document.processing_method}</Badge>
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
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-medium">Analyzing Document with AI</h3>
                    <p className="text-sm text-gray-600">Detecting document type and suggesting processing options...</p>
                  </div>
                </div>
                <Progress value={33} className="h-2" />
              </div>
            </CardContent>
          </Card>
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
                <Progress value={66} className="h-2" />
                <p className="text-xs text-gray-500 text-center">
                  This typically takes 60-90 seconds depending on document complexity
                </p>
                {document.metadata?.rerun_extraction && (
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

  const renderSideBySideView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Original Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Original Document
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {document.file_type?.toUpperCase() || 'Unknown'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(documentContent.original.text)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MarkdownViewer
            content={documentContent.original.text}
            height="h-64 sm:h-96"
          />
        </CardContent>
      </Card>

      {/* Processed Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Edit3 className="w-5 h-5 mr-2" />
              Processed Document
              {editMode && <Badge className="ml-2">Editing</Badge>}
            </CardTitle>
            <div className="flex items-center space-x-2">
              {documentContent.processed.template_applied && (
                <Badge variant="secondary">
                  Template: {documentContent.processed.template_applied}
                </Badge>
              )}
              {document.template_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateToTemplateEdit(document.template_id)}
                  className="text-xs"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit Template
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              </Button>
              {editMode && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveContent}
                >
                  <Save className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="h-64 sm:h-96">
              <WysiwygEditor
                value={editedContent}
                onChange={setEditedContent}
                placeholder="Enter processed document content..."
                height="100%"
              />
            </div>
          ) : (
            <MarkdownViewer
              content={formattedOutput || documentContent.processed.text}
              height="h-64 sm:h-96"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderTabsView = () => (
    <Tabs defaultValue="original" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-auto">
        <TabsTrigger value="original" className="text-xs sm:text-sm px-2 py-2">
          <span className="hidden sm:inline">Original Document</span>
          <span className="sm:hidden">Original</span>
        </TabsTrigger>
        <TabsTrigger value="processed" className="text-xs sm:text-sm px-2 py-2">
          <span className="hidden sm:inline">Processed Document</span>
          <span className="sm:hidden">Processed</span>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(documentContent.original.text)}
              >
                <Copy className="w-4 h-4" />
              </Button>
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
                Processed Content
                {editMode && <Badge className="ml-2">Editing</Badge>}
              </CardTitle>
              <div className="flex items-center space-x-2">
                {document.template_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateToTemplateEdit(document.template_id, false)}
                    className="text-xs"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit Template
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </Button>
                {editMode && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveContent}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="h-64 sm:h-96">
                <WysiwygEditor
                  value={editedContent}
                  onChange={setEditedContent}
                  placeholder="Enter processed document content..."
                  height="100%"
                />
              </div>
            ) : (
              <MarkdownViewer
                content={formattedOutput || documentContent.processed.text}
                height="h-64 sm:h-96"
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );

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
              <Badge className={getStatusColor(document.processing_status || 'completed')}>
                {getStatusIcon(document.processing_status || 'completed')}
                <span className="ml-1">{document.processing_status || 'completed'}</span>
              </Badge>
              {document.processing_method && (
                <Badge variant="outline">{document.processing_method}</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {new Date(document.created_at).toLocaleDateString()}
              </span>
              {document.metadata?.rerun_extraction && (
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
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'side-by-side' ? 'tabs' : 'side-by-side')}
              className="flex-1 sm:flex-none"
            >
              <SplitSquareHorizontal className="w-4 h-4 mr-2" />
              {viewMode === 'side-by-side' ? 'Tabs' : 'Split'}
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload('html')}
              className="flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>

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
        {viewMode === 'side-by-side' ? renderSideBySideView() : renderTabsView()}
      </div>

      {/* Processing Statistics and Insights */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Processing Statistics & Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Processing Time */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Processing Time</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {document.processing_time ? `${(document.processing_time).toFixed(2)}s` : '~0.2s'}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* Document Size */}
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">File Size</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {document.size ? `${(document.size / 1024).toFixed(1)}KB` : 'N/A'}
                  </p>
                </div>
                <Database className="w-8 h-8 text-green-500" />
              </div>
            </div>

            {/* Content Chunks */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Content Chunks</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {document.chunk_count || document.chunks?.length || 'N/A'}
                  </p>
                </div>
                <Layers className="w-8 h-8 text-purple-500" />
              </div>
            </div>

            {/* Processing Method */}
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Method Used</p>
                  <p className="text-lg font-bold text-orange-900 dark:text-orange-100">
                    {document.processing_method === 'real_docling' ? 'Enhanced' : 
                     document.processing_method === 'mock' ? 'Basic' : 
                     'Standard'}
                  </p>
                </div>
                <Target className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Detailed Processing Insights */}
          {(document.chunking_stats || document.processing_details) && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Processing Details
              </h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Chunking Statistics */}
                {document.chunking_stats && (
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <h5 className="font-medium mb-3">Chunking Analysis</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Average words per chunk:</span>
                        <span className="font-mono">{document.chunking_stats.avg_words_per_chunk?.toFixed(0) || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Chunk size range:</span>
                        <span className="font-mono">
                          {document.chunking_stats.min_words_per_chunk || 0}-{document.chunking_stats.max_words_per_chunk || 0} words
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total words processed:</span>
                        <span className="font-mono">{document.chunking_stats.total_words?.toLocaleString() || 'N/A'}</span>
                      </div>
                      {document.chunking_stats.chunking_methods && (
                        <div className="pt-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Chunking methods used:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(document.chunking_stats.chunking_methods).map(([method, count]) => (
                              <Badge key={method} variant="outline" className="text-xs">
                                {method}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vector Indexing Status */}
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                  <h5 className="font-medium mb-3">Vector Indexing</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Status:</span>
                      <Badge variant={document.vector_indexed ? "default" : "secondary"}>
                        {document.vector_indexed ? 'Indexed' : 'Not Indexed'}
                      </Badge>
                    </div>
                    {document.embedding_model && (
                      <div className="flex justify-between">
                        <span>Embedding model:</span>
                        <span className="font-mono text-xs">{document.embedding_model}</span>
                      </div>
                    )}
                    {document.vector_indexing_result && (
                      <div className="flex justify-between">
                        <span>Indexed chunks:</span>
                        <span className="font-mono">{document.vector_indexing_result.indexed_chunks || 0}</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {document.vector_indexed 
                          ? 'Document is searchable via semantic search' 
                          : 'Enable vector indexing for semantic search capabilities'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Extracted Fields Display */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Extracted Fields</CardTitle>
            <div className="flex gap-2">
              {document.template_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateToTemplateEdit(document.template_id)}
                  className="self-start sm:self-auto"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Edit Template & Fields</span>
                  <span className="sm:hidden">Edit Template</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRerunExtraction()}
                disabled={isProcessing}
                className="self-start sm:self-auto"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Rerun Smart Extraction</span>
                <span className="sm:hidden">Rerun Extraction</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Document processed successfully
                  {document.metadata?.rerun_extraction && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Updated with Smart Extraction
                    </span>
                  )}
                </span>
              </div>
              {document.metadata?.rerun_timestamp && (
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Last updated: {new Date(document.metadata.rerun_timestamp).toLocaleString()}
                </p>
              )}
            </div>
            
            {/* Extracted Fields Display */}
            <div>
              <h4 className="font-medium mb-3">Extracted Fields</h4>
              {(() => {
                // Handle different possible structures for extracted fields
                let extractedFields = null;
                let confidenceScores = null;
                
                // Try direct extracted_fields first
                if (document.extracted_fields && typeof document.extracted_fields === 'object') {
                  extractedFields = document.extracted_fields;
                }
                // Try metadata.extracted_fields
                else if (document.metadata?.extracted_fields && typeof document.metadata.extracted_fields === 'object') {
                  extractedFields = document.metadata.extracted_fields;
                }
                // Try metadata.extraction_result.extracted_values (NEW - this is the missing piece)
                else if (document.metadata?.extraction_result?.extracted_values && typeof document.metadata.extraction_result.extracted_values === 'object') {
                  extractedFields = document.metadata.extraction_result.extracted_values;
                  confidenceScores = document.metadata.extraction_result.confidence_scores || {};
                }
                // Try metadata.fields
                else if (document.metadata?.fields && typeof document.metadata.fields === 'object') {
                  extractedFields = document.metadata.fields;
                }
                
                if (!extractedFields || Object.keys(extractedFields).length === 0) {
                  return (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                      <p className="text-sm text-gray-500">No extracted fields available</p>
                      <p className="text-xs text-gray-400 mt-1">
                        This document may not have been processed with field extraction enabled
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {Object.entries(extractedFields).map(([key, fieldData]) => {
                      // Handle different field data structures
                      let displayValue = '';
                      let confidence = 0;
                      let sourceText = '';
                      
                      if (typeof fieldData === 'object' && fieldData !== null) {
                        // Handle ExtractedField structure with confidence, value, etc.
                        const field = fieldData as ExtractedFieldValue;
                        if ('value' in field) {
                          displayValue = String(field.value || '');
                          confidence = field.confidence || 0;
                          sourceText = field.sourceText || '';
                        } else {
                          // Handle direct object values
                          displayValue = JSON.stringify(fieldData);
                        }
                      } else {
                        // Handle primitive values (from extraction_result.extracted_values)
                        displayValue = String(fieldData || '');
                        // Use confidence from separate confidence_scores object if available
                        if (confidenceScores && confidenceScores[key] !== undefined) {
                          confidence = confidenceScores[key];
                        }
                      }
                      
                      const confidenceColor = confidence >= 0.8 ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400' :
                                             confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400' :
                                             confidence > 0 ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400' : '';
                      
                      return (
                        <div key={key} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            {confidence > 0 && (
                              <span className={`text-xs px-2 py-1 rounded-full ${confidenceColor}`}>
                                {Math.round(confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                          <div className="mb-2">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {displayValue || <em className="text-gray-400">No value</em>}
                            </span>
                          </div>
                          {sourceText && (
                            <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded italic">
                              Source: "{sourceText}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}