import { createFileRoute } from '@tanstack/react-router';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

interface DocumentTestSearch {
  templateId?: string;
}

function DocumentTestPage() {
  const { templateId } = Route.useSearch();
  
  // Mock template for testing
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

  const handleGenerationComplete = (_generatedDocument: string) => {
    // Handle document generation completion
    console.log('Document generation completed!');
  };

  const handleBack = () => {
    window.history.back();
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Processor (Test - No Auth)</h1>
        <p className="text-gray-600">Process documents using AI extraction</p>
        {templateId && <p className="text-sm text-blue-600">Template ID: {templateId}</p>}
        <p className="text-sm text-amber-600 mt-2">
          ⚠️ This is a test route without authentication. Use /documents/process-document for the authenticated version.
        </p>
      </div>
      
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={handleGenerationComplete}
        onBack={handleBack}
      />
    </div>
  );
}

export const Route = createFileRoute('/documents-test')({
  component: DocumentTestPage,
  validateSearch: (search: Record<string, unknown>): DocumentTestSearch => {
    return {
      templateId: typeof search.templateId === 'string' ? search.templateId : undefined,
    };
  },
}); 