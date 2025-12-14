/**
 * ExtractedFieldsEditor Component
 * 
 * Displays and allows editing of extracted fields from documents.
 * Features:
 * - View extracted fields with confidence scores
 * - Edit field values inline
 * - Save changes to document
 * - Create templates from extracted fields
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Edit3, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  FileText,
  AlertTriangle,
  CheckCircle
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

interface ExtractedFieldsEditorProps {
  documentId: string; // kept for future expansion
  extractedFields: Record<string, unknown>;
  confidenceScores?: Record<string, number>;
  onSave?: (fields: Record<string, unknown>) => Promise<void>;
  onCreateTemplate?: (fields: ExtractedField[]) => Promise<void>;
  readOnly?: boolean;
  showCreateTemplate?: boolean;
}

export function ExtractedFieldsEditor({
  documentId: _documentId,
  extractedFields: initialFields,
  confidenceScores = {},
  onSave,
  onCreateTemplate,
  readOnly = false,
  showCreateTemplate = true
}: ExtractedFieldsEditorProps) {
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize fields from props
  useEffect(() => {
    /* eslint-disable no-console */
    console.log('');
    console.log('🎨 [ExtractedFieldsEditor] Initializing fields from props');
    console.log('   Prop extractedFields type:', typeof initialFields);
    console.log('   Prop extractedFields value:', initialFields);
    console.log('   Prop extractedFields keys:', Object.keys(initialFields || {}));
    console.log('   Confidence scores:', confidenceScores);
    console.log('');

    const processedFields = Object.entries(initialFields || {}).map(([key, value], index) => {
      console.log(`   Processing field ${index + 1}/${Object.keys(initialFields || {}).length}: "${key}"`);
      console.log('     Raw value type:', typeof value);
      console.log('     Raw value:', value);

      let displayValue = '';
      let confidence = confidenceScores[key] || 0;
      let sourceText = '';
      let fieldType: ExtractedField['type'] = 'text';

      // Handle different field data structures
      if (typeof value === 'object' && value !== null) {
        const valAny = value as Record<string, unknown>;
        console.log('     Object keys:', Object.keys(valAny));

        if ('value' in valAny) {
          const rawVal = valAny.value;
          displayValue = rawVal == null ? '' : typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);
          console.log('     Extracted .value property:', displayValue);

          if (typeof valAny.confidence === 'number') {
            confidence = valAny.confidence;
            console.log('     Extracted .confidence property:', confidence);
          }
          if (typeof valAny.sourceText === 'string') {
            sourceText = valAny.sourceText;
            console.log('     Extracted .sourceText property:', sourceText);
          }
          if (typeof valAny.type === 'string') {
            fieldType = valAny.type as ExtractedField['type'];
            console.log('     Extracted .type property:', fieldType);
          }
        } else {
          displayValue = JSON.stringify(valAny);
          console.log('     ⚠️ No .value property, stringifying entire object:', displayValue);
        }
      } else {
        displayValue = value == null ? '' : typeof value === 'string' ? value : String(value);
        console.log('     Primitive value:', displayValue);
      }

      // Infer field type from name and value
      if (!fieldType || fieldType === 'text') {
        if (key.toLowerCase().includes('email') && displayValue.includes('@')) {
          fieldType = 'email';
  } else if (key.toLowerCase().includes('phone') || /^\+?\d[\d\s\-()]+$/.test(displayValue)) {
          fieldType = 'phone';
  } else if (key.toLowerCase().includes('date') || /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(displayValue)) {
          fieldType = 'date';
        } else if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || /^\$?\d+\.?\d*$/.test(displayValue)) {
          fieldType = 'currency';
        } else if (/^\d+\.?\d*$/.test(displayValue)) {
          fieldType = 'number';
        }
      }

      const processedField = {
        id: key,
        name: key,
        value: displayValue,
        confidence,
        sourceText,
        type: fieldType,
        required: confidence > 0.8 || key.toLowerCase().includes('id') || key.toLowerCase().includes('number')
      };

      console.log('     Final processed field:', processedField);
      console.log('');

      return processedField;
    });

    console.log('🎨 [ExtractedFieldsEditor] Field processing complete');
    console.log('   Total processed fields:', processedFields.length);
    console.log('   Processed fields:', processedFields);
    console.log('');
    /* eslint-enable no-console */

    setFields(processedFields);
  }, [initialFields, confidenceScores]);

  const handleFieldEdit = (fieldId: string, newValue: string) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, value: newValue } : field
    ));
  };

  const handleFieldNameEdit = (fieldId: string, newName: string) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, name: newName } : field
    ));
  };

  const handleFieldTypeChange = (fieldId: string, newType: ExtractedField['type']) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, type: newType } : field
    ));
  };

  const addNewField = () => {
    const newField: ExtractedField = {
      id: `custom_${Date.now()}`,
      name: 'new_field',
      value: '',
      confidence: 0,
      type: 'text',
      required: false
    };
    setFields(prev => [...prev, newField]);
    setEditingField(newField.id);
    setIsEditing(true);
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
    if (editingField === fieldId) {
      setEditingField(null);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      // Convert fields back to the format expected by the document
      const fieldsData = fields.reduce((acc, field) => {
        acc[field.name] = {
          value: field.value,
          confidence: field.confidence,
          type: field.type,
          sourceText: field.sourceText
        };
        return acc;
  }, {} as Record<string, unknown>);

      await onSave(fieldsData);
      
      setSaveMessage({ type: 'success', text: 'Fields saved successfully!' });
      setIsEditing(false);
      setEditingField(null);
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: `Failed to save fields: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!onCreateTemplate || fields.length === 0) return;

    try {
      await onCreateTemplate(fields);
      setSaveMessage({ type: 'success', text: 'Template created successfully!' });
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400';
    if (confidence > 0) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400';
    return 'bg-gray-100 text-gray-600';
  };

  const formatFieldName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (fields.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Extracted Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No extracted fields available</p>
            <p className="text-xs text-gray-400 mt-1">
              This document may not have been processed with field extraction enabled
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="extracted-fields-editor">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Extracted Fields ({fields.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Fields
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditingField(null);
                      }}
                      disabled={isSaving}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Changes
                    </Button>
                  </>
                )}
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addNewField}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </Button>
                )}
              </>
            )}
            {showCreateTemplate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreateTemplate}
                disabled={fields.length === 0}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Create Template
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {saveMessage && (
          <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'} className="mb-4">
            {saveMessage.type === 'error' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{saveMessage.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4" data-testid="extracted-fields">
          {fields.map((field) => (
            <div key={field.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg" data-testid="extracted-field">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  {isEditing && editingField === field.id ? (
                    <Input
                      value={field.name}
                      onChange={(e) => handleFieldNameEdit(field.id, e.target.value)}
                      className="max-w-xs"
                      placeholder="Field name"
                      data-testid="extracted-field-name-input"
                    />
                  ) : (
                    <Label className="font-medium cursor-pointer" onClick={() => {
                      if (isEditing) setEditingField(field.id);
                    }}>
                      {formatFieldName(field.name)}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                  )}
                  
                  {typeof field.confidence === 'number' && field.confidence > 0 && (
                    <Badge variant="secondary" className={getConfidenceColor(field.confidence)}>
                      {Math.round(field.confidence * 100)}%
                    </Badge>
                  )}
                  
                  <Badge variant="outline">
                    {field.type}
                  </Badge>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(e) => handleFieldTypeChange(field.id, e.target.value as ExtractedField['type'])}
                      className="text-xs border rounded px-2 py-1"
                      aria-label="Field type"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="currency">Currency</option>
                      <option value="date">Date</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field.id)}
                      className="text-red-500 hover:text-red-700 p-1 h-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {isEditing ? (() => {
                  const isLong = field.value.length > 50;
                  const inputType = ((): string => {
                    if (field.type === 'number' || field.type === 'currency') return 'number';
                    if (field.type === 'email') return 'email';
                    if (field.type === 'date') return 'date';
                    return 'text';
                  })();
                  return isLong ? (
                    <Textarea
                      value={field.value}
                      onChange={(e) => handleFieldEdit(field.id, e.target.value)}
                      className="min-h-[80px]"
                      placeholder="Enter field value"
                      data-testid="extracted-field-value-input"
                    />
                  ) : (
                    <Input
                      value={field.value}
                      onChange={(e) => handleFieldEdit(field.id, e.target.value)}
                      placeholder="Enter field value"
                      type={inputType}
                      data-testid="extracted-field-value-input"
                    />
                  );
                })() : (
          <div className="min-h-[40px] p-2 bg-gray-50 dark:bg-gray-800 rounded border" data-testid="extracted-field-value">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {field.value || <em className="text-gray-400">No value</em>}
                    </span>
                  </div>
                )}

                {field.sourceText && (
                  <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded italic">
                    <strong>Source:</strong> "{field.sourceText}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}