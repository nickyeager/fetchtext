/**
 * Unified Document Service
 * Centralized service for document lifecycle management across all upload paths
 */

import { supabase } from '@/lib/supabase';
import { requireAuthentication } from '@/lib/supabase-auth-utils';

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
}

export interface DocumentMetadata {
  // Core metadata
  upload_source: UploadSource;
  processing_status: DocumentStatus;
  original_filename: string;
  
  // Processing information
  template_id?: number;
  template_name?: string;
  processing_method?: 'template_guided' | 'generic' | 'progressive' | 'ai_enhanced';
  
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
}

export interface CreateDocumentOptions {
  file: File;
  uploadSource: UploadSource;
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

      // Get the file from storage
      const { supabase } = await import('@/lib/supabase');
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (downloadError || !fileData) {
        console.error('Failed to download file for analysis:', downloadError);
        await this.markDocumentFailed(documentId, 'Failed to download file for analysis');
        return;
      }

      // Create File object for document processor
      const file = new File([fileData], document.name, { 
        type: document.file_type 
      });

      // Initialize document processor
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const documentProcessor = new DocumentProcessorEnhanced();

      // Perform AI document type evaluation
      const evaluation = await documentProcessor.evaluateDocumentType(file, {
        quickScan: false,
        includeConfidenceScores: true,
        suggestTemplates: true
      });

      console.log('✅ AI analysis completed for document:', documentId);
      console.log('Evaluation result:', evaluation);

      // Update document with evaluation results
      await this.updateDocumentStatus(documentId, {
        status: DocumentStatus.PROCESSING,
        metadata: {
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
        },
      });

      console.log('✅ Document updated with AI analysis results');

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
      const fileName = `${user.id}/${Date.now()}_${options.file.name}`;
      
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
      };

      console.log('Creating document record:', documentData);
      
      const { data, error } = await supabase
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

      const { data, error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId)
        .select()
        .single();

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
   * Subscribe to document status changes for real-time updates
   */
  static subscribeToDocumentUpdates(
    documentId: string,
    callback: (document: DocumentRecord) => void
  ) {
    return supabase
      .channel(`document-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`,
        },
        (payload) => {
          callback(payload.new as DocumentRecord);
        }
      )
      .subscribe();
  }

  /**
   * Subscribe to all document changes for user
   */
  static subscribeToAllDocumentUpdates(
    userId: string,
    callback: (document: DocumentRecord, event: 'INSERT' | 'UPDATE' | 'DELETE') => void
  ) {
    return supabase
      .channel(`user-documents-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `uploaded_by=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as DocumentRecord, payload.eventType as any);
        }
      )
      .subscribe();
  }

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
}