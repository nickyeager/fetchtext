/**
 * N8N API Client for workflow management and execution
 */
export class N8nClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: { baseUrl: string; apiKey?: string } | string = 'http://localhost:5678/api/v1', apiKey?: string) {
    if (typeof config === 'object') {
      this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
      this.apiKey = config.apiKey;
    } else {
      this.baseUrl = config.replace(/\/$/, ''); // Remove trailing slash
      this.apiKey = apiKey;
    }
  }

  /**
   * Make authenticated request to N8N API
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`N8N API Error: ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  // Workflow Management
  async getWorkflows(): Promise<N8nWorkflow[]> {
    return this.request('/workflows');
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request(`/workflows/${id}`);
  }

  async createWorkflow(workflow: N8nWorkflowData): Promise<N8nWorkflow> {
    return this.request('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(id: string, workflow: N8nWorkflowData): Promise<N8nWorkflow> {
    return this.request(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  // Workflow Activation
  async activateWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async getWorkflowStatus(id: string): Promise<WorkflowStatus> {
    const workflow = await this.getWorkflow(id);
    return {
      id: workflow.id,
      active: workflow.active,
      status: workflow.active ? 'active' : 'inactive',
    };
  }

  // Workflow Execution
  async executeWorkflow(id: string, data?: any): Promise<N8nExecutionResult> {
    // Note: Direct execution depends on N8N workflow trigger type
    // This works for manual trigger workflows
    return this.request(`/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async getExecutions(workflowId?: string, limit: number = 100): Promise<N8nExecution[]> {
    const params = new URLSearchParams();
    if (workflowId) params.append('workflowId', workflowId);
    params.append('limit', limit.toString());
    
    const endpoint = `/executions?${params.toString()}`;
    return this.request(endpoint);
  }

  async getExecution(id: string): Promise<N8nExecution> {
    return this.request(`/executions/${id}`);
  }

  async cancelExecution(id: string): Promise<void> {
    await this.request(`/executions/${id}/stop`, {
      method: 'POST',
    });
  }

  // Credentials Management
  async getCredentials(): Promise<N8nCredential[]> {
    return this.request('/credentials');
  }

  async testCredentials(credentialId: string): Promise<boolean> {
    try {
      await this.request(`/credentials/${credentialId}/test`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  // Workflow Testing
  async testWorkflow(workflow: N8nWorkflowData): Promise<N8nTestResult> {
    return this.request('/workflows/test', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  // Node Information
  async getNodeTypes(): Promise<N8nNodeType[]> {
    return this.request('/node-types');
  }

  async getNodeType(nodeType: string): Promise<N8nNodeTypeDetails> {
    return this.request(`/node-types/${encodeURIComponent(nodeType)}`);
  }

  // Health Check
  async getHealth(): Promise<{ status: string }> {
    return this.request('/health');
  }
}

// Type definitions for N8N API responses
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: N8nConnections;
  createdAt: string;
  updatedAt: string;
  versionId: string;
}

export interface N8nWorkflowData {
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  active?: boolean;
  settings?: any;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
}

export interface N8nConnections {
  [nodeId: string]: {
    [outputIndex: string]: Array<{
      node: string;
      type: string;
      index: number;
    }>;
  };
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: 'new' | 'running' | 'success' | 'error' | 'canceled' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
  mode: 'manual' | 'trigger' | 'webhook' | 'retry';
  data?: any;
  error?: string;
}

export interface N8nExecutionResult {
  executionId: string;
  data: any;
  finished: boolean;
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  nodesAccess: Array<{ nodeType: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface N8nNodeType {
  name: string;
  displayName: string;
  description: string;
  version: number;
  group: string[];
  defaults: any;
  inputs: string[];
  outputs: string[];
}

export interface N8nNodeTypeDetails extends N8nNodeType {
  properties: any[];
  credentials?: any[];
}

export interface N8nTestResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface WorkflowStatus {
  id: string;
  active: boolean;
  status: 'active' | 'inactive' | 'error';
  error?: string;
}
