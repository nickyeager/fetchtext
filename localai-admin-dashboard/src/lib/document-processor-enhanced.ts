/**
 * Enhanced Document Processor Service
 * Integrates with the document-processor backend service for advanced document processing
 */

interface DocumentMetadata {
  title?: string;
  author?: string;
  pages?: number;
  format: string;
  size?: number;
  [key: string]: any;
}

interface DocumentStructure {
  headings: Array<{
    level: number;
    text: string;
    position: number;
  }>;
  tables: Array<{
    position: number;
    rows: number;
    columns: number;
  }>;
  images: Array<{
    position: number;
    alt?: string;
    dimensions?: {
      width: number;
      height: number;
    };
  }>;
}

interface TemplateSuggestion {
  templateId: string;
  templateName: string;
  confidence: number;
  matchReasons: string[];
}

interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
  structure: DocumentStructure;
  templateSuggestions: TemplateSuggestion[];
}

interface DocumentPreview {
  thumbnailUrl?: string;
  previewText: string;
  metadata: DocumentMetadata;
}

interface BatchProcessingOptions {
  continueOnError?: boolean;
  maxConcurrency?: number;
}

export class DocumentProcessorEnhanced {
  private readonly baseUrl = 'http://localhost:8001/api/documents';
  
  private readonly supportedFormats = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/msword', // .doc
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.ms-excel', // .xls
    'text/html',
    'text/plain',
    'text/markdown',
    'text/csv'
  ];

  /**
   * Process a document using the enhanced Docling-based backend
   */
  async processDocumentWithDocling(file: File): Promise<ProcessedDocument> {
    // Validate file format
    if (!this.supportedFormats.includes(file.type)) {
      throw new Error(`Unsupported file format: ${file.type}`);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify({
      extractStructure: true,
      generateTemplatesuggestions: true,
      includeMetadata: true
    }));

    const response = await fetch(`${this.baseUrl}/process-enhanced`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to process document: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Extract hierarchical document structure from processed data
   */
  async extractDocumentStructure(structuredData: any): Promise<DocumentStructure> {
    // Process the structured data to extract hierarchy
    return structuredData.structure;
  }

  /**
   * Generate preview with format-specific rendering
   */
  async generatePreview(processedDocument: ProcessedDocument): Promise<DocumentPreview> {
    const { content, metadata } = processedDocument;
    
    // Generate preview text (first 200 characters)
    const previewText = content.substring(0, 200) + (content.length > 200 ? '...' : '');
    
    // For now, we'll generate a placeholder thumbnail URL
    // In a real implementation, this might call a thumbnail generation service
    const thumbnailUrl = `/api/thumbnails/generate?format=${metadata.format}&size=200x150`;

    return {
      thumbnailUrl,
      previewText,
      metadata
    };
  }

  /**
   * Get list of supported document formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Process multiple documents concurrently
   */
  async batchProcessDocuments(
    files: File[], 
    options: BatchProcessingOptions = {}
  ): Promise<ProcessedDocument[]> {
    const { continueOnError = false, maxConcurrency = 3 } = options;
    const results: ProcessedDocument[] = [];
    
    // Process files in batches to respect concurrency limits
    for (let i = 0; i < files.length; i += maxConcurrency) {
      const batch = files.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async (file) => {
        try {
          return await this.processDocumentWithDocling(file);
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          // Log error but continue processing
          console.error(`Failed to process file ${file.name}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Add successful results
      batchResults.forEach(result => {
        if (result !== null) {
          results.push(result);
        }
      });
    }

    return results;
  }
}
