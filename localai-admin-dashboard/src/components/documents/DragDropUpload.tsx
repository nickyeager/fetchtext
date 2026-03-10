import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProcessingLog } from '@/components/ui/processing-log';
import { TemplateMatchCard, type TemplateSuggestion } from './TemplateMatchCard';
import { useAuth } from '@/context/auth-context';
import { useOrganization } from '@/context/organization-context';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { useProcessingStream } from '@/hooks/use-processing-stream';
import { UploadSource } from '@/services/unified-document-service';
import { supabase } from '@/lib/supabase';
import { withAuthentication } from '@/lib/supabase-auth-utils';
import { API_ENDPOINTS } from '@/lib/api-config';
import { toast } from 'sonner';

interface DragDropUploadProps {
  className?: string;
  onUploadStart?: () => void;
  onUploadComplete?: (documentId: string) => void;
  showProcessingLog?: boolean;
}

const ACCEPTED_FORMATS = ['.pdf', '.docx', '.html', '.htm', '.jpg', '.jpeg', '.png', '.txt', '.md', '.pptx', '.xlsx', '.csv', '.gif', '.webp', '.bmp', '.tiff'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DragDropUpload({
  className,
  onUploadStart,
  onUploadComplete,
  showProcessingLog: showProcessingLogProp = true,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    documentId: string;
    suggestions: TemplateSuggestion[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef(false);
  const handledErrorRef = useRef(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { activeOrganization } = useOrganization();
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });
  const stream = useProcessingStream();

  // Keep a ref to activeOrganization so stream-completion effect always reads
  // the current value even though it's not in the dependency array.
  const activeOrgRef = useRef(activeOrganization);
  useEffect(() => {
    activeOrgRef.current = activeOrganization;
  }, [activeOrganization]);

  // ── Handle stream completion: finalize document + notify parent ────
  useEffect(() => {
    if (
      stream.status !== 'complete' ||
      !stream.result ||
      !documentId ||
      handledResultRef.current
    ) {
      return;
    }

    handledResultRef.current = true;
    const result = stream.result;

    (async () => {
      try {
        // Build extracted data in the format DocumentDetailView expects
        let extractedData = null;
        if (
          result.extracted_fields &&
          Object.keys(result.extracted_fields).length > 0
        ) {
          extractedData = {
            extracted_values: result.extracted_fields,
            confidence_scores: Object.entries(result.extracted_fields).reduce(
              (acc, [key, field]: [string, any]) => {
                acc[key] = field.confidence || 0;
                return acc;
              },
              {} as Record<string, number>
            ),
          };
        }

        // If a template was generated, save it to the database
        let savedGeneratedTemplate = null;
        if (result.action === 'generate_new' && result.generated_template) {
          const genTemplate = result.generated_template;
          const templateVariables =
            genTemplate.smart_variables || genTemplate.variables || [];
          const primaryType =
            result.evaluation?.type_evaluation?.primary_type || 'document';

          if (
            Array.isArray(templateVariables) &&
            templateVariables.length > 0
          ) {
            const currentOrg = activeOrgRef.current;
            if (!currentOrg) {
              console.warn(
                '[DragDropUpload] Cannot save template: No active organization'
              );
              toast.error(
                'Template generated but could not be saved — organization context was lost.'
              );
            } else {
              try {
                const templateName =
                  genTemplate.name ||
                  `${primaryType.charAt(0).toUpperCase() + primaryType.slice(1)} Template`;

                savedGeneratedTemplate = await withAuthentication(
                  async (authUser) => {
                    const { data, error: dbError } = await supabase
                      .from('smart_templates')
                      .insert({
                        name: templateName,
                        description:
                          genTemplate.description ||
                          `Auto-generated template for ${primaryType} documents`,
                        category:
                          primaryType || genTemplate.category || 'document',
                        smart_variables: templateVariables,
                        extraction_rules: genTemplate.extraction_rules || [],
                        is_public: false,
                        created_by: authUser.id,
                        organization_id: currentOrg.id,
                        template_type: 'smart',
                        template_content: genTemplate.template_content || '',
                        tags: genTemplate.tags || ['ai-generated', primaryType],
                      })
                      .select()
                      .single();

                    if (dbError) {
                      if (dbError.code === '23505') {
                        console.log(
                          `[DragDropUpload] Template "${templateName}" already exists, reusing`
                        );
                        const { data: existing } = await supabase
                          .from('smart_templates')
                          .select()
                          .eq('name', templateName)
                          .single();
                        if (existing) return existing;
                      }
                      throw dbError;
                    }
                    return data;
                  },
                  'Save Generated Template'
                );

                console.log(
                  '[DragDropUpload] Generated template saved:',
                  savedGeneratedTemplate?.id
                );

                // Fire-and-forget: Qdrant indexing is non-fatal and should
                // never block document finalization or navigation.
                if (savedGeneratedTemplate?.id) {
                  const templateToIndex = savedGeneratedTemplate;
                  const contentSnippet = result.content
                    ? result.content.substring(0, 2000)
                    : undefined;
                  const token = session?.access_token;
                  (async () => {
                    try {
                      const embeddingHeaders: Record<string, string> = {
                        'Content-Type': 'application/json',
                      };
                      if (token) {
                        embeddingHeaders['Authorization'] = `Bearer ${token}`;
                      }
                      await fetch(API_ENDPOINTS.indexTemplateEmbedding, {
                        method: 'POST',
                        headers: embeddingHeaders,
                        body: JSON.stringify({
                          template_id: templateToIndex.id,
                          name: templateToIndex.name || '',
                          description: templateToIndex.description || '',
                          category: templateToIndex.category || '',
                          smart_variables: templateToIndex.smart_variables || [],
                          is_public: templateToIndex.is_public || false,
                          document_text: contentSnippet,
                        }),
                      });
                      console.log(
                        '[DragDropUpload] Template indexed in Qdrant:',
                        templateToIndex.id
                      );
                    } catch (indexErr) {
                      console.warn(
                        '[DragDropUpload] Failed to index template in Qdrant (non-fatal):',
                        indexErr
                      );
                    }
                  })();
                }
              } catch (saveErr) {
                console.error(
                  '[DragDropUpload] Failed to save generated template:',
                  saveErr
                );
                toast.error(
                  'Template was generated but failed to save. You can recreate it from the document.'
                );
              }
            }
          }
        }

        const appliedTemplate =
          result.chosen_template ||
          (savedGeneratedTemplate
            ? {
                template_id: savedGeneratedTemplate.id,
                template_name: savedGeneratedTemplate.name,
              }
            : null);

        const evaluation = result.evaluation || {};
        const typeEval = evaluation.type_evaluation || {};

        const customTemplateContent =
          result.generated_template?.template_content ?? undefined;

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
            custom_template_content: customTemplateContent,
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
            extracted_values: result.extracted_fields,
            extracted_data: extractedData,
            title: result.metadata?.title,
            author: result.metadata?.author,
            page_count: result.metadata?.page_count,
          },
        });

        await queryClient.invalidateQueries({
          queryKey: ['processedDocuments'],
        });

        console.log(
          '[DragDropUpload] Document finalized, navigating to:',
          documentId
        );

        toast.success('Document processed successfully!');

        if (onUploadComplete) {
          onUploadComplete(documentId);
        } else {
          // Build template suggestions for the results display
          const suggestions: TemplateSuggestion[] = [];

          if (result.chosen_template) {
            suggestions.push({
              template_id: result.chosen_template.template_id,
              template_name: result.chosen_template.template_name,
              category: result.chosen_template.category || 'document',
              match_score: result.decision_metadata?.match_score ?? result.decision_metadata?.combined_score ?? 0,
              field_count: result.chosen_template.field_count ?? 0,
            });
          }

          if (result.alternatives && Array.isArray(result.alternatives)) {
            for (const alt of result.alternatives) {
              suggestions.push({
                template_id: alt.template_id,
                template_name: alt.template_name,
                category: alt.category || 'document',
                match_score: alt.match_score ?? 0,
                field_count: alt.field_count ?? 0,
              });
            }
          }

          setCompletedResult({ documentId, suggestions });
        }
      } catch (err) {
        console.error('[DragDropUpload] Failed to finalize document:', err);
        toast.error(
          err instanceof Error ? err.message : 'Failed to finalize document'
        );
      } finally {
        setIsUploading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stream.result excluded to prevent double-firing
  }, [
    stream.status,
    documentId,
    documentManager,
    queryClient,
    navigate,
    onUploadComplete,
    session?.access_token,
  ]);

  // Propagate stream errors
  useEffect(() => {
    if (stream.status === 'error' && stream.error && !handledErrorRef.current) {
      handledErrorRef.current = true;
      toast.error(stream.error);
      if (documentId) {
        documentManager.markDocumentFailed(documentId, stream.error);
      }
      setIsUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- documentManager excluded: unstable ref
  }, [stream.status, stream.error, documentId]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_SIZE) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(MAX_SIZE / 1024 / 1024).toFixed(1)}MB)`;
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(fileExtension)) {
      return `File format "${fileExtension}" is not supported. Accepted formats: ${ACCEPTED_FORMATS.join(', ')}`;
    }

    return null;
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    console.log('[DragDropUpload] Starting file upload process', {
      fileName: file.name,
      fileSize: file.size,
    });

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!user || !session) {
      toast.error('Please sign in to upload documents');
      navigate({ to: '/sign-in', search: { redirect: '/documents' } });
      return;
    }

    if (!activeOrganization) {
      toast.error('Please select an organization before uploading documents');
      return;
    }

    setIsUploading(true);
    setCompletedResult(null);
    handledResultRef.current = false;
    handledErrorRef.current = false;
    onUploadStart?.();

    try {
      // Create document record
      const documentRecord = await documentManager.createDocument({
        file,
        uploadSource: UploadSource.SMART_UPLOAD,
        organizationId: activeOrganization.id,
      });

      if (!documentRecord.id) {
        throw new Error('Document record created without a valid ID — cannot proceed with upload');
      }

      setDocumentId(documentRecord.id);

      // Use 'processing' (not 'analyzing') to avoid triggering triggerAIAnalysis()
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: 'processing' as any,
        metadata: { processing_method: 'sse_stream' },
      });

      console.log('[DragDropUpload] Starting SSE stream for:', file.name);

      stream.startProcessing(file, {
        quickScan: true,
        minMatchConfidence: 0.6,
        allowGeneration: true,
        organizationId: activeOrganization.id,
        documentId: documentRecord.id,
        accessToken: session?.access_token,
      });

    } catch (err) {
      console.error('[DragDropUpload] Document upload failed:', err);
      toast.error(err instanceof Error ? err.message : 'Document upload failed');
      setIsUploading(false);
    }
  }, [user, session, activeOrganization, navigate, documentManager, validateFile, onUploadStart, stream]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [isUploading, handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const openFileDialog = useCallback(() => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [isUploading]);

  const isStreamActive =
    stream.status === 'connecting' || stream.status === 'streaming';
  const showLog =
    showProcessingLogProp &&
    (isStreamActive || stream.status === 'complete' || stream.status === 'error');

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isUploading}
        aria-hidden="true"
        tabIndex={-1}
        title="Select file to upload"
      />

      {/* Drag Drop Zone */}
      {!showLog && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFileDialog}
          className={cn(
            "relative p-8 transition-all duration-200 cursor-pointer",
            "border-2 border-dashed rounded-lg",
            "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50",
            isDragging && "border-blue-500 bg-blue-50 dark:bg-blue-950",
            isUploading && "cursor-not-allowed opacity-50",
            !isDragging && "border-gray-300 dark:border-gray-600"
          )}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            {isUploading ? (
              <>
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-white">Processing document...</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">AI is analyzing your file</p>
                </div>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    Drag & drop your document here
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">or click to browse files</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Supported formats: PDF, Word, Excel, PowerPoint, HTML, Images, Text
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Maximum size: 10MB
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileDialog();
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Streaming Processing Log */}
      {showLog && (
        <div className="p-4">
          <ProcessingLog
            logs={stream.logs}
            progress={stream.progress}
            status={stream.status}
            error={stream.error}
          />
          {stream.status === 'error' && (
            <div className="flex justify-center mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  stream.reset();
                  setIsUploading(false);
                  setDocumentId(null);
                  setCompletedResult(null);
                }}
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Match results after processing completes */}
          {completedResult && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Processing complete
              </div>

              {completedResult.suggestions.length > 0 && (
                <TemplateMatchCard
                  suggestions={completedResult.suggestions}
                  compact
                  onViewTemplate={(templateId) =>
                    navigate({ to: `/templates/${templateId}` })
                  }
                />
              )}

              <div className="flex justify-center">
                <Button
                  onClick={() =>
                    navigate({
                      to: `/documents/${completedResult.documentId}`,
                    })
                  }
                >
                  View Document
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
