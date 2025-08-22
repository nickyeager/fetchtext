import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings, FileText, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { smartTemplateService, SmartTemplate } from '@/services/smart-template-service';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Route = createFileRoute('/_authenticated/documents/templates/$templateId')({
  component: DocumentTemplateDetailPage,
});

export function DocumentTemplateDetailPage() {
  const { templateId } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: template,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['smart-template', templateId],
    queryFn: async () => {
      const foundTemplate = await smartTemplateService.getTemplate(Number(templateId));
      if (!foundTemplate) {
        throw new Error('Template not found');
      }
      return foundTemplate;
    },
    enabled: !!templateId,
  });

  const {
    data: allTemplates,
    isLoading: templatesLoading
  } = useQuery({
    queryKey: ['smart-templates'],
    queryFn: () => smartTemplateService.getTemplates(),
  });

  const handleBack = () => {
    navigate({ to: '/documents/templates' });
  };

  const handleEdit = () => {
    if (template) {
      navigate({ to: `/templates/smart/${template.id}/edit` });
    }
  };

  const handleTemplateSelect = (selectedTemplate: SmartTemplate) => {
    navigate({ to: `/documents/templates/${selectedTemplate.id}` });
  };

  const handleDeleteTemplate = async (templateIdToDelete: number) => {
    try {
      await smartTemplateService.deleteTemplate(templateIdToDelete);
      toast.success('Template deleted successfully');
      
      // If we deleted the currently viewed template, go back to templates list
      if (Number(templateId) === templateIdToDelete) {
        navigate({ to: '/documents/templates' });
      } else {
        // Refresh the templates list
        refetch();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  if (isLoading || templatesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Template not found. This template may have been deleted or you may not have permission to view it.
          </AlertDescription>
        </Alert>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Smart Templates</h1>
              <p className="text-muted-foreground mt-2">
                AI-powered templates for document processing with smart variable extraction
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Template Detail View - Same as original layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template List Sidebar */}
        <div className="lg:col-span-1">
          <TemplateList 
            templates={allTemplates || []}
            selectedTemplate={template}
            isLoading={templatesLoading}
            onTemplateSelect={handleTemplateSelect}
            onTemplateDelete={handleDeleteTemplate}
            currentTemplateId={Number(templateId)}
          />
        </div>
        
        {/* Template Detail */}
        <div className="lg:col-span-3">
          <SmartTemplateDetail 
            template={template}
            onEdit={handleEdit}
          />
        </div>
      </div>
    </div>
  );
}

interface TemplateListProps {
  templates: SmartTemplate[];
  selectedTemplate: SmartTemplate | null;
  isLoading: boolean;
  onTemplateSelect: (template: SmartTemplate) => void;
  onTemplateDelete: (templateId: number) => void;
  currentTemplateId: number;
}

function TemplateList({
  templates,
  selectedTemplate,
  isLoading,
  onTemplateSelect,
  onTemplateDelete,
  currentTemplateId
}: TemplateListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates yet</h3>
          <p className="text-muted-foreground text-center mb-6">
            Create your first smart template to get started with AI-powered document processing
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates ({templates.length})</CardTitle>
        <CardDescription>
          Select a template to view or edit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                currentTemplateId === template.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
              onClick={() => onTemplateSelect(template)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{template.name}</h4>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {template.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {template.smart_variables.length} variables
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface SmartTemplateDetailProps {
  template: SmartTemplate;
  onEdit: () => void;
}

function SmartTemplateDetail({ template, onEdit }: SmartTemplateDetailProps) {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </div>
            <Button onClick={onEdit}>
              <Settings className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Category:</span> {template.category}
            </div>
            <div>
              <span className="font-medium">Type:</span> {template.template_type}
            </div>
            <div>
              <span className="font-medium">Variables:</span> {template.smart_variables.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Variables</CardTitle>
          <CardDescription>
            AI-powered fields that will be extracted from documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {template.smart_variables.map((variable) => (
              <div key={variable.id} className="border rounded-lg p-4">
                <h4 className="font-medium">{variable.name}</h4>
                <p className="text-sm text-muted-foreground mb-2">{variable.description}</p>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="bg-gray-100 px-2 py-1 rounded">{variable.type}</span>
                  <span className="text-muted-foreground">
                    {variable.extraction_hints.length} hints
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template Content */}
      <Card>
        <CardHeader>
          <CardTitle>Template Content</CardTitle>
          <CardDescription>
            How the extracted data will be formatted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 border">
            {template.template_content || 'No content defined'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}