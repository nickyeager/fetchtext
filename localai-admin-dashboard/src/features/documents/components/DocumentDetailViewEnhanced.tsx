/**
 * Enhanced Document Detail View Component
 * 
 * Displays document details and handles all processing states:
 * - Uploaded: Shows AI analysis and processing options
 * - Analyzing: Shows progress while evaluating document
 * - Processing: Shows progress while extracting content
 * - Completed: Shows full extraction results
 * - Failed: Shows error information
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Download, FileText, Sparkles, Settings, Zap, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ProcessedDocumentsService, ProcessedDocument } from '../services/processed-documents-service';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { useDocumentManager } from '@/hooks/use-document-manager';

interface DocumentDetailViewEnhancedProps {
  documentId: string;
  onBack?: () => void;
  onDownload?: (format: 'json' | 'txt' | 'csv') => Promise<void>;
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

export function DocumentDetailViewEnhanced({ 
  documentId, 
  onBack, 
  onDownload 
}: DocumentDetailViewEnhancedProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluation, setEvaluation] = useState<DocumentEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const documentProcessor = React.useMemo(() => new DocumentProcessorEnhanced(), []);
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });

  // Fetch document data with real-time updates
  const { data: document, isLoading, refetch } = useQuery({
    queryKey: ['processedDocument', documentId],
    queryFn: () => ProcessedDocumentsService.getDocumentById(documentId),
    refetchInterval: (data) => {
      // Poll while document is being processed
      if (data?.processing_status === 'analyzing' || data?.processing_status === 'processing') {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling
    },
  });

  // Load evaluation data from document metadata if available
  useEffect(() => {
    if (document?.processing_status === 'uploaded' && !evaluation && document.metadata) {
      const metadata = document.metadata as any;
      if (metadata.template_suggestions && metadata.ai_classification) {
        // Reconstruct evaluation from metadata
        setEvaluation({
          type_evaluation: {
            primary_type: metadata.ai_classification.primary_category,
            confidence: metadata.ai_classification.confidence_score,
            detection_method: metadata.ai_classification.detection_method,
          },
          template_suggestions: metadata.template_suggestions,
          processing_recommendations: {
            workflow: metadata.template_suggestions.length > 0 ? 'existing_template' : 'generate_template',
            suggested_action: metadata.template_suggestions.length > 0 
              ? `Use the "${metadata.template_suggestions[0].template_name}" template for best results`
              : 'Generate a new AI-powered template for this document type',
            alternative_actions: ['Generate a new template', 'Browse all templates'],
            confidence_level: metadata.ai_classification.confidence_score > 0.8 ? 'high' : 'medium',
          },
        });
      }
    }
  }, [document?.processing_status, document?.metadata]);

  // Note: evaluateDocument function removed as evaluation happens before redirect

  // Helper function to get file for processing
  const getDocumentFile = async (): Promise<File> => {
    if (!document) throw new Error('Document not available');
    
    // Get the file - either from storage path or Supabase storage
    if (document.storage_path && document.storage_path.startsWith('http')) {
      // File is accessible via direct URL
      const response = await fetch(document.storage_path);
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
    setError(null);
    
    try {
      // Update document status to processing
      await documentManager.updateDocumentStatus(documentId, {
        status: 'processing' as any,
        metadata: {
          processing_method: action === 'use_template' ? 'template_guided' : 'ai_enhanced',
          template_id: templateId,
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
      });

      // Invalidate queries and refetch
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });
      await refetch();
    } catch (err) {
      console.error('Document processing failed:', err);
      setError(err instanceof Error ? err.message : 'Document processing failed');
      
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
    setError(null);
    
    try {
      // Reset document status to analyzing for re-evaluation
      await documentManager.updateDocumentStatus(documentId, {
        status: 'analyzing' as any,
        metadata: {
          rerun_extraction: true,
          rerun_timestamp: new Date().toISOString(),
        },
      });

      const file = await getDocumentFile();

      // Re-evaluate document type
      const evaluationResult = await documentProcessor.evaluateDocumentType(file);
      setEvaluation(evaluationResult);

      // Update document with new analysis results
      await documentManager.updateDocumentStatus(documentId, {
        status: 'uploaded' as any,
        metadata: {
          document_type: evaluationResult.type_evaluation.primary_type,
          type_confidence: evaluationResult.type_evaluation.confidence,
          ai_classification: {
            primary_category: evaluationResult.type_evaluation.primary_type,
            confidence_score: evaluationResult.type_evaluation.confidence,
            detection_method: evaluationResult.type_evaluation.detection_method,
          },
          template_suggestions: evaluationResult.template_suggestions,
          rerun_extraction: true,
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
      console.error('Rerun extraction failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to rerun extraction');
      
      await documentManager.markDocumentFailed(
        documentId, 
        err instanceof Error ? err.message : 'Failed to rerun extraction'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'analyzing': return 'bg-yellow-100 text-yellow-800';
      case 'uploaded': return 'bg-purple-100 text-purple-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': 
      case 'analyzing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'uploaded': return <Sparkles className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
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

  if (!document) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Document not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onBack || (() => navigate({ to: '/documents/gallery' }))}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{document.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(document.processing_status)}>
                {getStatusIcon(document.processing_status)}
                <span className="ml-1">{document.processing_status || 'uploaded'}</span>
              </Badge>
              {document.processing_method && (
                <Badge variant="outline">{document.processing_method}</Badge>
              )}
            </div>
          </div>
        </div>
        {document.processing_status === 'completed' && onDownload && (
          <Button onClick={() => onDownload('json')} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status-specific content */}
      {document.processing_status === 'analyzing' && (
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

      {document.processing_status === 'uploaded' && evaluation && (
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
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleProcessingAction('generate_template')}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate New Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: '/templates' })}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Browse All Templates
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {document.processing_status === 'processing' && (
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

      {document.processing_status === 'completed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Processing Complete</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRerunExtraction()}
                  disabled={isProcessing}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Rerun Smart Extraction
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
                  let debugInfo = {
                    hasDirectFields: !!document.extracted_fields,
                    hasMetadataFields: !!document.metadata?.extracted_fields,
                    hasMetadataFieldsAlt: !!document.metadata?.fields,
                    documentKeys: Object.keys(document),
                    metadataKeys: document.metadata ? Object.keys(document.metadata) : []
                  };
                  
                  // Try direct extracted_fields first
                  if (document.extracted_fields && typeof document.extracted_fields === 'object') {
                    extractedFields = document.extracted_fields;
                    console.log('Using direct extracted_fields:', extractedFields);
                  }
                  // Try metadata.extracted_fields
                  else if (document.metadata?.extracted_fields && typeof document.metadata.extracted_fields === 'object') {
                    extractedFields = document.metadata.extracted_fields;
                    console.log('Using metadata.extracted_fields:', extractedFields);
                  }
                  // Try metadata.fields
                  else if (document.metadata?.fields && typeof document.metadata.fields === 'object') {
                    extractedFields = document.metadata.fields;
                    console.log('Using metadata.fields:', extractedFields);
                  }
                  
                  // Debug output
                  console.log('Document field debug info:', debugInfo);
                  console.log('Full document object:', document);
                  
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
                          if ('value' in fieldData) {
                            displayValue = String(fieldData.value || '');
                            confidence = fieldData.confidence || 0;
                            sourceText = fieldData.sourceText || '';
                          } else {
                            // Handle direct object values
                            displayValue = JSON.stringify(fieldData);
                          }
                        } else {
                          // Handle primitive values
                          displayValue = String(fieldData || '');
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
      )}

      {document.processing_status === 'failed' && (
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
                Processing failed: {document.error_message || 'Unknown error occurred'}
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