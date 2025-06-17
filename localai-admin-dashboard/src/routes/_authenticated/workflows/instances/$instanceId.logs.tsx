import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';

export const Route = createFileRoute('/_authenticated/workflows/instances/$instanceId/logs')({
  loader: async ({ params }) => {
    const instance = await WorkflowInstanceService.getInstance(params.instanceId);
    // For now, return empty deployment logs - this would be fetched from a deployment service
    const deploymentLogs: string[] = [];
    
    return {
      instance,
      deploymentLogs,
    };
  },
  component: LogsTab,
});

function LogsTab() {
  const { instance, deploymentLogs } = Route.useLoaderData();

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deployment Logs</CardTitle>
          <CardDescription>
            Logs from the deployment process
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deploymentLogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deployment logs</h3>
              <p className="text-muted-foreground">
                Deployment logs will appear here when you deploy the workflow.
              </p>
            </div>
          ) : (
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-auto">
              {deploymentLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">
                    [{new Date().toISOString()}]
                  </span>{' '}
                  {log}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
