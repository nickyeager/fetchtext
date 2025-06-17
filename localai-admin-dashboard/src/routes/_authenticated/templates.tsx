import { useState, useCallback } from 'react';
import { TemplateGallery } from '@/components/templates/TemplateGallery';
import { TemplatePreviewModal } from '@/components/templates/TemplatePreviewModal';
import { CreateTemplateDialog } from '@/components/templates/CreateTemplateDialog';
import { WorkflowTemplate } from '@/types/workflows';
import { TemplateService } from '@/lib/template-service';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/templates')({
  component: () => <div>TEST: Templates route is working!</div>,
});

function TemplateGalleryPage() {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTemplates, setRefreshTemplates] = useState<(() => Promise<void>) | null>(null);
  // const router = useRouter(); // Assuming you have access to the router instance

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

  // Store the refresh function from TemplateGallery
  const handleRefreshFunctionReceived = useCallback((refreshFn: () => Promise<void>) => {
    setRefreshTemplates(() => refreshFn);
  }, []);

  // This function will be called by CreateTemplateDialog upon successful creation
  const handleTemplateCreated = useCallback(async () => {
    setIsCreateModalOpen(false);
    toast.success("Template created successfully!");
    // Refresh the template gallery to show the new template
    if (refreshTemplates) {
      await refreshTemplates();
    }
  }, [refreshTemplates]);

  const handleUseTemplate = useCallback(async (template: WorkflowTemplate) => {
    try {
      const instanceId = await TemplateService.useTemplate(
        template.id, 
        `${template.name} - Instance`,
        {} 
      );
      
      toast.success(`Template "${template.name}" has been added to your workflows!`);
      console.log('Created workflow instance:', instanceId);
      
      // TODO: Navigate to the workflow editor or instance management page
      // Example: router.navigate({ to: '/workflows/$instanceId', params: { instanceId } });
      
      handleClosePreviewModal();
    } catch (error) {
      console.error('Error using template:', error);
      toast.error('Failed to use template. Please try again.');
    }
  }, [handleClosePreviewModal]);

  const handleRateTemplate = useCallback(async (template: WorkflowTemplate, rating: number) => {
    try {
      await TemplateService.rateTemplate(template.id, rating);
      toast.success(`Rated "${template.name}" with ${rating} stars!`);
      
      // Refresh the template data to show updated rating
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
          onUse={() => handleUseTemplate(selectedTemplate)} // Corrected prop name
          onRate={handleRateTemplate}
        />
      )}
      <CreateTemplateDialog
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleTemplateCreated} // Changed from onSubmit to onSuccess
      />
    </div>
  );
}

export default TemplateGalleryPage;
