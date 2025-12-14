/**
 * CreateTemplateFromFields Component
 * 
 * Dialog for creating a reusable template from extracted document fields.
 * Allows users to configure template properties and field definitions.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Save,
  AlertTriangle,
  CheckCircle,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

interface ExtractedField {
  id: string;
  name: string;
  value: string;
  confidence?: number;
  type?: 'text' | 'number' | 'currency' | 'date' | 'email' | 'phone';
  sourceText?: string;
  required?: boolean;
}

interface TemplateField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  extraction_hints: string[];
  default_value: string;
  confidence_threshold: number;
}

interface CreateTemplateFromFieldsProps {
  isOpen: boolean;
  onClose: () => void;
  fields: ExtractedField[];
  documentType?: string;
  documentName?: string;
  onCreateTemplate: (templateData: {
    name: string;
    description: string;
    category: string;
    smart_variables: TemplateField[];
    is_public: boolean;
  }) => Promise<void>;
}

const TEMPLATE_CATEGORIES = [
  'invoice',
  'receipt',
  'contract',
  'report', 
  'form',
  'letter',
  'medical',
  'legal',
  'financial',
  'business',
  'other'
];

export function CreateTemplateFromFields({
  isOpen,
  onClose,
  fields,
  documentType = 'unknown',
  documentName = '',
  onCreateTemplate
}: CreateTemplateFromFieldsProps) {
  const [templateName, setTemplateName] = useState(() => {
    const baseName = documentName ? documentName.replace(/\.[^/.]+$/, '') : documentType;
    return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} Template`;
  });
  
  const [templateDescription, setTemplateDescription] = useState(() => 
    `Template for ${documentType} documents, created from field extraction`
  );
  
  const [templateCategory, setTemplateCategory] = useState(() => 
    TEMPLATE_CATEGORIES.includes(documentType) ? documentType : 'other'
  );
  
  const [isPublic, setIsPublic] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(fields.filter(f => f.confidence > 0.3).map(f => f.id))
  );
  const [fieldConfigs, setFieldConfigs] = useState<Record<string, TemplateField>>(() => {
    return fields.reduce((acc, field) => {
      acc[field.id] = {
        name: field.name,
        type: field.type || 'text',
        description: `Extracted ${field.name.replace(/_/g, ' ')} field`,
        required: field.required || false,
        extraction_hints: generateExtractionHints(field),
        default_value: '',
        confidence_threshold: Math.max(0.5, field.confidence || 0.3)
      };
      return acc;
    }, {} as Record<string, TemplateField>);
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generateExtractionHints(field: ExtractedField): string[] {
    const hints: string[] = [];
    
    // Add field name variations
    const fieldName = field.name.toLowerCase();
    hints.push(fieldName);
    hints.push(fieldName.replace(/_/g, ' '));
    hints.push(fieldName.replace(/_/g, '-'));
    
    // Add type-specific hints
    switch (field.type) {
      case 'currency':
        hints.push('$', 'amount', 'total', 'price', 'cost');
        break;
      case 'date':
        hints.push('date', 'day', 'month', 'year');
        break;
      case 'email':
        hints.push('@', 'email', 'mail');
        break;
      case 'phone':
        hints.push('phone', 'tel', 'mobile');
        break;
    }
    
    // Add hints from source text
    if (field.sourceText) {
      const words = field.sourceText.toLowerCase().match(/\w+/g) || [];
      hints.push(...words.filter(w => w.length > 2));
    }
    
    return [...new Set(hints)]; // Remove duplicates
  }

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(fieldId);
      } else {
        newSet.delete(fieldId);
      }
      return newSet;
    });
  };

  const handleFieldConfigChange = (fieldId: string, property: keyof TemplateField, value: any) => {
    setFieldConfigs(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [property]: value
      }
    }));
  };

  const handleCreateTemplate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Validate inputs
      if (!templateName.trim()) {
        throw new Error('Template name is required');
      }
      
      if (selectedFields.size === 0) {
        throw new Error('At least one field must be selected');
      }

      // Build smart variables from selected fields
      const smartVariables: TemplateField[] = Array.from(selectedFields)
        .map(fieldId => {
          const field = fields.find(f => f.id === fieldId);
          if (!field) return null;
          
          return fieldConfigs[fieldId];
        })
        .filter(Boolean) as TemplateField[];

      // Create template
      await onCreateTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        category: templateCategory,
        smart_variables: smartVariables,
        is_public: isPublic
      });

      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create template');
    } finally {
      setIsCreating(false);
    }
  };

  const formatFieldName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create Template from Extracted Fields
          </DialogTitle>
          <DialogDescription>
            Create a reusable template based on the fields extracted from this document. 
            This template can be used to process similar documents in the future.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Template Basic Info */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                <div>
                  <Label htmlFor="template-category">Category</Label>
                  <Select value={templateCategory} onValueChange={setTemplateCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe what this template is for"
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-public"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(!!checked)}
                />
                <Label htmlFor="is-public" className="text-sm">
                  Make this template public (available to all users)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Field Selection */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Select Fields for Template</h3>
                  <p className="text-sm text-gray-500">
                    Choose which extracted fields to include in your template
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2"
                >
                  {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map(field => (
                  <div key={field.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedFields.has(field.id)}
                        onCheckedChange={(checked) => handleFieldToggle(field.id, !!checked)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatFieldName(field.name)}</span>
                            <Badge variant="outline">{field.type}</Badge>
                            {field.confidence > 0 && (
                              <Badge variant="secondary">
                                {Math.round(field.confidence * 100)}% confident
                              </Badge>
                            )}
                            {field.required && (
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                Required
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          <strong>Value:</strong> {field.value || <em>No value</em>}
                        </div>

                        {showAdvanced && selectedFields.has(field.id) && (
                          <div className="space-y-3 pt-3 border-t bg-gray-50 dark:bg-gray-900 rounded p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Field Description</Label>
                                <Input
                                  value={fieldConfigs[field.id]?.description || ''}
                                  onChange={(e) => handleFieldConfigChange(field.id, 'description', e.target.value)}
                                  placeholder="Describe this field"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Confidence Threshold</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={fieldConfigs[field.id]?.confidence_threshold || 0.5}
                                  onChange={(e) => handleFieldConfigChange(field.id, 'confidence_threshold', parseFloat(e.target.value))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Extraction Hints (comma-separated)</Label>
                              <Input
                                value={fieldConfigs[field.id]?.extraction_hints?.join(', ') || ''}
                                onChange={(e) => handleFieldConfigChange(field.id, 'extraction_hints', e.target.value.split(',').map(s => s.trim()))}
                                placeholder="Keywords to help find this field"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-500 text-center">
                {selectedFields.size} of {fields.length} fields selected
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate} 
              disabled={isCreating || selectedFields.size === 0}
              className="flex items-center gap-2"
            >
              {isCreating ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Create Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}