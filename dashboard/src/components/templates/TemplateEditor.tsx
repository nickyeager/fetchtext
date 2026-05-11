/**
 * Smart Template Editor Component
 *
 * Document-first design that prioritizes the template content editing experience.
 * Features a clean, editorial aesthetic with the WYSIWYG editor prominently displayed.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings2,
  Variable,
  Sparkles,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Import the new Template Builder Editor
import { TemplateBuilderEditor } from '@/features/templates/components/TemplateBuilderEditor';

// Smart Variable type (aligned with unified-template)
interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'email' | 'phone' | 'address' | 'array' | 'object';
  description: string;
  extraction_hints: string[];
  default_value?: string | number | boolean | null;
  confidence_threshold?: number;
  post_processing?: {
    transform?: string;
    normalize?: boolean;
  };
}

// Smart Template type
interface SmartTemplate {
  id?: number;
  uuid?: string;
  name: string;
  description?: string;
  template_content?: string;
  template_type?: string;
  category: string;
  smart_variables: SmartVariable[];
  tags: string[];
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TemplateEditorProps {
  template?: SmartTemplate | null;
  onSave: (template: SmartTemplate) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
  isEditMode?: boolean;
}

/**
 * Generate sample content that organically includes all variables
 */
function generateSampleContent(variables: SmartVariable[], category: string): string {
  if (variables.length === 0) {
    return '';
  }

  // Category-specific templates
  const categoryTemplates: Record<string, (vars: SmartVariable[]) => string> = {
    invoice: (vars) => {
      const varMap = Object.fromEntries(vars.map(v => [v.type, v.name]));
      return `# Invoice

**Invoice Number:** {{${varMap.number || vars[0]?.name || 'invoice_number'}}}
**Date:** {{${varMap.date || 'invoice_date'}}}

## Bill To
{{${varMap.text || varMap.address || 'customer_name'}}}

## Items
| Description | Amount |
|-------------|--------|
| Services rendered | {{${varMap.currency || 'amount'}}} |

**Total Due:** {{${varMap.currency || 'total_amount'}}}

${vars.filter(v => !Object.values(varMap).includes(v.name)).map(v => `{{${v.name}}}`).join(' ')}`;
    },
    contract: (vars) => {
      return `# Contract Agreement

This agreement is entered into on {{${vars.find(v => v.type === 'date')?.name || 'effective_date'}}} between:

**Party A:** {{${vars.find(v => v.type === 'text')?.name || 'party_a_name'}}}
**Party B:** {{${vars.find(v => v.type === 'text' && v.name !== vars[0]?.name)?.name || 'party_b_name'}}}

## Terms and Conditions
${vars.map(v => `- {{${v.name}}}`).join('\n')}

Signed on {{${vars.find(v => v.type === 'date')?.name || 'signature_date'}}}`;
    },
    correspondence: (vars) => {
      return `Dear {{${vars.find(v => v.type === 'text')?.name || 'recipient_name'}}},

${vars.filter(v => v.type !== 'text' || v !== vars[0]).map(v =>
  v.type === 'date' ? `As of {{${v.name}}},` :
  v.type === 'currency' ? `regarding the amount of {{${v.name}}},` :
  `{{${v.name}}}`
).join(' ')}

Best regards,
{{${vars.find(v => v.name.includes('sender') || v.name.includes('from'))?.name || 'sender_name'}}}`;
    },
    default: (vars) => {
      // Generic template that naturally includes all variables
      const lines = [
        '# Document',
        '',
        '## Overview',
        ''
      ];

      vars.forEach((v, i) => {
        if (v.type === 'date') {
          lines.push(`**Date:** {{${v.name}}}`);
        } else if (v.type === 'currency' || v.type === 'number') {
          lines.push(`**${v.description || v.name}:** {{${v.name}}}`);
        } else if (v.type === 'email') {
          lines.push(`**Contact:** {{${v.name}}}`);
        } else if (v.type === 'phone') {
          lines.push(`**Phone:** {{${v.name}}}`);
        } else if (v.type === 'address') {
          lines.push(`**Address:** {{${v.name}}}`);
        } else {
          lines.push(`**${v.description || `Field ${i + 1}`}:** {{${v.name}}}`);
        }
      });

      return lines.join('\n');
    }
  };

  const generator = categoryTemplates[category] || categoryTemplates.default;
  return generator(variables);
}

/**
 * Check if content includes all variables
 */
