export interface ValidationRule {
  type: string;
  value: string | number;
  message: string;
}

export interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  description: string;
  extraction_hints: string[];
  validation_rules?: ValidationRule[];
  default_value?: string | number;
}

export interface ExtractionRule {
  variable_id: string;
  ai_prompt: string;
  fallback_rules: string[];
  confidence_threshold: number;
}

export interface GenerationSettings {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface SmartTemplate {
  id: number;
  uuid: string;
  name: string;
  description: string;
  template_content: string;
  template_type: string;
  smart_variables: SmartVariable[];
  extraction_rules: ExtractionRule[];
  generation_settings: GenerationSettings;
  category: string;
  tags: string[];
  thumbnail_url?: string;
  usage_count: number;
  rating: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}
