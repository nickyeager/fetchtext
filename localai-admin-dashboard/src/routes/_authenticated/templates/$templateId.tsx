import React, { useEffect } from 'react';
import { createFileRoute, useNavigate, Outlet, useMatches } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TemplateViewer } from '@/components/templates/TemplateViewer';
import { templateService } from '@/services/template-service';

interface SmartTemplateViewSearch {
  mode?: 'view' | 'edit';
}

export const Route = createFileRoute('/_authenticated/templates/$templateId')({
  validateSearch: (search: Record<string, unknown>): SmartTemplateViewSearch => ({
    mode: (search.mode as 'view' | 'edit') || 'view',
  }),
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
  const { mode } = Route.useSearch();
  const matches = useMatches();
  
  // Render debug: templateId, mode

  // Use React Query for proper caching and invalidation
  const { 
    data: template, 
    isLoading, 
    error,
    refetch 
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

  // Redirect to edit route if mode=edit
  useEffect(() => {
    if (mode === 'edit') {
      navigate({ 
        to: '/templates/$templateId/edit', 
        params: { templateId },
        replace: true
      });
    }
  }, [mode, templateId, navigate]);

  // Clean up URL when component mounts to remove leftover query params
  useEffect(() => {
    if (mode !== 'edit' && window.location.search.includes('mode=view')) {
      navigate({ 
        to: '/templates/$templateId', 
        params: { templateId },
        replace: true 
      });
    }
  }, [mode, templateId, navigate]);


  const handleBack = () => {
    navigate({ to: '/templates' });
  };

  // Use template is handled elsewhere via actions; no-op here

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

  // Don't render if redirecting to edit
  if (mode === 'edit') {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <span className="ml-2">Redirecting to edit mode...</span>
        </div>
      </div>
    );
  }

  // Check if we have an active child route (like /edit)
  const hasActiveChildRoute = matches.some(match => match.routeId.includes('/edit'));

  // If we have an active child route, just render the outlet
  if (hasActiveChildRoute) {
    return <Outlet />;
  }

  return (
    <div className="container mx-auto p-6">
      {/* Debug header to confirm we're on the view route */}
      <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded">
        <h2 className="text-blue-800 font-bold">👀 VIEW MODE - Smart Template Viewer</h2>
        <p className="text-sm text-blue-600">Template ID: {templateId} | Mode: {mode}</p>
        <p className="text-xs text-blue-500">Active routes: {matches.map(m => m.routeId).join(' > ')}</p>
      </div>

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