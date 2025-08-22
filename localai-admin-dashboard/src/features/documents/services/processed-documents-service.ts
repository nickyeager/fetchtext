/**
 * Processed Documents Service
 * Manages storage and retrieval of processed document data from Supabase
 * Uses existing tables: documents and generated_outputs
 */

import { supabase } from '@/lib/supabase';

export interface ExtractedField {
  value: any;
  confidence: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
  };
}

export interface ProcessedDocument {
  id: string;
  uuid: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  content_text?: string;
  metadata: any;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  
  // Additional processing info
  template_id?: number;
  template_name?: string;
  processing_status?: 'pending' | 'analyzing' | 'processing' | 'completed' | 'failed';
  extracted_fields?: Record<string, ExtractedField>;
  processing_method?: 'template_guided' | 'generic' | 'progressive';
}

export class ProcessedDocumentsService {
  /**
   * Save a processed document to the database using existing documents table
   */
  static async saveProcessedDocument(
    fileData: {
      name: string;
      file_path: string;
      file_type: string;
      file_size: number;
      content_text?: string;
      metadata?: any;
      template_id?: number;
      template_name?: string;
      extracted_fields?: Record<string, ExtractedField>;
      processing_method?: 'template_guided' | 'generic' | 'progressive';
    }
  ): Promise<ProcessedDocument> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    // Store document with enhanced metadata
    const enhancedMetadata = {
      ...fileData.metadata,
      template_id: fileData.template_id,
      template_name: fileData.template_name,
      extracted_fields: fileData.extracted_fields,
      processing_method: fileData.processing_method,
    };

    const docToInsert = {
      name: fileData.name,
      file_path: fileData.file_path,
      file_type: fileData.file_type,
      file_size: fileData.file_size,
      content_text: fileData.content_text,
      processing_status: 'completed',
      metadata: enhancedMetadata,
      uploaded_by: userData.user.id,
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(docToInsert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save processed document: ${error.message}`);
    }

    return {
      ...data,
      template_id: fileData.template_id,
      template_name: fileData.template_name,
      processing_status: 'completed' as const,
      extracted_fields: fileData.extracted_fields,
      processing_method: fileData.processing_method,
    };
  }

  /**
   * Update an existing processed document
   */
  static async updateProcessedDocument(
    id: string,
    updates: Partial<Omit<ProcessedDocument, 'id' | 'user_id' | 'created_at'>>
  ): Promise<ProcessedDocument> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('processed_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update processed document: ${error.message}`);
    }

