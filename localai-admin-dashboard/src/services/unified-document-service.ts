/**
 * Unified Document Service
 * Centralized service for document lifecycle management across all upload paths
 */

import { supabase } from '@/lib/supabase';
import { requireAuthentication } from '@/lib/supabase-auth-utils';
import { templateService } from './template-service';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  ANALYZING = 'analyzing', 
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum UploadSource {
  SMART_UPLOAD = 'smart_upload',
  TEMPLATE_PROCESSING = 'template_processing',
  DIRECT_UPLOAD = 'direct_upload'
}

export interface DocumentRecord {
  id: string;
  uuid: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  content_text?: string;
  metadata: DocumentMetadata;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  // Additional optional fields present in DB or used in code paths
  processing_status?: string;
  status?: string;
  extracted_fields?: Record<string, any>;
}

export interface DocumentMetadata {
  // Core metadata
  upload_source: UploadSource;
  processing_status: DocumentStatus;
  original_filename: string;
  
  // Processing information
  template_id?: number;
  template_name?: string;
  // Allow broader set of processing methods used across the app
  processing_method?: string;
  
  // AI Analysis results (from smart upload)
  document_type?: string;
  type_confidence?: number;
  ai_classification?: {
    primary_category: string;
    confidence_score: number;
    detection_method: string;
  };
  
  // Template suggestions (from smart upload)
  template_suggestions?: Array<{
    template_id: number;
    template_name: string;
    match_score: number;
    category: string;
    field_count: number;
  }>;
  
  // Processing results
  extracted_fields?: Record<string, {
    value: any;
    confidence: number;
    sourceText?: string;
    location?: {
      page?: number;
      position?: number;
    };
  }>;
  
  // Quality metrics
  extraction_quality?: number;
  confidence_distribution?: {
    high: number;
    medium: number;
    low: number;
  };
  
  // Processing timeline
  uploaded_at: string;
  analysis_started_at?: string;
  analysis_completed_at?: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  
  // Error tracking
  error_message?: string;
  error_details?: any;
  
  // Additional context
  processing_settings?: any;
  user_notes?: string;
  // Permit additional dynamic metadata keys to avoid strict typing issues
  [key: string]: unknown;
}

export interface CreateDocumentOptions {
  file: File;
  uploadSource: UploadSource;
  organizationId: string;
  templateId?: number;
  templateName?: string;
  processingMethod?: 'template_guided' | 'generic' | 'progressive' | 'ai_enhanced';
}

export interface UpdateDocumentStatusOptions {
  status: DocumentStatus;
  metadata?: Partial<DocumentMetadata>;
  content_text?: string;
  error_message?: string;
}

export class UnifiedDocumentService {
  /**
   * Trigger AI analysis for a document
   * This method is called automatically when status changes to 'analyzing'
   */
  private static async triggerAIAnalysis(documentId: string): Promise<void> {
    try {
      console.log('🤖 Triggering AI analysis for document:', documentId);
      
      // Get the document record
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found for AI analysis');
      }

      // If document has a VALID template already selected (not 0), skip AI analysis and go directly to template extraction
      const hasValidTemplateForAnalysisSkip = document.metadata?.template_id && document.metadata.template_id !== 0;
      if (hasValidTemplateForAnalysisSkip) {
        console.log('🎯 Document has pre-selected template, skipping AI analysis and going directly to template extraction');
        await this.updateDocumentStatus(documentId, {
          status: DocumentStatus.PROCESSING,
          metadata: {
            analysis_skipped: true,
            analysis_skip_reason: 'template_pre_selected',
            template_id: document.metadata.template_id,
            processing_method: 'template_guided',
            analysis_completed_at: new Date().toISOString(),
          },
        });
        
        // Trigger template extraction directly
        setTimeout(() => this.triggerTemplateExtraction(documentId), 100);
        return;
      }

      // Get the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (downloadError || !fileData) {
        console.error('Failed to download file for analysis:', downloadError);
        
        // If storage fails but we have VALID template metadata (not 0), try template extraction with original file
        const hasValidTemplateForStorageFallback = document.metadata?.template_id && document.metadata.template_id !== 0;
        if (hasValidTemplateForStorageFallback) {
          console.log('🔄 Storage failed but template selected, attempting template extraction with fallback');
          await this.updateDocumentStatus(documentId, {
            status: DocumentStatus.PROCESSING,
            metadata: {
              storage_download_failed: true,
              storage_error: downloadError?.message || 'Storage unavailable',
              fallback_template_processing: true,
              template_id: document.metadata.template_id,
              analysis_completed_at: new Date().toISOString(),
            },
          });
          
          // Trigger template extraction with fallback
          setTimeout(() => this.triggerTemplateExtractionWithFallback(documentId), 100);
          return;
        }
        
        // If no template and storage fails, mark as failed
        await this.markDocumentFailed(documentId, 'Failed to download file for analysis and no template selected');
        return;
      }

