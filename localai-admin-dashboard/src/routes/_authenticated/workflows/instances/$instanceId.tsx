import { useState, useEffect } from 'react';
import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Play, 
  Pause, 
  Save, 
  ArrowLeft, 
  Settings,
  Activity,
  FileText,
  RefreshCw,
  ExternalLink,
  Edit,
  MonitorPlay
} from 'lucide-react';
import { WorkflowInstance } from '@/types/workflows';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';
import { WorkflowClient } from '@/lib/workflow-client';
import { VisualWorkflowEditor } from '@/components/workflows/VisualWorkflowEditor';
import { RealtimeExecutionMonitor } from '@/components/workflows/RealtimeExecutionMonitor';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/workflows/instances/$instanceId')({
  component: WorkflowInstanceEditorPage,
});

function WorkflowInstanceEditorPage() {
  const { instanceId } = useParams({ from: '/_authenticated/workflows/instances/$instanceId' });
  const navigate = useNavigate();
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);

  const workflowClient = new WorkflowClient();

  const loadInstance = async () => {
    try {
      setLoading(true);
      const data = await WorkflowInstanceService.getInstance(instanceId);
      if (data) {
        // Add templateType from the relation if available
        data.templateType = data.workflow_templates?.template_type || 'other';
        setInstance(data);
      }        // Load execution history if deployed
        if (data && data.deployedWorkflowId) {
          try {
            const history = await workflowClient.getExecutionHistory(data);
            setExecutionHistory(history);
          } catch (error) {
            console.error('Error loading execution history:', error);
          }
        }
    } catch (error) {
      console.error('Error loading instance:', error);
      toast.error('Failed to load workflow instance');
      navigate({ to: '/workflows/instances' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstance();
  }, [instanceId]);

  const handleSaveInstance = async () => {
    if (!instance) return;
    
    try {
      setSaving(true);
      await WorkflowInstanceService.updateInstance(instance.id, {
        name: instance.name,
        configuration: instance.configuration,
      });
      toast.success('Instance saved successfully');
    } catch (error) {
      console.error('Error saving instance:', error);
      toast.error('Failed to save instance');
    } finally {
      setSaving(false);
    }
  };

  const handleDeployInstance = async () => {
    if (!instance) return;

    try {
      setSaving(true);
      setDeploymentLogs(['Starting deployment...']);
      
      const deployedId = await workflowClient.deployInstance(instance);
      
      setDeploymentLogs(prev => [...prev, 'Deployment completed successfully']);
      toast.success('Instance deployed successfully');
      
      // Reload instance to get updated deployment status
      await loadInstance();
    } catch (error: any) {
      console.error('Error deploying instance:', error);
      setDeploymentLogs(prev => [...prev, `Deployment failed: ${error?.message || 'Unknown error'}`]);
      toast.error('Failed to deploy instance');
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteInstance = async () => {
    if (!instance) return;

    try {
      setExecuting(true);
      const result = await workflowClient.executeInstance(instance);
      toast.success(`Execution started - ID: ${result.executionId}`);
      
      // Reload execution history
      setTimeout(async () => {
        try {
          const history = await workflowClient.getExecutionHistory(instance);
          setExecutionHistory(history);
        } catch (error) {
          console.error('Error loading execution history:', error);
        }
      }, 2000);
    } catch (error: any) {
      console.error('Error executing instance:', error);
      toast.error('Failed to execute workflow');
    } finally {
      setExecuting(false);
    }
  };

  const handleToggleActivation = async () => {
    if (!instance) return;

    try {
      if (instance.isActive) {
        await WorkflowInstanceService.deactivateInstance(instance.id);
        toast.success('Instance deactivated');
      } else {
        await WorkflowInstanceService.activateInstance(instance.id);
        toast.success('Instance activated');
      }
      await loadInstance();
    } catch (error) {
      console.error('Error toggling activation:', error);
      toast.error('Failed to toggle instance activation');
    }
  };

  const getStatusBadge = () => {
    if (!instance) return null;
    
    const status = instance.deploymentStatus || 'draft';
    const isActive = instance.isActive;

    switch (status) {
      case 'active':
        return (
          <Badge variant={isActive ? 'default' : 'secondary'} className="gap-1">
            {isActive ? <CheckCircle className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {isActive ? 'Active' : 'Deployed (Paused)'}
          </Badge>
        );
      case 'deploying':
        return (
          <Badge variant="outline" className="gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Deploying
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" />
            Error
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="secondary" className="gap-1">
            <Pause className="w-3 h-3" />
            Inactive
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            Draft
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Workflow instance not found</h3>
            <Button onClick={() => navigate({ to: '/workflows/instances' })}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Instances
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate({ to: '/workflows/instances' })}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{instance.name}</h1>
              {getStatusBadge()}
            </div>
            <p className="text-muted-foreground">
              Template: {instance.workflow_templates?.name || 'Unknown'}
              {instance.workflow_templates?.template_type && (
                <Badge variant="outline" className="ml-2">
                  {instance.workflow_templates.template_type}
                </Badge>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {instance.deploymentStatus === 'active' && (
            <Button
              onClick={handleExecuteInstance}
              disabled={executing}
              className="gap-2"
            >
              {executing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Execute
            </Button>
          )}
          
          {instance.deploymentStatus === 'draft' || instance.deploymentStatus === 'error' ? (
            <Button
              onClick={handleDeployInstance}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Deploy
            </Button>
          ) : (
            <Button
              onClick={handleToggleActivation}
              variant="outline"
              className="gap-2"
            >
              {instance.isActive ? (
                <>
                  <Pause className="w-4 h-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Activate
                </>
              )}
            </Button>
          )}

          <Button
            onClick={handleSaveInstance}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configuration" className="gap-2">
            <Settings className="w-4 h-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Activity className="w-4 h-4" />
            Visual Editor
          </TabsTrigger>
          <TabsTrigger value="execution" className="gap-2">
            <Activity className="w-4 h-4" />
            Execution History
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-2">
            <Activity className="w-4 h-4" />
            Live Monitor
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="w-4 h-4" />
            Deployment Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
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

          {/* Template-specific configuration would go here */}
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
        </TabsContent>

        <TabsContent value="editor" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="execution" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="monitor" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
