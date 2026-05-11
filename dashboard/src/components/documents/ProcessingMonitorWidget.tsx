/**
 * Processing Monitor Widget
 * Displays stuck documents and provides retry actions
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Activity, 
  PlayCircle,
  StopCircle 
} from 'lucide-react';
import { documentProcessingMonitor, StuckDocument } from '@/services/document-processing-monitor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function ProcessingMonitorWidget() {
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const queryClient = useQueryClient();

  // Check monitoring status
  const { data: monitorStatus } = useQuery({
    queryKey: ['processing-monitor-status'],
    queryFn: () => documentProcessingMonitor.getMonitoringStatus(),
    refetchInterval: 5000 // Check every 5 seconds
  });

  // Get stuck documents
  const { 
    data: stuckDocuments = [], 
    isLoading, 
    refetch: refetchStuckDocs 
  } = useQuery({
    queryKey: ['stuck-documents'],
    queryFn: () => documentProcessingMonitor.getCurrentStuckDocuments(),
    refetchInterval: 10000, // Check every 10 seconds
    enabled: isMonitoringActive
  });

  // Start/stop monitoring mutation
  const toggleMonitoringMutation = useMutation({
    mutationFn: async (start: boolean) => {
      if (start) {
        documentProcessingMonitor.startMonitoring();
      } else {
        documentProcessingMonitor.stopMonitoring();
      }
      return start;
    },
    onSuccess: (isActive) => {
      setIsMonitoringActive(isActive);
      toast.success(isActive ? 'Monitoring started' : 'Monitoring stopped');
      queryClient.invalidateQueries({ queryKey: ['processing-monitor-status'] });
    },
    onError: (error) => {
      toast.error(`Failed to ${isMonitoringActive ? 'stop' : 'start'} monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Manual check mutation
  const manualCheckMutation = useMutation({
    mutationFn: () => documentProcessingMonitor.triggerManualCheck(),
    onSuccess: (docs) => {
      toast.success(`Manual check completed. Found ${docs.length} stuck documents.`);
      refetchStuckDocs();
    },
    onError: (error) => {
      toast.error(`Manual check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Force retry mutation
  const forceRetryMutation = useMutation({
    mutationFn: (documentId: string) => documentProcessingMonitor.forceRetryDocument(documentId),
    onSuccess: () => {
      toast.success('Document retry initiated');
      refetchStuckDocs();
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error) => {
      toast.error(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Initialize monitoring status
  useEffect(() => {
    if (monitorStatus) {
      setIsMonitoringActive(monitorStatus.isMonitoring);
    }
  }, [monitorStatus]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'analyzing': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Processing Monitor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isMonitoringActive ? "default" : "secondary"}>
              {isMonitoringActive ? "Active" : "Inactive"}
            </Badge>
            <Button
              size="sm"
              variant={isMonitoringActive ? "outline" : "default"}
              onClick={() => toggleMonitoringMutation.mutate(!isMonitoringActive)}
              disabled={toggleMonitoringMutation.isPending}
            >
              {isMonitoringActive ? (
                <>
                  <StopCircle className="h-4 w-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Monitor Status */}
        {monitorStatus && (
          <div className="text-sm text-muted-foreground">
            <div className="grid grid-cols-2 gap-2">
              <div>Check Interval: {Math.round(monitorStatus.timeouts.STALE_CHECK_INTERVAL / 1000)}s</div>
              <div>Max Retries: {monitorStatus.timeouts.MAX_RETRY_ATTEMPTS}</div>
            </div>
          </div>
        )}

        {/* Manual Check Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => manualCheckMutation.mutate()}
          disabled={manualCheckMutation.isPending || !isMonitoringActive}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${manualCheckMutation.isPending ? 'animate-spin' : ''}`} />
          Manual Check
        </Button>

        {/* Stuck Documents */}
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground">
            Checking for stuck documents...
          </div>
        ) : stuckDocuments.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No stuck documents found
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">
                {stuckDocuments.length} Stuck Document{stuckDocuments.length !== 1 ? 's' : ''}
              </span>
            </div>

            {stuckDocuments.map((doc: StuckDocument) => (
              <div key={doc.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">
                    Doc: {doc.id.substring(0, 8)}...
                  </div>
                  <Badge className={getStatusColor(doc.status)}>
                    {doc.status}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Stuck: {formatDuration(doc.stuck_duration_ms)}
                  </div>
                  <div>
                    Retries: {doc.retry_count}/{monitorStatus?.timeouts.MAX_RETRY_ATTEMPTS || 3}
                  </div>
                </div>

                {doc.retry_count < (monitorStatus?.timeouts.MAX_RETRY_ATTEMPTS || 3) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => forceRetryMutation.mutate(doc.id)}
                    disabled={forceRetryMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Force Retry
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Alert for high retry counts */}
        {stuckDocuments.some(doc => doc.retry_count >= 2) && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Some documents are approaching the retry limit. Check logs for processing errors.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}