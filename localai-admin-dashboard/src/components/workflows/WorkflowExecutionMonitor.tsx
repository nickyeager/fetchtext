import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause, 
  RotateCcw,
  Filter,
  RefreshCw
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'error' | 'cancelled' | 'waiting';
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  triggeredBy: string;
  errorMessage?: string;
  nodeExecutions: NodeExecution[];
  metrics?: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
  };
}

export interface NodeExecution {
  id: string;
  nodeId: string;
  nodeName: string;
  status: 'waiting' | 'running' | 'success' | 'error' | 'skipped';
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  inputData?: any;
  outputData?: any;
  errorMessage?: string;
}

interface WorkflowExecutionMonitorProps {
  workflowId?: string;
  executions?: WorkflowExecution[];
  onExecutionSelect?: (execution: WorkflowExecution) => void;
  onRetryExecution?: (executionId: string) => void;
  onCancelExecution?: (executionId: string) => void;
  refreshInterval?: number;
}

export function WorkflowExecutionMonitor({
  workflowId,
  executions = [],
  onExecutionSelect,
  onRetryExecution,
  onCancelExecution,
  refreshInterval = 5000,
}: WorkflowExecutionMonitorProps) {
  const [filteredExecutions, setFilteredExecutions] = useState<WorkflowExecution[]>(executions);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh executions
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // In a real implementation, this would fetch fresh execution data
      console.log('Refreshing execution data...');
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Filter executions based on status
  useEffect(() => {
    let filtered = executions;
    
    if (statusFilter !== 'all') {
      filtered = executions.filter(execution => execution.status === statusFilter);
    }

    if (workflowId) {
      filtered = filtered.filter(execution => execution.workflowId === workflowId);
    }

    setFilteredExecutions(filtered);
  }, [executions, statusFilter, workflowId]);

  const handleExecutionClick = (execution: WorkflowExecution) => {
    setSelectedExecution(execution);
    onExecutionSelect?.(execution);
  };

  const handleRetry = (executionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onRetryExecution?.(executionId);
  };

  const handleCancel = (executionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onCancelExecution?.(executionId);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Execution Monitor</h3>
          <Badge variant="outline">{filteredExecutions.length}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Status: {statusFilter === 'all' ? 'All' : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                All Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('running')}>
                Running
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('success')}>
                Success
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('error')}>
                Error
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('cancelled')}>
                Cancelled
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Executions List */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {filteredExecutions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No executions found</h3>
                  <p className="text-muted-foreground">
                    {statusFilter === 'all' 
                      ? "No workflow executions yet"
                      : `No ${statusFilter} executions found`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {filteredExecutions.map((execution) => (
                    <ExecutionListItem
                      key={execution.id}
                      execution={execution}
                      selected={selectedExecution?.id === execution.id}
                      onClick={() => handleExecutionClick(execution)}
                      onRetry={(e) => handleRetry(execution.id, e)}
                      onCancel={(e) => handleCancel(execution.id, e)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Execution Details */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Execution Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedExecution ? (
              <ExecutionDetails execution={selectedExecution} />
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select an execution</h3>
                <p className="text-muted-foreground">
                  Click on an execution to view its details
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ExecutionListItemProps {
  execution: WorkflowExecution;
  selected: boolean;
  onClick: () => void;
  onRetry: (e: React.MouseEvent) => void;
  onCancel: (e: React.MouseEvent) => void;
}

function ExecutionListItem({ execution, selected, onClick, onRetry, onCancel }: ExecutionListItemProps) {
  const duration = execution.duration || 
    (execution.finishedAt && execution.startedAt 
      ? new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()
      : Date.now() - new Date(execution.startedAt).getTime());

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        selected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            #{execution.id.slice(-6)}
          </Badge>
          {getStatusBadge(execution.status)}
        </div>
        
        <div className="flex items-center gap-1">
          {execution.status === 'error' && (
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0"
              onClick={onRetry}
              title="Retry execution"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
          
          {execution.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0"
              onClick={onCancel}
              title="Cancel execution"
            >
              <XCircle className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-sm">{execution.workflowName}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Started {new Date(execution.startedAt).toLocaleString()}</span>
          <span>{formatDuration(duration)}</span>
        </div>
        
        {execution.metrics && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{execution.metrics.completedNodes}/{execution.metrics.totalNodes} nodes</span>
            {execution.metrics.failedNodes > 0 && (
              <span className="text-red-500">
                {execution.metrics.failedNodes} failed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionDetails({ execution }: { execution: WorkflowExecution }) {
  const duration = execution.duration || 
    (execution.finishedAt && execution.startedAt 
      ? new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()
      : Date.now() - new Date(execution.startedAt).getTime());

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Execution ID</label>
          <p className="text-sm font-mono">#{execution.id}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <div className="mt-1">{getStatusBadge(execution.status)}</div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Started</label>
          <p className="text-sm">{new Date(execution.startedAt).toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Duration</label>
          <p className="text-sm">{formatDuration(duration)}</p>
        </div>
      </div>

      {/* Error Message */}
      {execution.errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{execution.errorMessage}</p>
        </div>
      )}

      {/* Node Executions */}
      <div>
        <h4 className="font-medium mb-2">Node Executions</h4>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {execution.nodeExecutions.map((nodeExecution) => (
              <NodeExecutionItem key={nodeExecution.id} nodeExecution={nodeExecution} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function NodeExecutionItem({ nodeExecution }: { nodeExecution: NodeExecution }) {
  const duration = nodeExecution.duration || 
    (nodeExecution.finishedAt && nodeExecution.startedAt 
      ? new Date(nodeExecution.finishedAt).getTime() - new Date(nodeExecution.startedAt).getTime()
      : 0);

  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <div className="flex items-center gap-2">
        {getStatusIcon(nodeExecution.status)}
        <span className="text-sm font-medium">{nodeExecution.nodeName}</span>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {duration > 0 && <span>{formatDuration(duration)}</span>}
        <Badge variant="outline" className="text-xs">
          {nodeExecution.status}
        </Badge>
      </div>
    </div>
  );
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running':
      return <Activity className="w-4 h-4 text-blue-500" />;
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-gray-500" />;
    case 'waiting':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'skipped':
      return <Pause className="w-4 h-4 text-gray-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants = {
    running: 'default',
    success: 'default',
    error: 'destructive',
    cancelled: 'secondary',
    waiting: 'outline',
    skipped: 'secondary',
  } as const;

  return (
    <Badge variant={variants[status as keyof typeof variants] || 'outline'} className="gap-1">
      {getStatusIcon(status)}
      {status}
    </Badge>
  );
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};
