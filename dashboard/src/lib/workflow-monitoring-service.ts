import { supabase } from '@/lib/supabase';
import { WorkflowExecution } from '@/types/workflows';

/**
 * Service for workflow execution monitoring (polling-based, no realtime)
 */
export class WorkflowMonitoringService {
  /**
   * Get executions for a workflow instance
   */
  static async getExecutions(instanceId: string): Promise<WorkflowExecution[]> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_instance_id', instanceId)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching executions:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get node executions for a workflow execution
   */
  static async getNodeExecutions(executionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('workflow_node_executions')
      .select('*')
      .eq('execution_id', executionId)
      .order('started_at', { ascending: true });

    if (error) {
      console.error('Error fetching node executions:', error);
      throw error;
    }

    return data || [];
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
    parameters?: Record<string, any>
  ): Promise<WorkflowExecution> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_instance_id: instanceId,
        status: 'pending',
        input_parameters: parameters || {},
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting execution:', error);
      throw error;
    }

    return data;
  }

  /**
   * Cancel a workflow execution
   */
  static async cancelExecution(executionId: string): Promise<void> {
    const { error } = await supabase
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        ended_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) {
      console.error('Error cancelling execution:', error);
      throw error;
    }
  }

  /**
   * Get execution history for a workflow instance
   */
  static async getExecutionHistory(
    instanceId: string, 
    limit = 50
  ): Promise<WorkflowExecution[]> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_instance_id', instanceId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching execution history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get execution statistics for a workflow instance
   */
  static async getExecutionStats(instanceId: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_workflow_execution_stats', { instance_id: instanceId });

    if (error) {
      console.error('Error fetching execution stats:', error);
      // Fallback to manual calculation if RPC doesn't exist
      const executions = await this.getExecutionHistory(instanceId, 1000);
      return this.calculateStats(executions);
    }

    return data;
  }

  /**
   * Calculate statistics from executions
   */
  private static calculateStats(executions: WorkflowExecution[]) {
    const total = executions.length;
    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;
    const cancelled = executions.filter(e => e.status === 'cancelled').length;

    return {
      total_executions: total,
      successful_executions: successful,
      failed_executions: failed,
      running_executions: running,
      cancelled_executions: cancelled,
      success_rate: total > 0 ? successful / total : 0,
      failure_rate: total > 0 ? failed / total : 0
    };
  }
}