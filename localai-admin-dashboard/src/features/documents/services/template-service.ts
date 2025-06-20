import { supabase } from '@/lib/supabase';
import { SmartTemplate } from '@/features/documents/types';

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
};
