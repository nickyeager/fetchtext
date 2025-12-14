import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowInstanceManagerEnhanced } from '@/lib/workflow-instance-manager-enhanced';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock('@/lib/n8n-client', () => ({
  N8nClient: vi.fn().mockImplementation(() => ({
    createWorkflow: vi.fn(),
    activateWorkflow: vi.fn(),
    deactivateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    getWorkflowStatus: vi.fn(),
  })),
}));

vi.mock('@/lib/flowise-client', () => ({
  FlowiseClient: vi.fn().mockImplementation(() => ({
    createChatflow: vi.fn(),
    updateChatflow: vi.fn(),
    deleteChatflow: vi.fn(),
    getChatflow: vi.fn(),
  })),
}));

describe('WorkflowInstanceManagerEnhanced', () => {
  let manager: WorkflowInstanceManagerEnhanced;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new WorkflowInstanceManagerEnhanced();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('deployInstance', () => {
    it('should deploy N8N workflow instance successfully', async () => {
      const mockInstance = {
        id: 'instance-123',
        name: 'Test N8N Workflow',
        templateType: 'n8n' as const,
        configuration: {
          nodes: [
            {
              name: 'Start',
              type: 'n8n-nodes-base.start',
              parameters: {}
            }
          ],
          connections: {}
        },
        isActive: false,
        deploymentStatus: 'draft' as const
      };

      const mockN8nClient = {
        createWorkflow: vi.fn().mockResolvedValue('n8n-workflow-456'),
        activateWorkflow: vi.fn().mockResolvedValue(undefined)
      };

      vi.spyOn(manager, 'getN8nClient').mockReturnValue(mockN8nClient as any);
      vi.spyOn(manager, 'updateInstanceDeployment').mockResolvedValue(undefined);

      const deploymentId = await manager.deployInstance(mockInstance);

      expect(mockN8nClient.createWorkflow).toHaveBeenCalledWith({
        name: mockInstance.name,
        nodes: mockInstance.configuration.nodes,
        connections: mockInstance.configuration.connections,
      });

      expect(manager.updateInstanceDeployment).toHaveBeenCalledWith(
        mockInstance.id,
        {
          deployedWorkflowId: 'n8n-workflow-456',
          deploymentStatus: 'active',
          lastDeployedAt: expect.any(Date)
        }
      );

      expect(deploymentId).toBe('n8n-workflow-456');
    });

    it('should deploy Flowise chatflow instance successfully', async () => {
      const mockInstance = {
        id: 'instance-789',
        name: 'Test Flowise Chatflow',
        templateType: 'flowise' as const,
        configuration: {
          flowData: {
            nodes: [
              {
                id: 'llm-1',
                type: 'chatOpenAI',
                data: { inputs: { modelName: 'gpt-3.5-turbo' } }
              }
            ],
            edges: []
          }
        },
        isActive: false,
        deploymentStatus: 'draft' as const
      };

      const mockFlowiseClient = {
        createChatflow: vi.fn().mockResolvedValue('flowise-chatflow-456')
      };

      vi.spyOn(manager, 'getFlowiseClient').mockReturnValue(mockFlowiseClient as any);
      vi.spyOn(manager, 'updateInstanceDeployment').mockResolvedValue(undefined);

      const deploymentId = await manager.deployInstance(mockInstance);

      expect(mockFlowiseClient.createChatflow).toHaveBeenCalledWith({
        name: mockInstance.name,
        flowData: mockInstance.configuration.flowData
      });

      expect(deploymentId).toBe('flowise-chatflow-456');
    });

    it('should handle deployment failures gracefully', async () => {
      const mockInstance = {
        id: 'instance-123',
        name: 'Test Workflow',
        templateType: 'n8n' as const,
        configuration: {},
        isActive: false,
        deploymentStatus: 'draft' as const
      };

      const mockN8nClient = {
        createWorkflow: vi.fn().mockRejectedValue(new Error('N8N deployment failed'))
      };

      vi.spyOn(manager, 'getN8nClient').mockReturnValue(mockN8nClient as any);
      vi.spyOn(manager, 'updateInstanceDeployment').mockResolvedValue(undefined);

      await expect(manager.deployInstance(mockInstance)).rejects.toThrow('N8N deployment failed');

      expect(manager.updateInstanceDeployment).toHaveBeenCalledWith(
        mockInstance.id,
        {
          deploymentStatus: 'error',
          deploymentError: 'N8N deployment failed'
        }
      );
    });
  });

  describe('getInstanceStatus', () => {
    it('should get comprehensive instance status', async () => {
      const instanceId = 'instance-123';
      const mockInstance = {
        id: instanceId,
        deployedWorkflowId: 'n8n-workflow-456',
        templateType: 'n8n' as const,
        deploymentStatus: 'active' as const,
        lastExecutedAt: new Date('2024-01-01T12:00:00Z'),
        executionCount: 25
      };

      const mockN8nClient = {
        getWorkflowStatus: vi.fn().mockResolvedValue({
          active: true,
          lastExecuted: '2024-01-01T12:00:00Z',
          executionCount: 25
        }),
        getExecutions: vi.fn().mockResolvedValue([
          { id: 'exec-1', status: 'success', startedAt: '2024-01-01T11:30:00Z' },
          { id: 'exec-2', status: 'error', startedAt: '2024-01-01T11:00:00Z' }
        ])
      };

      vi.spyOn(manager, 'getInstance').mockResolvedValue(mockInstance as any);
      vi.spyOn(manager, 'getN8nClient').mockReturnValue(mockN8nClient as any);

      const status = await manager.getInstanceStatus(instanceId);

      expect(status.instance).toEqual(mockInstance);
      expect(status.isDeployed).toBe(true);
      expect(status.isActive).toBe(true);
      expect(status.executionCount).toBe(25);
      expect(status.recentExecutions).toHaveLength(2);
      expect(status.lastExecution.status).toBe('success');
    });

    it('should handle non-deployed instances', async () => {
      const instanceId = 'instance-456';
      const mockInstance = {
        id: instanceId,
        deployedWorkflowId: null,
        templateType: 'n8n' as const,
        deploymentStatus: 'draft' as const
      };

      vi.spyOn(manager, 'getInstance').mockResolvedValue(mockInstance as any);

      const status = await manager.getInstanceStatus(instanceId);

      expect(status.isDeployed).toBe(false);
      expect(status.isActive).toBe(false);
      expect(status.executionCount).toBe(0);
      expect(status.recentExecutions).toEqual([]);
    });
  });

  describe('executeInstance', () => {
    it('should execute N8N workflow instance with input data', async () => {
      const instanceId = 'instance-123';
      const inputData = { documentUrl: 'https://example.com/doc.pdf' };

      const mockInstance = {
        id: instanceId,
        deployedWorkflowId: 'n8n-workflow-456',
        templateType: 'n8n' as const,
        deploymentStatus: 'active' as const
      };

      const mockExecution = {
        id: 'execution-789',
        workflowId: 'n8n-workflow-456',
        status: 'running',
        startedAt: '2024-01-01T12:00:00Z'
      };

      const mockN8nClient = {
        executeWorkflow: vi.fn().mockResolvedValue(mockExecution)
      };

      vi.spyOn(manager, 'getInstance').mockResolvedValue(mockInstance as any);
      vi.spyOn(manager, 'getN8nClient').mockReturnValue(mockN8nClient as any);
      vi.spyOn(manager, 'recordExecution').mockResolvedValue(undefined);

      const execution = await manager.executeInstance(instanceId, inputData);

      expect(mockN8nClient.executeWorkflow).toHaveBeenCalledWith(
        'n8n-workflow-456',
        inputData
      );

      expect(manager.recordExecution).toHaveBeenCalledWith(
        instanceId,
        mockExecution.id,
        'running'
      );

      expect(execution).toEqual(mockExecution);
    });

    it('should execute Flowise chatflow instance with question', async () => {
      const instanceId = 'instance-456';
      const inputData = { question: 'Analyze this document', history: [] };

      const mockInstance = {
        id: instanceId,
        deployedWorkflowId: 'flowise-chatflow-789',
        templateType: 'flowise' as const,
        deploymentStatus: 'active' as const
      };

      const mockResponse = {
        question: 'Analyze this document',
        text: 'Here is the analysis...',
        chatId: 'chat-123'
      };

      const mockFlowiseClient = {
        executeChatflow: vi.fn().mockResolvedValue(mockResponse)
      };

      vi.spyOn(manager, 'getInstance').mockResolvedValue(mockInstance as any);
      vi.spyOn(manager, 'getFlowiseClient').mockReturnValue(mockFlowiseClient as any);
      vi.spyOn(manager, 'recordExecution').mockResolvedValue(undefined);

      const execution = await manager.executeInstance(instanceId, inputData);

      expect(mockFlowiseClient.executeChatflow).toHaveBeenCalledWith(
        'flowise-chatflow-789',
        inputData.question,
        inputData.history
      );

      expect(execution).toEqual(mockResponse);
    });

    it('should throw error for non-deployed instances', async () => {
      const instanceId = 'instance-789';
      const mockInstance = {
        id: instanceId,
        deployedWorkflowId: null,
        templateType: 'n8n' as const,
        deploymentStatus: 'draft' as const
      };

      vi.spyOn(manager, 'getInstance').mockResolvedValue(mockInstance as any);

      await expect(
        manager.executeInstance(instanceId, {})
      ).rejects.toThrow('Instance is not deployed');
    });
  });

  describe('getInstanceMetrics', () => {
    it('should calculate comprehensive instance metrics', async () => {
      const instanceId = 'instance-123';
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      const mockExecutions = [
        { id: 'exec-1', status: 'success', startedAt: '2024-01-15T10:00:00Z', duration: 2000 },
        { id: 'exec-2', status: 'success', startedAt: '2024-01-16T10:00:00Z', duration: 1500 },
        { id: 'exec-3', status: 'error', startedAt: '2024-01-17T10:00:00Z', duration: 500 },
        { id: 'exec-4', status: 'success', startedAt: '2024-01-18T10:00:00Z', duration: 1800 }
      ];

      vi.spyOn(manager, 'getExecutionHistory').mockResolvedValue(mockExecutions as any);

      const metrics = await manager.getInstanceMetrics(instanceId, startDate, endDate);

      expect(metrics.totalExecutions).toBe(4);
      expect(metrics.successfulExecutions).toBe(3);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.successRate).toBe(0.75);
      expect(metrics.averageDuration).toBe(1700); // (2000 + 1500 + 500 + 1800) / 4
      expect(metrics.executionsPerDay).toBeCloseTo(0.129, 2); // 4 executions / 31 days
    });

    it('should handle instances with no executions', async () => {
      const instanceId = 'instance-456';
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      vi.spyOn(manager, 'getExecutionHistory').mockResolvedValue([]);

      const metrics = await manager.getInstanceMetrics(instanceId, startDate, endDate);

      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(metrics.executionsPerDay).toBe(0);
    });
  });

  describe('batchOperations', () => {
    it('should activate multiple instances concurrently', async () => {
      const instanceIds = ['instance-1', 'instance-2', 'instance-3'];
      
      const mockInstances = instanceIds.map(id => ({
        id,
        deployedWorkflowId: `workflow-${id}`,
        templateType: 'n8n' as const,
        deploymentStatus: 'inactive' as const
      }));

      const mockN8nClient = {
        activateWorkflow: vi.fn().mockResolvedValue(undefined)
      };

      vi.spyOn(manager, 'getInstance').mockImplementation(async (id) => 
        mockInstances.find(inst => inst.id === id) as any
      );
      vi.spyOn(manager, 'getN8nClient').mockReturnValue(mockN8nClient as any);
      vi.spyOn(manager, 'updateInstanceDeployment').mockResolvedValue(undefined);

      const results = await manager.batchActivateInstances(instanceIds);

      expect(results.successful).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
      expect(mockN8nClient.activateWorkflow).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch operations', async () => {
      const instanceIds = ['instance-1', 'instance-2', 'instance-3'];
      
      const mockInstances = instanceIds.map(id => ({
        id,
        deployedWorkflowId: `workflow-${id}`,
        templateType: 'n8n' as const,
        deploymentStatus: 'inactive' as const
      }));

      const mockN8nClient = {
        activateWorkflow: vi.fn()
          .mockResolvedValueOnce(undefined) // instance-1 succeeds
          .mockRejectedValueOnce(new Error('Activation failed')) // instance-2 fails
          .mockResolvedValueOnce(undefined) // instance-3 succeeds
      };

      vi.spyOn(manager, 'getInstance').mockImplementation(async (id) => 
        mockInstances.find(inst => inst.id === id) as any
      );
      vi.spyOn(manager, 'getN8nClient').mockReturnValue(mockN8nClient as any);
      vi.spyOn(manager, 'updateInstanceDeployment').mockResolvedValue(undefined);

      const results = await manager.batchActivateInstances(instanceIds);

      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].instanceId).toBe('instance-2');
      expect(results.failed[0].error).toBe('Activation failed');
    });
  });

  describe('configurationValidation', () => {
    it('should validate N8N workflow configuration', async () => {
      const configuration = {
        nodes: [
          {
            name: 'Start',
            type: 'n8n-nodes-base.start',
            parameters: {}
          },
          {
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            parameters: {
              url: 'https://api.example.com/data',
              method: 'GET'
            }
          }
        ],
        connections: {
          'Start': {
            'main': [
              [{ node: 'HTTP Request', type: 'main', index: 0 }]
            ]
          }
        }
      };

      const validation = await manager.validateConfiguration('n8n', configuration);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toBeDefined();
    });

    it('should detect invalid N8N workflow configuration', async () => {
      const invalidConfiguration = {
        nodes: [
          {
            name: '', // Invalid: empty name
            type: 'n8n-nodes-base.start',
            parameters: {}
          }
        ],
        connections: {}
      };

      const validation = await manager.validateConfiguration('n8n', invalidConfiguration);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Node name cannot be empty');
    });

    it('should validate Flowise chatflow configuration', async () => {
      const configuration = {
        flowData: {
          nodes: [
            {
              id: 'llm-1',
              type: 'chatOpenAI',
              data: {
                inputs: {
                  modelName: 'gpt-3.5-turbo',
                  temperature: 0.7
                }
              }
            }
          ],
          edges: []
        }
      };

      const validation = await manager.validateConfiguration('flowise', configuration);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
