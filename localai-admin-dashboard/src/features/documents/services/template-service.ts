import { supabase } from '@/lib/supabase';
import { NewTemplate, SmartTemplate } from '@/features/documents/types';

export const DocumentTemplateService = {
  getTemplates: async (): Promise<SmartTemplate[]> => {
    const { data: userResponse } = await supabase.auth.getUser();
    const userId = userResponse.user?.id;

    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .or(`is_public.eq.true,created_by.eq.${userId}`)
      .order('usage_count', { ascending: false });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading templates:', error);
      throw error;
    }

    // Transform data from templates table to SmartTemplate format
    const smartTemplates: SmartTemplate[] = (data || []).map((template) => ({
      ...template,
      smart_variables: template.variables || [],
      extraction_rules: template.extraction_rules || [],
      generation_settings: template.generation_settings || {},
      category: template.category || 'Other',
      tags: template.tags || [],
      usage_count: template.usage_count || 0
    }));

    return smartTemplates;
  },

  createTemplate: async (templateData: NewTemplate): Promise<SmartTemplate> => {
    const { data: userResponse } = await supabase.auth.getUser();
    const userId = userResponse.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('templates')
      .insert([
        {
          ...templateData,
          created_by: userId,
          is_public: false, // Default to private
          variables: templateData.smart_variables || [],
          extraction_rules: templateData.extraction_rules || [],
          generation_settings: templateData.generation_settings || {},
          category: templateData.category || 'Other',
          tags: templateData.tags || [],
          usage_count: 0,
          rating: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating template:', error);
      throw error;
    }

    // Transform to SmartTemplate format
    const newTemplate: SmartTemplate = {
      ...data,
      smart_variables: data.variables || [],
      extraction_rules: [],
      generation_settings: {},
      category: data.category || 'general',
      tags: data.tags || [],
      usage_count: data.usage_count || 0,
      rating: 4.2, // Mock rating
    };

    return newTemplate;
  },

  getTemplateById: async (templateId: string | number): Promise<SmartTemplate> => {
    const { data: userResponse } = await supabase.auth.getUser();
    const userId = userResponse.user?.id;

    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .or(`is_public.eq.true,created_by.eq.${userId}`)
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading template:', error);
      throw new Error(`Template not found: ${error.message}`);
    }

    if (!data) {
      throw new Error('Template not found');
    }

    // Transform to SmartTemplate format
    const smartTemplate: SmartTemplate = {
      ...data,
      smart_variables: data.variables || [],
      extraction_rules: [],
      generation_settings: {},
      category: data.category || 'general',
      tags: data.tags || [],
      usage_count: data.usage_count || 0,
      rating: 4.2, // Mock rating - you can calculate from ratings table
    };

    return smartTemplate;
  },
};
