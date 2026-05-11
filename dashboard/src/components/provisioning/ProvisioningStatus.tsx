/**
 * ProvisioningStatus Component
 *
 * Displays the current provisioning status for enterprise tier
 * with progress steps and status indicators.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config';

interface ProvisioningStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

interface ProvisioningStatusData {
  organization_id: string;
  status: 'pending' | 'provisioning' | 'active' | 'failed' | 'deprovisioning';
  model?: string;
  region: string;
  error_message?: string;
  provisioned_at?: string;
  progress_steps: ProvisioningStep[];
}

interface ProvisioningStatusProps {
  organizationId: string;
  onComplete?: () => void;
}

const DEFAULT_STEPS: ProvisioningStep[] = [
  { name: 'Creating Azure OpenAI resource', status: 'pending' },
  { name: 'Deploying model', status: 'pending' },
  { name: 'Retrieving API credentials', status: 'pending' },
  { name: 'Finalizing configuration', status: 'pending' },
];

export function ProvisioningStatus({ organizationId, onComplete }: ProvisioningStatusProps) {
  const [data, setData] = useState<ProvisioningStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/models/provision/${organizationId}/status`
      );
      if (response.ok) {
        const statusData = await response.json();
        setData(statusData);
        setError(null);

        if (statusData.status === 'active' && onComplete) {
          onComplete();
        }
      } else {
        console.error('[ProvisioningStatus] Fetch failed', {
          organizationId,
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString()
        });
        setError(`Failed to fetch provisioning status (${response.status})`);
      }
    } catch (err) {
      console.error('[ProvisioningStatus] Fetch failed', {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString()
      });

      const errorMessage = err instanceof Error
        ? `Connection error: ${err.message}`
        : 'Connection error - please try again';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [organizationId, onComplete]);

  // Initial fetch effect
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling effect - separate so it only re-runs when status actually changes
  useEffect(() => {
    if (data?.status === 'provisioning' || data?.status === 'pending') {
      const interval = setInterval(() => {
        fetchStatus();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [data?.status, fetchStatus]);

  const getStepIcon = (status: ProvisioningStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" aria-label="Completed" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" aria-label="In progress" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" aria-label="Failed" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" aria-label="Pending" />;
    }
  };

  const getStatusBadge = (status: ProvisioningStatusData['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'provisioning':
        return <Badge variant="secondary">Provisioning...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'deprovisioning':
        return <Badge variant="outline">Deprovisioning</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const steps = data?.progress_steps?.length ? data.progress_steps : DEFAULT_STEPS;
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data?.status === 'active') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Instance Active</CardTitle>
            {getStatusBadge(data.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Model</p>
              <p className="font-medium">{data.model || 'GPT-4o-mini'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Region</p>
              <p className="font-medium">{data.region}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full">
            Test Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Provisioning Your Instance</CardTitle>
          {getStatusBadge(data?.status || 'pending')}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {Math.round(progress)}% complete
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {getStepIcon(step.status)}
              <span className={step.status === 'pending' ? 'text-muted-foreground' : ''}>
                {step.name}
              </span>
            </div>
          ))}
        </div>

        {data?.error_message && (
          <div className="p-3 bg-destructive/10 rounded-md">
            <p className="text-sm text-destructive">{data.error_message}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center">
          Estimated time: 2-5 minutes
        </p>
      </CardContent>
    </Card>
  );
}

export default ProvisioningStatus;
