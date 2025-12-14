import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VisualWorkflowEditor } from '@/components/workflows/VisualWorkflowEditor';

export const Route = createFileRoute('/_authenticated/workflows/instances/$instanceId/editor')({
  component: EditorTab,
});

function EditorTab() {
  const { instance, setInstance } = Route.useRouteContext();

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="h-[800px]">
        <CardHeader>
          <CardTitle>Visual Workflow Editor</CardTitle>
          <CardDescription>
            Design your workflow using the visual editor
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full p-0">
          <div className="h-full">
            <VisualWorkflowEditor
              workflow={{
                nodes: instance.configuration?.nodes || [],
                connections: instance.configuration?.connections || []
              }}
              onWorkflowChange={(updatedWorkflow) => {
                setInstance({
                  ...instance,
                  configuration: {
                    ...instance.configuration,
                    nodes: updatedWorkflow.nodes,
                    connections: updatedWorkflow.connections
                  }
                });
              }}
              readonly={instance.deploymentStatus === 'active'}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
