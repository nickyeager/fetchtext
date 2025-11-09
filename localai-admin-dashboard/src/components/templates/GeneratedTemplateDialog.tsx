import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Play, Plus, Trash2, Sparkles } from 'lucide-react';
import { SmartVariable } from '@/lib/template-validator';
import { useMutation } from '@tanstack/react-query';
import { templateService } from '@/services/template-service';
import { useNavigate } from '@tanstack/react-router';

interface GeneratedTemplate {
  template_id: string;
  template: {
    id?: number;
    name: string;
    description?: string;
    category: string;
    template_content?: string;
    smart_variables: SmartVariable[];
    tags?: string[];
    is_public?: boolean;
  };
  generation_metadata?: {
    ai_confidence?: number;
    fields_detected?: number;
    generation_method?: string;
    original_filename?: string;
  };
  validation_results?: {
    template_valid?: boolean;
    validation_warnings?: string[];
  };
  test_extraction?: {
    extraction_successful?: boolean;
    extracted_fields_count?: number;
    average_confidence?: number;
  };
}

interface GeneratedTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedTemplate: GeneratedTemplate | null;
  onSaveTemplate: (template: GeneratedTemplate) => Promise<void>;
  onUseTemplate: (template: GeneratedTemplate) => void;
  isLoading?: boolean;
}

const TEMPLATE_CATEGORIES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'contract', label: 'Contract' },
  { value: 'report', label: 'Report' },
  { value: 'form', label: 'Form' },
  { value: 'letter', label: 'Letter' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'general', label: 'General' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'address', label: 'Address' },
  { value: 'boolean', label: 'Yes/No' },
];

