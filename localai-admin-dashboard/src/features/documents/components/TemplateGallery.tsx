import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Search, Plus, Eye, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { masterTemplateService } from '@/services/master-template-service';
import { TemplateSelectionItem } from '../index';
import { UnifiedTemplate } from '@/types/unified-template';

interface ValidationRule {
  type: string;
  value: string | number;
  message: string;
}

interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  description: string;
  extraction_hints: string[];
  validation_rules?: ValidationRule[];
  default_value?: string | number;
}

interface ExtractionRule {
  variable_id: string;
  ai_prompt: string;
  fallback_rules: string[];
  confidence_threshold: number;
}

interface GenerationSettings {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

interface SmartTemplate {
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

interface TemplateGalleryProps {
  onSelectTemplate: (template: TemplateSelectionItem) => void;
  onCreateTemplate: () => void;
}

// Helper function to convert UnifiedTemplate to TemplateSelectionItem
const convertToSelectionItem = (template: UnifiedTemplate): TemplateSelectionItem => ({
  id: template.id,
  name: template.name,
  description: template.description,
  category: template.category,
  type: template.type,
  source: template.type, // source matches type for unified templates
  tags: template.tags || [],
  usageCount: template.usage_count || 0,
  rating: template.rating || 0,
  isSmartTemplate: template.type === 'smart',
  variableCount: template.smart_variables?.length || template.fields?.length || 0
});

export function TemplateGallery({ onSelectTemplate, onCreateTemplate }: TemplateGalleryProps) {
  const {
    data: templates = [],
    isLoading: loading,
    error,
  } = useQuery<TemplateSelectionItem[]>({
    queryKey: ['unified-templates'],
    queryFn: async () => {
      const unifiedTemplates = await masterTemplateService.getTemplates();
      return unifiedTemplates.map(convertToSelectionItem);
    },
  });

  const [filteredTemplates, setFilteredTemplates] = useState<TemplateSelectionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'business', 'legal', 'finance', 'hr', 'procurement', 'healthcare', 'insurance', 'other'];

  // Filter templates whenever dependencies change
  useEffect(() => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())),
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((template) => template.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  if (error) {
    return (
      <div className="text-center text-red-500 py-12">
        <p>Error loading templates. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-bold">Smart Document Templates</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Choose a template to automatically extract and populate data
              </CardDescription>
            </div>
            <Button onClick={onCreateTemplate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search-templates"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  onClick={() => handleSelectCategory(category)}
                  className="capitalize"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    {template.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {template.description}
                  </CardDescription>
                </div>
                <div className="flex gap-2 ml-2">
                  <Badge variant="secondary" className="text-xs">
                    {template.category}
                  </Badge>
                  {template.isSmartTemplate && (
                    <Badge variant="default" className="flex items-center gap-1 text-xs">
                      <Zap className="h-3 w-3" />
                      Smart
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {template.source === 'smart_templates' ? 'Smart Template' : 'Standard'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Template Stats */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{template.variableCount} fields</span>
                </div>
                {template.isSmartTemplate && (
                  <Badge variant="default" className="text-xs">
                    AI-Powered
                  </Badge>
                )}
              </div>

              {/* Template Description */}
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <p className="text-gray-600 line-clamp-2">
                  {template.description || 'No description available'}
                </p>
              </div>

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Additional Features Indicator */}
              {template.isSmartTemplate && (
                <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded text-xs">
                  <p className="text-blue-800 dark:text-blue-200">
                    <strong>Smart Features:</strong> AI extraction, confidence scores, real-time processing
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => onSelectTemplate(template)}
                  className="flex-1"
                  size="sm"
                >
                  Use Template
                </Button>
                <Button
                  onClick={() => console.log('Preview template:', template)}
                  variant="outline"
                  size="sm"
                  className="px-3"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && <p className="text-center text-gray-500">Loading templates...</p>}
      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no smart templates available. Try creating a new one.
          </p>
          <div className="mt-6">
            <Button onClick={onCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}