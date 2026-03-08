import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertTriangle, Loader2, FileText, LayoutTemplate } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TemplateViewer } from '@/components/templates/TemplateViewer';
import { TemplateDocumentsList } from '@/features/templates/components/TemplateDocumentsList';
import { templateService } from '@/services/template-service';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { ThemeSwitch } from '@/components/theme-switch';

export const Route = createFileRoute('/_authenticated/templates/$templateId')({
  component: SmartTemplateViewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || 'overview',
  }),
  errorComponent: ({ error }) => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error loading smart template: {error.message || 'Unknown error occurred'}
        </AlertDescription>
      </Alert>
    </div>
  ),
  notFoundComponent: () => (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Smart template not found. It may have been deleted or you don't have permission to view it.
        </AlertDescription>
      </Alert>
    </div>
  ),
});

function SmartTemplateViewPage() {
  const navigate = useNavigate();
  const { templateId } = Route.useParams();
  const { tab } = Route.useSearch();

  const {
    data: template,
    isLoading,
    error
  } = useQuery({
    queryKey: ['smart-template', templateId],
    queryFn: async () => {
      const foundTemplate = await templateService.getTemplate(Number(templateId));
      if (!foundTemplate) {
        throw new Error('Smart template not found');
      }
      return foundTemplate;
    },
    enabled: !!templateId,
  });

  const handleBack = () => {
    navigate({ to: '/templates' });
  };

  const handleTabChange = (value: string) => {
    navigate({
      to: '/templates/$templateId',
      params: { templateId },
      search: { tab: value },
      replace: true,
    });
  };

  if (isLoading) {
    return (
      <>
        <Header>
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>
        <Main>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </Main>
      </>
    );
  }

  if (error || (!isLoading && !template)) {
    return (
      <>
        <Header>
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>
        <Main>
          <div className="container mx-auto p-6">
            <div className="flex items-center mb-6">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Templates
              </Button>
            </div>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error ? error.message : 'Smart template not found'}
              </AlertDescription>
            </Alert>
          </div>
        </Main>
      </>
    );
  }

  return (
    <>
      <Header>
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <div className="container mx-auto p-6">
          <div className="flex items-center mb-6">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Templates
            </Button>
            <h1 className="ml-4 text-xl font-semibold truncate">
              {template?.name}
            </h1>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="overview" className="gap-1.5">
                <LayoutTemplate className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Documents
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <TemplateViewer
                template={{
                  ...(template as object as { [k: string]: unknown }),
                  tags: (template?.tags || []) as string[],
                  type: 'smart' as const
                } as any}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <TemplateDocumentsList
                templateId={Number(templateId)}
                templateName={template?.name}
              />
            </TabsContent>
          </Tabs>
        </div>
      </Main>
    </>
  );
}
