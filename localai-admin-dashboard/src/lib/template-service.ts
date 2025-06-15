import { supabase } from '@/lib/supabase';
import { WorkflowTemplate, WorkflowInstance } from '@/types/workflows';

// Template management functions
export class TemplateService {
  // Fetch all templates with ratings
  static async getTemplates(): Promise<WorkflowTemplate[]> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select(`
        *,
        template_categories(id, name, description, icon),
        template_ratings(rating, user_id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }

    return data || [];
  }

  // Get template by ID
  static async getTemplate(id: string): Promise<WorkflowTemplate | null> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select(`
        *,
        template_categories(id, name, description, icon),
        template_ratings(rating, user_id, comment, created_at)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data;
  }

  // Rate a template
  static async rateTemplate(templateId: string, rating: number, comment?: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to rate templates');
    }

    // Use upsert to handle both new ratings and updates
    const { error } = await supabase
      .from('template_ratings')
      .upsert({
        template_id: templateId,
        user_id: user.id,
        rating,
        comment
      }, {
        onConflict: 'template_id,user_id'
      });

    if (error) {
      console.error('Error rating template:', error);
      throw error;
    }

    return true;
  }

  // Create a workflow instance from a template
  static async useTemplate(templateId: string, name: string, configuration?: any): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to use templates');
    }

    const { data, error } = await supabase
      .from('workflow_instances')
      .insert({
        template_id: templateId,
        name,
        configuration: configuration || {},
        created_by: user.id
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating workflow instance:', error);
      throw error;
    }

    // Increment usage count
    await supabase.rpc('increment_template_usage', { template_id: templateId });

    return data.id;
  }

  // Creates a workflow instance from a template and returns the full instance data
  static async createWorkflowInstance(templateId: string, options: { name: string; configuration?: any }): Promise<WorkflowInstance> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to use templates');
    }

    const { data, error } = await supabase
      .from('workflow_instances')
      .insert({
        template_id: templateId,
        name: options.name,
        configuration: options.configuration || {},
        created_by: user.id
      })
      .select(`
        *,
        workflow_templates(id, name, template_type, description, thumbnail_url)
      `)
      .single();

    if (error) {
      console.error('Error creating workflow instance:', error);
      throw error;
    }

    // Increment usage count
    await supabase.rpc('increment_template_usage', { template_id: templateId });

    return data;
  }

  // Create a new template
  static async createTemplate(template: Omit<WorkflowTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'usage_count' | 'rating'>): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to create templates');
    }

    const { data, error } = await supabase
      .from('workflow_templates')
      .insert({
        name: template.name,
        description: template.description,
        category_id: template.category,
        template_type: template.templateType,
        difficulty_level: template.complexity,
        estimated_time_minutes: template.estimatedTimeMinutes,
        tags: template.tags,
        template_data: template.templateData,
        thumbnail_url: template.thumbnailUrl,
        n8n_workflow_id: template.n8nWorkflowId,
        created_by: user.id
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw error;
    }

    return data.id;
  }

  // Search templates
  static async searchTemplates(query: string): Promise<WorkflowTemplate[]> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select(`
        *,
        template_categories(id, name, description, icon),
        template_ratings(rating, user_id)
      `)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching templates:', error);
      throw error;
    }

    return data || [];
  }

  // Get user's template instances
  static async getUserInstances(): Promise<WorkflowInstance[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data, error } = await supabase
      .from('workflow_instances')
      .select(`
        *,
        workflow_templates(id, name, description, thumbnail_url)
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user instances:', error);
      throw error;
    }

    return data || [];
  }
}
