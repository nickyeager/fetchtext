import React, { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Settings, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { SmartTemplateEditor } from '@/components/templates/SmartTemplateEditor';
import { smartTemplateService, SmartTemplate } from '@/services/smart-template-service';

export const Route = createFileRoute('/_authenticated/documents/templates/')({
  component: DocumentTemplatesIndexPage,
});

export function DocumentTemplatesIndexPage() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<SmartTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [templates, setTemplates] = useState<SmartTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates on component mount
  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const loadedTemplates = await smartTemplateService.getTemplates();
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setIsEditing(true);
  };

  const handleEditTemplate = (template: SmartTemplate) => {
    setSelectedTemplate(template);
    setIsEditing(true);
  };

  const handleViewTemplate = (template: SmartTemplate) => {
    // Navigate to the specific template detail page
    navigate({ to: `/documents/templates/${template.id}` });
  };

  const handleSaveTemplate = async (template: SmartTemplate) => {
    try {
      if (selectedTemplate?.id) {
        // Update existing template
        await smartTemplateService.updateTemplate(selectedTemplate.id, template);
        toast.success('Template updated successfully');
      } else {
        // Create new template
        await smartTemplateService.createTemplate(template);
        toast.success('Template created successfully');
      }
      
      // Reload templates and exit editing mode
      await loadTemplates();
      setIsEditing(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (!selectedTemplate?.id) {
      setSelectedTemplate(null);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await smartTemplateService.deleteTemplate(templateId);
      toast.success('Template deleted successfully');
      
      // Clear selection if deleted template was selected
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setIsEditing(false);
      }
      
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  if (isEditing) {
    return (
      <div className="container mx-auto p-6">
        <SmartTemplateEditor
          template={selectedTemplate}
          onSave={handleSaveTemplate}
          onCancel={handleCancel}
          isNew={!selectedTemplate?.id}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Smart Templates</h1>
            <p className="text-muted-foreground mt-2">
              AI-powered templates for document processing with smart variable extraction
            </p>
          </div>
          <Button onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Templates Grid View */}
      <TemplateList 
        templates={templates}
        selectedTemplate={null}
        isLoading={isLoading}
        onTemplateSelect={handleViewTemplate}
        onTemplateEdit={handleEditTemplate}
        onTemplateDelete={handleDeleteTemplate}
        onCreateTemplate={handleCreateTemplate}
        gridView={true}
      />
    </div>
  );
}

interface TemplateListProps {
  templates: SmartTemplate[];
  selectedTemplate: SmartTemplate | null;
  isLoading: boolean;
  onTemplateSelect: (template: SmartTemplate) => void;
  onTemplateEdit: (template: SmartTemplate) => void;
  onTemplateDelete: (templateId: number) => void;
  onCreateTemplate: () => void;
  gridView?: boolean;
}

function TemplateList({
  templates,
  selectedTemplate,
  isLoading,
  onTemplateSelect,
  onTemplateEdit,
  onTemplateDelete,
  gridView = false
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

  if (gridView) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onTemplateSelect}
            onEdit={onTemplateEdit}
            onDelete={onTemplateDelete}
          />
        ))}
      </div>
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
                selectedTemplate?.id === template.id ? 'bg-blue-50 border-blue-200' : ''
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
                <div className="flex items-center space-x-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTemplateEdit(template);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TemplateCardProps {
  template: SmartTemplate;
  onSelect: (template: SmartTemplate) => void;
  onEdit: (template: SmartTemplate) => void;
  onDelete: (templateId: number) => void;
}

function TemplateCard({ template, onSelect, onEdit }: TemplateCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template);
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent onClick={() => onSelect(template)}>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
              {template.category}
            </span>
            <span className="text-muted-foreground">
              {template.smart_variables.length} variables
            </span>
          </div>
          
          
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}