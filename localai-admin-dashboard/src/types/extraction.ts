// Shared extraction and document processing related TypeScript interfaces
// Centralized to avoid duplication between UI components and processor client logic.

export interface DocumentMetadata {
  title?: string;
  author?: string;
  pages?: number;
  format: string;
  size?: number;
  [key: string]: unknown;
}

export interface DocumentStructure {
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

export interface TemplateSuggestion {
  templateId: string;
  templateName: string;
  confidence: number;
  matchReasons: string[];
}

export interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'email' | 'phone' | 'url' | 'tax_id';
  description: string;
  extraction_hints: string[];
  default_value?: string | number;
}

export interface DocumentEvaluation {
  document_info: {
    filename: string;
    file_size: number;
    mime_type: string;
    format_supported: boolean;
    file_extension?: string;
  };
  type_evaluation: {
    primary_type: string;
    confidence: number;
    detection_method: string;
    alternative_types?: string[];
  };
  content_preview?: {
    has_tables: boolean;
    has_images: boolean;
    detected_language?: string;
    page_count?: number;
    key_phrases?: string[];
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
  evaluation_metadata?: {
    evaluation_time: string;
    quick_scan?: boolean;
    include_confidence_scores?: boolean;
    suggest_templates?: boolean;
    evaluation_version?: string;
  };
}

export interface SmartTemplate {
  id: number;
  name: string;
  description: string;
  template_content: string;
  smart_variables: SmartVariable[];
  category: string;
  tags: string[];
  template_type?: string;
  extraction_rules?: unknown[];
  generation_settings?: unknown;
  variables?: unknown[]; // legacy / standard template alias
}

export interface ExtractedField {
  value: unknown;
  confidence: number;
  sourceText?: string;
  location?: { page?: number; position?: number };
}

export interface TemplateExtractionResult {
  content: string;
  metadata: DocumentMetadata;
  structure: DocumentStructure;
  extractedFields: Record<string, ExtractedField>;
  template: SmartTemplate;
}

export interface FieldExtractionProgress {
  fieldName: string;
  status: 'pending' | 'extracting' | 'analyzing' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: ExtractedField;
  error?: string;
}

export interface ProgressiveExtractionResult {
  content: string;
  metadata: DocumentMetadata;
  structure: DocumentStructure;
  template: SmartTemplate;
  fieldProgress: Record<string, FieldExtractionProgress>;
  isComplete: boolean;
}

export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
  structure: DocumentStructure;
  templateSuggestions: TemplateSuggestion[];
}

export interface DocumentPreview {
  thumbnailUrl?: string;
  previewText: string;
  metadata: DocumentMetadata;
}

export interface BatchProcessingOptions {
  continueOnError?: boolean;
  maxConcurrency?: number;
}

export interface BackendResponse {
  content?: {
    text?: string;
    layout_info?: {
      headings?: Array<{
        level: number;
        text: string;
        position: number;
      }>;
    };
    tables?: Array<{
      data?: unknown[][];
      caption?: string;
    }>;
    images?: Array<{
      caption?: string;
      dimensions?: { width: number; height: number };
    }>;
  };
  metadata?: {
    title?: string;
    pages?: number;
    [key: string]: unknown;
  };
  extracted_fields?: Record<string, {
    value: unknown;
    confidence?: number;
    source_text?: string;
    location?: { page?: number; position?: number };
  }>;
  processing_method?: string;
  processing_time?: number;
  status?: string;
}