export function GeneratedTemplateDialog({
  open,
  onOpenChange,
  generatedTemplate,
  onSaveTemplate,
  onUseTemplate,
  isLoading = false
}: GeneratedTemplateDialogProps) {
  const navigate = useNavigate();
  const [templateData, setTemplateData] = useState<GeneratedTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize template data when dialog opens
  useEffect(() => {
    if (generatedTemplate && open) {
      // Ensure smart_variables is always an array
      const templateWithDefaults = {
        ...generatedTemplate,
        template: {
          ...generatedTemplate.template,
          smart_variables: generatedTemplate.template.smart_variables || []
        }
      };
      setTemplateData(templateWithDefaults);
    }
  }, [generatedTemplate, open]);

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: GeneratedTemplate) => {
      const savedTemplate = await templateService.createTemplate({
        name: template.template.name,
        description: template.template.description || '',
        category: template.template.category,
        template_content: template.template.template_content || '',
        template_type: 'smart',
        smart_variables: template.template.smart_variables,
        tags: template.template.tags || [],
        is_public: false,
        extraction_rules: (template.template.smart_variables || []).map(v => ({
          variable_id: v.id,
          extraction_method: 'ai_powered',
          confidence_threshold: 0.7
        })),
        generation_settings: {
          model: 'azure_openai',
          temperature: 0.3,
          max_tokens: 1000
        }
      });
      return savedTemplate;
    },
    onSuccess: (savedTemplate) => {
      // Navigate to template editor
      navigate({ 
        to: '/templates/$templateId/edit', 
        params: { templateId: String(savedTemplate.id ?? '') } 
      });
      onOpenChange(false);
    }
  });

  const handleSave = async () => {
    if (!templateData) return;
    
    setIsSaving(true);
    try {
      await saveTemplateMutation.mutateAsync(templateData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseWithoutSaving = () => {
    if (!templateData) return;
    onUseTemplate(templateData);
    onOpenChange(false);
  };

  const updateTemplateField = (field: keyof GeneratedTemplate['template'], value: any) => {
    if (!templateData) return;
    
    setTemplateData({
      ...templateData,
      template: {
        ...templateData.template,
        [field]: value
      }
    });
  };

  const updateVariable = (index: number, updates: Partial<SmartVariable>) => {
    if (!templateData) return;
    
    const newVariables = [...templateData.template.smart_variables];
    newVariables[index] = { ...newVariables[index], ...updates };
    
    updateTemplateField('smart_variables', newVariables);
  };

  const addVariable = () => {
    if (!templateData) return;
    
    const newVariable: SmartVariable = {
      id: `var_${Date.now()}`,
      name: 'new_field',
      type: 'text',
      description: 'New field description',
      extraction_hints: [''],
      confidence_threshold: 0.7
    };
    
    updateTemplateField('smart_variables', [...(templateData.template.smart_variables || []), newVariable]);
  };

  const removeVariable = (index: number) => {
    if (!templateData) return;
    
    const newVariables = (templateData.template.smart_variables || []).filter((_, i) => i !== index);
    updateTemplateField('smart_variables', newVariables);
  };

  if (!templateData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="generated-template-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI-Generated Template
          </DialogTitle>
          <DialogDescription>
            Review and customize the AI-generated template before saving or using it.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Generation Metadata */}
            {templateData.generation_metadata && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Generation Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {templateData.generation_metadata.fields_detected} fields detected
                    </Badge>
                    {templateData.generation_metadata.ai_confidence && (
                      <Badge variant="secondary">
                        {Math.round(templateData.generation_metadata.ai_confidence * 100)}% confidence
                      </Badge>
                    )}
                    <Badge variant="outline">
                      Source: {templateData.generation_metadata.original_filename}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Template Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateData.template.name}
                    onChange={(e) => updateTemplateField('name', e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    value={templateData.template.category}
                    onValueChange={(value) => updateTemplateField('category', value)}
                  >
                    <SelectTrigger id="template-category" data-testid="template-category-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value} data-testid={`category-${cat.value}`}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={templateData.template.description || ''}
                  onChange={(e) => updateTemplateField('description', e.target.value)}
                  placeholder="Describe what this template is for"
                  rows={2}
                />
              </div>
            </div>

            {/* Smart Variables */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Detected Fields</CardTitle>
                    <CardDescription>
                      Review and customize the fields that will be extracted
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addVariable}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(templateData.template.smart_variables || []).map((variable, index) => (
                    <div key={variable.id} className="border rounded-lg p-4 space-y-3" data-testid="template-field">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Field Name</Label>
                            <Input
                              value={variable.name}
                              onChange={(e) => updateVariable(index, { name: e.target.value })}
                              placeholder="field_name"
                              className="h-8"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={variable.type}
                              onValueChange={(value) => updateVariable(index, { type: value as SmartVariable['type'] })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Required</Label>
                            {/* Required toggle not supported in SmartVariable type */}
                          </div>
                        </div>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeVariable(index)}
                          className="ml-2 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={variable.description}
                          onChange={(e) => updateVariable(index, { description: e.target.value })}
                          placeholder="What this field contains"
                          className="h-8"
                        />
                      </div>
                      
                      {variable.extraction_hints && variable.extraction_hints.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">Hints:</span>
                          {variable.extraction_hints.map((hint) => (
                            <Badge key={hint} variant="secondary" className="text-xs">
                              {hint}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Test Extraction Results */}
            {templateData.test_extraction && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p>
                      Extraction: {templateData.test_extraction.extraction_successful ? 
                        <Badge variant="default" className="ml-1">Successful</Badge> : 
                        <Badge variant="destructive" className="ml-1">Failed</Badge>
                      }
                    </p>
                    {templateData.test_extraction.extracted_fields_count !== undefined && (
                      <p className="text-muted-foreground">
                        Extracted {templateData.test_extraction.extracted_fields_count} out of {(templateData.template.smart_variables || []).length} fields
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || saveTemplateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleUseWithoutSaving}
            disabled={isSaving || saveTemplateMutation.isPending}
          >
            <Play className="w-4 h-4 mr-2" />
            Use Without Saving
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || saveTemplateMutation.isPending || !templateData.template.name}
          >
            {(isSaving || saveTemplateMutation.isPending) ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save & Edit Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}