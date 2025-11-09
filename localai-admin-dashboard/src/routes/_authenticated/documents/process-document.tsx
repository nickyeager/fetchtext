import { createFileRoute } from '@tanstack/react-router';
import { DocumentWorkflow } from '@/features/documents/components/DocumentWorkflow';
import { Header } from '@/components/layout/header';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { ProfileDropdown } from '@/components/profile-dropdown';

type TemplateSource = 'smart' | 'standard' | 'workflow' | 'gallery';
interface ProcessDocumentSearch {
  templateId?: string | number;
  // search param uses backend terms, map to internal TemplateSource
  templateSource?: 'templates' | 'smart_templates' | 'workflow' | 'gallery';
}

function ProcessDocumentPage() {
  const { templateId, templateSource } = Route.useSearch();
  // Map URL search param to internal TemplateSource union
  const mappedSource: TemplateSource | undefined =
    templateSource === 'smart_templates' ? 'smart'
    : templateSource === 'templates' ? 'standard'
    : templateSource === 'workflow' ? 'workflow'
    : templateSource === 'gallery' ? 'gallery'
    : undefined;
  
  // Use the actual template ID from URL parameter
  
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
      
  <DocumentWorkflow selectedTemplateId={templateId} templateSource={mappedSource} />
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/documents/process-document')({
  component: ProcessDocumentPage,
  validateSearch: (search: Record<string, unknown>): ProcessDocumentSearch => {
    return {
      templateId: search.templateId ? String(search.templateId) : undefined,
      templateSource: (
        search.templateSource === 'smart_templates' ||
        search.templateSource === 'templates' ||
        search.templateSource === 'workflow' ||
        search.templateSource === 'gallery'
      ) ? (search.templateSource as ProcessDocumentSearch['templateSource']) : undefined,
    };
  },
});
