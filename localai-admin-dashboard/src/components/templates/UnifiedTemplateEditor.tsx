/**
 * Unified Template Editor Component
 * 
 * This component provides a unified editing experience for all template types
 * while preserving the specific UI/UX of each template type.
 */

import React from 'react';
import { 
  UnifiedTemplate, 
  isSmartTemplate, 
  isStandardTemplate, 
  isWorkflowTemplate,
  TemplatePayload 
} from '@/types/unified-template';
import { SmartTemplateEditor } from './SmartTemplateEditor';
import { StandardTemplateEditor } from './StandardTemplateEditor';
import { WorkflowTemplateEditor } from './WorkflowTemplateEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

interface UnifiedTemplateEditorProps {
  template: UnifiedTemplate | null;
  onSave: (template: TemplatePayload) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
  isLoading?: boolean;
}

export function UnifiedTemplateEditor({
  template,
  onSave,
  onCancel,
  isNew = false,
  isLoading = false
}: UnifiedTemplateEditorProps) {
  // Handle loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mr-2" />
          <span>Loading template editor...</span>
        </CardContent>
      </Card>
    );
  }

  // Add error boundary wrapper
  try {

  // Handle case when no template is provided
  if (!template) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <span>No template selected for editing</span>
        </CardContent>
      </Card>
    );
  }

  // Handle smart template editing
  if (isSmartTemplate(template)) {
    const handleSmartTemplateSave = React.useCallback(async (smartTemplate: any) => {
      await onSave({
        name: smartTemplate.name,
        description: smartTemplate.description,
        category: smartTemplate.category,
        type: 'smart',
        template_content: smartTemplate.template_content,
        smart_variables: smartTemplate.smart_variables,
        tags: smartTemplate.tags,
        is_public: smartTemplate.is_public,
        metadata: smartTemplate.metadata
      });
    }, [onSave]);

    return (
      <SmartTemplateEditor
        template={template}
        onSave={handleSmartTemplateSave}
        onCancel={onCancel}
        isNew={isNew}
      />
    );
  }

  // Handle standard template editing
  if (isStandardTemplate(template)) {
    return (
      <StandardTemplateEditor
        template={template}
        onSave={onSave}
        onCancel={onCancel}
        isNew={isNew}
      />
    );
  }

  // Handle workflow template editing
  if (isWorkflowTemplate(template)) {
    return (
      <WorkflowTemplateEditor
        template={template}
        onSave={onSave}
        onCancel={onCancel}
        isNew={isNew}
      />
    );
  }

  // Unknown template type
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          Unknown Template Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertDescription>
            The template type could not be determined. Please check the template configuration.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
  } catch (error) {
    // Error boundary fallback
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Template Editor Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              An error occurred while loading the template editor: {error instanceof Error ? error.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <button 
              onClick={onCancel}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Go Back
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

// Placeholder for Standard Template Editor
// This would be implemented based on your existing standard template UI
function StandardTemplateEditor({ 
  template, 
  onSave, 
  onCancel, 
  isNew 
}: {
  template: any;
  onSave: (template: TemplatePayload) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [formData, setFormData] = React.useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'general',
    content: template?.content || '',
    fields: template?.fields || [],
    tags: template?.tags || [],
    is_public: template?.is_public || false
  });

  const handleSave = async () => {
    await onSave({
      ...formData,
      type: 'standard'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isNew ? 'Create Standard Template' : 'Edit Standard Template'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Standard template editing UI would go here */}
        <div className="text-center py-8 text-gray-500">
          Standard Template Editor UI
          <br />
          (To be implemented based on existing UI patterns)
        </div>
        <div className="flex justify-end gap-2">
          <button 
            onClick={onCancel}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Template
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// Placeholder for Workflow Template Editor
// This would integrate with your N8N workflow editor
function WorkflowTemplateEditor({ 
  template, 
  onSave, 
  onCancel, 
  isNew 
}: {
  template: any;
  onSave: (template: TemplatePayload) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [formData, setFormData] = React.useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'workflow',
    workflow_config: template?.workflow_config || {},
    tags: template?.tags || [],
    is_public: template?.is_public || false
  });

  const handleSave = async () => {
    await onSave({
      ...formData,
      type: 'workflow'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isNew ? 'Create Workflow Template' : 'Edit Workflow Template'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workflow template editing UI would go here */}
        <div className="text-center py-8 text-gray-500">
          Workflow Template Editor UI
          <br />
          (To be integrated with N8N workflow editor)
        </div>
        <div className="flex justify-end gap-2">
          <button 
            onClick={onCancel}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Template
          </button>
        </div>
      </CardContent>
    </Card>
  );
}