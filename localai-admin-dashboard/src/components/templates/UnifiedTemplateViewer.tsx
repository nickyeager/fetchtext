/**
 * Unified Template Viewer Component
 * 
 * Displays template details with type-specific sections while maintaining
 * a consistent UI across all template types.
 */

import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
  UnifiedTemplate, 
  isSmartTemplate, 
  isStandardTemplate, 
  isWorkflowTemplate,
  SmartVariable 
} from '@/types/unified-template';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Zap, 
  Workflow, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  Star,
  Clock,
  User,
  Eye,
  Settings
} from 'lucide-react';

interface UnifiedTemplateViewerProps {
  template: UnifiedTemplate;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onUse?: () => void;
  showActions?: boolean;
}

export function UnifiedTemplateViewer({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onUse,
  showActions = true
}: UnifiedTemplateViewerProps) {
  const navigate = useNavigate();

  // Ensure template exists
  if (!template) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No template data available
      </div>
    );
  }

  // Handle edit navigation internally
  const handleEdit = () => {
    console.log('UnifiedTemplateViewer: handleEdit called', { 
      template: template.id, 
      type: template.type, 
      isSmartTemplate: isSmartTemplate(template),
      onEdit: !!onEdit 
    });
    
    if (onEdit) {
      // Use provided onEdit if available (for backward compatibility)
      console.log('UnifiedTemplateViewer: Using provided onEdit callback');
      onEdit();
    } else {
      // Navigate to appropriate edit route
      if (isSmartTemplate(template)) {
        const route = '/templates/smart/$templateId/edit';
        const params = { templateId: template.id.toString() };
        console.log('UnifiedTemplateViewer: Navigating to smart template edit', { route, params });
        navigate({ 
          to: route, 
          params 
        });
      } else {
        const route = '/templates/$templateId/edit';
        const params = { templateId: template.id.toString() };
        console.log('UnifiedTemplateViewer: Navigating to standard template edit', { route, params });
        navigate({ 
          to: route, 
          params 
        });
      }
    }
  };
  const getTemplateIcon = () => {
    if (isSmartTemplate(template)) return <Zap className="h-5 w-5 text-yellow-500" />;
    if (isWorkflowTemplate(template)) return <Workflow className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const getTemplateTypeBadge = () => {
    const typeConfig = {
      smart: { label: 'Smart Template', variant: 'default' as const, className: 'bg-yellow-100 text-yellow-800' },
      standard: { label: 'Standard Template', variant: 'secondary' as const },
      workflow: { label: 'Workflow Template', variant: 'default' as const, className: 'bg-blue-100 text-blue-800' }
    };
    
    const config = typeConfig[template.type];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1">{getTemplateIcon()}</div>
              <div className="space-y-1">
                <CardTitle className="text-2xl">{template.name}</CardTitle>
                <CardDescription className="text-base">{template.description}</CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  {getTemplateTypeBadge()}
                  <Badge variant="outline">{template.category}</Badge>
                  {template.is_public && (
                    <Badge variant="secondary">Public</Badge>
                  )}
                </div>
              </div>
            </div>
            
            {showActions && (
              <div className="flex items-center gap-2">
                {onUse && (
                  <Button onClick={onUse}>
                    <Eye className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                {onDuplicate && (
                  <Button variant="outline" size="sm" onClick={onDuplicate}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="outline" size="sm" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            
            {template.created_at && (
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium">
                  {new Date(template.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
            
            {template.updated_at && (
              <div>
                <span className="text-muted-foreground">Updated</span>
                <p className="font-medium">
                  {new Date(template.updated_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          
          {template.tags && template.tags.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="text-sm text-muted-foreground">Tags</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {template.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Type-specific content */}
      {isSmartTemplate(template) && (
        <SmartTemplateDetails template={template} />
      )}
      
      {isStandardTemplate(template) && (
        <StandardTemplateDetails template={template} />
      )}
      
      {isWorkflowTemplate(template) && (
        <WorkflowTemplateDetails template={template} />
      )}
    </div>
  );
}

// Smart Template specific details
function SmartTemplateDetails({ template }: { template: any }) {
  if (!template) return null;
  
  return (
    <>
      {/* Smart Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Smart Variables
          </CardTitle>
          <CardDescription>
            AI-powered fields that will be extracted from documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Array.isArray(template.smart_variables) && template.smart_variables.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {template.smart_variables.map((variable: SmartVariable, index: number) => (
                <div key={variable.id || index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium">{variable.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {variable.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {variable.description}
                  </p>
                  {Array.isArray(variable.extraction_hints) && variable.extraction_hints.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600">Extraction hints:</p>
                      <div className="flex flex-wrap gap-1">
                        {variable.extraction_hints.map((hint, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {hint || 'No hint'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {variable.required && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                  {variable.confidence_threshold && (
                    <p className="text-xs text-gray-500">
                      Min confidence: {(variable.confidence_threshold * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No variables defined
            </p>
          )}
        </CardContent>
      </Card>

      {/* Template Content */}
      <Card>
        <CardHeader>
          <CardTitle>Template Content</CardTitle>
          <CardDescription>
            Output format: {template.template_type || 'Markdown'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {template.template_content || 'No content defined'}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

// Standard Template specific details
function StandardTemplateDetails({ template }: { template: any }) {
  if (!template) return null;
  
  return (
    <>
      {/* Template Fields */}
      {Array.isArray(template.fields) && template.fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Template Fields</CardTitle>
            <CardDescription>
              Fields defined for this template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {template.fields.map((field: any, index: number) => (
                <div key={field.id || index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium">{field.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {field.type}
                    </Badge>
                  </div>
                  {field.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {field.description}
                    </p>
                  )}
                  {field.required && (
                    <Badge variant="destructive" className="text-xs mt-2">
                      Required
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Content */}
      <Card>
        <CardHeader>
          <CardTitle>Template Content</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {template.content || 'No content defined'}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

// Workflow Template specific details
function WorkflowTemplateDetails({ template }: { template: any }) {
  if (!template) return null;
  
  return (
    <>
      {/* Workflow Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Workflow Configuration
          </CardTitle>
          <CardDescription>
            N8N workflow settings and parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Trigger Type</span>
              <p className="font-medium">
                {template.workflow_config?.trigger_type || 'Manual'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Version</span>
              <p className="font-medium">
                {template.workflow_config?.version || '1.0'}
              </p>
            </div>
          </div>
          
          {template.workflow_config?.parameters && 
           typeof template.workflow_config.parameters === 'object' &&
           Object.keys(template.workflow_config.parameters).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Parameters</h4>
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs">
                  {JSON.stringify(template.workflow_config.parameters, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      {template.documentation && (
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {template.documentation}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}