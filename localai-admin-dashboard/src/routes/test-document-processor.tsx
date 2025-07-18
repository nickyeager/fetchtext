import { createFileRoute } from '@tanstack/react-router';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

function TestDocumentProcessor() {
  const mockTemplate = {
    id: 1,
    uuid: 'test-uuid',
    name: 'Business Proposal Template',
    description: 'Template for creating professional business proposals with AI extraction',
    template_content: `# Business Proposal

**Client:** {{company_name}}
**Project:** {{project_title}}
**Budget:** {{project_budget}}
**Timeline:** {{project_timeline}}
**Contact:** {{contact_person}}

## Project Overview
This proposal outlines the scope of work for {{project_title}} with an estimated budget of {{project_budget}}.

## Next Steps
We look forward to working with {{company_name}} and {{contact_person}} on this exciting project.`,
    smart_variables: [
      {
        id: '1',
        name: 'company_name',
        type: 'text' as const,
        description: 'Name of the client company',
        extraction_hints: ['company', 'business name', 'organization', 'corp', 'inc'],
        default_value: ''
      },
      {
        id: '2',
        name: 'project_title',
        type: 'text' as const,
        description: 'Title or name of the project',
        extraction_hints: ['project', 'title', 'name', 'subject'],
        default_value: ''
      },
      {
        id: '3',
        name: 'project_budget',
        type: 'currency' as const,
        description: 'Total budget for the project',
        extraction_hints: ['budget', 'cost', 'price', 'amount', 'fee', '$'],
        default_value: 0
      },
      {
        id: '4',
        name: 'project_timeline',
        type: 'text' as const,
        description: 'Expected timeline for project completion',
        extraction_hints: ['timeline', 'duration', 'deadline', 'completion'],
        default_value: ''
      },
      {
        id: '5',
        name: 'contact_person',
        type: 'text' as const,
        description: 'Primary contact person for the project',
        extraction_hints: ['contact', 'person', 'manager', 'representative'],
        default_value: ''
      }
    ],
    category: 'business'
  };

  const handleGenerationComplete = (document: any) => {
    console.log('Document generated:', document);
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 mb-6">
        <h1 className="text-2xl font-bold">🧪 TEST ROUTE - Document Processor</h1>
        <p className="text-blue-100">This is what should render at /documents/process-document?templateId=1</p>
        <p className="text-sm text-blue-200 mt-2">
          Full URL: <code>http://localhost:5173/documents/process-document?templateId=1</code>
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

export const Route = createFileRoute('/test-document-processor')({
  component: TestDocumentProcessor,
}); 