      // Create File object for document processor
      const file = new File([fileData], document.name, { 
        type: document.file_type 
      });

      // Initialize document processor
      const documentProcessor = new DocumentProcessorEnhanced();

      // Perform AI document type evaluation
      const evaluation = await documentProcessor.evaluateDocumentType(file, {
        quickScan: false,
        includeConfidenceScores: true,
        suggestTemplates: true
      });

      console.log('✅ AI analysis completed for document:', documentId);
      console.log('Evaluation result:', evaluation);

      // Update document with evaluation results and trigger extraction if template is available
      const metadata = {
        document_type: evaluation.type_evaluation.primary_type,
        type_confidence: evaluation.type_evaluation.confidence,
        ai_classification: {
          primary_category: evaluation.type_evaluation.primary_type,
          confidence_score: evaluation.type_evaluation.confidence,
          detection_method: evaluation.type_evaluation.detection_method,
        },
        template_suggestions: evaluation.template_suggestions,
        processing_recommendations: evaluation.processing_recommendations,
        analysis_completed_at: new Date().toISOString(),
      };

      await this.updateDocumentStatus(documentId, {
        status: DocumentStatus.PROCESSING,
        metadata,
      });

      console.log('✅ Document updated with AI analysis results');

      // If document has VALID template metadata (not 0), trigger template extraction automatically
      const hasValidTemplatePostAnalysis = document.metadata?.template_id && document.metadata.template_id !== 0;
      if (hasValidTemplatePostAnalysis) {
        console.log('🎯 Document has pre-selected template, triggering template extraction...');
        setTimeout(() => this.triggerTemplateExtraction(documentId), 100);
      }
      // If we have template suggestions, automatically select and apply the best one (if confidence is high enough)
      else if (evaluation.template_suggestions && evaluation.template_suggestions.length > 0) {
        const bestTemplate = evaluation.template_suggestions
          .sort((a, b) => b.match_score - a.match_score)[0];

        const MIN_AUTO_SELECT_CONFIDENCE = 0.70; // Require 70% match score for auto-selection

        console.log('🤖 Evaluating template auto-selection...', {
          templateId: bestTemplate.template_id,
          templateName: bestTemplate.template_name,
          matchScore: bestTemplate.match_score,
          threshold: MIN_AUTO_SELECT_CONFIDENCE
        });

        // Only auto-select if confidence is above threshold
        if (bestTemplate.match_score >= MIN_AUTO_SELECT_CONFIDENCE) {
          console.log('🎯 Auto-selecting template (confidence above threshold)');
          // Apply the best template and trigger extraction
          setTimeout(() => this.applyTemplateToDocument(documentId, bestTemplate.template_id, bestTemplate.template_name), 100);
        } else {
          console.log('⚠️ Template match score too low for auto-selection:', {
            matchScore: bestTemplate.match_score,
            required: MIN_AUTO_SELECT_CONFIDENCE,
            templateName: bestTemplate.template_name
          });
          console.log('💡 User will need to manually select a template or create a new one');
          // Do generic text extraction instead
          setTimeout(() => this.triggerGenericTextExtraction(documentId), 100);
        }
      }
      // If no template suggestions, do generic text extraction
      else {
        console.log('⚠️ No template suggestions available, performing generic text extraction...');
        setTimeout(() => this.triggerGenericTextExtraction(documentId), 100);
      }

    } catch (error) {
      console.error('❌ AI analysis failed for document:', documentId, error);
      
      // Check if it's a timeout or network error - provide fallback processing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isNetworkError = errorMessage.includes('timeout') || 
                            errorMessage.includes('network') || 
                            errorMessage.includes('AbortError') ||
                            errorMessage.includes('Failed to fetch') ||
                            errorMessage.includes('Document evaluation failed');
      
      if (isNetworkError) {
        console.log('🔄 Network error detected, attempting fallback analysis...');
        try {
          // Fallback: create basic analysis without backend
          const document = await this.getDocumentById(documentId);
          if (document) {
            const fallbackEvaluation = {
              type_evaluation: {
                primary_type: this.guessDocumentType(document.name),
                confidence: 0.6,
                detection_method: 'filename_analysis_fallback'
              },
              template_suggestions: [],
              processing_recommendations: {
                workflow: 'manual_processing',
                suggested_action: 'Manual review recommended - backend unavailable',
                alternative_actions: ['Browse templates', 'Upload different document'],
                confidence_level: 'medium'
              }
            };
            
            // Update with fallback analysis
            await this.updateDocumentStatus(documentId, {
              status: DocumentStatus.PROCESSING,
              metadata: {
                document_type: fallbackEvaluation.type_evaluation.primary_type,
                type_confidence: fallbackEvaluation.type_evaluation.confidence,
                ai_classification: {
                  primary_category: fallbackEvaluation.type_evaluation.primary_type,
                  confidence_score: fallbackEvaluation.type_evaluation.confidence,
                  detection_method: fallbackEvaluation.type_evaluation.detection_method,
                },
                template_suggestions: fallbackEvaluation.template_suggestions,
                processing_recommendations: fallbackEvaluation.processing_recommendations,
                analysis_completed_at: new Date().toISOString(),
                fallback_analysis: true,
                backend_unavailable: true
              },
            });
            
            console.log('✅ Fallback analysis completed for document:', documentId);
            return;
          }
        } catch (fallbackError) {
          console.error('❌ Fallback analysis also failed:', fallbackError);
        }
      }
      
      // Mark document as failed if analysis fails
      await this.markDocumentFailed(
        documentId, 
        `AI analysis failed: ${errorMessage}`
      );
    }
  }

  /**
   * Guess document type from filename
   */
  private static guessDocumentType(filename: string): string {
    const name = filename.toLowerCase();
    
    if (name.includes('invoice') || name.includes('bill')) {
      return 'invoice';
    } else if (name.includes('receipt')) {
      return 'receipt';  
    } else if (name.includes('contract') || name.includes('agreement')) {
      return 'contract';
    } else if (name.includes('report')) {
      return 'report';
    } else if (name.includes('statement')) {
      return 'statement';
    } else {
      return 'document';
    }
  }

  /**
   * Trigger template extraction with fallback when storage is unavailable
   */
  private static async triggerTemplateExtractionWithFallback(documentId: string): Promise<void> {
    try {
      console.log('🎯 Triggering fallback template extraction for document:', documentId);
      
      // Get the document with template metadata
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found for fallback template extraction');
      }

      const templateId = document.metadata?.template_id;
      if (templateId === undefined || templateId === null) {
        console.log('❌ No template ID found in document metadata');
        return;
      }

      // Get the template
      const template = await templateService.getTemplate(Number(templateId));
      
      if (!template) {
        console.error('Template not found:', templateId);
        await this.markDocumentFailed(documentId, `Template not found: ${templateId}`);
        return;
      }

      console.log('⚠️ Storage unavailable, completing with template metadata only');
      
      // Create a minimal extraction result since we can't process the actual file
      const fallbackResult = {
        content: `Document uploaded for template "${template.name}" (ID: ${template.id}). File processing skipped due to storage unavailability.`,
        extractedFields: template.smart_variables?.reduce((acc, variable) => {
          acc[variable.name] = {
            value: '',
            confidence: 0,
            note: 'Extraction skipped - storage unavailable'
          };
          return acc;
        }, {} as Record<string, any>) || {},
        template_used: template.name,
        processing_method: 'fallback_template_assignment'
      };

      // Finalize document with fallback results
      await this.finalizeDocument(documentId, {
        content_text: fallbackResult.content,
        extracted_fields: fallbackResult.extractedFields,
        processing_method: 'template_fallback',
        metadata: {
          template_extraction_completed_at: new Date().toISOString(),
          template_used: template.name,
          field_count: Object.keys(fallbackResult.extractedFields).length,
          storage_unavailable: true,
          fallback_processing: true,
          template_assigned: true
        }
      });

      console.log('✅ Fallback template extraction completed for document:', documentId);

    } catch (error) {
      console.error('❌ Fallback template extraction failed for document:', documentId, error);
      await this.markDocumentFailed(
        documentId, 
        `Fallback template extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if document is stuck in processing
   */
  static isDocumentStuckInProcessing(document: DocumentRecord): boolean {
    const status = document.processing_status || document.status;
    if (status !== 'processing') return false;

    const processingStartedAt = document.metadata?.processing_started_at;
    if (!processingStartedAt) return false;

    const elapsed = Date.now() - new Date(processingStartedAt).getTime();
    // Consider stuck if processing for more than 2 minutes
    return elapsed > 2 * 60 * 1000;
  }

  /**
   * Trigger generic text extraction for documents without template suggestions
   */
  private static async triggerGenericTextExtraction(documentId: string): Promise<void> {
    try {
      console.log('📄 Triggering generic text extraction for document:', documentId);
      
      // Get the document
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found for generic text extraction');
      }

      // Get the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (downloadError || !fileData) {
        console.error('Failed to download file for generic extraction:', downloadError);
        await this.markDocumentFailed(documentId, 'Failed to download file for generic text extraction');
        return;
      }

      // Create File object for document processor
      const file = new File([fileData], document.name, { 
        type: document.file_type 
      });

      // Initialize document processor and perform basic text extraction
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const documentProcessor = new DocumentProcessorEnhanced();

      console.log('🔄 Starting generic text extraction...');
      
      // Use processDocumentWithDocling for basic text extraction
      const extractionResult = await documentProcessor.processDocumentWithDocling(file);

      console.log('✅ Generic text extraction completed for document:', documentId);

      // Finalize document with extraction results
      await this.finalizeDocument(documentId, {
        content_text: extractionResult.content || extractionResult.text || 'No text content extracted',
        extracted_fields: {}, // No field extraction for generic processing
        processing_method: 'generic_text_extraction',
        metadata: {
          generic_extraction_completed_at: new Date().toISOString(),
          extraction_method: 'docling_generic',
          content_length: (extractionResult.content || extractionResult.text || '').length
        }
      });

    } catch (error) {
      console.error('❌ Generic text extraction failed for document:', documentId, error);
      await this.markDocumentFailed(
        documentId, 
        `Generic text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Trigger template extraction for a document with template metadata
   */
  private static async triggerTemplateExtraction(documentId: string): Promise<void> {
    try {
      console.log('🎯 Triggering template extraction for document:', documentId);
      
      // Get the document with template metadata
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found for template extraction');
      }

      const templateId = document.metadata?.template_id;
      // template_id of 0, undefined, or null means no template - do generic extraction instead
      if (templateId === undefined || templateId === null || templateId === 0) {
        console.log('⚠️ No valid template ID found (got: ' + templateId + '), falling back to generic extraction');
        await this.triggerGenericTextExtraction(documentId);
        return;
      }

      // Get the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (downloadError || !fileData) {
        console.error('Failed to download file for template extraction:', downloadError);
        await this.markDocumentFailed(documentId, 'Failed to download file for template extraction');
        return;
      }

      // Create File object for document processor
      const file = new File([fileData], document.name, { 
        type: document.file_type 
      });

      // Get the template
      const template = await templateService.getTemplate(Number(templateId));

      if (!template) {
        console.error('Template not found:', templateId);
        await this.markDocumentFailed(documentId, `Template not found: ${templateId}`);
        return;
      }

      // VALIDATION: Verify template has smart_variables
      console.log('🔍 Validating template data...', {
        templateId: template.id,
        templateName: template.name,
        hasSmartVariables: !!template.smart_variables,
        smartVariablesLength: template.smart_variables?.length ?? 0,
        smartVariablesType: typeof template.smart_variables
      });

      if (!template.smart_variables || !Array.isArray(template.smart_variables) || template.smart_variables.length === 0) {
        console.error('❌ Template missing smart_variables:', {
          templateId: template.id,
          templateName: template.name,
          smart_variables: template.smart_variables
        });
        await this.markDocumentFailed(documentId, `Template ${template.name} (ID: ${template.id}) is missing smart_variables definition`);
        return;
      }

      console.log('✅ Template validation passed:', {
        variableCount: template.smart_variables.length,
        variables: template.smart_variables.map((v: any) => v.name || v.id).join(', ')
      });

      // Initialize document processor and perform extraction
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const documentProcessor = new DocumentProcessorEnhanced();

      console.log('🔄 Starting template extraction...');
      
      // Set processing timeout (5 minutes for template extraction)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Template extraction timeout')), 5 * 60 * 1000);
      });

      const extractionPromise = documentProcessor.processDocumentWithTemplate(file, template as any);
      
      const extractionResult = await Promise.race([extractionPromise, timeoutPromise]) as {
        content: string;
        extractedFields?: Record<string, unknown>;
        qualityScore?: number;
      };

      console.log('✅ Template extraction completed for document:', documentId);

      // Finalize document with extraction results
      await this.finalizeDocument(documentId, {
  content_text: extractionResult?.content,
  extracted_fields: extractionResult?.extractedFields as Record<string, any>,
        processing_method: 'smart_template',
        quality_metrics: {
          extraction_quality: extractionResult?.qualityScore || 0.8,
          confidence_distribution: {
            high: 0.7,
            medium: 0.2,
            low: 0.1
          }
        },
        metadata: {
          template_extraction_completed_at: new Date().toISOString(),
          template_used: template.name,
      field_count: Object.keys(extractionResult?.extractedFields || {}).length
        }
      });

    } catch (error) {
      console.error('❌ Template extraction failed for document:', documentId, error);
      
      // Check if it's a timeout error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeoutError = errorMessage.includes('timeout') || 
                            errorMessage.includes('AbortError') ||
                            errorMessage.includes('Failed to fetch');
      
      if (isTimeoutError) {
        console.log('⏰ Template extraction timeout, attempting fallback...');
        try {
          // Fallback: mark as completed with partial results
          await this.finalizeDocument(documentId, {
            content_text: `Template extraction timed out for document: ${documentId}`,
            processing_method: 'template_extraction_timeout',
            metadata: {
              extraction_timeout: true,
              timeout_reason: errorMessage,
              fallback_processing: true,
              template_extraction_failed_at: new Date().toISOString()
            }
          });
          return;
        } catch (fallbackError) {
          console.error('❌ Fallback processing also failed:', fallbackError);
        }
      }
      
      // Mark document as failed if extraction fails
      await this.markDocumentFailed(
        documentId, 
        `Template extraction failed: ${errorMessage}`
      );
    }
  }

  /**
   * Force retry analysis for a stuck document
   */
  static async forceRetryAnalysis(documentId: string): Promise<void> {
    console.log('🔄 Force retrying analysis for document:', documentId);
    
    try {
      // Reset status to analyzing to trigger fresh analysis
      await this.updateDocumentStatus(documentId, {
        status: DocumentStatus.ANALYZING,
        metadata: {
          retry_attempt: true,
          retry_timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('❌ Failed to force retry analysis:', error);
      throw error;
    }
  }

  /**
   * Force complete a stuck document
   * Use this when a document is stuck in processing status
   */
  static async forceCompleteDocument(documentId: string): Promise<DocumentRecord> {
    console.log('⚡ Force completing stuck document:', documentId);
    
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if document is actually stuck in processing
      const status = document.processing_status || document.status;
      if (status !== 'processing') {
        console.log('Document is not in processing status, current status:', status);
        return document;
      }

      // Check how long it's been processing
      const processingStartedAt = document.metadata?.processing_started_at;
      if (processingStartedAt) {
        const elapsed = Date.now() - new Date(processingStartedAt).getTime();
        console.log('Document has been processing for:', Math.round(elapsed / 1000), 'seconds');
      }

      // Force complete with whatever data we have
      return await this.finalizeDocument(documentId, {
        content_text: document.content_text || 'Document processing was incomplete',
        extracted_fields: document.metadata?.extracted_fields || {},
        processing_method: 'force_completed',
        metadata: {
          force_completed: true,
          force_completed_at: new Date().toISOString(),
          incomplete_reason: 'Document was stuck in processing status',
          original_processing_method: document.metadata?.processing_method,
        }
      });
    } catch (error) {
      console.error('❌ Failed to force complete document:', error);
      throw error;
    }
  }

  /**
   * Auto-complete a document if it appears to be processed but stuck in processing status
   * This handles cases where the backend completed processing but didn't update the status
   */
  static async autoCompleteIfProcessed(documentId: string): Promise<boolean> {
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) return false;
      
      const status = document.processing_status || document.status;
      if (status !== 'processing') return false; // Only auto-complete stuck processing documents
      
      // Check if document has processing results that indicate completion
      const hasContent = !!document.content_text;
      const hasExtractedFields = !!(document.extracted_fields || document.metadata?.extracted_fields);
      const hasTemplateExtracted = !!(document.metadata?.template_extraction_completed_at);
  const hasProcessingCompleted = !!(document.metadata?.processing_completed_at);
      const hasProcessingStarted = !!(document.metadata?.processing_started_at);
      
      // Check processing time
      const processingTime = hasProcessingStarted && document.metadata?.processing_started_at ? 
        (Date.now() - new Date(document.metadata.processing_started_at).getTime()) : 0;
      
      // Check if document appears to be actually completed (must have meaningful content)
      const hasMeaningfulContent = hasContent && document.content_text && document.content_text.length > 50;
      const isActuallyCompleted = hasMeaningfulContent || hasExtractedFields || hasTemplateExtracted || hasProcessingCompleted;
      
      if (isActuallyCompleted) {
        console.log('🔄 Auto-completing document that appears to be processed but stuck:', documentId);
        
        await this.finalizeDocument(documentId, {
          content_text: document.content_text || 'Document processing completed',
          extracted_fields: document.extracted_fields || document.metadata?.extracted_fields || {},
          processing_method: document.metadata?.processing_method || 'auto_completed',
          metadata: {
            auto_completed: true,
            auto_completed_at: new Date().toISOString(),
            auto_completion_reason: 'Document had processing results but was stuck in processing status',
            original_processing_method: document.metadata?.processing_method,
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to auto-complete document:', error);
      return false;
    }
  }

  /**
   * Create initial document record immediately upon file selection
   * This ensures every uploaded document gets tracked from the start
   */
  static async createDocumentRecord(options: CreateDocumentOptions): Promise<DocumentRecord> {
    try {
      // Get current authenticated user
      const user = await requireAuthentication();
      console.log('✅ createDocumentRecord - Authenticated user:', user.id);

      // Generate file path for storage
      const fileExtension = options.file.name.split('.').pop() || '';
      // Sanitize filename to remove special characters and spaces
      const sanitizedFileName = options.file.name
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace non-alphanumeric chars (except dot and dash) with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
      const fileName = `${user.id}/${Date.now()}_${sanitizedFileName}`;
      
      // Initialize metadata
      const metadata: DocumentMetadata = {
        upload_source: options.uploadSource,
        processing_status: DocumentStatus.UPLOADED,
        original_filename: options.file.name,
        template_id: options.templateId,
        template_name: options.templateName,
        processing_method: options.processingMethod,
        uploaded_at: new Date().toISOString(),
      };

      // Create document record
      const documentData = {
        name: options.file.name,
        file_path: fileName,
        file_type: options.file.type || `application/${fileExtension}`,
        file_size: options.file.size,
        processing_status: 'uploaded', // Set initial status
        metadata,
        uploaded_by: user.id,
        organization_id: options.organizationId,
      };

      console.log('Creating document record:', documentData);
      
      const { data: rawData, error } = await supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single();

      if (error) {
        console.error('Document insert error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));

        if (error.code === 'PGRST116' || error.message?.includes('row-level security')) {
          throw new Error('Permission denied - please ensure you are signed in and have permission to upload documents');
        }

        // Better error handling for undefined error messages
        const errorMessage = error.message || error.details || error.hint || `Database error (code: ${error.code || 'unknown'})`;
        throw new Error(`Failed to create document record: ${errorMessage}`);
      }

      // Normalize: production Supabase can return an array [{id, ...}] instead of
      // a single object {id, ...} despite .single() being called (observed in CI).
      const data = Array.isArray(rawData) ? rawData[0] : rawData;

      // Validate that the insert returned a valid document with an ID
      if (!data?.id) {
        console.error('Document insert returned without ID:', JSON.stringify(rawData, null, 2));
        throw new Error(
          'Document was inserted but database did not return a valid ID. ' +
          'This may indicate an RLS policy issue preventing SELECT after INSERT.'
        );
      }

      // Upload file to storage (with fallback for file system issues)
      try {
        await UnifiedDocumentService.uploadFileToStorage(options.file, fileName);
      } catch (uploadError) {
        console.warn('File storage upload failed, continuing without storage:', uploadError);
        // Update metadata to indicate storage upload failed
        await UnifiedDocumentService.updateDocumentStatus(data.id, {
          status: DocumentStatus.UPLOADED,
          metadata: {
            storage_upload_failed: true,
            storage_error: uploadError instanceof Error ? uploadError.message : 'Unknown error',
            // File will be processed in memory without storage
          },
        });
        return data;
      }
      
      // Update status to uploaded (successful storage upload)
      await UnifiedDocumentService.updateDocumentStatus(data.id, {
        status: DocumentStatus.UPLOADED,
      });

      return data;
    } catch (error) {
      console.error('Failed to create document record:', error);
      throw error;
    }
  }

  /**
   * Upload file to Supabase storage
   */
  private static async uploadFileToStorage(file: File, filePath: string): Promise<void> {
    try {
      // Convert File to Blob to avoid extended attributes issues on some file systems
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type });
      
      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream'
        });

      if (error) {
        console.error('Supabase storage upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }
    } catch (error) {
      console.error('File upload error:', error);
      
      // If it's an extended attributes error, try alternative approach
      if (error instanceof Error && error.message.includes('extended attributes')) {
        console.warn('Extended attributes not supported, trying alternative upload method...');
        
        try {
          // Create a new File object without extended attributes
          const cleanFile = new File([await file.arrayBuffer()], file.name, {
            type: file.type,
            lastModified: file.lastModified
          });
          
          const { error: retryError } = await supabase.storage
            .from('documents')
            .upload(filePath, cleanFile, {
              cacheControl: '3600',
              upsert: false
            });
            
          if (retryError) {
            throw new Error(`Failed to upload file (retry): ${retryError.message}`);
          }
        } catch (retryError) {
          console.error('Retry upload also failed:', retryError);
          throw new Error(`Failed to upload file: ${error.message}`);
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Update document status and metadata
   */
  static async updateDocumentStatus(
    documentId: string,
    options: UpdateDocumentStatusOptions
  ): Promise<DocumentRecord> {
    console.log('🔄 UpdateDocumentStatus called:', { documentId, status: options.status, timestamp: new Date().toISOString() });

    // Validate documentId is defined and valid before querying
    if (!documentId || documentId === 'undefined' || documentId === 'null') {
      const error = new Error(
        `Invalid document ID: "${documentId}". Cannot update status to "${options.status}". ` +
        'This usually means createDocumentRecord did not return a valid ID.'
      );
      console.error('❌ Document ID validation failed:', error.message);
      throw error;
    }

    // Validate status value against allowed enum
    const validStatuses = ['uploaded', 'analyzing', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(options.status)) {
      const error = new Error(`Invalid status '${options.status}'. Must be one of: ${validStatuses.join(', ')}`);
      console.error('❌ Status validation failed:', error.message);
      throw error;
    }
    
    try {
      // Get current document to merge metadata
      const { data: currentDoc, error: fetchError } = await supabase
        .from('documents')
        .select('metadata')
        .eq('id', documentId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch current document: ${fetchError.message}`);
      }

      // Merge metadata with timestamps
      const updatedMetadata = {
        ...currentDoc.metadata,
        ...options.metadata,
      };

      // Add status-specific timestamps
      const now = new Date().toISOString();
      switch (options.status) {
        case DocumentStatus.ANALYZING:
          updatedMetadata.analysis_started_at = now;
          // Trigger AI analysis automatically (use setTimeout for browser compatibility)
          setTimeout(() => this.triggerAIAnalysis(documentId), 0);
          break;
        case DocumentStatus.PROCESSING:
          if (!updatedMetadata.analysis_completed_at && updatedMetadata.analysis_started_at) {
            updatedMetadata.analysis_completed_at = now;
          }
          updatedMetadata.processing_started_at = now;
          break;
        case DocumentStatus.COMPLETED:
          updatedMetadata.processing_completed_at = now;
          break;
        case DocumentStatus.FAILED:
          updatedMetadata.error_message = options.error_message;
          break;
      }

      // Update document
      const updateData: any = {
        processing_status: options.status,
        metadata: updatedMetadata,
      };

      if (options.content_text) {
        updateData.content_text = options.content_text;
      }

      console.log('🔄 Database update payload:', {
        documentId,
        updateData,
        timestamp: new Date().toISOString()
      });

      const { data: rawUpdateData, error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId)
        .select()
        .single();

      // Normalize: .single() may return array in some Supabase environments
      const data = Array.isArray(rawUpdateData) ? rawUpdateData[0] : rawUpdateData;

      console.log('🔄 Database update response:', {
        documentId,
        success: !error,
        error: error?.message,
        updatedProcessingStatus: data?.processing_status,
        timestamp: new Date().toISOString()
      });

      if (error) {
        console.error('❌ Database update failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          updateData 
        });
        throw new Error(`Failed to update document status: ${error.message}`);
      }

      console.log('✅ Document status updated successfully:', { 
        documentId, 
        newStatus: data.processing_status,
        timestamp: new Date().toISOString()
      });
      return data;
    } catch (error) {
      console.error('Failed to update document status:', error);
      throw error;
    }
  }

  /**
   * Finalize document with processing results
   */
  static async finalizeDocument(
    documentId: string,
    results: {
      content_text?: string;
      extracted_fields?: Record<string, any>;
      processing_method?: string;
      quality_metrics?: {
        extraction_quality: number;
        confidence_distribution: { high: number; medium: number; low: number };
      };
      metadata?: Record<string, any>;
    }
  ): Promise<DocumentRecord> {
    try {
      return await UnifiedDocumentService.updateDocumentStatus(documentId, {
        status: DocumentStatus.COMPLETED,
        content_text: results.content_text,
        metadata: {
          ...results.metadata, // Merge any additional metadata passed in
          extracted_fields: results.extracted_fields,
          processing_method: results.processing_method,
          extraction_quality: results.quality_metrics?.extraction_quality,
          confidence_distribution: results.quality_metrics?.confidence_distribution,
        },
      });
    } catch (error) {
      console.error('Failed to finalize document:', error);
      throw error;
    }
  }

  /**
   * Handle document processing failure
   */
  static async markDocumentFailed(
    documentId: string,
    errorMessage: string,
    errorDetails?: any
  ): Promise<DocumentRecord> {
    return await UnifiedDocumentService.updateDocumentStatus(documentId, {
      status: DocumentStatus.FAILED,
      error_message: errorMessage,
      metadata: {
        error_details: errorDetails,
      },
    });
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(documentId: string): Promise<DocumentRecord | null> {
    try {
      const user = await requireAuthentication();

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('uploaded_by', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Document not found
        }
        throw new Error(`Failed to fetch document: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to get document:', error);
      throw error;
    }
  }

  /**
   * Get all documents for current user with real-time status
   */
  static async getUserDocuments(): Promise<DocumentRecord[]> {
    try {
      const user = await requireAuthentication();

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get user documents:', error);
      throw error;
    }
  }

  /**
   * REMOVED: Realtime subscriptions
   * Use polling or manual refresh instead
   */

  /**
   * Delete document and associated files
   */
  static async deleteDocument(documentId: string): Promise<void> {
    try {
      const document = await UnifiedDocumentService.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) {
        console.warn('Failed to delete file from storage:', storageError);
      }

      // Delete document record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Get processing analytics for user
   */
  static async getProcessingAnalytics(): Promise<{
    total: number;
    byStatus: Record<DocumentStatus, number>;
    bySource: Record<UploadSource, number>;
    byMethod: Record<string, number>;
    avgProcessingTime: number;
  }> {
    try {
      const documents = await UnifiedDocumentService.getUserDocuments();
      
      const analytics = {
        total: documents.length,
        byStatus: {} as Record<DocumentStatus, number>,
        bySource: {} as Record<UploadSource, number>,
        byMethod: {} as Record<string, number>,
        avgProcessingTime: 0,
      };

      let totalProcessingTime = 0;
      let completedDocs = 0;

      documents.forEach(doc => {
        const metadata = doc.metadata as DocumentMetadata;
        
        // Count by status
        const status = metadata.processing_status;
        analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1;
        
        // Count by source
        const source = metadata.upload_source;
        analytics.bySource[source] = (analytics.bySource[source] || 0) + 1;
        
        // Count by method
        if (metadata.processing_method) {
          analytics.byMethod[metadata.processing_method] = 
            (analytics.byMethod[metadata.processing_method] || 0) + 1;
        }
        
        // Calculate processing time
        if (metadata.uploaded_at && metadata.processing_completed_at) {
          const processingTime = 
            new Date(metadata.processing_completed_at).getTime() - 
            new Date(metadata.uploaded_at).getTime();
          totalProcessingTime += processingTime;
          completedDocs++;
        }
      });

      analytics.avgProcessingTime = completedDocs > 0 ? totalProcessingTime / completedDocs : 0;

      return analytics;
    } catch (error) {
      console.error('Failed to get processing analytics:', error);
      throw error;
    }
  }

  /**
   * Select and apply the best template suggestion for a document
   */
  static async selectBestTemplate(documentId: string): Promise<DocumentRecord> {
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      const suggestions = document.metadata?.template_suggestions;
      if (!suggestions || suggestions.length === 0) {
        throw new Error('No template suggestions available for this document');
      }

      // Sort by match_score descending and take the best one
      const bestTemplate = suggestions.sort((a: any, b: any) => b.match_score - a.match_score)[0];

      console.log('🎯 Auto-selecting best template:', {
        templateId: bestTemplate.template_id,
        templateName: bestTemplate.template_name,
        matchScore: bestTemplate.match_score
      });

      // Apply the template
      return await this.applyTemplateToDocument(documentId, bestTemplate.template_id, bestTemplate.template_name);
    } catch (error) {
      console.error('Failed to select best template:', error);
      throw error;
    }
  }

  /**
   * Apply a specific template to a document and trigger extraction
   */
  static async applyTemplateToDocument(
    documentId: string, 
    templateId: number, 
    templateName?: string
  ): Promise<DocumentRecord> {
    try {
      console.log('🎯 Applying template to document:', {
        documentId,
        templateId,
        templateName
      });

      // Update document with template information
      const updatedDocument = await this.updateDocumentStatus(documentId, {
        status: DocumentStatus.PROCESSING,
        metadata: {
          template_id: templateId,
          template_name: templateName,
          template_selected_at: new Date().toISOString(),
          processing_started_at: new Date().toISOString(),
          processing_method: 'template_guided'
        },
      });

      // Trigger template extraction
      setTimeout(() => this.triggerTemplateExtraction(documentId), 100);

      return updatedDocument;
    } catch (error) {
      console.error('Failed to apply template to document:', error);
      throw error;
    }
  }

  /**
   * Change the template for a document and re-process it
   */
  static async changeDocumentTemplate(
    documentId: string,
    templateId: number,
    templateName?: string
  ): Promise<DocumentRecord> {
    try {
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      console.log('🔄 Changing template for document:', {
        documentId,
        oldTemplate: document.metadata?.template_id,
        newTemplate: templateId
      });

      // Reset processing status and apply new template
      return await this.applyTemplateToDocument(documentId, templateId, templateName);
    } catch (error) {
      console.error('Failed to change document template:', error);
      throw error;
    }
  }

  /**
   * Get template suggestions for a document
   */
  static getDocumentTemplateSuggestions(document: DocumentRecord): Array<{
    template_id: number;
    template_name: string;
    match_score: number;
    category: string;
    field_count: number;
  }> {
    return document.metadata?.template_suggestions || [];
  }

  /**
   * Check if document needs template selection
   */
  static documentNeedsTemplateSelection(document: DocumentRecord): boolean {
    const hasTemplateId = !!document.metadata?.template_id;
    const hasSuggestions = !!(document.metadata?.template_suggestions?.length);
    const isProcessing = document.processing_status === 'processing' || document.status === 'processing';
    
    return isProcessing && !hasTemplateId && hasSuggestions;
  }
}