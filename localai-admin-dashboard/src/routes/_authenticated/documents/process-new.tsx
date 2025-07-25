import { createFileRoute } from '@tanstack/react-router';
import { VisualWorkflowEditor } from '@/components/workflows/VisualWorkflowEditor';

interface DocumentProcessSearch {
  templateId?: string;
}

function DocumentProcessPage() {
  const { templateId } = Route.useSearch();
  
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Workflow Editor</h1>
        <p className="text-gray-600">Design your document processing workflow</p>
        {templateId && <p className="text-sm text-blue-600">Template ID: {templateId}</p>}
      </div>
      
      <div className="bg-white border rounded-lg shadow-sm">
        <VisualWorkflowEditor />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/documents/process-new')({
  component: DocumentProcessPage,
  validateSearch: (search: Record<string, unknown>): DocumentProcessSearch => {
    return {
      templateId: typeof search.templateId === 'string' ? search.templateId : undefined,
    };
  },
});
