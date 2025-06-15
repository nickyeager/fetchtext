import { useState, useCallback } from 'react';
import { TemplateGallery } from '@/components/templates/TemplateGallery';
import { TemplatePreviewModal } from '@/components/templates/TemplatePreviewModal';
import { CreateTemplateDialog } from '@/components/templates/CreateTemplateDialog';
import { WorkflowTemplate } from '@/types/workflows';
import { TemplateService } from '@/lib/template-service';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/templates/')({
  component: TemplateGalleryPage,
});

function TemplateGalleryPage() {
  const navigate = useNavigate();
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTemplates, setRefreshTemplates] = useState<(() => Promise<void>) | null>(null);

  const handlePreviewTemplate = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewModalOpen(true);
  }, []);

  const handleClosePreviewModal = useCallback(() => {
    setIsPreviewModalOpen(false);
    setSelectedTemplate(null);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleTemplateCreated = useCallback(async () => {
    handleCloseCreateModal();
    toast.success('Template created successfully!');
    
    // Trigger refresh if available
    if (refreshTemplates) {
      await refreshTemplates();
    }
  }, [refreshTemplates]);

  const handleRefreshFunctionReceived = useCallback((refreshFn: () => Promise<void>) => {
    setRefreshTemplates(() => refreshFn);
  }, []);

  const handleUseTemplate = useCallback(async (template: WorkflowTemplate) => {
    try {
      // Create a workflow instance from the template
      const instance = await TemplateService.createWorkflowInstance(template.id, {
        name: `${template.name} - Instance`,
        configuration: template.templateData,
      });
      
      toast.success(`Created workflow instance: ${template.name}`);
      
      // Navigate to the workflow editor
      navigate({ to: `/workflows/instances/${instance.id}` });
      
    } catch (error) {
      console.error('Error using template:', error);
      toast.error('Failed to create workflow instance. Please try again.');
    }
  }, [navigate]);

  const handleRateTemplate = useCallback(async (template: WorkflowTemplate, rating: number, comment?: string) => {
    try {
      await TemplateService.rateTemplate(template.id, rating, comment);
      toast.success('Thank you for your rating!');
      
      // Refresh the templates to show updated rating
      if (refreshTemplates) {
        await refreshTemplates();
      }
      
      // Also update the selected template if it's the one being rated
      if (selectedTemplate && selectedTemplate.id === template.id) {
        const updatedTemplate = await TemplateService.getTemplate(template.id);
        if (updatedTemplate) setSelectedTemplate(updatedTemplate);
      }
      return;
    } catch (error) {
      console.error('Error rating template:', error);
      toast.error('Failed to rate template. Please try again.');
    }
  }, [refreshTemplates, selectedTemplate]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Workflow Template Gallery</h1>
      <TemplateGallery
        onPreviewTemplate={handlePreviewTemplate}
        onUseTemplate={handleUseTemplate} 
        onCreateTemplate={handleOpenCreateModal}
        onRefresh={handleRefreshFunctionReceived}
      />
      {selectedTemplate && (
        <TemplatePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={handleClosePreviewModal}
          template={selectedTemplate}
          onUse={() => handleUseTemplate(selectedTemplate)}
          onRate={handleRateTemplate}
        />
      )}
      <CreateTemplateDialog
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleTemplateCreated}
      />
    </div>
  )
}
