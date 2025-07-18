import { N8nClient, N8nWorkflowData } from './n8n-client';
import { FlowiseClient, FlowiseChatflowData } from './flowise-client';
import { WorkflowInstance } from '@/types/workflows';
import { WorkflowInstanceService } from './workflow-instance-service';

/**
 * Unified client for managing workflows across N8N and Flowise platforms
 */
export class WorkflowClient {
  private n8nClient: N8nClient;
  private flowiseClient: FlowiseClient;

  constructor(
    n8nBaseUrl?: string,
    n8nApiKey?: string,
    flowiseBaseUrl?: string,
    flowiseApiKey?: string
  ) {
    this.n8nClient = new N8nClient(n8nBaseUrl, n8nApiKey);
    this.flowiseClient = new FlowiseClient(flowiseBaseUrl, flowiseApiKey);
  }

  /**
   * Deploy a workflow instance to the appropriate platform
   */
  async deployInstance(instance: WorkflowInstance): Promise<string> {
    try {
      // Update deployment status to 'deploying'
      await WorkflowInstanceService.updateInstance(instance.id, {
        deploymentStatus: 'deploying' as const,
        deploymentError: undefined,
      });

      let deployedId: string;

      switch (instance.templateType) {
        case 'n8n':
          deployedId = await this.deployN8nWorkflow(instance);
          break;
        case 'flowise':
          deployedId = await this.deployFlowiseChatflow(instance);
          break;
        case 'hybrid':
          deployedId = await this.deployHybridWorkflow(instance);
          break;
        default:
          throw new Error(`Unsupported template type: ${instance.templateType}`);
      }

      // Update deployment status to 'active'
      await WorkflowInstanceService.updateInstance(instance.id, {
        deploymentStatus: 'active' as const,
        deployedWorkflowId: deployedId,
        deploymentError: undefined,
      });

      return deployedId;
    } catch (error) {
      // Update deployment status to 'error'
      await WorkflowInstanceService.updateInstance(instance.id, {
        deploymentStatus: 'error' as const,
        deploymentError: error instanceof Error ? error.message : 'Unknown deployment error',
      });
      throw error;
    }
  }

  /**
   * Execute a workflow instance
   */
  async executeInstance(instance: WorkflowInstance, input?: any): Promise<ExecutionResult> {
    if (!instance.deployedWorkflowId) {
      throw new Error('Workflow instance is not deployed');
    }

    switch (instance.templateType) {
      case 'n8n':
        return this.executeN8nWorkflow(instance.deployedWorkflowId, input);
      case 'flowise':
        return this.executeFlowiseChatflow(instance.deployedWorkflowId, input);
      case 'hybrid':
        return this.executeHybridWorkflow(instance, input);
      default:
        throw new Error(`Unsupported template type: ${instance.templateType}`);
    }
  }

  /**
   * Get real-time status of a deployed workflow
   */
  async getInstanceStatus(instance: WorkflowInstance): Promise<WorkflowStatus> {
    if (!instance.deployedWorkflowId) {
      return {
        id: instance.id,
        active: false,
        status: 'inactive',
        platform: instance.templateType as any,
      };
    }

    try {
      switch (instance.templateType) {
        case 'n8n':
          const n8nStatus = await this.n8nClient.getWorkflowStatus(instance.deployedWorkflowId);
          return {
            id: instance.id,
            active: n8nStatus.active,
            status: n8nStatus.status,
            platform: 'n8n',
            platformWorkflowId: instance.deployedWorkflowId,
          };
        case 'flowise':
          const chatflow = await this.flowiseClient.getChatflow(instance.deployedWorkflowId);
          return {
            id: instance.id,
            active: chatflow.deployed,
            status: chatflow.deployed ? 'active' : 'inactive',
            platform: 'flowise',
            platformWorkflowId: instance.deployedWorkflowId,
          };
        default:
          return {
            id: instance.id,
            active: false,
            status: 'unknown',
            platform: instance.templateType as any,
          };
      }
    } catch (error) {
      return {
        id: instance.id,
        active: false,
        status: 'error',
        platform: instance.templateType as any,
        error: error instanceof Error ? error.message : 'Unknown status error',
      };
    }
  }

