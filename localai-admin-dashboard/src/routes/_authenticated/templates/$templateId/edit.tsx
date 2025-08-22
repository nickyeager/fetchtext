import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { UnifiedTemplateEditor } from '@/components/templates/UnifiedTemplateEditor';
import { masterTemplateService } from '@/services/master-template-service';
import { TemplatePayload } from '@/types/unified-template';

export const Route = createFileRoute('/_authenticated/templates/$templateId/edit')({
  component: TemplateEditPage,
  errorComponent: ({ error }) => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error loading template for editing: {error.message || 'Unknown error occurred'}
        </AlertDescription>
      </Alert>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Template not found. It may have been deleted or you don't have permission to edit it.
        </AlertDescription>
      </Alert>
    </div>
  ),
});

function TemplateEditPage() {
  const navigate = useNavigate();
  const { templateId } = Route.useParams();

  // Fetch template data
  const { 
    data: template, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const template = await masterTemplateService.getTemplate(templateId);
      
      // If it's a smart template, redirect to the smart template edit route
      if (template?.type === 'smart') {
        navigate({ 
          to: '/templates/smart/$templateId/edit', 
          params: { templateId },
          replace: true
        });
        return null;
      }
      
      return template;
    },
    enabled: !!templateId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: TemplatePayload) => {
      return await masterTemplateService.updateTemplate(templateId, payload);
    },
    onSuccess: () => {
      toast.success('Template updated successfully');
      navigate({ 
        to: '/templates/$templateId', 
        params: { templateId }
      });
    },
    onError: (error) => {
      console.error('Error saving template:', error);
      toast.error('Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  const handleSave = async (payload: TemplatePayload) => {
    saveMutation.mutate(payload);
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
          <span className="ml-2">Loading template...</span>
        </div>
      </div>
    );
  }

  // Don't render if this is a smart template (we're redirecting)
  if (template?.type === 'smart') {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <span className="ml-2">Redirecting to smart template editor...</span>
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
            Template not found or failed to load.
          </AlertDescription>
        </Alert>
        <Button onClick={handleCancel} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Template
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <UnifiedTemplateEditor
        template={template}
        onSave={handleSave}
        onCancel={handleCancel}
        isNew={false}
      />
    </div>
  );
}