import { createFileRoute } from '@tanstack/react-router';
import { RealtimeExecutionMonitor } from '@/components/workflows/RealtimeExecutionMonitor';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/workflows/instances/$instanceId/monitor')({
  component: MonitorTab,
});

function MonitorTab() {
  const { instance } = Route.useRouteContext();

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  return (
    <div className="space-y-6">
      <RealtimeExecutionMonitor
        instanceId={instance.id}
        onExecutionStart={(executionId) => {
          console.log('Execution started:', executionId);
          toast.success(`Execution started - ID: ${executionId}`);
        }}
        onExecutionStop={(executionId) => {
          console.log('Execution stopped:', executionId);
          toast.info(`Execution stopped - ID: ${executionId}`);
        }}
      />
    </div>
  );
}
