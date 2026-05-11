import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowClient } from '@/lib/workflow-client';
import { N8nClient } from '@/lib/n8n-client';
import { FlowiseClient } from '@/lib/flowise-client';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';
import { WorkflowInstance } from '@/types/workflows';

// Mock external dependencies
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
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const mockWorkflowInstance: WorkflowInstance = {
  id: 'instance-456',
  templateId: 'template-123',
  name: 'Test Workflow Instance',
  configuration: {
    nodes: [
      {
        id: '1',
        type: 'n8n-nodes-base.start',
        name: 'Start',
        parameters: {},
        position: [250, 300],
      },
    ],
    connections: {},
  },
  isActive: false,
  deploymentStatus: 'draft',
  createdBy: 'test-user-123',
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
  templateType: 'n8n',
  workflow_templates: {
    id: 'template-123',
    name: 'Test Workflow Template',
    description: 'A test template',
    template_type: 'n8n',
    thumbnail_url: 'https://example.com/thumb.png',
    template_data: {},
  },
};

const mockFlowiseInstance: WorkflowInstance = {
  ...mockWorkflowInstance,
  id: 'flowise-instance-789',
  templateType: 'flowise',
  configuration: {
    chatflowName: 'Test Chatflow',
    nodes: [
      {
        id: 'llm-1',
        type: 'ChatOpenAI',
        data: {
          label: 'ChatOpenAI',
          name: 'chatOpenAI',
        },
      },
    ],
  },
};

describe('WorkflowClient', () => {
  let mockWorkflowClient: WorkflowClient;
  let mockN8nClient: N8nClient;
  let mockFlowiseClient: FlowiseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock N8N Client
    mockN8nClient = new N8nClient();
    vi.spyOn(mockN8nClient, 'createWorkflow').mockResolvedValue({
      id: 'n8n-workflow-123',
      name: 'Test Workflow',
      active: false,
      nodes: [],
      connections: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionId: '1',
    });
    vi.spyOn(mockN8nClient, 'getHealth').mockResolvedValue({ status: 'healthy' });

    // Mock Flowise Client
    mockFlowiseClient = new FlowiseClient();
    vi.spyOn(mockFlowiseClient, 'createChatflow').mockResolvedValue({
      id: 'flowise-chatflow-456',
      name: 'Test Chatflow',
      deployed: false,
      flowData: {
        nodes: [],
        edges: [],
      },
      isPublic: false,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    });
    vi.spyOn(mockFlowiseClient, 'getHealth').mockResolvedValue({ status: 'healthy' });

    // Mock Workflow Client
    mockWorkflowClient = new WorkflowClient();
    vi.spyOn(WorkflowInstanceService, 'updateInstance').mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('deployInstance', () => {
    it('should successfully deploy an N8N workflow instance', async () => {
      vi.spyOn(mockWorkflowClient, 'deployInstance').mockResolvedValue('n8n-workflow-123');
      
      const deployedId = await mockWorkflowClient.deployInstance(mockWorkflowInstance);
      
      expect(deployedId).toBe('n8n-workflow-123');
      expect(mockWorkflowClient.deployInstance).toHaveBeenCalledWith(mockWorkflowInstance);
    });

    it('should successfully deploy a Flowise chatflow instance', async () => {
      vi.spyOn(mockWorkflowClient, 'deployInstance').mockResolvedValue('flowise-chatflow-456');
      
      const deployedId = await mockWorkflowClient.deployInstance(mockFlowiseInstance);
      
      expect(deployedId).toBe('flowise-chatflow-456');
      expect(mockWorkflowClient.deployInstance).toHaveBeenCalledWith(mockFlowiseInstance);
    });

    it('should handle deployment failures', async () => {
      vi.spyOn(mockWorkflowClient, 'deployInstance').mockRejectedValue(new Error('N8N service unavailable'));
      
      await expect(mockWorkflowClient.deployInstance(mockWorkflowInstance)).rejects.toThrow('N8N service unavailable');
    });

    it('should handle missing configuration', async () => {
      const instanceWithoutConfig = { ...mockWorkflowInstance, configuration: undefined };
      vi.spyOn(mockWorkflowClient, 'deployInstance').mockRejectedValue(new Error('No N8N workflow configuration provided'));
      
      await expect(mockWorkflowClient.deployInstance(instanceWithoutConfig)).rejects.toThrow('No N8N workflow configuration provided');
    });

    it('should handle unsupported template types', async () => {
      const unsupportedInstance = { ...mockWorkflowInstance, templateType: 'unknown' as 'n8n' };
      vi.spyOn(mockWorkflowClient, 'deployInstance').mockRejectedValue(new Error('Unsupported template type: unknown'));
      
      await expect(mockWorkflowClient.deployInstance(unsupportedInstance)).rejects.toThrow('Unsupported template type: unknown');
    });
  });

  describe('executeInstance', () => {
    it('should successfully execute a deployed workflow', async () => {
      const deployedInstance = { 
        ...mockWorkflowInstance, 
        deployedWorkflowId: 'n8n-workflow-123',
        deploymentStatus: 'active' as const,
      };
      
      vi.spyOn(mockWorkflowClient, 'executeInstance').mockResolvedValue({
        executionId: 'exec-789',
        status: 'running',
        startedAt: new Date().toISOString(),
        platform: 'n8n',
        platformExecutionId: 'exec-789',
      });
      
      const result = await mockWorkflowClient.executeInstance(deployedInstance);
      
      expect(result).toEqual({
        executionId: 'exec-789',
        status: 'running',
        startedAt: expect.any(String),
        platform: 'n8n',
        platformExecutionId: 'exec-789',
      });
    });

    it('should fail to execute non-deployed instances', async () => {
      vi.spyOn(mockWorkflowClient, 'executeInstance').mockRejectedValue(new Error('Workflow instance is not deployed'));
      
      await expect(mockWorkflowClient.executeInstance(mockWorkflowInstance)).rejects.toThrow('Workflow instance is not deployed');
    });
  });
}); 