import { createFileRoute } from '@tanstack/react-router';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

interface ProcessDocumentSearch {
  templateId?: string;
}

function ProcessDocumentPage() {
  const { templateId } = Route.useSearch();
  
  // Mock template for now
  const mockTemplate = {
    id: parseInt(templateId || '1'),
    uuid: 'test-uuid',
    name: 'Test Template',
    description: 'Test description for document processing',
    template_content: 'Test content',
    template_type: 'document',
    smart_variables: [],
    extraction_rules: [],
    generation_settings: {},
    category: 'test',
    tags: [],
    usage_count: 0,
    rating: 5,
    is_public: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const handleGenerationComplete = (document: any) => {
    console.log('Document generated:', document);
  };

  const handleBack = () => {
    window.history.back();
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Processor</h1>
        <p className="text-gray-600">Process documents using AI extraction</p>
        {templateId && <p className="text-sm text-blue-600">Template ID: {templateId}</p>}
      </div>
      
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={handleGenerationComplete}
        onBack={handleBack}
      />
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/documents/process-document-new')({
  component: ProcessDocumentPage,
  validateSearch: (search: Record<string, unknown>): ProcessDocumentSearch => {
    return {
      templateId: typeof search.templateId === 'string' ? search.templateId : undefined,
    };
  },
});
