import { useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  MoreHorizontal, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Search,
  Plus,
  RefreshCw,
  Filter
} from 'lucide-react';
import { WorkflowInstance } from '@/types/workflows';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';
import { WorkflowClient } from '@/lib/workflow-client';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/workflows/instances/')({
  component: WorkflowInstancesPage,
});

function WorkflowInstancesPage() {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const workflowClient = new WorkflowClient();

  const loadInstances = useCallback(async () => {
    try {
      setLoading(true);
      const data = await WorkflowInstanceService.getInstances();
      setInstances(data);
      setFilteredInstances(data);
    } catch (error) {
      console.error('Error loading instances:', error);
      toast.error('Failed to load workflow instances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Filter instances based on search and filters
  useEffect(() => {
    let filtered = instances;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(instance =>
        instance.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        instance.workflow_templates?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(instance => {
        switch (statusFilter) {
          case 'active':
            return instance.isActive && instance.deploymentStatus === 'active';
          case 'inactive':
            return !instance.isActive || instance.deploymentStatus === 'inactive';
          case 'error':
            return instance.deploymentStatus === 'error';
          case 'draft':
            return instance.deploymentStatus === 'draft' || !instance.deploymentStatus;
          default:
            return true;
        }
      });
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(instance => 
        instance.workflow_templates?.template_type === typeFilter
      );
    }

    setFilteredInstances(filtered);
  }, [instances, searchQuery, statusFilter, typeFilter]);

  const handleActivateInstance = async (instance: WorkflowInstance) => {
    try {
      if (instance.deploymentStatus !== 'active') {
        // Deploy if not already deployed
        await workflowClient.deployInstance(instance);
        toast.success(`Deployed and activated ${instance.name}`);
      } else {
        // Just activate
        await WorkflowInstanceService.activateInstance(instance.id);
        toast.success(`Activated ${instance.name}`);
      }
      await loadInstances();
    } catch (error) {
      console.error('Error activating instance:', error);
      toast.error('Failed to activate workflow instance');
    }
  };

  const handleDeactivateInstance = async (instance: WorkflowInstance) => {
    try {
      await WorkflowInstanceService.deactivateInstance(instance.id);
      toast.success(`Deactivated ${instance.name}`);
      await loadInstances();
    } catch (error) {
      console.error('Error deactivating instance:', error);
      toast.error('Failed to deactivate workflow instance');
    }
  };

  const handleDeleteInstance = async (instance: WorkflowInstance) => {
    if (!confirm(`Are you sure you want to delete "${instance.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Undeploy if deployed
      if (instance.deployedWorkflowId) {
        await workflowClient.undeployInstance(instance);
      }
      
      await WorkflowInstanceService.deleteInstance(instance.id);
      toast.success(`Deleted ${instance.name}`);
      await loadInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast.error('Failed to delete workflow instance');
    }
  };

  const handleExecuteInstance = async (instance: WorkflowInstance) => {
    try {
      const result = await workflowClient.executeInstance(instance);
      toast.success(`Executed ${instance.name} - ID: ${result.executionId}`);
    } catch (error) {
      console.error('Error executing instance:', error);
      toast.error('Failed to execute workflow instance');
    }
  };

  const getStatusBadge = (instance: WorkflowInstance) => {
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

  const getTypeIcon = (templateType: string) => {
    switch (templateType) {
      case 'n8n':
        return '🔧';
      case 'flowise':
        return '🤖';
      case 'hybrid':
        return '🔀';
      default:
        return '📄';
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Instances</h1>
          <p className="text-muted-foreground">
            Manage your deployed workflow instances
          </p>
        </div>
        <Button onClick={() => window.location.href = '/templates'}>
          <Plus className="w-4 h-4 mr-2" />
          Create from Template
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search instances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Status: {statusFilter === 'all' ? 'All' : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                All Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('draft')}>
                Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('error')}>
                Error
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Type: {typeFilter === 'all' ? 'All' : typeFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                All Types
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('n8n')}>
                N8N
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('flowise')}>
                Flowise
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('hybrid')}>
                Hybrid
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={loadInstances}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Instances Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Instances ({filteredInstances.length})
          </CardTitle>
          <CardDescription>
            {instances.length > filteredInstances.length && 
              `Showing ${filteredInstances.length} of ${instances.length} instances`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInstances.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workflow instances found</h3>
              <p className="text-muted-foreground mb-4">
                {instances.length === 0 
                  ? "Create your first workflow instance from a template"
                  : "Try adjusting your search or filters"
                }
              </p>
              {instances.length === 0 && (
                <Button onClick={() => window.location.href = '/templates'}>
                  Browse Templates
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Executed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{getTypeIcon(instance.workflow_templates?.template_type || 'other')}</span>
                        {instance.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {instance.workflow_templates?.name || 'Unknown Template'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {instance.workflow_templates?.template_type || 'other'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(instance)}
                      {instance.deploymentError && (
                        <div className="text-xs text-red-500 mt-1">
                          {instance.deploymentError}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {instance.lastExecutedAt 
                        ? new Date(instance.lastExecutedAt).toLocaleDateString()
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(instance.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => window.location.href = `/workflows/instances/${instance.id}`}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          
                          {instance.deploymentStatus === 'active' && (
                            <DropdownMenuItem onClick={() => handleExecuteInstance(instance)}>
                              <Play className="w-4 h-4 mr-2" />
                              Execute
                            </DropdownMenuItem>
                          )}
                          
                          {instance.isActive ? (
                            <DropdownMenuItem onClick={() => handleDeactivateInstance(instance)}>
                              <Pause className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivateInstance(instance)}>
                              <Play className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem 
                            onClick={() => handleDeleteInstance(instance)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
