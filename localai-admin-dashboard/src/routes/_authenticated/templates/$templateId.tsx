import { createFileRoute, useNavigate, Outlet, useMatches } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TemplateViewer } from '@/components/templates/TemplateViewer';
import { templateService } from '@/services/template-service';

export const Route = createFileRoute('/_authenticated/templates/$templateId')({
  component: SmartTemplateViewPage,
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
  const matches = useMatches();

  // Check if we have an active child route (like /edit)
  const hasActiveChildRoute = matches.some(match =>
    match.routeId.includes('/edit') || match.routeId.endsWith('/$templateId/edit')
  );

  // Use React Query for proper caching and invalidation
  // Disable query when child route is active to avoid unnecessary fetches
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
    enabled: !!templateId && !hasActiveChildRoute,
  });

  const handleBack = () => {
    navigate({ to: '/templates' });
  };

  // If we have an active child route, just render the outlet
  if (hasActiveChildRoute) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (error || (!isLoading && !template)) {
    return (
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
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Templates
        </Button>
      </div>

      {/* Smart Template Viewer - View Only */}
      <TemplateViewer
        template={{
          ...(template as object as { [k: string]: unknown }),
          tags: (template?.tags || []) as string[],
          type: 'smart' as const
        } as any}
      />
    </div>
  );
}