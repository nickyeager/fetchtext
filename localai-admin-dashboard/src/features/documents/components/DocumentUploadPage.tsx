import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/context/auth-context';
import { useOrganization } from '@/context/organization-context';
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
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<DocumentEvaluation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug pre-selected template
  useEffect(() => {
    if (preSelectedTemplate) {
      console.log('🎯 Pre-selected template loaded:', preSelectedTemplate);
    }
  }, [preSelectedTemplate]);
  
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { activeOrganization, isLoading: isLoadingOrg } = useOrganization();
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

  // Define handleActionSelect first since it's used by handleFileSelect
  const handleActionSelect = useCallback(async (action: ProcessingAction) => {
    // For pre-selected templates, we don't need evaluation
    if (!selectedFile || !documentId) return;
    
    // For regular flow, we need evaluation, but not for pre-selected templates
    if (!evaluation && !preSelectedTemplate) return;

    console.log('🎯 handleActionSelect called with:', action);
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
          console.log('🔄 Processing with existing template:', action.template_id);
          // Process with existing template
          result = await documentProcessor.processWithExistingTemplate(
            selectedFile,
            action.template_id!
          );
          break;

        case 'generate_template':
          // Generate new template (only for regular evaluation flow)
          if (!evaluation) {
            throw new Error('Cannot generate template without evaluation data');
          }
          
          console.log('🎨 Generating template for:', evaluation.type_evaluation.primary_type);
          result = await documentProcessor.generateTemplate(
            selectedFile,
            `${evaluation.type_evaluation.primary_type} Template`,
            evaluation.type_evaluation.primary_type
          );
          break;

        case 'manual_selection':
          // Navigate to template selection
          navigate({ to: '/templates' });
          return;
      }

      console.log('✅ Processing completed:', result);

      // Finalize document with processing results
      await documentManager.finalizeDocument(documentId, {
        content_text: result?.content || '',
        extracted_fields: result?.extractedFields || result?.extracted_fields,
        processing_method: action.type === 'use_template' ? 'template_guided' : 'ai_enhanced',
        quality_metrics: result?.quality_metrics,
      });

      // Invalidate queries to refresh the documents list
      await queryClient.invalidateQueries({ queryKey: ['processedDocuments'] });

      console.log('🧭 Navigating to document detail page:', documentId);

      // For pre-selected template flow, always navigate directly to results
      if (preSelectedTemplate) {
        console.log('🎯 Pre-selected template flow: forcing navigation to results page');
        navigate({ to: `/documents/${documentId}` });
        return; // Exit early to prevent further processing
      }

      // Navigate to results page or call callback
      if (onDocumentProcessed) {
        onDocumentProcessed(result);
      } else {
        // Navigate to the document detail page to show the processed result
        navigate({ to: `/documents/${documentId}` });
      }

    } catch (err) {
      console.error('❌ Document processing failed:', err);
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
  }, [selectedFile, evaluation, navigate, onDocumentProcessed, documentId, documentManager, documentProcessor, queryClient, preSelectedTemplate]);

  const handleFileSelect = useCallback(async (file: File) => {
    console.log('📁 handleFileSelect called with:', file.name, 'preSelectedTemplate:', preSelectedTemplate);
    
    setSelectedFile(file);
    setError(null);
    setEvaluation(null);
    setIsEvaluating(true);

    // Verify user is authenticated before proceeding
    if (!user || !session) {
      console.error('❌ Authentication failed');
      setError('Authentication required - please sign in to upload documents');
      setIsEvaluating(false);
      return;
    }

    // Verify organization is selected
    if (!activeOrganization) {
      console.error('❌ No organization selected');
      setError('Please select an organization before uploading documents');
      setIsEvaluating(false);
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
        throw new Error('Document record created without a valid ID — cannot proceed with processing');
      }

      setDocumentId(documentRecord.id);

      // Check if storage upload failed but processing can continue
      const metadata = documentRecord.metadata as any;
      if (metadata?.storage_upload_failed) {
        console.warn('File storage failed, but document processing will continue:', metadata.storage_error);
      }

      // If we have a pre-selected template, skip evaluation and process directly
      if (preSelectedTemplate) {
        console.log('🎯 Using pre-selected template:', preSelectedTemplate);
        setIsEvaluating(false); // Stop evaluating since we're processing directly
        setIsProcessing(true);  // Start processing
        
        try {
          // Step 2: Update status to processing with template info
          await documentManager.updateDocumentStatus(documentRecord.id, {
            status: 'processing' as any,
            metadata: {
              template_id: Number(preSelectedTemplate.id),
              template_type: preSelectedTemplate.type || 'smart',
              template_name: preSelectedTemplate.name,
              processing_method: 'template_pre_selected',
            },
          });

          console.log('🔄 Processing with template ID:', preSelectedTemplate.id);
          
          // Step 3: Process with the selected template
          await handleActionSelect({
            type: 'use_template',
            template_id: Number(preSelectedTemplate.id),
            template_name: preSelectedTemplate.name
          });
          
          console.log('✅ Pre-selected template processing completed successfully');
          return; // Exit early, processing is handled by handleActionSelect
        } catch (error) {
          console.error('❌ Error processing with pre-selected template:', error);
          setError(error instanceof Error ? error.message : 'Processing failed with selected template');
          setIsProcessing(false);
          setIsEvaluating(false);
          
          // Even on error, try to navigate to the document if it was created
          if (documentRecord && documentRecord.id) {
            console.log('🔀 Error occurred but document exists, navigating to document page for troubleshooting');
            setTimeout(() => {
              navigate({ to: `/documents/${documentRecord.id}` });
            }, 2000); // Give user time to see the error message
          }
          return;
        }
      }

      // Step 2: Update status to analyzing
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: 'analyzing' as any,
      });

      // Step 3: Call the /decide-template endpoint with 2-way validation
      // Pass user ID to include their private saved templates in matching
      console.log('🎯 Using intelligent template decision with 2-way validation...');
      const decisionResult = await documentProcessor.decideTemplate(file, {
        minMatchConfidence: 0.6,
        allowGeneration: true,
        autoSave: false,
        userId: user?.id // Include user's private templates in matching
      });

      setEvaluation(decisionResult.evaluation);

      // Step 4: Extract document content using Docling
      console.log('📄 Extracting document content...');
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: 'processing' as any,
      });

      const processedContent = await documentProcessor.processDocumentWithDocling(file);
      console.log('✅ Content extracted:', processedContent.content?.substring(0, 100) + '...');

      // Step 5: Auto-apply best matching template (user can change later)
      // Changed: Always auto-apply if a template was found, regardless of confidence level
      let extractedData = null;
      let finalStatus: any = 'uploaded'; // Default: Ready for user action
      const MIN_AUTO_APPLY_SCORE = 0.6; // Require 60% match for auto-apply

      if (
        decisionResult.action === 'use_existing' &&
        decisionResult.chosen_template &&
        (decisionResult.decision_metadata.match_score || 0) >= MIN_AUTO_APPLY_SCORE
      ) {
        // Auto-extract fields with the best matching template
        // User can change template later if extraction isn't satisfactory
        console.log('✨ Auto-applying best matching template...', {
          template: decisionResult.chosen_template.template_name,
          match_score: decisionResult.decision_metadata.match_score,
          extraction_quality: decisionResult.decision_metadata.extraction_quality,
          combined_score: decisionResult.decision_metadata.combined_score,
          confidence_level: decisionResult.decision_metadata.validation_level
        });

        try {
          const extractionResult = await documentProcessor.processWithExistingTemplate(
            file,
            decisionResult.chosen_template.template_id
          );

          // Get extracted fields (backend returns extractedFields, not extracted_data)
          const rawExtractedFields = extractionResult.extractedFields || extractionResult.extracted_data;
          const fieldsExtractedCount = Object.keys(rawExtractedFields || {}).length;

          // FALLBACK: If existing template extracted 0 fields, generate a new template
          if (fieldsExtractedCount === 0) {
            console.log('⚠️ Existing template extracted 0 fields, falling back to template generation...');

            // Trigger template generation via backend
            const primaryType = decisionResult.evaluation?.type_evaluation?.primary_type || 'document';
            const generationResult = await documentProcessor.generateTemplate(
              file,
              `${primaryType.charAt(0).toUpperCase() + primaryType.slice(1)} Template`,
              primaryType
            );

            if (generationResult?.template || generationResult?.generated_template) {
              const generatedTemplate = generationResult.template || generationResult.generated_template;
              const templateVariables = generatedTemplate.smart_variables || generatedTemplate.variables || [];

              if (templateVariables.length > 0) {
                console.log('📝 Saving fallback-generated template...', {
                  name: generatedTemplate.name,
                  variables_count: templateVariables.length
                });

                // Save the generated template
                const savedTemplate = await withAuthentication(async (user) => {
                  const { data, error } = await supabase
                    .from('smart_templates')
                    .insert({
                      name: generatedTemplate.name || `${primaryType.charAt(0).toUpperCase() + primaryType.slice(1)} Template`,
                      description: generatedTemplate.description || `Auto-generated template for ${primaryType} documents`,
                      category: generatedTemplate.category || primaryType,
                      smart_variables: templateVariables,
                      extraction_rules: generatedTemplate.extraction_rules || [],
                      is_public: false,
                      created_by: user.id,
                      template_type: 'smart',
                      tags: ['ai-generated', 'fallback', primaryType]
                    })
                    .select()
                    .single();

                  if (error) throw error;
                  return data;
                }, 'Save Fallback Generated Template');

                console.log('✅ Fallback template saved, extracting fields...');

                // Extract with the new template
                const fallbackExtraction = await documentProcessor.processWithExistingTemplate(
                  file,
                  savedTemplate.id
                );

                const fallbackFields = fallbackExtraction.extractedFields || fallbackExtraction.extracted_data;

                extractedData = {
                  extracted_values: fallbackFields,
                  confidence_scores: Object.entries(fallbackFields || {}).reduce((acc, [key, field]: [string, any]) => {
                    acc[key] = field.confidence || 0;
                    return acc;
                  }, {} as Record<string, number>)
                };

                // Update the chosen template to the generated one
                decisionResult.chosen_template = {
                  template_id: savedTemplate.id,
                  template_name: savedTemplate.name,
                  match_score: 1.0, // Perfect match since we generated it
                  extraction_quality: Object.keys(fallbackFields || {}).length > 0 ? 0.8 : 0
                };

                console.log('✅ Fallback extraction completed:', {
                  fields_extracted: Object.keys(fallbackFields || {}).length,
                  template_id: savedTemplate.id,
                  template_name: savedTemplate.name
                });
              }
            }
          } else {
            // Transform to the format DocumentDetailView expects
            extractedData = {
              extracted_values: rawExtractedFields,
              confidence_scores: Object.entries(rawExtractedFields || {}).reduce((acc, [key, field]: [string, any]) => {
                acc[key] = field.confidence || 0;
                return acc;
              }, {} as Record<string, number>)
            };

            console.log('✅ Auto-extraction completed:', {
              fields_extracted: fieldsExtractedCount,
              template_used: decisionResult.chosen_template.template_name,
              extracted_data_format: extractedData
            });
          }

          finalStatus = 'completed'; // Fully processed
        } catch (extractError) {
          console.error('⚠️ Auto-extraction failed, continuing without extraction:', extractError);
          // Still save document - user can retry or change template
          finalStatus = 'completed'; // Mark as completed so user sees the document
        }
      } else if (decisionResult.action === 'generate_new' && decisionResult.generated_template) {
        // Auto-generate new template and extract fields
        const generatedTemplate = decisionResult.generated_template;
        console.log('✨ No suitable template found - generating new template with AI...', {
          template_name: generatedTemplate.name,
          variables_count: (generatedTemplate.smart_variables || generatedTemplate.variables)?.length || 0
        });

        try {
          // Map 'variables' to 'smart_variables' if needed (backend field name compatibility)
          const templateVariables = generatedTemplate.smart_variables || generatedTemplate.variables || [];

          if (!Array.isArray(templateVariables) || templateVariables.length === 0) {
            throw new Error('Generated template has no variables defined');
          }

          console.log('📝 Saving generated template to database...', {
            name: generatedTemplate.name,
            category: generatedTemplate.category,
            variable_names: templateVariables.map((v: any) => v.name).join(', ')
          });

          // Save template to database with authentication
          const savedTemplate = await withAuthentication(async (user) => {
            const { data, error } = await supabase
              .from('smart_templates')
              .insert({
                name: generatedTemplate.name,
                description: generatedTemplate.description || `Auto-generated template for ${decisionResult.evaluation.type_evaluation.primary_type} documents`,
                category: generatedTemplate.category || 'general',
                smart_variables: templateVariables,
                extraction_rules: generatedTemplate.extraction_rules || [],
                is_public: false, // Private by default
                created_by: user.id,
                template_type: 'smart',
                tags: generatedTemplate.tags || []
              })
              .select()
              .single();

            if (error) throw error;
            return data;
          }, 'Save Generated Template');

          console.log('✅ Template saved successfully:', {
            template_id: savedTemplate.id,
            name: savedTemplate.name
          });

          // Extract fields using the newly saved template
          console.log('🔍 Extracting fields with generated template...');
          const extractionResult = await documentProcessor.processWithExistingTemplate(
            file,
            savedTemplate.id
          );

          // Get extracted fields (backend returns extractedFields, not extracted_data)
          const rawExtractedFields = extractionResult.extractedFields || extractionResult.extracted_data;

          // Transform to the format DocumentDetailView expects
          extractedData = {
            extracted_values: rawExtractedFields,
            confidence_scores: Object.entries(rawExtractedFields || {}).reduce((acc, [key, field]: [string, any]) => {
              acc[key] = field.confidence || 0;
              return acc;
            }, {} as Record<string, number>)
          };

          finalStatus = 'completed'; // Fully processed

          console.log('✅ Auto-extraction with generated template completed:', {
            fields_extracted: Object.keys(rawExtractedFields || {}).length,
            template_id: savedTemplate.id,
            template_name: savedTemplate.name,
            extracted_data_format: extractedData
          });
        } catch (generationError) {
          console.error('⚠️ Failed to save/apply generated template:', generationError);
          console.error('   Error details:', {
            message: generationError instanceof Error ? generationError.message : String(generationError),
            template_data: generatedTemplate
          });
          // Still save document but without extracted fields
          // User can manually select template or retry later
        }
      } else {
        console.log('📋 No suitable template found or match too low - document saved without extraction', {
          action: decisionResult.action,
          match_score: decisionResult.decision_metadata?.match_score,
          threshold: MIN_AUTO_APPLY_SCORE
        });
        finalStatus = 'completed'; // Still mark as completed
      }

      // Determine if a template was applied
      const appliedTemplate = extractedData ? decisionResult.chosen_template : null;

      // Step 6: Update document with content, decision results, and optional extracted fields
      await documentManager.finalizeDocument(documentRecord.id, {
        status: finalStatus,
        content_text: processedContent.content,
        extracted_fields: extractedData,
        metadata: {
          document_type: decisionResult.evaluation.type_evaluation.primary_type,
          type_confidence: decisionResult.evaluation.type_evaluation.confidence,
          ai_classification: {
            primary_category: decisionResult.evaluation.type_evaluation.primary_type,
            confidence_score: decisionResult.evaluation.type_evaluation.confidence,
            detection_method: decisionResult.evaluation.type_evaluation.detection_method,
          },
          // Store applied template info for easy access
          template_id: appliedTemplate?.template_id,
          template_name: appliedTemplate?.template_name,
          template_decision: {
            action: decisionResult.action,
            validation_level: decisionResult.decision_metadata.validation_level,
            match_score: decisionResult.decision_metadata.match_score,
            extraction_quality: decisionResult.decision_metadata.extraction_quality,
            combined_score: decisionResult.decision_metadata.combined_score,
            extraction_tested: decisionResult.decision_metadata.extraction_tested,
            auto_applied: !!extractedData,
            chosen_template: decisionResult.chosen_template
          },
          template_suggestions: decisionResult.alternatives || [],
          // CRITICAL: Store extracted_data for DocumentDetailView compatibility
          extracted_data: extractedData,
          title: processedContent.metadata?.title,
          author: processedContent.metadata?.author,
          page_count: processedContent.metadata?.page_count,
        },
      });

      // Redirect to document detail page
      navigate({ to: `/documents/${documentRecord.id}` });

    } catch (err) {
      console.error('❌ Document evaluation failed:', err);
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
      setIsProcessing(false);
    }
  }, [documentProcessor, documentManager, documentId, preSelectedTemplate, handleActionSelect, user, session, navigate, activeOrganization]);

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
                // Clear the search params by navigating to upload without params
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
            disabled={isProcessing || !user || isLoadingOrg || !activeOrganization}
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
                {preSelectedTemplate ? (
                  <>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">Processing with {preSelectedTemplate.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Extracting data using the pre-selected template. This should be faster since we're skipping document type analysis...
                    </p>
                    <div className="mt-2 flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>⚡ Template processing</span>
                      <span>•</span>
                      <span>🎯 {preSelectedTemplate.name}</span>
                      <span>•</span>
                      <span>⏱️ Redirecting to results</span>
                    </div>
                    {/* Manual navigation button as backup */}
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (documentId) {
                            console.log('🖱️ Manual navigation clicked for document:', documentId);
                            navigate({ to: `/documents/${documentId}` });
                          }
                        }}
                        disabled={!documentId}
                      >
                        {documentId ? 'View Document Results' : 'Processing...'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {!selectedFile && !isEvaluating && (
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
                    <p>• <strong>Template Selected:</strong> {preSelectedTemplate.name || `Template ${preSelectedTemplate.id}`}</p>
                    <p>• <strong>Direct Processing:</strong> Your document will be processed immediately using this template</p>
                    <p>• <strong>Fast Results:</strong> No evaluation needed - we'll extract data based on the template fields</p>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Smart Document Processing
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 max-w-2xl mx-auto">
                    <p>• <strong>Automatic Detection:</strong> AI identifies document type (invoices, contracts, reports, etc.)</p>
                    <p>• <strong>Template Matching:</strong> Suggests the best templates based on document content</p>
                    <p>• <strong>Intelligent Processing:</strong> Chooses optimal extraction method for your document</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}