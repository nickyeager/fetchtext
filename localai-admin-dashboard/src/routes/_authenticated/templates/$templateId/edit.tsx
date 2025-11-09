import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { templateService, SmartTemplate } from '@/services/template-service';

export const Route = createFileRoute('/_authenticated/templates/$templateId/edit')({
  component: SmartTemplateEditPage,
  errorComponent: ({ error }) => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error loading smart template for editing: {error.message || 'Unknown error occurred'}
        </AlertDescription>
      </Alert>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Smart template not found. It may have been deleted or you don't have permission to edit it.
        </AlertDescription>
      </Alert>
    </div>
  ),
});

function SmartTemplateEditPage() {
  const navigate = useNavigate();
  const { templateId } = Route.useParams();
  const queryClient = useQueryClient();

  // Fetch template data
  const { 
    data: template, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['smart-template', templateId],
    queryFn: async () => {
      return await templateService.getTemplate(Number(templateId));
    },
    enabled: !!templateId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (templateData: SmartTemplate) => {
      if (template?.id) {
        return await templateService.updateTemplate(template.id, templateData);
      } else {
        throw new Error('Template ID not found');
      }
    },
    onSuccess: () => {
      toast.success('Smart template updated successfully');
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['smart-template', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template', templateId] });
      
      navigate({ 
        to: '/templates/$templateId', 
        params: { templateId },
        replace: true  // Replace current entry to avoid back button issues
      });
    },
    onError: (error) => {
      console.error('Error saving smart template:', error);
      toast.error('Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  const handleSave = async (templateData: SmartTemplate) => {
    saveMutation.mutate(templateData);
  };

  const handleCancel = () => {
    navigate({ 
      to: '/templates/$templateId', 
      params: { templateId }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <span className="ml-2">Loading smart template...</span>
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
            Smart template not found or failed to load.
          </AlertDescription>
        </Alert>
        <Button onClick={handleCancel} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Smart Template
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      {/* Debug header to confirm we're on the edit route */}
      <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded">
        <h2 className="text-green-800 font-bold">🛠️ EDITING MODE - Smart Template Editor</h2>
        <p className="text-sm text-green-600">Template ID: {templateId}</p>
      </div>
      
      <TemplateEditor
        template={template}
        onSave={handleSave}
        onCancel={handleCancel}
        isNew={false}
        isEditMode={true}
      />
    </div>
  );
}