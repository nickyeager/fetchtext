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

    // Transform to SmartTemplate format
    const smartTemplates: SmartTemplate[] = (data || []).map((template) => ({
      ...template,
      smart_variables: template.variables || [],
      extraction_rules: [],
      generation_settings: {},
      category: template.category || 'general',
      tags: template.tags || [],
      usage_count: template.usage_count || 0,
      rating: 4.2, // Mock rating - you can calculate from ratings table
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
          // Add other default fields as necessary
          variables: [], // Default empty array for smart variables
          tags: [],
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
};