  /**
   * Undeploy a workflow instance
   */
  async undeployInstance(instance: WorkflowInstance): Promise<void> {
    if (!instance.deployedWorkflowId) {
      return; // Already undeployed
    }

    try {
      switch (instance.templateType) {
        case 'n8n':
          await this.n8nClient.deleteWorkflow(instance.deployedWorkflowId);
          break;
        case 'flowise':
          await this.flowiseClient.deleteChatflow(instance.deployedWorkflowId);
          break;
        case 'hybrid':
          // Handle hybrid undeployment
          break;
      }

      await WorkflowInstanceService.updateInstance(instance.id, {
        deploymentStatus: 'inactive' as const,
        deployedWorkflowId: undefined,
      });
    } catch (error) {
      await WorkflowInstanceService.updateInstance(instance.id, {
        deploymentStatus: 'error' as const,
        deploymentError: error instanceof Error ? error.message : 'Undeployment error',
      });
      throw error;
    }
  }

  /**
   * Test a workflow configuration before deployment
   */
  async testWorkflow(instance: WorkflowInstance): Promise<TestResult> {
    if (!instance.configuration) {
      return { success: false, error: 'No configuration provided' };
    }

    try {
      switch (instance.templateType) {
        case 'n8n':
          return await this.n8nClient.testWorkflow(instance.configuration);
        case 'flowise':
          const validation = await this.flowiseClient.validateChatflow(instance.configuration);
          return {
            success: validation.valid,
            error: validation.errors?.join(', '),
            warnings: validation.warnings,
          };
        default:
          return { success: true, warnings: ['Testing not implemented for this workflow type'] };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      };
    }
  }

  /**
   * Get platform health status
   */
  async getHealthStatus(): Promise<PlatformHealth> {
    const [n8nHealth, flowiseHealth] = await Promise.allSettled([
      this.n8nClient.getHealth(),
      this.flowiseClient.getHealth(),
    ]);

    return {
      n8n: {
        status: n8nHealth.status === 'fulfilled' ? n8nHealth.value.status : 'unhealthy',
        error: n8nHealth.status === 'rejected' ? n8nHealth.reason.message : undefined,
      },
      flowise: {
        status: flowiseHealth.status === 'fulfilled' ? flowiseHealth.value.status : 'unhealthy',
        error: flowiseHealth.status === 'rejected' ? flowiseHealth.reason.message : undefined,
      },
    };
  }

  /**
   * Get execution history for a workflow instance
   */
  async getExecutionHistory(instance: WorkflowInstance): Promise<any[]> {
    try {
      return await WorkflowInstanceService.getExecutionHistory(instance.id);
    } catch (error) {
      console.error('Error fetching execution history:', error);
      return [];
    }
  }

