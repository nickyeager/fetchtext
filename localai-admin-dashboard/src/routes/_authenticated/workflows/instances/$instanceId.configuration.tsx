import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WorkflowInstance } from '@/types/workflows';

export const Route = createFileRoute('/_authenticated/workflows/instances/$instanceId/configuration')({
  component: ConfigurationTab,
});

function ConfigurationTab() {
  const { instance, setInstance } = Route.useRouteContext();

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Configure the basic settings for your workflow instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Instance Name</Label>
              <Input
                id="name"
                value={instance.name}
                onChange={(e) => setInstance({
                  ...instance,
                  name: e.target.value
                })}
                placeholder="Enter instance name"
              />
            </div>
            <div>
              <Label htmlFor="template">Template</Label>
              <Input
                id="template"
                value={instance.workflow_templates?.name || 'Unknown'}
                disabled
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={instance.configuration?.description || ''}
              onChange={(e) => setInstance({
                ...instance,
                configuration: {
                  ...instance.configuration,
                  description: e.target.value
                }
              })}
              placeholder="Describe this workflow instance..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Template-specific configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Parameters</CardTitle>
          <CardDescription>
            Template-specific configuration parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              Configuration parameters will be dynamically generated based on the template.
            </p>
            <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-48">
              {JSON.stringify(instance.configuration || {}, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
