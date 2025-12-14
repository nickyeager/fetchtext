import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { N8nClient } from '@/lib/n8n-client';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('N8nClient', () => {
  let n8nClient: N8nClient;

  beforeEach(() => {
    vi.clearAllMocks();
    n8nClient = new N8nClient({
      baseUrl: 'http://localhost:5678/api/v1',
      apiKey: 'test-api-key'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getWorkflows', () => {
    it('should fetch all workflows from N8N', async () => {
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Document Processing Workflow',
          active: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'workflow-2',
          name: 'Email Automation Workflow',
          active: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWorkflows }),
      } as Response);

      const workflows = await n8nClient.getWorkflows();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/api/v1/workflows',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(workflows).toEqual(mockWorkflows);
      expect(workflows).toHaveLength(2);
      expect(workflows[0].active).toBe(true);
      expect(workflows[1].active).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as Response);

      await expect(n8nClient.getWorkflows()).rejects.toThrow('N8N API Error: Unauthorized');
    });
  });

  describe('createWorkflow', () => {
    it('should create a new workflow in N8N', async () => {
      const workflowData = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'n8n-nodes-base.start',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        ],
        connections: {},
        settings: {},
        staticData: {}
      };

      const mockResponse = {
        id: 'new-workflow-id',
        name: 'Test Workflow',
        active: false,
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse }),
      } as Response);

      const workflowId = await n8nClient.createWorkflow(workflowData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/api/v1/workflows',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(workflowData),
        })
      );

      expect(workflowId).toBe('new-workflow-id');
    });

    it('should validate workflow data before creation', async () => {
      const invalidWorkflowData = {
        name: '', // Empty name should be invalid
        nodes: [],
        connections: {}
      };

      await expect(
        n8nClient.createWorkflow(invalidWorkflowData as any)
      ).rejects.toThrow('Invalid workflow data: name is required');
    });
  });

  describe('activateWorkflow', () => {
    it('should activate a workflow', async () => {
      const workflowId = 'workflow-123';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { active: true } }),
      } as Response);

      await n8nClient.activateWorkflow(workflowId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:5678/api/v1/workflows/${workflowId}/activate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key',
          }),
        })
      );
    });

    it('should handle activation failures', async () => {
      const workflowId = 'workflow-123';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Workflow has errors and cannot be activated' }),
      } as Response);

      await expect(n8nClient.activateWorkflow(workflowId)).rejects.toThrow(
        'N8N API Error: Workflow has errors and cannot be activated'
      );
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a workflow with input data', async () => {
      const workflowId = 'workflow-123';
      const inputData = { documentUrl: 'https://example.com/doc.pdf' };

      const mockExecution = {
        id: 'execution-456',
        mode: 'manual',
        startedAt: '2024-01-01T00:00:00.000Z',
        status: 'running',
        workflowId: workflowId
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockExecution }),
      } as Response);

      const execution = await n8nClient.executeWorkflow(workflowId, inputData);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:5678/api/v1/workflows/${workflowId}/execute`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(inputData),
        })
      );

      expect(execution.id).toBe('execution-456');
      expect(execution.status).toBe('running');
    });

    it('should execute workflow without input data', async () => {
      const workflowId = 'workflow-123';

      const mockExecution = {
        id: 'execution-789',
        mode: 'manual',
        startedAt: '2024-01-01T00:00:00.000Z',
        status: 'success',
        workflowId: workflowId
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockExecution }),
      } as Response);

      const execution = await n8nClient.executeWorkflow(workflowId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:5678/api/v1/workflows/${workflowId}/execute`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );

      expect(execution.id).toBe('execution-789');
    });
  });

  describe('getExecutions', () => {
    it('should fetch executions for all workflows when no workflowId provided', async () => {
      const mockExecutions = [
        {
          id: 'execution-1',
          mode: 'trigger',
          startedAt: '2024-01-01T00:00:00.000Z',
          stoppedAt: '2024-01-01T00:01:00.000Z',
          status: 'success',
          workflowId: 'workflow-1'
        },
        {
          id: 'execution-2',
          mode: 'manual',
          startedAt: '2024-01-01T01:00:00.000Z',
          stoppedAt: '2024-01-01T01:02:00.000Z',
          status: 'error',
          workflowId: 'workflow-2'
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockExecutions }),
      } as Response);

      const executions = await n8nClient.getExecutions();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/api/v1/executions',
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(executions).toEqual(mockExecutions);
      expect(executions).toHaveLength(2);
    });

    it('should fetch executions for specific workflow', async () => {
      const workflowId = 'workflow-123';
      const mockExecutions = [
        {
          id: 'execution-1',
          mode: 'trigger',
          status: 'success',
          workflowId: workflowId
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockExecutions }),
      } as Response);

      const executions = await n8nClient.getExecutions(workflowId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:5678/api/v1/executions?workflowId=${workflowId}`,
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(executions).toEqual(mockExecutions);
      expect(executions[0].workflowId).toBe(workflowId);
    });
  });

  describe('getWorkflowStatus', () => {
    it('should get workflow activation status', async () => {
      const workflowId = 'workflow-123';
      const mockStatus = {
        active: true,
        lastExecuted: '2024-01-01T00:00:00.000Z',
        executionCount: 5
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockStatus }),
      } as Response);

      const status = await n8nClient.getWorkflowStatus(workflowId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:5678/api/v1/workflows/${workflowId}/status`,
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(status.active).toBe(true);
      expect(status.executionCount).toBe(5);
    });
  });

  describe('testWorkflow', () => {
    it('should test workflow without activation', async () => {
      const workflowData = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'n8n-nodes-base.start',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        ],
        connections: {}
      };

      const mockTestResult = {
        success: true,
        executionId: 'test-execution-123',
        duration: 1500,
        outputData: {
          'node-1': [{ json: { message: 'Test successful' } }]
        }
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockTestResult }),
      } as Response);

      const testResult = await n8nClient.testWorkflow(workflowData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/api/v1/workflows/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(workflowData),
        })
      );

      expect(testResult.success).toBe(true);
      expect(testResult.duration).toBe(1500);
      expect(testResult.outputData).toBeDefined();
    });

    it('should handle test failures', async () => {
      const workflowData = {
        name: 'Test Workflow',
        nodes: [],
        connections: {}
      };

      const mockTestResult = {
        success: false,
        error: 'Workflow contains no executable nodes',
        executionId: 'test-execution-failed'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockTestResult }),
      } as Response);

      const testResult = await n8nClient.testWorkflow(workflowData);

      expect(testResult.success).toBe(false);
      expect(testResult.error).toBe('Workflow contains no executable nodes');
    });
  });

  describe('cancelExecution', () => {
    it('should cancel a running execution', async () => {
      const executionId = 'execution-123';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'cancelled' } }),
      } as Response);

      await n8nClient.cancelExecution(executionId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:5678/api/v1/executions/${executionId}/cancel`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle cancellation of non-running execution', async () => {
      const executionId = 'execution-123';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Execution is not running' }),
      } as Response);

      await expect(n8nClient.cancelExecution(executionId)).rejects.toThrow(
        'N8N API Error: Execution is not running'
      );
    });
  });

  describe('connection management', () => {
    it('should handle connection timeouts', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network timeout'));

      await expect(n8nClient.getWorkflows()).rejects.toThrow('Network timeout');
    });

    it('should retry failed requests', async () => {
      // First call fails, second succeeds
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);

      const client = new N8nClient({
        baseUrl: 'http://localhost:5678/api/v1',
        apiKey: 'test-api-key',
        retries: 1
      });

      const workflows = await client.getWorkflows();

      expect(workflows).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
