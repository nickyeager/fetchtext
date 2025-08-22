import React, { useCallback, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { UnifiedTemplateViewer } from '@/components/templates/UnifiedTemplateViewer';
import { masterTemplateService } from '@/services/master-template-service';
import { isSmartTemplate } from '@/types/unified-template';

interface TemplateDetailSearch {
  mode?: 'view' | 'edit';
}

export const Route = createFileRoute('/_authenticated/templates/$templateId')({
  validateSearch: (search: Record<string, unknown>): TemplateDetailSearch => ({
    mode: (search.mode as 'view' | 'edit') || 'view',
  }),
  component: TemplateDetailPage,
  errorComponent: ({ error }) => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error loading template: {error.message || 'Unknown error occurred'}
        </AlertDescription>
      </Alert>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Template not found. It may have been deleted or you don't have permission to view it.
        </AlertDescription>
      </Alert>
    </div>
  ),
});

function TemplateDetailPage() {
  const navigate = useNavigate();
  const { templateId } = Route.useParams();
  const { mode } = Route.useSearch();

  // Fetch template data
  const { 
    data: template, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      // Try to get template from different types until we find it
      const templateIdNum = Number(templateId);
      
      // Try smart template first
      let template = await masterTemplateService.getTemplate(templateIdNum, 'smart');
      if (template) return template;
      
      // Try standard template
      template = await masterTemplateService.getTemplate(templateIdNum, 'standard');
      if (template) return template;
      
      // Try workflow template
      template = await masterTemplateService.getTemplate(templateIdNum, 'workflow');
      if (template) return template;
      
      throw new Error('Template not found');
    },
    enabled: !!templateId,
  });

  // Handle smart template redirect in a separate effect to avoid infinite loops
  useEffect(() => {
    if (template && isSmartTemplate(template)) {
      navigate({ 
        to: '/templates/smart/$templateId', 
        params: { templateId },
        search: { mode },
        replace: true
      });
    }
  }, [template, templateId, mode, navigate]);

  const handleBack = useCallback(() => {
    navigate({ to: '/templates' });
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (!template) return;
    
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      if (template) {
        await masterTemplateService.deleteTemplate(Number(templateId), template.type);
      }
      toast.success('Template deleted successfully');
      navigate({ to: '/templates' });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  }, [template, templateId, navigate]);

  const handleDuplicate = useCallback(async () => {
    if (!template) return;
    
    try {
      // TODO: Implement template duplication logic
      toast.success('Template duplicated successfully');
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    }
  }, [template]);

  const handleUseTemplate = useCallback(() => {
    if (!template) return;
    
    // Navigate to document upload with this template pre-selected
    navigate({ 
      to: '/documents/upload',
      search: { 
        templateId: templateId.toString(),
        templateType: template.type,
        templateName: template.name 
      }
    });
  }, [template, templateId, navigate]);

  // Show loading while fetching template data
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
  if (template && isSmartTemplate(template)) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <span className="ml-2">Redirecting to smart template...</span>
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
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>

      {/* Template Viewer */}
      <UnifiedTemplateViewer
        template={template}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onUse={handleUseTemplate}
        showActions={true}
      />
    </div>
  );
}