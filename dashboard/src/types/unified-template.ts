/**
 * Unified Template Types
 * 
 * This file contains the unified template data model that supports
 * all template types in the FetchText platform.
 */

// Base template interface that all templates extend
export interface BaseTemplate {
  id: string | number;
  uuid?: string;
  name: string;
  description: string;
  category: string;
  type: 'smart' | 'standard' | 'workflow';
  usage_count?: number;
  rating?: number;
  tags?: string[];
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

// Smart variable definition for AI-powered extraction
export interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'address' | 'currency' | 'array' | 'object';
  description: string;
  extraction_hints: string[];
  required?: boolean;
  default_value?: any;
  validation_regex?: string;
  confidence_threshold?: number;
  post_processing?: {
    transform?: string;
    normalize?: boolean;
  };
}

// Standard template field definition
export interface TemplateField {
  id?: string;
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default_value?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

// Workflow configuration for N8N templates
export interface WorkflowConfig {
  workflow_id?: string;
  n8n_config?: any;
  trigger_type?: string;
  parameters?: Record<string, any>;
  version?: string;
}

// Extraction configuration for smart templates
export interface ExtractionConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  extraction_strategy?: 'single_pass' | 'multi_pass' | 'iterative';
  preprocessing?: {
    ocr_enabled?: boolean;
    language_detection?: boolean;
    noise_reduction?: boolean;
  };
}

// Smart Template type (AI-powered document processing)
export interface SmartTemplate extends BaseTemplate {
  type: 'smart';
  template_content: string;
  template_type: 'markdown' | 'html' | 'plain' | 'json';
  smart_variables: SmartVariable[];
  extraction_config?: ExtractionConfig;
  validation_rules?: Array<{
    rule: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

// Standard Template type (basic field-based)
export interface StandardTemplate extends BaseTemplate {
  type: 'standard';
  content: string;
  fields: TemplateField[];
  layout?: 'form' | 'document' | 'custom';
}

// Workflow Template type (N8N workflows)
export interface WorkflowTemplate extends BaseTemplate {
  type: 'workflow';
  workflow_config: WorkflowConfig;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  documentation?: string;
}

// Union type for all template types
export type UnifiedTemplate = SmartTemplate | StandardTemplate | WorkflowTemplate;

// Type guards
export function isSmartTemplate(template: UnifiedTemplate): template is SmartTemplate {
  return template.type === 'smart';
}

export function isStandardTemplate(template: UnifiedTemplate): template is StandardTemplate {
  return template.type === 'standard';
}

export function isWorkflowTemplate(template: UnifiedTemplate): template is WorkflowTemplate {
  return template.type === 'workflow';
}

// Template filters for searching/listing
export interface TemplateFilters {
  type?: ('smart' | 'standard' | 'workflow')[];
  category?: string[];
  tags?: string[];
  search?: string;
  is_public?: boolean;
  created_by?: string;
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'usage_count' | 'rating';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Processing result when using a template
export interface TemplateProcessingResult {
  success: boolean;
  template_id: string | number;
  processed_at: string;
  duration_ms: number;
  
  // For smart templates
  extracted_data?: Record<string, any>;
  confidence_scores?: Record<string, number>;
  
  // For workflow templates
  workflow_execution_id?: string;
  workflow_output?: any;
  
  // Common
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  warnings?: string[];
}

// Template creation/update payload
export interface TemplatePayload {
  name: string;
  description: string;
  category: string;
  type: 'smart' | 'standard' | 'workflow';
  tags?: string[];
  is_public?: boolean;
  
  // Type-specific fields
  template_content?: string;  // For smart templates
  content?: string;           // For standard templates
  smart_variables?: SmartVariable[];
  fields?: TemplateField[];
  workflow_config?: WorkflowConfig;
  extraction_config?: ExtractionConfig;
  metadata?: Record<string, unknown>;
}