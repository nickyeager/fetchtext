/**
 * Master Template Service
 * 
 * Unified interface for all template types (Smart, Standard, Workflow)
 * This service provides a single interface to query across all template types
 * and manages the unified template data model.
 */

import { supabase } from '@/lib/supabase';
import { smartTemplateService, SmartTemplate } from './smart-template-service';
import { 
  UnifiedTemplate, 
  TemplateFilters, 
  isSmartTemplate,
  isStandardTemplate,
  isWorkflowTemplate,
  TemplatePayload 
} from '@/types/unified-template';

// Standard template interface (for templates table)
interface StandardTemplate {
  id: number;
  uuid?: string;
  name: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  is_public: boolean;
  usage_count?: number;
  rating?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  fields?: any[];
}

// Workflow template interface (for workflow_templates table)
interface WorkflowTemplate {
  id: number;
  uuid?: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  is_public: boolean;
  usage_count?: number;
  rating?: number;
  workflow_config: any;
  documentation?: string;
  input_schema?: any;
  output_schema?: any;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

class MasterTemplateService {
  /**
   * Get all templates across all types with unified filtering
   */
  async getTemplates(filters: TemplateFilters = {}): Promise<UnifiedTemplate[]> {
    const results: UnifiedTemplate[] = [];

    try {
      // Get smart templates
      if (!filters.type || filters.type.includes('smart')) {
        const smartTemplates = await this.getSmartTemplates(filters);
        results.push(...smartTemplates);
      }

      // Get standard templates
      if (!filters.type || filters.type.includes('standard')) {
        const standardTemplates = await this.getStandardTemplates(filters);
        results.push(...standardTemplates);
      }

      // Get workflow templates
      if (!filters.type || filters.type.includes('workflow')) {
        const workflowTemplates = await this.getWorkflowTemplates(filters);
        results.push(...workflowTemplates);
      }

      // Apply search filter if provided
      let filteredResults = results;
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredResults = results.filter(template =>
          template.name.toLowerCase().includes(searchTerm) ||
          template.description.toLowerCase().includes(searchTerm) ||
          template.category.toLowerCase().includes(searchTerm) ||
          (template.tags || []).some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      // Apply category filter if provided
      if (filters.category && filters.category.length > 0) {
        filteredResults = filteredResults.filter(template =>
          filters.category!.includes(template.category)
        );
      }

      // Sort results
      const sortField = filters.sort_by || 'updated_at';
      const sortOrder = filters.sort_order || 'desc';
      
      filteredResults.sort((a, b) => {
        let aValue: any = a[sortField as keyof UnifiedTemplate];
        let bValue: any = b[sortField as keyof UnifiedTemplate];

        // Handle undefined values
        if (aValue === undefined) aValue = 0;
        if (bValue === undefined) bValue = 0;

        // Handle dates
        if (sortField === 'created_at' || sortField === 'updated_at') {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (sortOrder === 'desc') {
          return bValue - aValue;
        } else {
          return aValue - bValue;
        }
      });

      // Apply pagination if provided
      if (filters.limit) {
        const offset = filters.offset || 0;
        filteredResults = filteredResults.slice(offset, offset + filters.limit);
      }

      return filteredResults;
    } catch (error) {
      console.error('Error fetching unified templates:', error);
      return [];
    }
  }

  /**
   * Get a single template by ID and type
   */
  async getTemplate(id: string | number, type: 'smart' | 'standard' | 'workflow'): Promise<UnifiedTemplate | null> {
    try {
      switch (type) {
        case 'smart':
          const smartTemplate = await smartTemplateService.getTemplate(Number(id));
          return smartTemplate ? this.convertSmartToUnified(smartTemplate) : null;

        case 'standard':
          return await this.getStandardTemplate(Number(id));

        case 'workflow':
          return await this.getWorkflowTemplate(Number(id));

        default:
          return null;
      }
    } catch (error) {
      console.error(`Error fetching ${type} template ${id}:`, error);
      return null;
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string | number, payload: TemplatePayload): Promise<UnifiedTemplate> {
    const { type } = payload;
    
    switch (type) {
      case 'smart':
        const smartData = {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          tags: payload.tags || [],
          is_public: payload.is_public || false,
          template_content: payload.template_content || '',
          smart_variables: payload.smart_variables || [],
          extraction_config: payload.extraction_config
        };
        const updatedSmart = await smartTemplateService.updateTemplate(Number(templateId), smartData);
        return this.convertSmartToUnified(updatedSmart);

      case 'standard':
        return await this.updateStandardTemplate(Number(templateId), payload);

      case 'workflow':
        return await this.updateWorkflowTemplate(Number(templateId), payload);

      default:
        throw new Error(`Unknown template type: ${type}`);
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(payload: TemplatePayload): Promise<UnifiedTemplate> {
    const { type } = payload;
    
    switch (type) {
      case 'smart':
        const smartData = {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          tags: payload.tags || [],
          is_public: payload.is_public || false,
          template_content: payload.template_content || '',
          template_type: 'markdown',
          smart_variables: payload.smart_variables || [],
          extraction_config: payload.extraction_config
        };
        const newSmart = await smartTemplateService.createTemplate(smartData);
        return this.convertSmartToUnified(newSmart);

      case 'standard':
        return await this.createStandardTemplate(payload);

      case 'workflow':
        return await this.createWorkflowTemplate(payload);

      default:
        throw new Error(`Unknown template type: ${type}`);
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string | number, type: 'smart' | 'standard' | 'workflow'): Promise<void> {
    switch (type) {
      case 'smart':
        await smartTemplateService.deleteTemplate(Number(id));
        break;
      case 'standard':
        await this.deleteStandardTemplate(Number(id));
        break;
      case 'workflow':
        await this.deleteWorkflowTemplate(Number(id));
        break;
      default:
        throw new Error(`Unknown template type: ${type}`);
    }
  }

  // Private methods for handling specific template types

  private async getSmartTemplates(filters: TemplateFilters): Promise<UnifiedTemplate[]> {
    try {
      const smartTemplates = await smartTemplateService.getTemplates();
      return smartTemplates.map(template => this.convertSmartToUnified(template));
    } catch (error) {
      console.error('Error fetching smart templates:', error);
      return [];
    }
  }

  private async getStandardTemplates(filters: TemplateFilters): Promise<UnifiedTemplate[]> {
    try {
      const { data: userResponse } = await supabase.auth.getUser();
      const userId = userResponse.user?.id;

      const query = supabase
        .from('templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userId) {
        query.or(`is_public.eq.true,created_by.eq.${userId}`);
      } else {
        query.eq('is_public', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading standard templates:', error);
        return [];
      }

      return (data || []).map(template => this.convertStandardToUnified(template));
    } catch (error) {
      console.error('Error in getStandardTemplates:', error);
      return [];
    }
  }

  private async getWorkflowTemplates(filters: TemplateFilters): Promise<UnifiedTemplate[]> {
    try {
      const { data: userResponse } = await supabase.auth.getUser();
      const userId = userResponse.user?.id;

      const query = supabase
        .from('workflow_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userId) {
        query.or(`is_public.eq.true,created_by.eq.${userId}`);
      } else {
        query.eq('is_public', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading workflow templates:', error);
        return [];
      }

      return (data || []).map(template => this.convertWorkflowToUnified(template));
    } catch (error) {
      console.error('Error in getWorkflowTemplates:', error);
      return [];
    }
  }

  private async getStandardTemplate(id: number): Promise<UnifiedTemplate | null> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.convertStandardToUnified(data);
  }

  private async getWorkflowTemplate(id: number): Promise<UnifiedTemplate | null> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.convertWorkflowToUnified(data);
  }

  private async updateStandardTemplate(id: number, payload: TemplatePayload): Promise<UnifiedTemplate> {
    const { data, error } = await supabase
      .from('templates')
      .update({
        name: payload.name,
        description: payload.description,
        category: payload.category,
        tags: payload.tags || [],
        is_public: payload.is_public || false,
        content: payload.content || '',
        fields: payload.fields || []
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.convertStandardToUnified(data);
  }

  private async updateWorkflowTemplate(id: number, payload: TemplatePayload): Promise<UnifiedTemplate> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .update({
        name: payload.name,
        description: payload.description,
        category: payload.category,
        tags: payload.tags || [],
        is_public: payload.is_public || false,
        workflow_config: payload.workflow_config || {},
        documentation: payload.metadata?.documentation
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.convertWorkflowToUnified(data);
  }

  private async createStandardTemplate(payload: TemplatePayload): Promise<UnifiedTemplate> {
    const { data: userResponse } = await supabase.auth.getUser();
    const userId = userResponse.user?.id;

    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('templates')
      .insert([{
        name: payload.name,
        description: payload.description,
        category: payload.category,
        tags: payload.tags || [],
        is_public: payload.is_public || false,
        content: payload.content || '',
        fields: payload.fields || [],
        created_by: userId,
        usage_count: 0,
        rating: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return this.convertStandardToUnified(data);
  }

  private async createWorkflowTemplate(payload: TemplatePayload): Promise<UnifiedTemplate> {
    const { data: userResponse } = await supabase.auth.getUser();
    const userId = userResponse.user?.id;

    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('workflow_templates')
      .insert([{
        name: payload.name,
        description: payload.description,
        category: payload.category,
        tags: payload.tags || [],
        is_public: payload.is_public || false,
        workflow_config: payload.workflow_config || {},
        documentation: payload.metadata?.documentation,
        created_by: userId,
        usage_count: 0,
        rating: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return this.convertWorkflowToUnified(data);
  }

  private async deleteStandardTemplate(id: number): Promise<void> {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  private async deleteWorkflowTemplate(id: number): Promise<void> {
    const { error } = await supabase
      .from('workflow_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Conversion methods to unified format

  private convertSmartToUnified(template: SmartTemplate): UnifiedTemplate {
    return {
      ...template,
      type: 'smart' as const,
      id: template.id || 0
    };
  }

  private convertStandardToUnified(template: StandardTemplate): UnifiedTemplate {
    return {
      id: template.id,
      uuid: template.uuid,
      name: template.name,
      description: template.description,
      category: template.category,
      type: 'standard' as const,
      usage_count: template.usage_count,
      rating: template.rating,
      tags: template.tags,
      is_public: template.is_public,
      created_at: template.created_at,
      updated_at: template.updated_at,
      created_by: template.created_by,
      content: template.content,
      fields: template.fields || []
    };
  }

  private convertWorkflowToUnified(template: WorkflowTemplate): UnifiedTemplate {
    return {
      id: template.id,
      uuid: template.uuid,
      name: template.name,
      description: template.description,
      category: template.category,
      type: 'workflow' as const,
      usage_count: template.usage_count,
      rating: template.rating,
      tags: template.tags,
      is_public: template.is_public,
      created_at: template.created_at,
      updated_at: template.updated_at,
      created_by: template.created_by,
      workflow_config: template.workflow_config,
      input_schema: template.input_schema,
      output_schema: template.output_schema,
      documentation: template.documentation
    };
  }
}

// Export singleton instance
export const masterTemplateService = new MasterTemplateService();
export default masterTemplateService;