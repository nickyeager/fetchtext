import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Search, Plus, Eye, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DocumentTemplateService } from '../services/template-service';

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
  onSelectTemplate: (template: SmartTemplate) => void;
  onCreateTemplate: () => void;
}

export function TemplateGallery({ onSelectTemplate, onCreateTemplate }: TemplateGalleryProps) {
  const {
    data: templates = [],
    isLoading: loading,
    error,
  } = useQuery<SmartTemplate[]>({
    queryKey: ['document-templates'],
    queryFn: DocumentTemplateService.getTemplates,
  });

  const [filteredTemplates, setFilteredTemplates] = useState<SmartTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'business', 'legal', 'marketing', 'hr', 'finance', 'technical'];

  const filterTemplates = useCallback(() => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((template) => template.category.toLowerCase() === selectedCategory);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory]);

  useEffect(() => {
    filterTemplates();
  }, [filterTemplates]);

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
                {template.smart_variables.length > 0 && (
                  <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Smart
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Template Preview */}
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <p className="text-gray-600 line-clamp-3">
                  {template.template_content.substring(0, 120)}...
                </p>
              </div>

              {/* Smart Variables Preview */}
              {template.smart_variables.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Auto-extractable fields ({template.smart_variables.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {template.smart_variables.slice(0, 3).map((variable) => (
                      <Badge key={variable.id} variant="outline" className="text-xs">
                        {variable.name}
                      </Badge>
                    ))}
                    {template.smart_variables.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.smart_variables.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

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

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{template.usage_count} uses</span>
                <span>★ {template.rating.toFixed(1)}</span>
              </div>

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