  /**
   * Execute a workflow by template ID with document data
   */
  static async executeWorkflow(options: {
    templateId: string;
    documentData: any;
    parameters?: any;
  }): Promise<{ workflowId: string; status: string; result: any }> {
    const { templateId, documentData, parameters } = options;
    
    try {
      // Simulate async workflow execution with progress
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
      
      // In a real implementation, this would:
      // 1. Create a workflow instance from the template
      // 2. Deploy it to N8N/Flowise
      // 3. Execute with the document data
      // 4. Return the results
      
      const workflowId = `workflow-${Date.now()}-${templateId}`;
      
      // Simulate different outcomes based on template
      const successRate = 0.9; // 90% success rate
      const isSuccess = Math.random() < successRate;
      
      if (isSuccess) {
        return {
          workflowId,
          status: 'completed',
          result: {
            documentId: `doc-${Date.now()}`,
            processedContent: `Generated content from ${templateId}`,
            extractedData: {
              title: documentData.metadata?.title || 'Untitled Document',
              summary: 'AI-generated summary of the document',
              keyPoints: ['Point 1', 'Point 2', 'Point 3'],
              recommendations: ['Recommendation 1', 'Recommendation 2']
            },
            template: {
              id: templateId,
              name: `Template ${templateId}`,
              applied: true
            }
          }
        };
      } else {
        throw new Error('Workflow execution failed due to processing error');
      }
    } catch (error) {
      throw new Error(`Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available workflow templates
   */
  static async getWorkflowTemplates(): Promise<any[]> {
    // For now, return empty array
    // In a real implementation, this would fetch from the template service
    return [];
  }

  // Private deployment methods
  private async deployN8nWorkflow(instance: WorkflowInstance): Promise<string> {
    if (!instance.configuration) {
      throw new Error('No N8N workflow configuration provided');
    }

    const workflowData: N8nWorkflowData = {
      name: instance.name,
      ...instance.configuration,
      active: instance.isActive,
    };

    const result = await this.n8nClient.createWorkflow(workflowData);
    
    if (instance.isActive) {
      await this.n8nClient.activateWorkflow(result.id);
    }

    return result.id;
  }

  private async deployFlowiseChatflow(instance: WorkflowInstance): Promise<string> {
    if (!instance.configuration) {
      throw new Error('No Flowise chatflow configuration provided');
    }

    const chatflowData: FlowiseChatflowData = {
      name: instance.name,
      ...instance.configuration,
      deployed: instance.isActive,
    };

    const result = await this.flowiseClient.createChatflow(chatflowData);
    return result.id;
  }

  private async deployHybridWorkflow(instance: WorkflowInstance): Promise<string> {
    if (!instance.configuration) {
      throw new Error('No hybrid workflow configuration provided');
    }

    // Deploy both N8N and Flowise components if they exist
    const deployments: string[] = [];

    if (instance.configuration.n8n) {
      const n8nId = await this.deployN8nWorkflow({
        ...instance,
        configuration: instance.configuration.n8n,
        templateType: 'n8n',
      });
      deployments.push(`n8n:${n8nId}`);
    }

    if (instance.configuration.flowise) {
      const flowiseId = await this.deployFlowiseChatflow({
        ...instance,
        configuration: instance.configuration.flowise,
        templateType: 'flowise',
      });
      deployments.push(`flowise:${flowiseId}`);
    }

    return deployments.join(',');
  }

  private async executeN8nWorkflow(workflowId: string, input?: any): Promise<ExecutionResult> {
    const result = await this.n8nClient.executeWorkflow(workflowId, input);
    
    return {
      executionId: result.executionId,
      status: result.finished ? 'completed' : 'running',
      output: result.data,
      platform: 'n8n',
      platformExecutionId: result.executionId,
    };
  }

  private async executeFlowiseChatflow(chatflowId: string, input?: any): Promise<ExecutionResult> {
    const question = typeof input === 'string' ? input : input?.question || 'Execute chatflow';
    const result = await this.flowiseClient.executeChatflow(chatflowId, question);

    return {
      executionId: result.chatMessageId,
      status: 'completed',
      output: {
        text: result.text,
        question: result.question,
        sourceDocuments: result.sourceDocuments,
      },
      platform: 'flowise',
      platformExecutionId: result.chatMessageId,
    };
  }

  private async executeHybridWorkflow(instance: WorkflowInstance, input?: any): Promise<ExecutionResult> {
    if (!instance.deployedWorkflowId) {
      throw new Error('Hybrid workflow not deployed');
    }

    const deploymentIds = instance.deployedWorkflowId.split(',');
    const results: any[] = [];

    for (const deployment of deploymentIds) {
      const [platform, id] = deployment.split(':');
      
      if (platform === 'n8n') {
        const result = await this.executeN8nWorkflow(id, input);
        results.push(result);
      } else if (platform === 'flowise') {
        const result = await this.executeFlowiseChatflow(id, input);
        results.push(result);
      }
    }

    return {
      executionId: `hybrid-${Date.now()}`,
      status: 'completed',
      output: { results },
      platform: 'hybrid',
      platformExecutionId: instance.deployedWorkflowId,
    };
  }
}

// Type definitions
export interface ExecutionResult {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  platform: 'n8n' | 'flowise' | 'hybrid';
  platformExecutionId: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowStatus {
  id: string;
  active: boolean;
  status: 'active' | 'inactive' | 'error' | 'unknown';
  platform: 'n8n' | 'flowise' | 'hybrid';
  platformWorkflowId?: string;
  error?: string;
}

export interface TestResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  data?: any;
}

export interface PlatformHealth {
  n8n: {
    status: string;
    error?: string;
  };
  flowise: {
    status: string;
    error?: string;
  };
}
