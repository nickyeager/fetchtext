import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertTriangle, Loader2, FileText, LayoutTemplate, BookOpen, Pencil } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TemplateViewer } from '@/components/templates/TemplateViewer';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { TemplateDocumentsList } from '@/features/templates/components/TemplateDocumentsList';
import { TemplateExemplarsList } from '@/features/templates/components/TemplateExemplarsList';
import { templateService } from '@/services/template-service';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const { templateId } = Route.useParams();
  const { tab } = Route.useSearch();
  const [isEditing, setIsEditing] = useState(false);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveTemplate = async (updated: any) => {
    try {
      await templateService.updateTemplate(Number(templateId), updated);
      toast.success('Template updated successfully');
      await queryClient.invalidateQueries({ queryKey: ['smart-template', templateId] });
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Failed to save template');
    }
  };

  if (isLoading) {
    return (
      <>
        <Header />
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
        <Header />
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

  // ── Editing mode: show full TemplateEditor ──────────────────────
  if (isEditing && template) {
    return (
      <>
        <Header />
        <Main>
          <TemplateEditor
            template={template}
            onSave={handleSaveTemplate}
            onCancel={() => setIsEditing(false)}
            isEditMode
          />
        </Main>
      </>
    );
  }

  // ── View mode: tabs with overview, documents, examples ────────
  return (
    <>
      <Header />
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
            <div className="ml-auto">
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Template
              </Button>
            </div>
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
              <TabsTrigger value="exemplars" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                Examples
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

            <TabsContent value="exemplars" className="mt-4">
              <TemplateExemplarsList
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
