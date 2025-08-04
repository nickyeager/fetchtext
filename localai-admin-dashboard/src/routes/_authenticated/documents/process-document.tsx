import { createFileRoute } from '@tanstack/react-router';
import { DocumentWorkflow } from '@/features/documents/components/DocumentWorkflow';
import { Header } from '@/components/layout/header';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { ProfileDropdown } from '@/components/profile-dropdown';

interface ProcessDocumentSearch {
  templateId?: string | number;
}

function ProcessDocumentPage() {
  const { templateId } = Route.useSearch();
  
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
        {templateId && <p className="text-sm text-blue-600">Template ID: {templateId}</p>}
      </div>
      
      <DocumentWorkflow selectedTemplateId={templateId} />
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/documents/process-document')({
  component: ProcessDocumentPage,
  validateSearch: (search: Record<string, unknown>): ProcessDocumentSearch => {
    return {
      templateId: search.templateId ? String(search.templateId) : undefined,
    };
  },
});