    return data;
  }

  /**
   * Debug method to check if a document exists (temporary)
   */
  static async debugCheckDocument(id: string): Promise<any> {
    console.log('🔍 Debug: Checking document existence for ID:', id);
    
    try {
      // First, check without user filter to see if document exists at all
      const { data: allDocs, error: allError } = await supabase
        .from('documents')
        .select('id, uploaded_by, created_at, name')
        .eq('id', id);
      
      console.log('🔍 Debug: Document search result (no user filter):', allDocs, allError);
      
      // Now check with user filter
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: userDocs, error: userError } = await supabase
          .from('documents')
          .select('id, uploaded_by, created_at, name')
          .eq('id', id)
          .eq('uploaded_by', userData.user.id);
        
        console.log('🔍 Debug: Document search result (with user filter):', userDocs, userError);
        console.log('🔍 Debug: Current user ID:', userData.user.id);
      }
      
      return { exists: allDocs && allDocs.length > 0, documents: allDocs };
    } catch (error) {
      console.error('🔍 Debug: Error checking document:', error);
      return { exists: false, error };
    }
  }

  /**
   * Get all processed documents for the current user
   */
  static async getProcessedDocuments(): Promise<ProcessedDocument[]> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('uploaded_by', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch processed documents: ${error.message}`);
    }

    // Transform data to include extracted processing info from metadata
    return (data || []).map(doc => ({
      ...doc,
      template_id: doc.metadata?.template_id,
      template_name: doc.metadata?.template_name,
      extracted_fields: doc.metadata?.extracted_fields,
      processing_method: doc.metadata?.processing_method,
    }));
  }

  /**
   * Get a document by ID (alias for getProcessedDocumentById)
   */
  static async getDocument(id: string): Promise<ProcessedDocument | null> {
    return this.getProcessedDocumentById(id);
  }

  /**
   * Get a specific processed document by ID
   */
  static async getProcessedDocumentById(id: string): Promise<ProcessedDocument | null> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('uploaded_by', userData.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Document not found
      }
      throw new Error(`Failed to fetch processed document: ${error.message}`);
    }

    // Transform data to include extracted processing info from metadata
    return {
      ...data,
      template_id: data.metadata?.template_id,
      template_name: data.metadata?.template_name,
      extracted_fields: data.metadata?.extracted_fields,
      processing_method: data.metadata?.processing_method,
    };
  }

  /**
   * Delete a processed document
   */
  static async deleteProcessedDocument(id: string): Promise<void> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('uploaded_by', userData.user.id);

    if (error) {
      throw new Error(`Failed to delete processed document: ${error.message}`);
    }
  }

  /**
   * Update a processed document
   */
  static async updateDocument(id: string, updates: {
    processed_content?: string;
    metadata?: any;
    template_id?: number;
    template_name?: string;
    extracted_fields?: Record<string, ExtractedField>;
  }): Promise<ProcessedDocument> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    // Get existing document first
    const existing = await this.getProcessedDocumentById(id);
    if (!existing) {
      throw new Error('Document not found');
    }

    // Merge metadata
    const updatedMetadata = {
      ...existing.metadata,
      ...updates.metadata,
    };

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
      metadata: updatedMetadata,
    };

    if (updates.processed_content !== undefined) {
      updateData.content_text = updates.processed_content;
    }

    if (updates.template_id !== undefined) {
      updatedMetadata.template_id = updates.template_id;
    }

    if (updates.template_name !== undefined) {
      updatedMetadata.template_name = updates.template_name;
    }

    if (updates.extracted_fields !== undefined) {
      updatedMetadata.extracted_fields = updates.extracted_fields;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .eq('uploaded_by', userData.user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }

    return {
      ...data,
      template_id: updatedMetadata.template_id,
      template_name: updatedMetadata.template_name,
      extracted_fields: updatedMetadata.extracted_fields,
      processing_method: updatedMetadata.processing_method,
    };
  }

  /**
   * Get document processing history with detailed metadata
   */
  static async getDocumentProcessingHistory(id: string): Promise<{
    document: ProcessedDocument;
    processingSteps: Array<{
      step: string;
      timestamp: string;
      status: 'success' | 'warning' | 'error';
      details?: any;
    }>;
  } | null> {
    const document = await this.getProcessedDocumentById(id);
    if (!document) return null;

    // Extract processing history from metadata
    const processingSteps = [];
    
    // Add basic processing step
    processingSteps.push({
      step: 'Document Upload',
      timestamp: document.created_at,
      status: 'success' as const,
      details: {
        file_type: document.file_type,
        file_size: document.file_size,
      }
    });

    // Add docling processing step
    if (document.content_text) {
      processingSteps.push({
        step: 'Content Extraction',
        timestamp: document.created_at, // Would be better with separate timestamp
        status: 'success' as const,
        details: {
          method: 'docling',
          content_length: document.content_text.length,
        }
      });
    }

    // Add template processing step
    if (document.template_name && document.extracted_fields) {
      processingSteps.push({
        step: 'Template Processing',
        timestamp: document.created_at,
        status: 'success' as const,
        details: {
          template: document.template_name,
          fields_extracted: Object.keys(document.extracted_fields).length,
          method: document.processing_method,
        }
      });
    }

    // Add AI enhancement step
    if (document.metadata?.ai_enhancement_enabled) {
      processingSteps.push({
        step: 'AI Enhancement',
        timestamp: document.created_at,
        status: document.metadata.ai_classification ? 'success' as const : 'warning' as const,
        details: {
          classification: document.metadata.ai_classification?.primary_category,
          confidence: document.metadata.ai_classification?.confidence_score,
          processing_time: document.metadata.ai_processing_time,
        }
      });
    }

    return {
      document,
      processingSteps,
    };
  }

  /**
   * Get document quality metrics
   */
  static async getDocumentQualityMetrics(id: string): Promise<{
    extraction_quality: number;
    confidence_distribution: { high: number; medium: number; low: number };
    ai_quality_score?: number;
    recommendations: string[];
  } | null> {
    const document = await this.getProcessedDocumentById(id);
    if (!document) return null;

    const metrics = {
      extraction_quality: 0,
      confidence_distribution: { high: 0, medium: 0, low: 0 },
      ai_quality_score: undefined as number | undefined,
      recommendations: [] as string[],
    };

    // Calculate extraction quality from extracted fields
    if (document.extracted_fields) {
      const fields = Object.values(document.extracted_fields);
      const totalFields = fields.length;
      
      if (totalFields > 0) {
        const highConfidence = fields.filter(f => f.confidence >= 0.8).length;
        const mediumConfidence = fields.filter(f => f.confidence >= 0.6 && f.confidence < 0.8).length;
        const lowConfidence = fields.filter(f => f.confidence < 0.6).length;

        metrics.extraction_quality = (highConfidence * 1.0 + mediumConfidence * 0.7 + lowConfidence * 0.4) / totalFields;
        metrics.confidence_distribution = {
          high: highConfidence,
          medium: mediumConfidence,
          low: lowConfidence,
        };

        // Add recommendations based on confidence distribution
        if (lowConfidence > totalFields * 0.3) {
          metrics.recommendations.push('Consider re-processing with a different template for better accuracy');
        }
        if (highConfidence < totalFields * 0.5) {
          metrics.recommendations.push('Review extracted fields manually for accuracy');
        }
      }
    }

    // Get AI quality score from metadata
    const qualityAssessment = document.metadata?.quality_assessment;
    if (qualityAssessment?.overall_quality) {
      switch (qualityAssessment.overall_quality) {
        case 'high':
          metrics.ai_quality_score = 0.9;
          break;
        case 'medium':
          metrics.ai_quality_score = 0.7;
          break;
        case 'low':
          metrics.ai_quality_score = 0.4;
          break;
      }

      // Add AI-based recommendations
      if (qualityAssessment.insights) {
        metrics.recommendations.push(...qualityAssessment.insights);
      }
    }

    return metrics;
  }

  /**
   * Search documents by content or metadata
   */
  static async searchDocuments(query: string, filters?: {
    template_id?: number;
    processing_method?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ProcessedDocument[]> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    let queryBuilder = supabase
      .from('documents')
      .select('*')
      .eq('uploaded_by', userData.user.id);

    // Add text search
    if (query.trim()) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,content_text.ilike.%${query}%`);
    }

    // Add filters
    if (filters?.date_from) {
      queryBuilder = queryBuilder.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      queryBuilder = queryBuilder.lte('created_at', filters.date_to);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(50); // Limit results for performance

    if (error) {
      throw new Error(`Failed to search documents: ${error.message}`);
    }

    // Transform and filter results
    let results = (data || []).map(doc => ({
      ...doc,
      template_id: doc.metadata?.template_id,
      template_name: doc.metadata?.template_name,
      processing_status: doc.metadata?.processing_status || 'completed',
      extracted_fields: doc.metadata?.extracted_fields,
      processing_method: doc.metadata?.processing_method,
    }));

    // Apply metadata filters
    if (filters?.template_id) {
      results = results.filter(doc => doc.template_id === filters.template_id);
    }
    if (filters?.processing_method) {
      results = results.filter(doc => doc.processing_method === filters.processing_method);
    }

    return results;
  }

  /**
   * Get processed documents by template
   */
  static async getProcessedDocumentsByTemplate(templateId: number): Promise<ProcessedDocument[]> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('processed_documents')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('template_id', templateId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents by template: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single document by ID
   */
  static async getDocumentById(documentId: string): Promise<ProcessedDocument> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('uploaded_by', userData.user.id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    if (!data) {
      throw new Error('Document not found');
    }

    // Transform data to include extracted processing info from metadata
    return {
      ...data,
      template_id: data.metadata?.template_id,
      template_name: data.metadata?.template_name,
      extracted_fields: data.metadata?.extracted_fields,
      processing_method: data.metadata?.processing_method,
    };
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    processing: number;
    byTemplate: Record<string, number>;
  }> {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('processed_documents')
      .select('processing_status, template_name')
      .eq('user_id', userData.user.id);

    if (error) {
      throw new Error(`Failed to fetch processing stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      completed: 0,
      failed: 0,
      processing: 0,
      byTemplate: {} as Record<string, number>,
    };

    data?.forEach(doc => {
      switch (doc.processing_status) {
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'processing':
        case 'pending':
          stats.processing++;
          break;
      }

      if (doc.template_name) {
        stats.byTemplate[doc.template_name] = (stats.byTemplate[doc.template_name] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Export document data for download
   */
  static async exportDocument(id: string, format: 'json' | 'txt' | 'csv' | 'html' | 'docx' = 'json'): Promise<Blob> {
    const document = await this.getProcessedDocumentById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    let content: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(document, null, 2);
        mimeType = 'application/json';
        break;
      
      case 'txt':
        content = `Document: ${document.original_filename}\n`;
        content += `Processed: ${document.processed_at || document.created_at}\n`;
        content += `Template: ${document.template_name || 'Generic Processing'}\n\n`;
        content += `Content:\n${document.extracted_content || 'No content available'}\n\n`;
        
        if (document.extracted_fields) {
          content += `Extracted Fields:\n`;
          Object.entries(document.extracted_fields).forEach(([field, data]) => {
            content += `${field}: ${data.value} (${Math.round(data.confidence * 100)}% confidence)\n`;
          });
        }
        mimeType = 'text/plain';
        break;
      
      case 'csv':
        if (document.extracted_fields) {
          const headers = ['Field', 'Value', 'Confidence', 'Source Text'];
          const rows = Object.entries(document.extracted_fields).map(([field, data]) => [
            field,
            String(data.value),
            String(Math.round(data.confidence * 100)),
            data.sourceText || ''
          ]);
          
          content = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
        } else {
          content = 'No extracted fields available';
        }
        mimeType = 'text/csv';
        break;

      case 'html':
        content = `<!DOCTYPE html>
<html>
<head>
  <title>${document.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 20px; }
    .field { margin-bottom: 10px; }
    .field-label { font-weight: bold; }
    .confidence { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${document.name}</h1>
    <p>Processed: ${document.created_at}</p>
    <p>Template: ${document.template_name || 'Generic Processing'}</p>
  </div>
  <div class="content">
    ${document.content_text ? `<h2>Content</h2><p>${document.content_text.replace(/\n/g, '<br>')}</p>` : ''}
    ${document.extracted_fields ? `
      <h2>Extracted Fields</h2>
      ${Object.entries(document.extracted_fields).map(([field, data]) => 
        `<div class="field">
          <span class="field-label">${field}:</span> ${data.value}
          <span class="confidence">(${Math.round(data.confidence * 100)}% confidence)</span>
        </div>`
      ).join('')}
    ` : ''}
  </div>
</body>
</html>`;
        mimeType = 'text/html';
        break;

      case 'docx':
        // Basic DOCX export - for a full implementation, you'd need a library like docx
        const docContent = `Document: ${document.name}
Processed: ${document.created_at}
Template: ${document.template_name || 'Generic Processing'}

Content:
${document.content_text || 'No content available'}

${document.extracted_fields ? 'Extracted Fields:\n' + 
  Object.entries(document.extracted_fields).map(([field, data]) => 
    `${field}: ${data.value} (${Math.round(data.confidence * 100)}% confidence)`
  ).join('\n') : ''
}`;
        content = docContent;
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return new Blob([content], { type: mimeType });
  }
}