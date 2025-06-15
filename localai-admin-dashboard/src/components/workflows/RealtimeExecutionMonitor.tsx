import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Play, 
  Pause, 
  RotateCcw,
  Wifi,
  WifiOff,
  TrendingUp,
  BarChart3,
  Zap
} from 'lucide-react';
import { WorkflowMonitoringService } from '@/lib/workflow-monitoring-service';
import { WorkflowExecution } from '@/types/workflows';

interface RealtimeExecutionMonitorProps {
  instanceId: string;
  onExecutionStart?: (executionId: string) => void;
  onExecutionStop?: (executionId: string) => void;
}

export function RealtimeExecutionMonitor({
  instanceId,
  onExecutionStart,
  onExecutionStop
}: RealtimeExecutionMonitorProps) {
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');
  const [metrics, setMetrics] = useState<{
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    executionTrend: Array<{ timestamp: string; count: number; successCount: number }>;
  } | null>(null);
  const [logs, setLogs] = useState<Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    nodeId?: string;
    nodeName?: string;
  }>>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Subscribe to real-time execution updates
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      setConnectionStatus('testing');
      
      try {
        // Test connection first
        const healthCheck = await WorkflowMonitoringService.testWorkflowConnection(instanceId);
        
        if (healthCheck.status === 'healthy') {
          setConnectionStatus('connected');
          
          // Subscribe to execution updates
          unsubscribe = WorkflowMonitoringService.subscribeToExecutions(instanceId, (execution) => {
            if (execution.status === 'running') {
              setCurrentExecution(execution);
            } else {
              setCurrentExecution(null);
              setExecutionHistory(prev => [execution, ...prev.slice(0, 9)]); // Keep last 10
            }
          });
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('Failed to setup monitoring:', error);
        setConnectionStatus('disconnected');
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [instanceId]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load current execution
        const current = await WorkflowMonitoringService.getCurrentExecution(instanceId);
        setCurrentExecution(current);

        // Load metrics
        const metricsData = await WorkflowMonitoringService.getExecutionMetrics(instanceId, '24h');
        setMetrics(metricsData);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, [instanceId]);

  // Load execution logs when current execution changes
  useEffect(() => {
    if (currentExecution?.id) {
      const loadLogs = async () => {
        try {
          const logsData = await WorkflowMonitoringService.getExecutionLogs(currentExecution.id);
          setLogs(logsData);
        } catch (error) {
          console.error('Failed to load logs:', error);
        }
      };

      loadLogs();
      
      // Refresh logs every 5 seconds during execution
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    } else {
      setLogs([]);
    }
  }, [currentExecution?.id]);

  const handleStartExecution = useCallback(async () => {
    if (isStarting || currentExecution) return;

    setIsStarting(true);
    try {
      const executionId = await WorkflowMonitoringService.startExecution(instanceId, 'manual');
      onExecutionStart?.(executionId);
    } catch (error) {
      console.error('Failed to start execution:', error);
    } finally {
      setIsStarting(false);
    }
  }, [instanceId, isStarting, currentExecution, onExecutionStart]);

  const handleStopExecution = useCallback(async () => {
    if (!currentExecution || isStopping) return;

    setIsStopping(true);
    try {
      await WorkflowMonitoringService.stopExecution(currentExecution.id);
      onExecutionStop?.(currentExecution.id);
      setCurrentExecution(null);
    } catch (error) {
      console.error('Failed to stop execution:', error);
    } finally {
      setIsStopping(false);
    }
  }, [currentExecution, isStopping, onExecutionStop]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'default',
      completed: 'default',
      failed: 'destructive',
      cancelled: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* Connection Status & Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Execution Monitor</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : connectionStatus === 'testing' ? (
                  <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground capitalize">
                  {connectionStatus}
                </span>
              </div>
              
              {currentExecution ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopExecution}
                  disabled={isStopping}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  {isStopping ? 'Stopping...' : 'Stop'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartExecution}
                  disabled={isStarting || connectionStatus !== 'connected'}
                >
                  <Play className="h-4 w-4 mr-1" />
                  {isStarting ? 'Starting...' : 'Start'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        {currentExecution && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge(currentExecution.status)}
                  <span className="text-sm text-muted-foreground">
                    Started {formatTimestamp(currentExecution.startedAt)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  ID: {currentExecution.id.slice(0, 8)}...
                </div>
              </div>
              
              {currentExecution.metrics && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {currentExecution.metrics.completedNodes}/{currentExecution.metrics.totalNodes} nodes
                    </span>
                  </div>
                  <Progress 
                    value={(currentExecution.metrics.completedNodes / currentExecution.metrics.totalNodes) * 100} 
                  />
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detailed Monitoring Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {currentExecution ? (
            <Card>
              <CardHeader>
                <CardTitle>Current Execution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Status</div>
                    <div className="mt-1">{getStatusBadge(currentExecution.status)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Duration</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {currentExecution.duration 
                        ? formatDuration(currentExecution.duration)
                        : `${Math.floor((Date.now() - new Date(currentExecution.startedAt).getTime()) / 1000)}s`
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Triggered By</div>
                    <div className="mt-1 text-sm text-muted-foreground capitalize">
                      {currentExecution.triggeredBy}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Error</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {currentExecution.errorMessage || 'None'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No active execution</p>
                  <p className="text-sm">Start a workflow to see real-time monitoring</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {executionHistory.length > 0 ? (
                    executionHistory.map((execution) => (
                      <div
                        key={execution.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusBadge(execution.status)}
                          <div>
                            <div className="text-sm font-medium">
                              {formatTimestamp(execution.startedAt)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {execution.triggeredBy}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {execution.duration ? formatDuration(execution.duration) : '-'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No execution history</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-1 font-mono text-xs">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          log.level === 'error' ? 'bg-red-50 text-red-800' :
                          log.level === 'warn' ? 'bg-yellow-50 text-yellow-800' :
                          log.level === 'debug' ? 'bg-gray-50 text-gray-600' :
                          'bg-blue-50 text-blue-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="opacity-60 shrink-0">
                            {formatTimestamp(log.timestamp)}
                          </span>
                          <span className="font-semibold shrink-0 uppercase">
                            [{log.level}]
                          </span>
                          {log.nodeName && (
                            <span className="text-purple-600 shrink-0">
                              [{log.nodeName}]
                            </span>
                          )}
                          <span className="break-all">{log.message}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No logs available</p>
                      {!currentExecution && (
                        <p className="text-xs">Start an execution to see logs</p>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Total Executions</p>
                    <p className="text-2xl font-bold">{metrics?.totalExecutions || 0}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Success Rate</p>
                    <p className="text-2xl font-bold">{metrics?.successRate.toFixed(1) || 0}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Avg. Duration</p>
                    <p className="text-2xl font-bold">
                      {metrics?.averageExecutionTime ? formatDuration(metrics.averageExecutionTime) : '0ms'}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
