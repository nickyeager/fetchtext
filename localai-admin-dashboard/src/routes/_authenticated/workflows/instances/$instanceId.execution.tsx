import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Play } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/workflows/instances/$instanceId/execution')({
  component: ExecutionTab,
});

function ExecutionTab() {
  const { instance, executionHistory, handleExecuteInstance, executing } = Route.useRouteContext();

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>
            Recent executions of this workflow instance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {executionHistory.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No executions yet</h3>
              <p className="text-muted-foreground mb-4">
                This workflow instance hasn't been executed yet.
              </p>
              {instance.deploymentStatus === 'active' && (
                <Button onClick={handleExecuteInstance} disabled={executing}>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Now
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {executionHistory.map((execution, index) => (
                <div
                  key={execution.id || index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      execution.status === 'success' ? 'bg-green-500' :
                      execution.status === 'error' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="font-medium">
                        Execution #{execution.id || index + 1}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : 'Unknown time'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    execution.status === 'success' ? 'default' :
                    execution.status === 'error' ? 'destructive' :
                    'secondary'
                  }>
                    {execution.status || 'pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