function getMissingVariables(content: string, variables: SmartVariable[]): SmartVariable[] {
  return variables.filter(v => !content.includes(`{{${v.name}}}`));
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  isNew = false,
  isEditMode = false
}: TemplateEditorProps) {
  // Initialize template state with auto-generated sample content if empty
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

    // Auto-generate sample content if template_content is empty but variables exist
    if (
      (!baseTemplate.template_content || baseTemplate.template_content.trim() === '') &&
      baseTemplate.smart_variables.length > 0
    ) {
      baseTemplate.template_content = generateSampleContent(
        baseTemplate.smart_variables,
        baseTemplate.category
      );
    }

    return baseTemplate;
  });

  const [isEditing, setIsEditing] = useState(isNew || isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Check for missing variables in content
  const missingVariables = useMemo(() => {
    return getMissingVariables(
      currentTemplate.template_content || '',
      currentTemplate.smart_variables
    );
  }, [currentTemplate.template_content, currentTemplate.smart_variables]);

  // Handle adding new smart variable
  const addSmartVariable = () => {
    const newVariable: SmartVariable = {
      id: `var_${Date.now()}`,
      name: '',
      type: 'text',
      description: '',
      extraction_hints: [''],
      confidence_threshold: 0.7
    };

    setCurrentTemplate(prev => ({
      ...prev,
      smart_variables: [newVariable, ...prev.smart_variables]
    }));

    toast.success('New variable added');
  };

  // Handle removing smart variable
  const removeSmartVariable = (index: number) => {
    const varName = currentTemplate.smart_variables[index]?.name || 'Variable';
    setCurrentTemplate(prev => ({
      ...prev,
      smart_variables: prev.smart_variables.filter((_, i) => i !== index)
    }));
    toast.success(`${varName} removed`);
  };

  // Handle updating smart variable
  const updateSmartVariable = (index: number, updatedVariable: SmartVariable) => {
    setCurrentTemplate(prev => ({
      ...prev,
      smart_variables: prev.smart_variables.map((variable, i) =>
        i === index ? updatedVariable : variable
      )
    }));
  };

  // Generate sample content with all variables
  const handleGenerateSampleContent = () => {
    const sampleContent = generateSampleContent(
      currentTemplate.smart_variables,
      currentTemplate.category
    );
    setCurrentTemplate(prev => ({
      ...prev,
      template_content: sampleContent
    }));
    toast.success('Sample content generated with all variables');
  };

  // Insert missing variables into existing content
  const handleInsertMissingVariables = () => {
    if (missingVariables.length === 0) return;

    const insertions = missingVariables.map(v => `{{${v.name}}}`).join(' ');
    setCurrentTemplate(prev => ({
      ...prev,
      template_content: `${prev.template_content || ''}\n\n${insertions}`
    }));
    toast.success(`Inserted ${missingVariables.length} missing variable(s)`);
  };

  // Handle template save
  const handleSave = async () => {
    if (!currentTemplate.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setIsSaving(true);

    try {
      await onSave(currentTemplate);
      setIsEditing(false);
      toast.success('Template saved successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save template: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle variable format change from TemplateBuilderEditor
  const handleVariableFormatChange = useCallback((variableId: string, format: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      smart_variables: prev.smart_variables.map(variable => {
        if (variable.id !== variableId) return variable;
        return {
          ...variable,
          post_processing: {
            ...variable.post_processing,
            transform: format
          }
        };
      })
    }));
    toast.success(`Format updated to "${format}"`);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Floating Header Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Template Name */}
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <Input
                  value={currentTemplate.name}
                  onChange={(e) => setCurrentTemplate(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="Untitled Template"
                  className={cn(
                    "text-xl font-semibold bg-transparent border-none shadow-none p-0 h-auto",
                    "focus-visible:ring-0 focus-visible:ring-offset-0",
                    "placeholder:text-muted-foreground/60",
                    !isEditing && "cursor-default"
                  )}
                />
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentTemplate.category} • {currentTemplate.smart_variables.length} variables
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {isEditing && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    className="text-muted-foreground"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="shadow-lg shadow-primary/25"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1.5" />
                        Save Template
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Editor Column - Takes most space */}
          <div className="lg:col-span-3 space-y-6">
            {/* Template Content Editor - THE STAR OF THE SHOW */}
            <div className="relative">
              {/* Decorative gradient border effect using theme colors */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 rounded-2xl blur-sm" />

              <div className="relative bg-card rounded-2xl shadow-xl shadow-muted/50 overflow-hidden border border-border/50">
                {/* Editor Header */}
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-foreground">Template Content</h2>
                        <p className="text-xs text-muted-foreground">
                          Type <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{'{{'}</kbd> to insert variables
                        </p>
                      </div>
                    </div>

                    {/* Generate sample content button */}
                    {isEditing && currentTemplate.smart_variables.length > 0 && (
                      <div className="flex items-center gap-2">
                        {missingVariables.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleInsertMissingVariables}
                            className="text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add {missingVariables.length} Missing
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateSampleContent}
                          className="text-xs"
                        >
                          <Wand2 className="h-3 w-3 mr-1" />
                          Generate Sample
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* TipTap Editor */}
                <div className="p-6">
                  <TemplateBuilderEditor
                    content={currentTemplate.template_content || ''}
                    onChange={(content) => setCurrentTemplate(prev => ({ ...prev, template_content: content }))}
                    variables={currentTemplate.smart_variables as import('@/types/unified-template').SmartVariable[]}
                    onVariableFormatChange={handleVariableFormatChange}
                    readOnly={!isEditing}
                    placeholder="Start writing your template content here...

Use {{ to insert variables that will be automatically filled with extracted data.

Example: Dear {{customer_name}}, your invoice #{{invoice_number}} is ready."
                    showToolbar={isEditing}
                    className="min-h-[400px]"
                  />
                </div>
              </div>
            </div>

            {/* Template Settings - Collapsible */}
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                        <Settings2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-foreground">Template Settings</span>
                    </div>
                    {settingsOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Description</Label>
                      <Textarea
                        value={currentTemplate.description}
                        onChange={(e) => setCurrentTemplate(prev => ({ ...prev, description: e.target.value }))}
                        disabled={!isEditing}
                        rows={2}
                        placeholder="A brief description of this template's purpose..."
                        className="mt-1.5 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Category</Label>
                        <Select
                          value={currentTemplate.category}
                          onValueChange={(value) => setCurrentTemplate(prev => ({ ...prev, category: value }))}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="mt-1.5">
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
                        <Label className="text-sm text-muted-foreground">Format</Label>
                        <Select
                          value={currentTemplate.template_type}
                          onValueChange={(value) => setCurrentTemplate(prev => ({ ...prev, template_type: value }))}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="mt-1.5">
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
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* Variables Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Variables Panel */}
            <div className="sticky top-28">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Variables Header */}
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Variable className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm text-foreground">Variables</span>
                      <Badge variant="secondary" className="text-xs">
                        {currentTemplate.smart_variables.length}
                      </Badge>
                    </div>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addSmartVariable}
                        className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Variables List */}
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  {currentTemplate.smart_variables.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="p-3 rounded-full bg-muted w-fit mx-auto mb-3">
                        <Variable className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">No variables yet</p>
                      <p className="text-xs text-muted-foreground/70">
                        {isEditing ? 'Click + to add your first variable' : 'This template has no variables'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {currentTemplate.smart_variables.map((variable, index) => (
                        <VariableItem
                          key={variable.id}
                          variable={variable}
                          onUpdate={(updated) => updateSmartVariable(index, updated)}
                          onRemove={() => removeSmartVariable(index)}
                          isEditing={isEditing}
                          isInContent={!missingVariables.includes(variable)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer hint */}
                {currentTemplate.smart_variables.length > 0 && (
                  <div className="px-4 py-3 border-t border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Click a variable to edit. Type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">{'{{'}</kbd> in editor to insert.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Variable Item for Sidebar
 */
interface VariableItemProps {
  variable: SmartVariable;
  onUpdate: (variable: SmartVariable) => void;
  onRemove: () => void;
  isEditing: boolean;
  isInContent?: boolean;
}

function VariableItem({ variable, onUpdate, onRemove, isEditing, isInContent = false }: VariableItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateVariable = (updates: Partial<SmartVariable>) => {
    onUpdate({ ...variable, ...updates });
  };

  // Use semantic color classes that work with both themes
  const typeColors: Record<string, string> = {
    text: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    number: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    date: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    currency: 'bg-green-500/10 text-green-600 dark:text-green-400',
    email: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    phone: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    percentage: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    address: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="group">
      <button
        onClick={() => isEditing && setIsExpanded(!isExpanded)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between text-left transition-colors",
          isEditing && "hover:bg-muted/50 cursor-pointer",
          isExpanded && "bg-muted/50",
          !isInContent && "opacity-60"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge
            variant="secondary"
            className={cn("text-[10px] font-medium shrink-0", typeColors[variable.type] || typeColors.text)}
          >
            {variable.type}
          </Badge>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-foreground truncate">
                {variable.name || 'unnamed'}
              </p>
              {isInContent && (
                <span className="text-[10px] text-primary">✓</span>
              )}
            </div>
            {variable.description && (
              <p className="text-xs text-muted-foreground truncate">
                {variable.description}
              </p>
            )}
          </div>
        </div>
        {isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </button>

      {/* Expanded Edit Form */}
      {isExpanded && isEditing && (
        <div className="px-4 pb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">ID</Label>
              <Input
                value={variable.id}
                onChange={(e) => updateVariable({ id: e.target.value })}
                className="text-xs h-8 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={variable.name}
                onChange={(e) => updateVariable({ name: e.target.value })}
                className="text-xs h-8"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={variable.type}
              onValueChange={(value: SmartVariable['type']) => updateVariable({ type: value })}
            >
              <SelectTrigger className="text-xs h-8">
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
                <SelectItem value="address">Address</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input
              value={variable.description}
              onChange={(e) => updateVariable({ description: e.target.value })}
              placeholder="What is this variable for?"
              className="text-xs h-8"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="w-full h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            Remove Variable
          </Button>
        </div>
      )}
    </div>
  );
}
