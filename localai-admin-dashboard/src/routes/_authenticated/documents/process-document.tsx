import { createFileRoute } from '@tanstack/react-router';
import { DocumentWorkflow } from '@/features/documents/components/DocumentWorkflow';
import { Header } from '@/components/layout/header';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { ProfileDropdown } from '@/components/profile-dropdown';

interface ProcessDocumentSearch {
  templateId?: string | number;
  templateSource?: 'templates' | 'smart_templates';
}

function ProcessDocumentPage() {
  const { templateId, templateSource } = Route.useSearch();
  
  // Use the actual template ID from URL parameter
  console.log('ProcessDocumentPage templateId:', templateId);
  
  return (
    <div className="container mx-auto py-6">

      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <div className='ml-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>


      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Workflow</h1>
        <p className="text-muted-foreground">Process documents using enhanced AI extraction</p>
        {templateId && (
          <div className="flex gap-4 text-sm">
            <p className="text-blue-600">Template ID: {templateId}</p>
            {templateSource && <p className="text-green-600">Source: {templateSource}</p>}
          </div>
        )}
      </div>
      
      <DocumentWorkflow selectedTemplateId={templateId} templateSource={templateSource} />
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/documents/process-document')({
  component: ProcessDocumentPage,
  validateSearch: (search: Record<string, unknown>): ProcessDocumentSearch => {
    return {
      templateId: search.templateId ? String(search.templateId) : undefined,
      templateSource: search.templateSource === 'smart_templates' || search.templateSource === 'templates' 
        ? search.templateSource 
        : undefined,
    };
  },
});
