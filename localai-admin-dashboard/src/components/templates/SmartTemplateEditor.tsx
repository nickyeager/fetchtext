/**
 * Smart Template Editor Component
 * Allows editing of smart templates with variables, validation, and AI-powered features
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Eye, EyeOff, AlertCircle, CheckCircle, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

// Import our validation system
import { TemplateValidationPanel } from './TemplateValidationPanel';
import { useTemplateValidator } from '@/hooks/use-template-validator';
import { Template, SmartVariable } from '@/lib/template-validator';

// Smart Template type (from our existing system)
interface SmartTemplate {
  id?: number;
  uuid?: string;
  name: string;
  description: string;
  template_content: string;
  template_type: string;
  category: string;
  smart_variables: SmartVariable[];
  tags: string[];
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SmartTemplateEditorProps {
  template?: SmartTemplate | null;
  onSave: (template: SmartTemplate) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
  isEditMode?: boolean;
}

export function SmartTemplateEditor({ 
  template, 
  onSave, 
  onCancel, 
  isNew = false,
  isEditMode = false
}: SmartTemplateEditorProps) {
  // Initialize template state
  const [currentTemplate, setCurrentTemplate] = useState<SmartTemplate>(() => {
    const baseTemplate = template || {
      name: '',
      description: '',
      template_content: '',
      template_type: 'markdown',
      category: 'general',
      smart_variables: [],
      tags: [],
      is_public: false
    };
    
    // Ensure all smart variables have confidence_threshold
    if (baseTemplate.smart_variables) {
      baseTemplate.smart_variables = baseTemplate.smart_variables.map(variable => ({
        ...variable,
        confidence_threshold: variable.confidence_threshold ?? 0.7
      }));
    }
    
    return baseTemplate;
  });

  const [isEditing, setIsEditing] = useState(isNew || isEditMode);
  const [showValidation, setShowValidation] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Use our template validator
  const validator = useTemplateValidator();
  
  // Manual validation trigger to avoid infinite loops
  const validateTemplate = () => {
    if (showValidation) {
      validator.validate(currentTemplate);
    }
  };
  
  // Debounced validation
  const validationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedValidate = () => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }
    validationTimerRef.current = setTimeout(() => {
      validateTemplate();
    }, 1000); // Wait 1 second after user stops typing
  };
  
  // Validate on mount only
  useEffect(() => {
    if (showValidation && template) {
      validator.validate(currentTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount

  // Handle adding new smart variable
  const addSmartVariable = () => {
    const newVariable: SmartVariable = {
      id: `var_${Date.now()}`,
      name: 'New Variable',
      type: 'text',
      description: 'Enter description for this variable',
      extraction_hints: ['hint1', 'hint2', 'hint3'],
      confidence_threshold: 0.5
    };

    console.log('➕ Adding new variable:', newVariable);

    setCurrentTemplate(prev => {
      const updated = {
        ...prev,
        smart_variables: [newVariable, ...prev.smart_variables]
      };
      console.log('➕ Updated template variables count:', updated.smart_variables.length);
      console.log('➕ All variables:', updated.smart_variables.map(v => ({ id: v.id, name: v.name })));
      
      // Validate after state update
      setTimeout(() => validateTemplate(), 0);
      return updated;
    });
  };

  // Handle removing smart variable
  const removeSmartVariable = (index: number) => {
    setCurrentTemplate(prev => ({
      ...prev,
      smart_variables: prev.smart_variables.filter((_, i) => i !== index)
    }));
  };

  // Handle updating smart variable
  const updateSmartVariable = (index: number, updatedVariable: SmartVariable) => {
    setCurrentTemplate(prev => ({
      ...prev,
      smart_variables: prev.smart_variables.map((variable, i) => 
        i === index ? updatedVariable : variable
      )
    }));
    // No validation during editing to prevent focus loss
  };

  // Handle template save
  const handleSave = async () => {
    // Validate before saving
    const validationResult = validator.validate(currentTemplate);
    
    if (!validationResult.isValid) {
      toast.error(`Template has ${validationResult.errors.length} error(s). Please fix them before saving.`);
      setShowValidation(true);
      return;
    }

    console.log('💾 Saving template with data:', currentTemplate);
    console.log('💾 Number of smart variables:', currentTemplate.smart_variables?.length || 0);
    console.log('💾 Smart variables:', currentTemplate.smart_variables);

    setIsSaving(true);
    
    try {
      await onSave(currentTemplate);
      setIsEditing(false);
      toast.success('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle auto-fix
  const handleAutoFix = () => {
    const fixedTemplate = validator.autoFix(currentTemplate);
    setCurrentTemplate(fixedTemplate);
    toast.success('Template issues have been auto-fixed!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {isNew ? 'Create New Smart Template' : 'Smart Template Editor'}
          </h2>
          <p className="text-muted-foreground">
            {isNew 
              ? 'Create a smart template with AI-powered variable extraction'
              : 'Edit template content and smart variables'
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={validateTemplate}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Validate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowValidation(!showValidation)}
          >
            {showValidation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showValidation ? 'Hide' : 'Show'} Validation
          </Button>
          
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="min-w-[100px]"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={currentTemplate.name}
                  onChange={(e) => setCurrentTemplate(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                  className={validator.hasFieldErrors('name') ? 'border-red-500' : ''}
                />
                {validator.hasFieldErrors('name') && (
                  <p className="text-red-500 text-sm mt-1">
                    {validator.getErrorsByField('name')[0]?.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={currentTemplate.description}
                  onChange={(e) => setCurrentTemplate(prev => ({ ...prev, description: e.target.value }))}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    value={currentTemplate.category}
                    onValueChange={(value) => setCurrentTemplate(prev => ({ ...prev, category: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="correspondence">Correspondence</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="form">Form</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="template-type">Template Type</Label>
                  <Select
                    value={currentTemplate.template_type}
                    onValueChange={(value) => setCurrentTemplate(prev => ({ ...prev, template_type: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="plain">Plain Text</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Variables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Smart Variables</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Define fields that will be automatically extracted from documents
                </p>
              </div>
              {isEditing && (
                <Button onClick={addSmartVariable} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {currentTemplate.smart_variables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>No smart variables defined yet.</p>
                  {isEditing && (
                    <p className="text-sm">Click "Add Variable" to get started.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {currentTemplate.smart_variables.map((variable, index) => (
                    <SmartVariableEditor
                      key={variable.id}
                      variable={variable}
                      onUpdate={(updated) => updateSmartVariable(index, updated)}
                      onRemove={() => removeSmartVariable(index)}
                      isEditing={isEditing}
                      hasErrors={validator.hasFieldErrors(`smart_variables[${index}]`)}
                      errors={validator.getErrorsByField(`smart_variables[${index}]`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Content */}
          <Card>
            <CardHeader>
              <CardTitle>Template Content</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define how the extracted data should be formatted. Use {'{{variable_id}}'} to reference smart variables.
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={currentTemplate.template_content}
                onChange={(e) => setCurrentTemplate(prev => ({ ...prev, template_content: e.target.value }))}
                disabled={!isEditing}
                rows={12}
                className="font-mono text-sm"
                placeholder="Enter your template content here..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Validation Panel */}
        <div className="lg:col-span-1">
          {showValidation && (
            <TemplateValidationPanel
              template={currentTemplate}
              validator={validator}
              showAutoFix={isEditing}
              onAutoFix={handleAutoFix}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Smart Variable Editor Component
 */
interface SmartVariableEditorProps {
  variable: SmartVariable;
  onUpdate: (variable: SmartVariable) => void;
  onRemove: () => void;
  isEditing: boolean;
  hasErrors: boolean;
  errors: any[];
}

function SmartVariableEditor({ 
  variable, 
  onUpdate, 
  onRemove, 
  isEditing, 
  hasErrors,
  errors 
}: SmartVariableEditorProps) {
  const updateVariable = (updates: Partial<SmartVariable>) => {
    onUpdate({ ...variable, ...updates });
  };

  const updateExtractionHint = (index: number, value: string) => {
    const newHints = [...variable.extraction_hints];
    newHints[index] = value;
    updateVariable({ extraction_hints: newHints });
  };

  const addExtractionHint = () => {
    updateVariable({ 
      extraction_hints: [...variable.extraction_hints, ''] 
    });
  };

  const removeExtractionHint = (index: number) => {
    updateVariable({ 
      extraction_hints: variable.extraction_hints.filter((_, i) => i !== index) 
    });
  };

  return (
    <Card className={hasErrors ? 'border-red-500' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={hasErrors ? 'destructive' : 'secondary'}>
              {variable.type}
            </Badge>
            <span className="font-medium">{variable.name || 'Unnamed Variable'}</span>
          </div>
          {isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {hasErrors && errors.length > 0 && (
          <div className="text-sm text-red-500">
            {errors.map((error, i) => (
              <p key={i}>• {error.message}</p>
            ))}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Variable ID</Label>
            <Input
              value={variable.id}
              onChange={(e) => updateVariable({ id: e.target.value })}
              disabled={!isEditing}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input
              value={variable.name}
              onChange={(e) => updateVariable({ name: e.target.value })}
              disabled={!isEditing}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Data Type</Label>
            <Select
              value={variable.type}
              onValueChange={(value: any) => updateVariable({ type: value })}
              disabled={!isEditing}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Confidence Threshold</Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={variable.confidence_threshold || 0.7}
              onChange={(e) => updateVariable({ confidence_threshold: parseFloat(e.target.value) || 0.7 })}
              disabled={!isEditing}
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={variable.description}
            onChange={(e) => updateVariable({ description: e.target.value })}
            disabled={!isEditing}
            rows={2}
            className="text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Extraction Hints</Label>
            {isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addExtractionHint}
                className="text-xs h-6 px-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Hint
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {variable.extraction_hints.map((hint, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={hint}
                  onChange={(e) => updateExtractionHint(index, e.target.value)}
                  disabled={!isEditing}
                  className="text-sm"
                  placeholder={`Extraction hint ${index + 1}`}
                />
                {isEditing && variable.extraction_hints.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExtractionHint(index)}
                    className="text-red-500 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}