/**
 * Unified Template Service
 * 
 * Handles all template operations for the FetchText document processing platform:
 * 1. Process documents → Extract variables (AI-first, regex fallback) → Generate new documents
 * 
 * All templates are now "smart templates" with AI-powered extraction and regex fallback support.
 */
import { supabase } from '@/lib/supabase';
import { withAuthentication } from '@/lib/supabase-auth-utils';
import { Template, SmartVariable } from '@/lib/template-validator';

// Enhanced SmartVariable with regex fallback
export interface SmartVariableWithFallback extends SmartVariable {
  regex_fallback?: string;
  // Keep confidence_threshold required to remain compatible with SmartVariable
  confidence_threshold: number;
}

export interface SmartTemplate extends Omit<Template, 'id'> {
  // Database uses numeric IDs; omit base id to avoid type conflict and expose numeric id
  id?: number;
  uuid?: string;
  // Some rows or drafts may have missing content/type – make optional for compatibility
  template_content?: string;
  template_type?: string;
  tags: string[];
  is_public: boolean;
  usage_count?: number;
  rating?: number;
  thumbnail_url?: string | null;
  extraction_rules?: any[];
  generation_settings?: any;
  regex_fallback?: Record<string, string>; // Field name -> regex pattern mapping
  smart_variables: SmartVariableWithFallback[]; // Enhanced with regex fallback
  created_by?: string | null;
  organization_id?: string; // Organization this template belongs to
  created_at?: string;
  updated_at?: string;
}

// Extraction result interface
export interface ExtractionResult {
  field_name: string;
  value: any;
  extraction_method: 'ai' | 'regex' | 'failed';
  confidence: number;
  source_pattern?: string;
}

export interface SmartTemplateStats {
  total_templates: number;
  user_templates: number;
  public_templates: number;
  templates_by_category: Record<string, number>;
  most_used_templates: Array<{
    id: number;
    name: string;
    usage_count: number;
  }>;
  highest_rated_templates: Array<{
    id: number;
    name: string;
    rating: number;
  }>;
}

