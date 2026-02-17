import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/context/auth-context';
import { useOrganization } from '@/context/organization-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DragDropZone } from '@/components/ui/drag-drop-zone';
import { ProcessingLog } from '@/components/ui/processing-log';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { useProcessingStream } from '@/hooks/use-processing-stream';
import type { StreamResult } from '@/hooks/use-processing-stream';
import { UploadSource } from '@/services/unified-document-service';
import { Sparkles, ArrowRight, Settings, FileText, Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { withAuthentication } from '@/lib/supabase-auth-utils';

interface DocumentEvaluation {
  document_info: {
    filename: string;
    file_size: number;
    mime_type: string;
    format_supported: boolean;
  };
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

interface ProcessingAction {
  type: 'use_template' | 'generate_template' | 'manual_selection';
  template_id?: number;
  template_name?: string;
}

interface PreSelectedTemplate {
  id: string;
  type?: 'smart' | 'standard' | 'workflow';
  name?: string;
}

interface DocumentUploadPageProps {
  onDocumentProcessed?: (result: any) => void;
  preSelectedTemplate?: PreSelectedTemplate;
}

export function DocumentUploadPage({ onDocumentProcessed, preSelectedTemplate }: DocumentUploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug pre-selected template
  useEffect(() => {
    if (preSelectedTemplate) {
      console.log('[DocumentUpload] Pre-selected template loaded:', preSelectedTemplate);
    }
  }, [preSelectedTemplate]);

  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { activeOrganization, isLoading: isLoadingOrg } = useOrganization();
  const queryClient = useQueryClient();
  const documentProcessor = React.useMemo(() => new DocumentProcessorEnhanced(), []);
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });
  const stream = useProcessingStream();

  // Track whether we've already handled the stream result to prevent double-navigation
  const handledResultRef = useRef(false);

  // Debug authentication state
  useEffect(() => {
    console.log('[DocumentUpload] Auth state:', {
      user_id: user?.id,
      has_session: !!session,
      user_email: user?.email
    });
  }, [user, session]);

  // ── Handle stream completion: finalize document + navigate ──────────
  useEffect(() => {
    if (stream.status !== 'complete' || !stream.result || !documentId || handledResultRef.current) {
      return;
    }

    handledResultRef.current = true;
    const result = stream.result;

    (async () => {
      try {
        // Build extracted data in the format DocumentDetailView expects
        let extractedData = null;
        if (result.extracted_fields && Object.keys(result.extracted_fields).length > 0) {
          extractedData = {
            extracted_values: result.extracted_fields,
            confidence_scores: Object.entries(result.extracted_fields).reduce(
              (acc, [key, field]: [string, any]) => {
                acc[key] = field.confidence || 0;
                return acc;
              },
              {} as Record<string, number>,
            ),
          };
        }

        // If a template was generated, save it to the database
        let savedGeneratedTemplate = null;
        if (result.action === 'generate_new' && result.generated_template) {
          const genTemplate = result.generated_template;
          const templateVariables = genTemplate.smart_variables || genTemplate.variables || [];
          const primaryType = (result.evaluation?.type_evaluation?.primary_type) || 'document';

          if (Array.isArray(templateVariables) && templateVariables.length > 0) {
            try {
              savedGeneratedTemplate = await withAuthentication(async (authUser) => {
                const { data, error: dbError } = await supabase
                  .from('smart_templates')
                  .insert({
                    name: genTemplate.name || `${primaryType.charAt(0).toUpperCase() + primaryType.slice(1)} Template`,
                    description: genTemplate.description || `Auto-generated template for ${primaryType} documents`,
                    category: genTemplate.category || primaryType,
                    smart_variables: templateVariables,
                    extraction_rules: genTemplate.extraction_rules || [],
                    is_public: false,
                    created_by: authUser.id,
                    template_type: 'smart',
                    tags: genTemplate.tags || ['ai-generated', primaryType],
                  })
                  .select()
                  .single();

                if (dbError) throw dbError;
                return data;
              }, 'Save Generated Template');

              console.log('[DocumentUpload] Generated template saved:', savedGeneratedTemplate?.id);
            } catch (saveErr) {
              console.error('[DocumentUpload] Failed to save generated template:', saveErr);
              toast.error('Template was generated but failed to save. You can recreate it from the document.');
            }
          }
        }

        const appliedTemplate = result.chosen_template || (savedGeneratedTemplate
          ? { template_id: savedGeneratedTemplate.id, template_name: savedGeneratedTemplate.name }
          : null);

        const evaluation = result.evaluation || {};
        const typeEval = evaluation.type_evaluation || {};

        await documentManager.finalizeDocument(documentId, {
          status: 'completed',
          content_text: result.content,
          extracted_fields: extractedData,
          metadata: {
            document_type: typeEval.primary_type,
            type_confidence: typeEval.confidence,
            ai_classification: {
              primary_category: typeEval.primary_type,
              confidence_score: typeEval.confidence,
              detection_method: typeEval.detection_method,
            },
            template_id: appliedTemplate?.template_id,
            template_name: appliedTemplate?.template_name,
            template_decision: {
              action: result.action,
              validation_level: result.decision_metadata?.validation_level,
              match_score: result.decision_metadata?.match_score,
              extraction_quality: result.decision_metadata?.extraction_quality,
              combined_score: result.decision_metadata?.combined_score,
              auto_applied: !!extractedData,
              chosen_template: result.chosen_template,
            },
            template_suggestions: result.alternatives || [],
            extracted_data: extractedData,
            title: result.metadata?.title,
            author: result.metadata?.author,
            page_count: result.metadata?.page_count,
          },
        });

        await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });

        console.log('[DocumentUpload] Document finalized, navigating to:', documentId);

        if (onDocumentProcessed) {
          onDocumentProcessed(result);
        } else {
          navigate({ to: `/documents/${documentId}` });
        }
      } catch (err) {
        console.error('[DocumentUpload] Failed to finalize document:', err);
        setError(err instanceof Error ? err.message : 'Failed to finalize document');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stream.result intentionally excluded to prevent
  // double-firing when the result object reference changes. handledResultRef guards against duplicate processing.
  }, [stream.status, documentId, documentManager, queryClient, navigate, onDocumentProcessed]);

  // Propagate stream errors
  useEffect(() => {
    if (stream.status === 'error' && stream.error) {
      setError(stream.error);
      if (documentId) {
        documentManager.markDocumentFailed(documentId, stream.error);
      }
    }
  }, [stream.status, stream.error, documentId, documentManager]);

  // ── Pre-selected template handler (unchanged) ──────────────────────
  const handleActionSelect = useCallback(async (action: ProcessingAction) => {
    if (!selectedFile || !documentId) return;
    if (!preSelectedTemplate) return;

    console.log('[DocumentUpload] handleActionSelect (pre-selected):', action);
    setIsProcessing(true);
    setError(null);

    try {
      await documentManager.updateDocumentStatus(documentId, {
        status: 'processing' as any,
        metadata: {
          processing_method: 'template_guided',
          template_id: action.template_id,
          template_name: action.template_name,
        },
      });

      const result = await documentProcessor.processWithExistingTemplate(
        selectedFile,
        action.template_id!,
      );

      console.log('[DocumentUpload] Pre-selected template processing complete:', result);

      await documentManager.finalizeDocument(documentId, {
        content_text: result?.content || '',
        extracted_fields: result?.extractedFields || result?.extracted_fields,
        processing_method: 'template_guided',
        quality_metrics: result?.quality_metrics,
      });

      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });
      navigate({ to: `/documents/${documentId}` });

    } catch (err) {
      console.error('[DocumentUpload] Pre-selected template processing failed:', err);
      setError(err instanceof Error ? err.message : 'Document processing failed');
      if (documentId) {
        await documentManager.markDocumentFailed(
          documentId,
          err instanceof Error ? err.message : 'Document processing failed',
        );
      }
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, documentId, documentManager, documentProcessor, queryClient, navigate, preSelectedTemplate]);

  // ── Main file select handler ───────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    console.log('[DocumentUpload] handleFileSelect:', file.name, 'preSelectedTemplate:', preSelectedTemplate);

    setSelectedFile(file);
    setError(null);
    handledResultRef.current = false;

    // Verify user is authenticated before proceeding
    if (!user || !session) {
      console.error('[DocumentUpload] Authentication failed');
      setError('Authentication required - please sign in to upload documents');
      return;
    }

    // Verify organization is selected
    if (!activeOrganization) {
      console.error('[DocumentUpload] No organization selected');
      setError('Please select an organization before uploading documents');
      return;
    }

    try {
      // Step 1: Create document record immediately
      const documentRecord = await documentManager.createDocument({
        file,
        uploadSource: UploadSource.SMART_UPLOAD,
        organizationId: activeOrganization.id,
      });

      if (!documentRecord.id) {
        throw new Error('Document record created without a valid ID');
      }

      setDocumentId(documentRecord.id);

      const metadata = documentRecord.metadata as any;
      if (metadata?.storage_upload_failed) {
        console.warn('[DocumentUpload] File storage failed, processing will continue:', metadata.storage_error);
      }

      // ── Pre-selected template path (unchanged) ───────────────────
      if (preSelectedTemplate) {
        console.log('[DocumentUpload] Using pre-selected template:', preSelectedTemplate);
        setIsProcessing(true);

        try {
          await documentManager.updateDocumentStatus(documentRecord.id, {
            status: 'processing' as any,
            metadata: {
              template_id: Number(preSelectedTemplate.id),
              template_type: preSelectedTemplate.type || 'smart',
              template_name: preSelectedTemplate.name,
              processing_method: 'template_pre_selected',
            },
          });

          await handleActionSelect({
            type: 'use_template',
            template_id: Number(preSelectedTemplate.id),
            template_name: preSelectedTemplate.name,
          });
          return;
        } catch (templateErr) {
          console.error('[DocumentUpload] Pre-selected template error:', templateErr);
          setError(templateErr instanceof Error ? templateErr.message : 'Processing failed with selected template');
          setIsProcessing(false);
          if (documentRecord.id) {
            setTimeout(() => navigate({ to: `/documents/${documentRecord.id}` }), 2000);
          }
          return;
        }
      }

      // ── Smart upload path: stream via SSE ────────────────────────
      // Use 'processing' (not 'analyzing') because 'analyzing' auto-triggers
      // triggerAIAnalysis() which tries to download from storage — conflicting
      // with the SSE stream that sends the file directly to the backend.
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: 'processing' as any,
        metadata: { processing_method: 'sse_stream' },
      });

      console.log('[DocumentUpload] Starting SSE stream for:', file.name);

      stream.startProcessing(file, {
        quickScan: true,
        minMatchConfidence: 0.6,
        allowGeneration: true,
        organizationId: activeOrganization.id,
      });

    } catch (err) {
      console.error('[DocumentUpload] Document upload failed:', err);
      setError(err instanceof Error ? err.message : 'Document upload failed');

      if (documentId) {
        await documentManager.markDocumentFailed(
          documentId,
          err instanceof Error ? err.message : 'Document upload failed',
        );
      }
    }
  }, [documentProcessor, documentManager, documentId, preSelectedTemplate, handleActionSelect, user, session, navigate, activeOrganization, stream]);

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setDocumentId(null);
    setError(null);
    setIsProcessing(false);
    handledResultRef.current = false;
    stream.abort();
  }, [stream]);

  const isStreamActive = stream.status === 'connecting' || stream.status === 'streaming';
  const showProcessingLog = isStreamActive || stream.status === 'complete' || stream.status === 'error';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/documents' })}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Smart Upload</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Upload your document and let AI automatically detect its type and suggest the best processing approach.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-600" />
        </div>
      </div>

      {/* Pre-selected Template Notification */}
      {preSelectedTemplate && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Template Selected:</strong> {preSelectedTemplate.name || `Template ${preSelectedTemplate.id}`}
              <span className="ml-2">
                <Badge variant="outline" className="text-xs">
                  {preSelectedTemplate.type || 'smart'} template
                </Badge>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigate({ to: '/documents/upload' });
              }}
              className="text-xs"
            >
              Clear Selection
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Authentication Status */}
      {!user && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to upload documents. Authentication is required for document processing.
          </AlertDescription>
        </Alert>
      )}

      {/* Organization Status */}
      {user && !isLoadingOrg && !activeOrganization && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No organization selected. Please select or create an organization to upload documents.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && !showProcessingLog && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6">
          <DragDropZone
            onFileSelect={handleFileSelect}
            isEvaluating={isStreamActive}
            evaluationResult={undefined}
            disabled={isProcessing || isStreamActive || !user || isLoadingOrg || !activeOrganization}
          />
        </CardContent>
      </Card>

      {/* Streaming Processing Log (replaces old static spinners) */}
      {showProcessingLog && (
        <ProcessingLog
          logs={stream.logs}
          progress={stream.progress}
          status={stream.status}
          error={stream.error}
        />
      )}

      {/* Pre-selected template processing status (kept as-is) */}
      {isProcessing && preSelectedTemplate && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-3">
              <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">Processing with {preSelectedTemplate.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Extracting data using the pre-selected template...
                </p>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (documentId) {
                        navigate({ to: `/documents/${documentId}` });
                      }
                    }}
                    disabled={!documentId}
                  >
                    {documentId ? 'View Document Results' : 'Processing...'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {!selectedFile && !isStreamActive && !isProcessing && (
        <Card className={preSelectedTemplate
          ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800"
          : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800"
        }>
          <CardContent className="p-6">
            <div className="text-center">
              {preSelectedTemplate ? (
                <>
                  <Zap className="w-8 h-8 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Ready to Process with Selected Template
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 max-w-2xl mx-auto">
                    <p>- <strong>Template Selected:</strong> {preSelectedTemplate.name || `Template ${preSelectedTemplate.id}`}</p>
                    <p>- <strong>Direct Processing:</strong> Your document will be processed immediately using this template</p>
                    <p>- <strong>Fast Results:</strong> No evaluation needed - we'll extract data based on the template fields</p>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Smart Document Processing
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 max-w-2xl mx-auto">
                    <p>- <strong>Automatic Detection:</strong> AI identifies document type (invoices, contracts, reports, etc.)</p>
                    <p>- <strong>Template Matching:</strong> Suggests the best templates based on document content</p>
                    <p>- <strong>Intelligent Processing:</strong> Chooses optimal extraction method for your document</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Button when streaming is active or errored */}
      {(isStreamActive || stream.status === 'error') && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={resetUpload}
          >
            {stream.status === 'error' ? 'Try Again' : 'Cancel Processing'}
          </Button>
        </div>
      )}
    </div>
  );
}
