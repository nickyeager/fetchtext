import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DragDropZone } from '@/components/ui/drag-drop-zone';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { UploadSource } from '@/services/unified-document-service';
import { Sparkles, ArrowRight, Settings, FileText, Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

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

interface DocumentUploadPageProps {
  onDocumentProcessed?: (result: any) => void;
}

export function DocumentUploadPage({ onDocumentProcessed }: DocumentUploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<DocumentEvaluation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const documentProcessor = React.useMemo(() => new DocumentProcessorEnhanced(), []);
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });

  // Debug authentication state
  useEffect(() => {
    console.log('Auth state in DocumentUploadPage:', { 
      user_id: user?.id, 
      has_session: !!session,
      user_email: user?.email
    });
  }, [user, session]);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setEvaluation(null);
    setIsEvaluating(true);

    // Verify user is authenticated before proceeding
    if (!user || !session) {
      setError('Authentication required - please sign in to upload documents');
      setIsEvaluating(false);
      return;
    }

    try {
      // Step 1: Create document record immediately
      const documentRecord = await documentManager.createDocument({
        file,
        uploadSource: UploadSource.SMART_UPLOAD,
      });
      setDocumentId(documentRecord.id);

      // Check if storage upload failed but processing can continue
      const metadata = documentRecord.metadata as any;
      if (metadata?.storage_upload_failed) {
        console.warn('File storage failed, but document processing will continue:', metadata.storage_error);
      }

      // Step 2: Update status to analyzing
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: 'analyzing' as any,
      });

      // Step 3: Call the document type evaluation endpoint
      const evaluationResult = await documentProcessor.evaluateDocumentType(file);
      setEvaluation(evaluationResult);

      // Step 4: Update document with AI analysis results
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: 'uploaded' as any, // Ready for user action
        metadata: {
          document_type: evaluationResult.type_evaluation.primary_type,
          type_confidence: evaluationResult.type_evaluation.confidence,
          ai_classification: {
            primary_category: evaluationResult.type_evaluation.primary_type,
            confidence_score: evaluationResult.type_evaluation.confidence,
            detection_method: evaluationResult.type_evaluation.detection_method,
          },
          template_suggestions: evaluationResult.template_suggestions,
        },
      });

      // Redirect to document detail page after evaluation is complete
      navigate({ to: `/documents/${documentRecord.id}` });

    } catch (err) {
      console.error('Document evaluation failed:', err);
      setError(err instanceof Error ? err.message : 'Document evaluation failed');
      
      // Mark document as failed if we created it
      if (documentId) {
        await documentManager.markDocumentFailed(
          documentId, 
          err instanceof Error ? err.message : 'Document evaluation failed'
        );
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [documentProcessor, documentManager, documentId]);

  const handleActionSelect = useCallback(async (action: ProcessingAction) => {
    if (!selectedFile || !evaluation || !documentId) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Update document status to processing
      await documentManager.updateDocumentStatus(documentId, {
        status: 'processing' as any,
        metadata: {
          processing_method: action.type === 'use_template' ? 'template_guided' : 'ai_enhanced',
          template_id: action.template_id,
          template_name: action.template_name,
        },
      });

      let result;

      switch (action.type) {
        case 'use_template':
          // Process with existing template
          result = await documentProcessor.processWithExistingTemplate(
            selectedFile,
            action.template_id!
          );
          break;

        case 'generate_template':
          // Generate new template
          console.log('Generating template for:', evaluation.type_evaluation.primary_type);
          result = await documentProcessor.generateTemplate(
            selectedFile,
            `${evaluation.type_evaluation.primary_type} Template`,
            evaluation.type_evaluation.primary_type
          );
          console.log('Template generation result:', result);
          
          // Save the generated template to the database
          if (result && result.template) {
            try {
              const { supabase } = await import('@/lib/supabase');
              const { data: userResponse } = await supabase.auth.getUser();
              const userId = userResponse.user?.id;
              
              if (userId && result.template.name && result.template.template_content) {
                // Ensure smart_variables/variables are properly handled
                const templateVariables = result.template.smart_variables || result.template.variables || [];
                
                console.log('Saving template with variables:', templateVariables);
                
                const { data: savedTemplate, error } = await supabase
                  .from('templates')
                  .insert([{
                    name: result.template.name || `Generated Template ${Date.now()}`,
                    description: result.template.description || 'AI-generated template',
                    template_content: result.template.template_content,
                    template_type: 'markdown',
                    variables: templateVariables,
                    extraction_rules: result.template.extraction_rules || [],
                    generation_settings: result.template.generation_settings || {},
                    category: result.template.category || 'other',
                    tags: result.template.tags || [],
                    is_public: false,
                    created_by: userId,
                    usage_count: 0,
                    rating: 0
                  }])
                  .select()
                  .single();
                  
                if (error) {
                  console.error('Failed to save generated template:', error);
                } else {
                  console.log('Generated template saved:', savedTemplate);
                  // Update result with the saved template ID
                  result.template.id = savedTemplate.id;
                }
              }
            } catch (err) {
              console.error('Error saving template:', err);
            }
          }
          break;

        case 'manual_selection':
          // Navigate to template selection
          navigate({ to: '/templates' });
          return;
      }

      // Finalize document with processing results
      await documentManager.finalizeDocument(documentId, {
        content_text: result?.content || '',
        extracted_fields: result?.extractedFields || result?.extracted_fields,
        processing_method: action.type === 'use_template' ? 'template_guided' : 'ai_enhanced',
        quality_metrics: result?.quality_metrics,
      });

      // Invalidate queries to refresh the documents list
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });

      // Navigate to results page or call callback
      if (onDocumentProcessed) {
        onDocumentProcessed(result);
      } else {
        // Navigate to the document detail page to show the processed result
        navigate({ to: `/documents/${documentId}` });
      }

    } catch (err) {
      console.error('Document processing failed:', err);
      setError(err instanceof Error ? err.message : 'Document processing failed');
      
      // Mark document as failed
      if (documentId) {
        await documentManager.markDocumentFailed(
          documentId, 
          err instanceof Error ? err.message : 'Document processing failed'
        );
      }
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, evaluation, navigate, onDocumentProcessed, documentId, documentManager]);

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setDocumentId(null);
    setEvaluation(null);
    setError(null);
    setIsEvaluating(false);
    setIsProcessing(false);
  }, []);

  const getWorkflowIcon = (workflow: string) => {
    switch (workflow) {
      case 'existing_template':
        return <FileText className="w-5 h-5" />;
      case 'generate_template':
        return <Sparkles className="w-5 h-5" />;
      case 'template_selection':
        return <Settings className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

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

      {/* Authentication Status */}
      {!user && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to upload documents. Authentication is required for document processing.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
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
            isEvaluating={isEvaluating}
            evaluationResult={evaluation || undefined}
            disabled={isProcessing}
          />
        </CardContent>
      </Card>

      {/* Processing Options */}
      {evaluation && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getWorkflowIcon(evaluation.processing_recommendations.workflow)}
              Processing Options
              <Badge variant="outline" className="ml-auto">
                {evaluation.processing_recommendations.confidence_level} confidence
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary Recommendation */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Recommended Action
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mb-3">
                    {evaluation.processing_recommendations.suggested_action}
                  </p>

                  {/* Template Suggestions */}
                  {evaluation.template_suggestions.length > 0 && (
                    <div className="space-y-2">
                      {evaluation.template_suggestions.slice(0, 1).map((template) => (
                        <div key={template.template_id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                          <div>
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{template.template_name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({template.category} • {template.field_count} fields)
                            </span>
                          </div>
                          <Badge variant="secondary">
                            {Math.round(template.match_score * 100)}% match
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleActionSelect({
                    type: evaluation.template_suggestions.length > 0 ? 'use_template' : 'generate_template',
                    template_id: evaluation.template_suggestions[0]?.template_id,
                    template_name: evaluation.template_suggestions[0]?.template_name
                  })}
                  disabled={isProcessing}
                  className="ml-4"
                >
                  {isProcessing ? (
                    <>
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      {evaluation.template_suggestions.length > 0 ? 'Use Template' : 'Generate Template'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Alternative Actions */}
            {evaluation.processing_recommendations.alternative_actions.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Alternative Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {evaluation.processing_recommendations.alternative_actions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => {
                        if (action.toLowerCase().includes('generate')) {
                          handleActionSelect({ type: 'generate_template' });
                        } else if (action.toLowerCase().includes('template')) {
                          handleActionSelect({ type: 'manual_selection' });
                        }
                      }}
                      disabled={isProcessing}
                      className="justify-start"
                    >
                      {action.toLowerCase().includes('generate') && <Sparkles className="w-4 h-4 mr-2" />}
                      {action.toLowerCase().includes('template') && <Settings className="w-4 h-4 mr-2" />}
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Templates */}
            {evaluation.template_suggestions.length > 1 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Other Suggested Templates</h3>
                <div className="space-y-2">
                  {evaluation.template_suggestions.slice(1).map((template) => (
                    <div key={template.template_id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div>
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{template.template_name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({template.category} • {template.field_count} fields)
                        </span>
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            {Math.round(template.match_score * 100)}% match
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActionSelect({
                          type: 'use_template',
                          template_id: template.template_id,
                          template_name: template.template_name
                        })}
                        disabled={isProcessing}
                      >
                        Use This
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reset Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                onClick={resetUpload}
                disabled={isProcessing}
                className="w-full"
              >
                Upload Different Document
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Status */}
      {isEvaluating && !evaluation && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-3">
              <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">Analyzing Document</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  AI is detecting document type and preparing processing recommendations...
                </p>
                <div className="mt-2 flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>🔍 Document analysis</span>
                  <span>•</span>
                  <span>🤖 AI evaluation</span>
                  <span>•</span>
                  <span>⏱️ Redirecting shortly</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-3">
              <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">Processing Document with AI</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Using advanced AI models for document analysis. This typically takes 60-90 seconds...
                </p>
                <div className="mt-2 flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>⚡ AI-powered extraction</span>
                  <span>•</span>
                  <span>🤖 LLM processing</span>
                  <span>•</span>
                  <span>⏱️ Please wait</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {!selectedFile && !isEvaluating && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Smart Document Processing
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 max-w-2xl mx-auto">
                <p>• <strong>Automatic Detection:</strong> AI identifies document type (invoices, contracts, reports, etc.)</p>
                <p>• <strong>Template Matching:</strong> Suggests the best templates based on document content</p>
                <p>• <strong>Intelligent Processing:</strong> Chooses optimal extraction method for your document</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}