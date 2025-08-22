import { createFileRoute } from '@tanstack/react-router';
import { DocumentUploadPage } from '@/features/documents/components/DocumentUploadPage';

interface DocumentUploadSearch {
  templateId?: string;
  templateType?: 'smart' | 'standard' | 'workflow';
  templateName?: string;
}

export const Route = createFileRoute('/_authenticated/documents/upload')({
  validateSearch: (search: Record<string, unknown>): DocumentUploadSearch => {
    // Clean up templateId by removing quotes if they exist
    let cleanTemplateId = search.templateId as string;
    if (cleanTemplateId && typeof cleanTemplateId === 'string') {
      cleanTemplateId = cleanTemplateId.replace(/^["']|["']$/g, '');
    }
    
    return {
      templateId: cleanTemplateId,
      templateType: search.templateType as 'smart' | 'standard' | 'workflow',
      templateName: search.templateName as string,
    };
  },
  component: DocumentUpload,
});

function DocumentUpload() {
  const { templateId, templateType, templateName } = Route.useSearch();
  
  console.log('DocumentUpload: Search params:', { templateId, templateType, templateName });
  
  return (
    <div className="container mx-auto py-6">
      <DocumentUploadPage 
        preSelectedTemplate={templateId ? {
          id: templateId,
          type: templateType,
          name: templateName
        } : undefined}
      />
    </div>
  );
}