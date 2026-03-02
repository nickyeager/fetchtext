import { createFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
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
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <DocumentUploadPage
          preSelectedTemplate={templateId ? {
            id: templateId,
            type: templateType,
            name: templateName
          } : undefined}
        />
      </Main>
    </>
  );
}