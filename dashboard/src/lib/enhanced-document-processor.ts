/**
 * Enhanced Document Processor Client
 * Integrates with AI-powered content extraction and classification
 */

import { API_ENDPOINTS } from '@/lib/api-config';

export interface AIEnhancedProcessingOptions {
  extractText: boolean
  extractMetadata: boolean
  extractStructure: boolean
  useAIEnhancement: boolean
  includeQualityAssessment: boolean
}

export interface AIClassification {
  primary_category: string
  secondary_categories: string[]
  confidence_score: number
  content_type: string
  complexity_level: string
  industry_domain: string
  key_topics: string[]
  document_purpose: string
  extraction_recommendations: {
    key_data_points: string[]
    structure_patterns: string[]
    processing_priority: string
  }
  language: string
  formality_level: string
  classification_method: string
  timestamp: string
}

export interface ExtractedData {
  extraction_method: string
  target_data_points: string[]
  extracted_values: Record<string, any>
  confidence_scores: Record<string, number>
  extraction_notes: string
  overall_confidence: number
}

export interface QualityAssessment {
  content_length: number
  word_count: number
  completeness_score: number
  readability_score: number
  structure_score: number
  overall_quality: 'high' | 'medium' | 'low' | 'unknown'
  insights: string[]
  assessment_timestamp: string
}

export interface ContextAnalysis {
  classification: AIClassification
  structure_analysis: any
  contextual_data: any
  processing_recommendations: any
}

export interface EnhancedProcessedDocument {
  job_id: string
  status: string
  content: {
    text: string
    markdown?: string
    tables?: any[]
    images?: any[]
    layout_info?: any
    ai_structure_analysis?: {
      detected_patterns: string[]
      confidence: number
      enhancement_applied: boolean
      category_specific_analysis: any
    }
  }
  metadata: {
    filename: string
    file_size: number
    mime_type: string
    document_type: string
    created_at: string
    modified_at: string
    title: string
  }
  ai_classification?: AIClassification
  extracted_data?: ExtractedData
  quality_assessment?: QualityAssessment
  context_analysis?: ContextAnalysis
  ai_enhancement_enabled: boolean
  ai_processing_time?: number
  processing_method: string
  processing_time: number
  created_at: string
  completed_at: string
  request_metadata?: {
    original_filename: string
    content_type: string
    processing_options: AIEnhancedProcessingOptions
    processed_at: string
  }
}

export interface BatchProcessingResult {
  batch_id: string
  batch_statistics: {
    total_files: number
    successful_count: number
    failed_count: number
    success_rate: number
    total_processing_time: number
    average_time_per_file: number
  }
  processing_options: AIEnhancedProcessingOptions & {
    max_concurrent: number
  }
  results: EnhancedProcessedDocument[]
  batch_started_at: string
  batch_completed_at: string
}

export interface ClassificationResult {
  classification: AIClassification
  document_metadata: any
  classification_timestamp: string
  confidence_analysis?: {
    overall_confidence: number
    classification_method: string
    confidence_level: 'low' | 'medium' | 'high'
    reliability_factors: string[]
  }
}

export class EnhancedDocumentProcessor {
  private readonly enhancedBaseUrl = API_ENDPOINTS.enhancedDocuments
  
  private readonly defaultOptions: AIEnhancedProcessingOptions = {
    extractText: true,
    extractMetadata: true,
    extractStructure: true,
    useAIEnhancement: true,
    includeQualityAssessment: true
  }

  /**
   * Process document with AI enhancement and intelligent content analysis
   */
  async processDocumentWithAI(
    file: File,
    options: Partial<AIEnhancedProcessingOptions> = {}
  ): Promise<EnhancedProcessedDocument> {
    
    const processingOptions = { ...this.defaultOptions, ...options }
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('extract_text', String(processingOptions.extractText))
      formData.append('extract_metadata', String(processingOptions.extractMetadata))
      formData.append('extract_structure', String(processingOptions.extractStructure))
      formData.append('use_ai_enhancement', String(processingOptions.useAIEnhancement))
      formData.append('include_quality_assessment', String(processingOptions.includeQualityAssessment))

      const response = await fetch(`${this.enhancedBaseUrl}/process-with-ai`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Enhanced processing failed: ${errorData.detail || response.statusText}`)
      }

      const result = await response.json() as EnhancedProcessedDocument
      return result
      
    } catch (error) {
      console.error('Enhanced processing error:', error)
      throw error
    }
  }

  /**
   * Classify document content using AI-powered analysis
   */
  async classifyDocument(
    file: File,
    includeConfidenceAnalysis: boolean = false
  ): Promise<ClassificationResult> {
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('include_confidence_analysis', String(includeConfidenceAnalysis))

      const response = await fetch(`${this.enhancedBaseUrl}/classify-content`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Classification failed: ${errorData.detail || response.statusText}`)
      }

      const result = await response.json() as ClassificationResult
      return result
      
    } catch (error) {
      console.error('Classification error:', error)
      throw error
    }
  }

  /**
   * Process multiple documents with AI enhancement in batch
   */
  async batchProcessWithAI(
    files: File[],
    options: Partial<AIEnhancedProcessingOptions & { maxConcurrent: number }> = {}
  ): Promise<BatchProcessingResult> {
    
    const processingOptions = { 
      ...this.defaultOptions, 
      maxConcurrent: 3,
      ...options 
    }
    
    try {
      const formData = new FormData()
      
      files.forEach(file => {
        formData.append('files', file)
      })
      
      formData.append('extract_text', String(processingOptions.extractText))
      formData.append('extract_metadata', String(processingOptions.extractMetadata))
      formData.append('extract_structure', String(processingOptions.extractStructure))
      formData.append('use_ai_enhancement', String(processingOptions.useAIEnhancement))
      formData.append('max_concurrent', String(processingOptions.maxConcurrent))

      const response = await fetch(`${this.enhancedBaseUrl}/batch-process-with-ai`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Batch processing failed: ${errorData.detail || response.statusText}`)
      }

      const result = await response.json() as BatchProcessingResult
      return result
      
    } catch (error) {
      console.error('Batch processing error:', error)
      throw error
    }
  }

  /**
   * Check if the enhanced backend service is available
   */
  async isEnhancedBackendAvailable(): Promise<boolean> {
    try {
      const healthUrl = this.enhancedBaseUrl.replace('/api/enhanced-documents', '/health')
      const response = await fetch(healthUrl, { method: 'GET' })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Utility method to format classification confidence for display
   */
  formatConfidenceLevel(confidence: number): {
    level: 'low' | 'medium' | 'high'
    percentage: string
    color: string
  } {
    const percentage = `${(confidence * 100).toFixed(1)}%`
    
    if (confidence >= 0.8) {
      return { level: 'high', percentage, color: 'green' }
    } else if (confidence >= 0.6) {
      return { level: 'medium', percentage, color: 'yellow' }
    } else {
      return { level: 'low', percentage, color: 'red' }
    }
  }

  /**
   * Utility method to format document category for display
   */
  formatCategoryName(category: string): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Utility method to get processing priority color
   */
  getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'red'
      case 'medium':
        return 'yellow'
      case 'low':
        return 'green'
      default:
        return 'gray'
    }
  }
}