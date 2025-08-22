/**
 * Smart Template Service
 * Handles CRUD operations for smart templates with proper database integration
 */
import { supabase } from '@/lib/supabase';
import { withAuthentication } from '@/lib/supabase-auth-utils';
import { Template, SmartVariable } from '@/lib/template-validator';

export interface SmartTemplate extends Template {
  id?: number;
  uuid?: string;
  template_content: string;
  template_type: string;
  tags: string[];
  is_public: boolean;
  usage_count?: number;
  rating?: number;
  thumbnail_url?: string | null;
  extraction_rules?: any[];
  generation_settings?: any;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
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

class SmartTemplateService {
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
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null;
        }
        console.error('Error loading smart template:', error);
        throw error;
      }

      return data;
    }, 'getSmartTemplate');
  }

  /**
   * Create a new smart template
   */
  async createTemplate(templateData: Omit<SmartTemplate, 'id' | 'uuid' | 'created_at' | 'updated_at'>): Promise<SmartTemplate> {
    return withAuthentication(async (user) => {

      // Validate template data
      if (!templateData.name || !templateData.category || !templateData.smart_variables) {
        throw new Error('Missing required template fields');
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
      // Remove readonly fields
      const { id: _, uuid, created_at, updated_at, created_by, ...updateData } = updates;

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
   */
  async duplicateTemplate(id: number, newName?: string): Promise<SmartTemplate> {
    const originalTemplate = await this.getTemplate(id);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    const duplicateData = {
      ...originalTemplate,
      name: newName || `${originalTemplate.name} (Copy)`,
      is_public: false, // Always make duplicates private
      usage_count: 0,
      rating: 0
    };

    // Remove readonly fields
    delete duplicateData.id;
    delete duplicateData.uuid;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;
    delete duplicateData.created_by;

    return this.createTemplate(duplicateData);
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
export const smartTemplateService = new SmartTemplateService();
export default smartTemplateService;