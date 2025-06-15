import { supabase } from '@/lib/supabase';
import { WorkflowInstance, WorkflowExecution } from '@/types/workflows';

/**
 * Service for managing workflow instances - the actual deployable workflows created from templates
 */
export class WorkflowInstanceService {
  /**
   * Get all workflow instances for the current user
   */
  static async getInstances(userId?: string): Promise<WorkflowInstance[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user && !userId) {
      throw new Error('User must be authenticated to view instances');
    }

    const targetUserId = userId || user.id;

    const { data, error } = await supabase
      .from('workflow_instances')
      .select(`
        *,
        workflow_templates(id, name, description, template_type, thumbnail_url)
      `)
      .eq('created_by', targetUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflow instances:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a specific workflow instance by ID
   */
  static async getInstance(id: string): Promise<WorkflowInstance | null> {
    const { data, error } = await supabase
      .from('workflow_instances')
      .select(`
        *,
        workflow_templates(id, name, description, template_type, thumbnail_url, template_data)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching workflow instance:', error);
      return null;
    }

    return data;
  }

  /**
   * Update a workflow instance
   */
  static async updateInstance(id: string, updates: Partial<WorkflowInstance>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to update instances');
    }

    // Don't allow updating certain protected fields
    const allowedUpdates = {
      name: updates.name,
      configuration: updates.configuration,
      is_active: updates.isActive,
      deployment_status: updates.deploymentStatus,
      deployed_workflow_id: updates.deployedWorkflowId,
      deployment_error: updates.deploymentError,
    };

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
    );

    const { error } = await supabase
      .from('workflow_instances')
      .update(cleanUpdates)
      .eq('id', id)
      .eq('created_by', user.id); // Ensure user can only update their own instances

    if (error) {
      console.error('Error updating workflow instance:', error);
      throw error;
    }
  }

  /**
   * Delete a workflow instance
   */
  static async deleteInstance(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to delete instances');
    }

    const { error } = await supabase
      .from('workflow_instances')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id); // Ensure user can only delete their own instances

    if (error) {
      console.error('Error deleting workflow instance:', error);
      throw error;
    }
  }

  /**
   * Activate a workflow instance
   */
  static async activateInstance(id: string): Promise<void> {
    await this.updateInstance(id, { isActive: true });
  }

  /**
   * Deactivate a workflow instance
   */
  static async deactivateInstance(id: string): Promise<void> {
    await this.updateInstance(id, { isActive: false });
  }

  /**
   * Update workflow configuration
   */
  static async updateConfiguration(id: string, configuration: any): Promise<void> {
    await this.updateInstance(id, { configuration });
  }

  /**
   * Validate workflow configuration based on template type
   */
  static async validateConfiguration(templateType: string, configuration: any): Promise<boolean> {
    try {
      switch (templateType) {
        case 'n8n':
          return this.validateN8nConfiguration(configuration);
        case 'flowise':
          return this.validateFlowiseConfiguration(configuration);
        case 'hybrid':
          return this.validateHybridConfiguration(configuration);
        default:
          return true; // Allow 'other' types without validation
      }
    } catch (error) {
      console.error('Configuration validation error:', error);
      return false;
    }
  }

  /**
   * Get execution history for a workflow instance
   */
  static async getExecutionHistory(instanceId: string, limit: number = 50): Promise<WorkflowExecution[]> {
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
   * Get instance statistics
   */
  static async getInstanceStats(instanceId: string): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecutedAt: string | null;
  }> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('status, execution_time_ms, started_at')
      .eq('workflow_instance_id', instanceId);

    if (error) {
      console.error('Error fetching instance stats:', error);
      throw error;
    }

    const executions = data || [];
    const successful = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');
    const executionTimes = executions
      .filter(e => e.execution_time_ms != null)
      .map(e => e.execution_time_ms);

    return {
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      averageExecutionTime: executionTimes.length > 0 
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0,
      lastExecutedAt: executions.length > 0 ? executions[0].started_at : null,
    };
  }

  /**
   * Validate N8N workflow configuration
   */
  private static validateN8nConfiguration(config: any): boolean {
    if (!config || typeof config !== 'object') return false;
    
    // Basic N8N structure validation
    if (!config.nodes || !Array.isArray(config.nodes)) return false;
    if (!config.connections || typeof config.connections !== 'object') return false;
    
    // Ensure at least one node exists
    if (config.nodes.length === 0) return false;
    
    // Validate each node has required properties
    for (const node of config.nodes) {
      if (!node.id || !node.type || !node.typeVersion) return false;
    }
    
    return true;
  }

  /**
   * Validate Flowise chatflow configuration
   */
  private static validateFlowiseConfiguration(config: any): boolean {
    if (!config || typeof config !== 'object') return false;
    
    // Basic Flowise structure validation
    if (!config.nodes || !Array.isArray(config.nodes)) return false;
    if (!config.edges || !Array.isArray(config.edges)) return false;
    
    // Ensure at least one node exists
    if (config.nodes.length === 0) return false;
    
    // Validate each node has required properties
    for (const node of config.nodes) {
      if (!node.id || !node.data || !node.data.name) return false;
    }
    
    return true;
  }

  /**
   * Validate hybrid workflow configuration
   */
  private static validateHybridConfiguration(config: any): boolean {
    if (!config || typeof config !== 'object') return false;
    
    // Hybrid workflows should have both n8n and flowise components
    const hasN8n = config.n8n && this.validateN8nConfiguration(config.n8n);
    const hasFlowise = config.flowise && this.validateFlowiseConfiguration(config.flowise);
    
    return hasN8n || hasFlowise; // At least one component should be valid
  }
}
