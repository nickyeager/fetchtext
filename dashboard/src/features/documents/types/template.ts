export interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  description: string;
  extraction_hints: string[];
  default_value?: string | number;
}

export interface SmartTemplate {
  id: number;
  uuid: string;
  name: string;
  description: string;
  template_content: string;
  template_type: string;
  smart_variables: SmartVariable[];
  category: string;
  tags: string[];
  is_public: boolean;
  variables: any[]; // Legacy field
  usage_count: number;
  rating: number;
  thumbnail_url: string | null;
  extraction_rules: any[];
  generation_settings: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExtractionRule {
  id: string;
  field_name: string;
  extraction_method: 'regex' | 'ai' | 'position' | 'keyword';
  pattern?: string;
  keywords?: string[];
  required: boolean;
  validation_rules?: string[];
}

export interface TemplateGenerationSettings {
  output_format: 'markdown' | 'html' | 'pdf' | 'docx';
  include_metadata: boolean;
  custom_styling?: any;
  post_processing?: string[];
}

export type TemplateCategory = 
  | 'Finance'
  | 'Legal'
  | 'HR'
  | 'Business'
  | 'Procurement'
  | 'Healthcare'
  | 'Real Estate'
  | 'Insurance'
  | 'Manufacturing'
  | 'Other';

export interface TemplateStats {
  total_templates: number;
  templates_by_category: Record<TemplateCategory, number>;
  most_used_templates: Array<{
    name: string;
    usage_count: number;
  }>;
  highest_rated_templates: Array<{
    name: string;
    rating: number;
  }>;
}