class TemplateService {
  /**
   * Get all smart templates (public + user's private)
   */
  async getTemplates(): Promise<SmartTemplate[]> {
    return withAuthentication(async (user) => {
      console.log('[SmartTemplateService] Auth status:', {
        hasUser: !!user,
        userId: user.id ? user.id.substring(0, 8) + '...' : null
      });

      const query = supabase
        .from('smart_templates')
        .select('*')
        .order('usage_count', { ascending: false });

      // Get public + their private templates
      query.or(`is_public.eq.true,created_by.eq.${user.id}`);

      const { data, error } = await query;

      if (error) {
        console.error('Error loading smart templates:', error);
        
        // If the table doesn't exist (404), return empty array instead of throwing
        if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('404')) {
          console.warn('Smart templates table does not exist yet. Please run the database migration.');
          return [];
        }
        
        throw error;
      }

      return data || [];
    }, 'getSmartTemplates');
  }

  /**
   * Get a single smart template by ID
   */
  async getTemplate(id: number): Promise<SmartTemplate | null> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('smart_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error loading smart template:', error);
        throw error;
      }

      return data;
    }, 'getSmartTemplate');
  }

  /**
   * Create a new smart template
   * @param templateData Template data including required organization_id
   */
  async createTemplate(templateData: Omit<SmartTemplate, 'id' | 'uuid' | 'created_at' | 'updated_at'> & { organization_id: string }): Promise<SmartTemplate> {
    return withAuthentication(async (user) => {

      // Validate template data
      if (!templateData.name || !templateData.category || !templateData.smart_variables) {
        throw new Error('Missing required template fields');
      }

      if (!templateData.organization_id) {
        throw new Error('organization_id is required to create a template');
      }

      const { data, error } = await supabase
        .from('smart_templates')
        .insert([
          {
            name: templateData.name,
            description: templateData.description || '',
            template_content: templateData.template_content || '',
            template_type: templateData.template_type || 'markdown',
            category: templateData.category,
            tags: templateData.tags || [],
            is_public: templateData.is_public || false,
            smart_variables: templateData.smart_variables,
            extraction_rules: templateData.extraction_rules || [],
            generation_settings: templateData.generation_settings || {},
            created_by: user.id,
            organization_id: templateData.organization_id,
            usage_count: 0,
            rating: 0.0
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating smart template:', error);
        throw error;
      }

      return data;
    }, 'createSmartTemplate');
  }

  /**
   * Update an existing smart template
   */
  async updateTemplate(id: number, updates: Partial<SmartTemplate>): Promise<SmartTemplate> {
    return withAuthentication(async (user) => {
      // Remove readonly fields and work with a mutable payload
      const { id: _omitId, uuid, created_at, updated_at, created_by: _omitCreatedBy, ...rest } = updates as any;
      const updateData: Record<string, any> = { ...rest };

      // Check if the template exists and get its creator
      const { data: existingTemplate, error: fetchError } = await supabase
        .from('smart_templates')
        .select('id, created_by')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching template for update:', fetchError);
        throw fetchError;
      }

      if (!existingTemplate) {
        throw new Error(`Template with ID ${id} not found`);
      }

      // If template has no creator, set the current user as creator
      if (!existingTemplate.created_by) {
        updateData.created_by = user.id;
      }

      const { data, error } = await supabase
        .from('smart_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating smart template:', error);
        throw error;
      }

      return data;
    }, 'updateSmartTemplate');
  }

  /**
   * Delete a smart template
   */
  async deleteTemplate(id: number): Promise<void> {
    return withAuthentication(async (user) => {
      const { error } = await supabase
        .from('smart_templates')
        .delete()
        .eq('id', id)
        .eq('created_by', user.id); // Ensure user can only delete their own templates

      if (error) {
        console.error('Error deleting smart template:', error);
        throw error;
      }
    }, 'deleteSmartTemplate');
  }

  /**
   * Duplicate a smart template
   * @param id Template ID to duplicate
   * @param organizationId Organization to create the duplicate in (required)
   * @param newName Optional new name for the duplicate
   */
  async duplicateTemplate(id: number, organizationId: string, newName?: string): Promise<SmartTemplate> {
    const originalTemplate = await this.getTemplate(id);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    if (!organizationId) {
      throw new Error('organization_id is required to duplicate a template');
    }

    const duplicateData = {
      ...originalTemplate,
      name: newName || `${originalTemplate.name} (Copy)`,
      is_public: false, // Always make duplicates private
      usage_count: 0,
      rating: 0,
      organization_id: organizationId
    };

    // Remove readonly fields
    delete duplicateData.id;
    delete duplicateData.uuid;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;
    delete duplicateData.created_by;

    return this.createTemplate(duplicateData as Omit<SmartTemplate, 'id' | 'uuid' | 'created_at' | 'updated_at'> & { organization_id: string });
  }

  /**
   * Increment usage count for a template
   */
  async incrementUsage(id: number): Promise<void> {
    const { error } = await supabase.rpc('increment_template_usage', {
      template_id: id
    });

    if (error) {
      console.error('Error incrementing template usage:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(id: number, rating: number): Promise<void> {
    console.warn('Template rating functionality has been removed from the system');
    // Rating functionality disabled - table was removed in migration 006
  }

  /**
   * Update template's average rating (deprecated - rating functionality removed)
   */
  private async updateTemplateRating(id: number): Promise<void> {
    // No-op - rating functionality has been removed
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string): Promise<SmartTemplate[]> {
    return withAuthentication(async (user) => {
      const query = supabase
        .from('smart_templates')
        .select('*')
        .eq('category', category)
        .order('rating', { ascending: false });

      query.or(`is_public.eq.true,created_by.eq.${user.id}`);

      const { data, error } = await query;

      if (error) {
        console.error('Error loading templates by category:', error);
        throw error;
      }

      return data || [];
    }, 'getSmartTemplatesByCategory');
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string): Promise<SmartTemplate[]> {
    return withAuthentication(async (user) => {
      const searchQuery = supabase
        .from('smart_templates')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('usage_count', { ascending: false });

      searchQuery.or(`is_public.eq.true,created_by.eq.${user.id}`);

      const { data, error } = await searchQuery;

      if (error) {
        console.error('Error searching templates:', error);
        throw error;
      }

      return data || [];
    }, 'searchSmartTemplates');
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(): Promise<SmartTemplateStats> {
    return withAuthentication(async (user) => {

      // Get total counts
      const { count: totalTemplates } = await supabase
        .from('smart_templates')
        .select('*', { count: 'exact', head: true });

      const { count: publicTemplates } = await supabase
        .from('smart_templates')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);

      const { count: userTemplates } = await supabase
        .from('smart_templates')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);

      // Get templates by category
      const { data: categoryData } = await supabase
        .from('smart_templates')
        .select('category')
        .eq('is_public', true);

      const templatesByCategory: Record<string, number> = {};
      categoryData?.forEach(template => {
        templatesByCategory[template.category] = (templatesByCategory[template.category] || 0) + 1;
      });

      // Get most used templates
      const { data: mostUsed } = await supabase
        .from('smart_templates')
        .select('id, name, usage_count')
        .eq('is_public', true)
        .order('usage_count', { ascending: false })
        .limit(5);

      // Get highest rated templates
      const { data: highestRated } = await supabase
        .from('smart_templates')
        .select('id, name, rating')
        .eq('is_public', true)
        .order('rating', { ascending: false })
        .limit(5);

      return {
        total_templates: totalTemplates || 0,
        user_templates: userTemplates || 0,
        public_templates: publicTemplates || 0,
        templates_by_category: templatesByCategory,
        most_used_templates: mostUsed || [],
        highest_rated_templates: highestRated || []
      };
    }, 'getSmartTemplateStats');
  }

  /**
   * Extract variables from document text using AI-first, regex fallback approach
   */
  async extractVariables(
    documentText: string, 
    template: SmartTemplate
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    
    for (const variable of template.smart_variables) {
      try {
        // Try AI extraction first (if available)
        const aiResult = await this.extractWithAI(documentText, variable);
        if (aiResult && aiResult.confidence >= (variable.confidence_threshold || 0.6)) {
          results.push({
            field_name: variable.name,
            value: aiResult.value,
            extraction_method: 'ai',
            confidence: aiResult.confidence
          });
          continue;
        }
      } catch (error) {
        console.warn(`AI extraction failed for ${variable.name}:`, error);
      }
      
      // Fallback to regex extraction
      const regexResult = this.extractWithRegex(
        documentText, 
        variable.name,
        variable.regex_fallback || template.regex_fallback?.[variable.name]
      );
      
      if (regexResult) {
        results.push({
          field_name: variable.name,
          value: regexResult.value,
          extraction_method: 'regex',
          confidence: 0.8, // High confidence for successful regex match
          source_pattern: regexResult.pattern
        });
      } else {
        // Extraction failed completely
        results.push({
          field_name: variable.name,
          value: null,
          extraction_method: 'failed',
          confidence: 0.0
        });
      }
    }
    
    return results;
  }

  /**
   * Extract using AI/LLM (placeholder - integrate with document processor API)
   */
  private async extractWithAI(
    text: string, 
    variable: SmartVariableWithFallback
  ): Promise<{ value: any; confidence: number } | null> {
    // TODO: Integrate with document processor's smart extraction endpoint
    // For now, return null to always fall back to regex
    return null;
  }

  /**
   * Extract using regex patterns
   */
  private extractWithRegex(
    text: string,
    fieldName: string, 
    pattern?: string
  ): { value: any; pattern: string } | null {
    if (!pattern) {
      return null;
    }
    
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = text.match(regex);
      
      if (matches && matches.length > 0) {
        // Return the first capture group if available, otherwise the full match
        const match = matches[0];
        const captureGroups = match.match(new RegExp(pattern, 'i'));
        const value = captureGroups && captureGroups[1] ? captureGroups[1] : match;
        
        return {
          value: value.trim(),
          pattern
        };
      }
    } catch (error) {
      console.error(`Regex extraction failed for ${fieldName}:`, error);
    }
    
    return null;
  }

  /**
   * Generate a new document using extracted variables and template
   */
  async generateDocument(
    template: SmartTemplate,
    extractedVariables: Record<string, any>,
    outputFormat: 'html' | 'markdown' | 'pdf' = 'html'
  ): Promise<string> {
    // Simple template substitution for now
    let generatedContent: string = template.template_content ?? '';
    
    // Replace {{variable_name}} placeholders with extracted values
    Object.entries(extractedVariables).forEach(([fieldName, value]) => {
      const placeholder = new RegExp(`\\{\\{\\s*${fieldName}\\s*\\}\\}`, 'g');
      generatedContent = generatedContent.replace(placeholder, value || '');
    });
    
    // TODO: Integrate with more sophisticated template engines (handlebars, mustache)
    // TODO: Add workflow-based generation for templates with generation_settings.type === 'workflow'
    
    return generatedContent;
  }

  /**
   * Validate template before saving
   */
  validateTemplate(template: Partial<SmartTemplate>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.category) {
      errors.push('Template category is required');
    }

    if (!template.smart_variables || template.smart_variables.length === 0) {
      errors.push('At least one smart variable is required');
    }

    // Validate smart variables
    template.smart_variables?.forEach((variable, index) => {
      if (!variable.id) {
        errors.push(`Smart variable ${index + 1} is missing an ID`);
      }
      if (!variable.name) {
        errors.push(`Smart variable ${index + 1} is missing a name`);
      }
      if (!variable.type) {
        errors.push(`Smart variable ${index + 1} is missing a type`);
      }
      if (!variable.extraction_hints || variable.extraction_hints.length === 0) {
        errors.push(`Smart variable ${index + 1} needs at least one extraction hint`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const templateService = new TemplateService();
export const smartTemplateService = templateService; // Backward compatibility alias
export default templateService;