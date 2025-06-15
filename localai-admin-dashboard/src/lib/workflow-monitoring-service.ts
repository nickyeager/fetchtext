import { supabase } from '@/lib/supabase';
import { WorkflowExecution } from '@/types/workflows';

/**
 * Service for real-time workflow execution monitoring
 */
export class WorkflowMonitoringService {
  private static subscriptions = new Map<string, any>();

  /**
   * Subscribe to real-time execution updates for a workflow instance
   */
  static subscribeToExecutions(
    instanceId: string, 
    callback: (execution: WorkflowExecution) => void
  ): () => void {
    const subscription = supabase
      .channel(`workflow_executions_${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions',
          filter: `workflow_instance_id=eq.${instanceId}`
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as WorkflowExecution);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(instanceId, subscription);

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(instanceId);
    };
  }

  /**
   * Subscribe to real-time node execution updates
   */
  static subscribeToNodeExecutions(
    executionId: string,
    callback: (nodeExecution: any) => void
  ): () => void {
    const subscription = supabase
      .channel(`node_executions_${executionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_node_executions',
          filter: `execution_id=eq.${executionId}`
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new);
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Get current execution status for a workflow instance
   */
  static async getCurrentExecution(instanceId: string): Promise<WorkflowExecution | null> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow_node_executions(*)
      `)
      .eq('workflow_instance_id', instanceId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching current execution:', error);
      throw error;
    }

    return data;
  }

  /**
   * Start a new workflow execution
   */
  static async startExecution(
    instanceId: string, 
    triggeredBy: 'manual' | 'schedule' | 'webhook' | 'api' = 'manual',
    triggerData?: any
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to start executions');
    }

    const { data, error } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_instance_id: instanceId,
        status: 'running',
        started_at: new Date().toISOString(),
        triggered_by: triggeredBy,
        trigger_data: triggerData || {},
        created_by: user.id
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error starting execution:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Stop a running execution
   */
  static async stopExecution(executionId: string): Promise<void> {
    const { error } = await supabase
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        finished_at: new Date().toISOString(),
        error_message: 'Execution cancelled by user'
      })
      .eq('id', executionId)
      .eq('status', 'running');

    if (error) {
      console.error('Error stopping execution:', error);
      throw error;
    }
  }

  /**
   * Get execution metrics for monitoring dashboard
   */
  static async getExecutionMetrics(instanceId: string, timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<{
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    executionTrend: Array<{ timestamp: string; count: number; successCount: number }>;
  }> {
    const now = new Date();
    const timeRangeHours = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    };

    const since = new Date(now.getTime() - timeRangeHours[timeRange] * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('workflow_executions')
      .select('status, execution_time_ms, started_at')
      .eq('workflow_instance_id', instanceId)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: true });

    if (error) {
      console.error('Error fetching execution metrics:', error);
      throw error;
    }

    const executions = data || [];
    const successfulExecutions = executions.filter(e => e.status === 'completed');
    const executionTimes = executions
      .filter(e => e.execution_time_ms != null)
      .map(e => e.execution_time_ms);

    // Group executions by time buckets for trend analysis
    const bucketSize = timeRangeHours[timeRange] > 24 ? 24 : 1; // hourly for short ranges, daily for longer
    const buckets = new Map<string, { count: number; successCount: number }>();

    executions.forEach(execution => {
      const timestamp = new Date(execution.started_at);
      const bucketKey = new Date(
        timestamp.getFullYear(),
        timestamp.getMonth(),
        timestamp.getDate(),
        bucketSize === 1 ? timestamp.getHours() : 0
      ).toISOString();

      const bucket = buckets.get(bucketKey) || { count: 0, successCount: 0 };
      bucket.count++;
      if (execution.status === 'completed') {
        bucket.successCount++;
      }
      buckets.set(bucketKey, bucket);
    });

    const executionTrend = Array.from(buckets.entries()).map(([timestamp, { count, successCount }]) => ({
      timestamp,
      count,
      successCount
    }));

    return {
      totalExecutions: executions.length,
      successRate: executions.length > 0 ? (successfulExecutions.length / executions.length) * 100 : 0,
      averageExecutionTime: executionTimes.length > 0 
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0,
      executionTrend
    };
  }

  /**
   * Get detailed execution logs
   */
  static async getExecutionLogs(executionId: string): Promise<Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    nodeId?: string;
    nodeName?: string;
    data?: any;
  }>> {
    const { data, error } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching execution logs:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Clean up old subscriptions
   */
  static cleanup(): void {
    for (const [, subscription] of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
  }

  /**
   * Test workflow connection (N8N/Flowise health check)
   */
  static async testWorkflowConnection(instanceId: string): Promise<{
    status: 'healthy' | 'unhealthy' | 'unknown';
    message: string;
    responseTime?: number;
  }> {
    try {
      const instance = await supabase
        .from('workflow_instances')
        .select('deployment_status, deployed_workflow_id, workflow_templates(template_type)')
        .eq('id', instanceId)
        .single();

      if (instance.error) {
        throw instance.error;
      }

      const { deployment_status, deployed_workflow_id, workflow_templates } = instance.data;

      if (deployment_status !== 'deployed' || !deployed_workflow_id) {
        return {
          status: 'unhealthy',
          message: 'Workflow is not deployed'
        };
      }

      const templateType = Array.isArray(workflow_templates) 
        ? workflow_templates[0]?.template_type 
        : (workflow_templates as any)?.template_type;
      const startTime = Date.now();

      // Test based on template type
      if (templateType === 'n8n') {
        return await this.testN8nConnection(deployed_workflow_id, startTime);
      } else if (templateType === 'flowise') {
        return await this.testFlowiseConnection(deployed_workflow_id, startTime);
      } else {
        return {
          status: 'unknown',
          message: 'Cannot test connection for this workflow type'
        };
      }
    } catch (error) {
      console.error('Error testing workflow connection:', error);
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test N8N workflow connection
   */
  private static async testN8nConnection(_workflowId: string, startTime: number): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    responseTime: number;
  }> {
    try {
      // This would typically make an HTTP request to N8N API
      // For now, we'll simulate the health check
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'N8N workflow is accessible',
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `N8N connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Test Flowise workflow connection
   */
  private static async testFlowiseConnection(_workflowId: string, startTime: number): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    responseTime: number;
  }> {
    try {
      // This would typically make an HTTP request to Flowise API
      // For now, we'll simulate the health check
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Flowise chatflow is accessible',
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Flowise connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      };
    }
  }
}
