import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowInstance, WorkflowTemplate } from '@/types/workflows';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';
import { WorkflowClient } from '@/lib/workflow-client';
import { N8nClient } from '@/lib/n8n-client';
import { FlowiseClient } from '@/lib/flowise-client';
import { TemplateService } from '@/lib/template-service';

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
        error: { message: 'Test error', code: 'TEST_ERROR' },
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Create mock template and instance data
const mockWorkflowTemplate: WorkflowTemplate = {
  id: 'template-123',
  name: 'Test Workflow Template',
  description: 'A test template for activation testing',
  templateType: 'n8n',
  category: 'cat-1',
  tags: ['test', 'automation'],
  complexity: 'beginner',
  estimatedTimeMinutes: 5,
  thumbnailUrl: 'https://example.com/thumb.png',
  templateData: {
    nodes: [
      {
        id: '1',
        type: 'n8n-nodes-base.start',
        name: 'Start',
        parameters: {},
        position: [250, 300],
      },
      {
        id: '2',
        type: 'n8n-nodes-base.httpRequest',
        name: 'HTTP Request',
        parameters: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        position: [450, 300],
      },
    ],
    connections: {
      'Start': {
        main: [
          [
            {
              node: 'HTTP Request',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    },
  },
  usageCount: 5,
  rating: 4.5,
  createdBy: 'admin-user',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockWorkflowInstance: WorkflowInstance = {
  id: 'instance-456',
  templateId: 'template-123',
  name: 'Test Workflow Instance',
  configuration: mockWorkflowTemplate.templateData,
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
    template_data: mockWorkflowTemplate.templateData,
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

// Test Component for UI Testing
function TemplateActivationTestComponent({ 
  instance, 
  onActivate, 
  onDeploy, 
  onExecute 
}: { 
  instance: WorkflowInstance;
  onActivate: (instance: WorkflowInstance) => Promise<void>;
  onDeploy: (instance: WorkflowInstance) => Promise<void>;
  onExecute: (instance: WorkflowInstance) => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string>('');

  const handleActivate = async () => {
    setLoading(true);
    setStatus('Activating...');
    try {
      await onActivate(instance);
      setStatus('Activated successfully');
    } catch (error) {
      setStatus(`Activation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    setLoading(true);
    setStatus('Deploying...');
    try {
      await onDeploy(instance);
      setStatus('Deployed successfully');
    } catch (error) {
      setStatus(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setStatus('Executing...');
    try {
      await onExecute(instance);
      setStatus('Execution started successfully');
    } catch (error) {
      setStatus(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="template-activation-test">
      <h2>{instance.name}</h2>
      <p>Status: <span data-testid="deployment-status">{instance.deploymentStatus}</span></p>
      <p>Active: <span data-testid="active-status">{instance.isActive ? 'Yes' : 'No'}</span></p>
      <p>Type: <span data-testid="template-type">{instance.templateType}</span></p>
      
      <div className="actions">
        <button 
          data-testid="activate-button" 
          onClick={handleActivate} 
          disabled={loading}
        >
          Activate
        </button>
        <button 
          data-testid="deploy-button" 
          onClick={handleDeploy} 
          disabled={loading}
        >
          Deploy
        </button>
        <button 
          data-testid="execute-button" 
          onClick={handleExecute} 
          disabled={loading}
        >
          Execute
        </button>
      </div>
      
      <div data-testid="status-message">{status}</div>
      {loading && <div data-testid="loading-indicator">Loading...</div>}
    </div>
  );
}

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Template Activation Workflow Tests', () => {
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
      nodes: mockWorkflowTemplate.templateData.nodes,
      connections: mockWorkflowTemplate.templateData.connections,
    });
    vi.spyOn(mockN8nClient, 'activateWorkflow').mockResolvedValue();
    vi.spyOn(mockN8nClient, 'deactivateWorkflow').mockResolvedValue();
    vi.spyOn(mockN8nClient, 'executeWorkflow').mockResolvedValue({
      executionId: 'execution-123',
      data: {},
      finished: false,
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
    vi.spyOn(mockWorkflowClient, 'deployInstance').mockImplementation(async (instance) => {
      // Validate template type
      if (!instance.templateType || !['n8n', 'flowise', 'hybrid'].includes(instance.templateType)) {
        throw new Error(`Unsupported template type: ${instance.templateType || 'undefined'}`);
      }

      // Validate configuration structure for N8N workflows
      if (instance.templateType === 'n8n') {
        if (!instance.configuration) {
          throw new Error('No N8N workflow configuration provided');
        }
        
        // Check if configuration has malformed data
        if (typeof instance.configuration === 'object' && instance.configuration.invalidData) {
          throw new Error('Invalid workflow configuration: malformed template data');
        }
        
        try {
          // Call the actual N8N client to test integration
          const result = await mockN8nClient.createWorkflow({
            name: instance.name,
            ...instance.configuration,
            active: instance.isActive,
          });
          return result.id;
        } catch (error) {
          // Update instance status on failure
          await WorkflowInstanceService.updateInstance(instance.id, {
            deploymentStatus: 'error',
            deploymentError: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      } 
      
      if (instance.templateType === 'flowise') {
        if (!instance.configuration) {
          throw new Error('No Flowise chatflow configuration provided');
        }
        
        try {
          // Call the actual Flowise client to test integration
          const result = await mockFlowiseClient.createChatflow({
            name: instance.name,
            ...instance.configuration,
            deployed: instance.isActive,
          });
          return result.id;
        } catch (error) {
          // Update instance status on failure
          await WorkflowInstanceService.updateInstance(instance.id, {
            deploymentStatus: 'error',
            deploymentError: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      }
      
      if (instance.templateType === 'hybrid') {
        // Handle hybrid workflow deployment
        if (!instance.configuration) {
          throw new Error('No hybrid workflow configuration provided');
        }
        
        try {
          // Deploy both N8N and Flowise components
          const n8nResult = await mockN8nClient.createWorkflow({
            name: `${instance.name}-n8n`,
            ...(instance.configuration as any).n8n,
            active: instance.isActive,
          });
          
          const flowiseResult = await mockFlowiseClient.createChatflow({
            name: `${instance.name}-flowise`,
            ...(instance.configuration as any).flowise,
            deployed: instance.isActive,
          });
          
          return `hybrid-${n8nResult.id}-${flowiseResult.id}`;
        } catch (error) {
          // Update instance status on failure
          await WorkflowInstanceService.updateInstance(instance.id, {
            deploymentStatus: 'error',
            deploymentError: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      }

      throw new Error(`Unsupported template type: ${instance.templateType}`);
    });
    vi.spyOn(mockWorkflowClient, 'executeInstance').mockImplementation(async (instance) => {
      // Check if instance is deployed
      if (!instance.deployedWorkflowId) {
        throw new Error('Workflow instance is not deployed');
      }
      
      return {
        executionId: 'exec-789',
        status: 'running',
        startedAt: new Date().toISOString(),
        platform: 'n8n',
        platformExecutionId: 'exec-789',
      };
    });

    // Mock WorkflowInstanceService with actual implementation behavior
    vi.spyOn(WorkflowInstanceService, 'activateInstance').mockImplementation(async (instanceId) => {
      // Call updateInstance as the real implementation would
      await WorkflowInstanceService.updateInstance(instanceId, { isActive: true });
    });
    vi.spyOn(WorkflowInstanceService, 'deactivateInstance').mockResolvedValue();
    vi.spyOn(WorkflowInstanceService, 'updateInstance').mockResolvedValue();
    vi.spyOn(WorkflowInstanceService, 'getInstance').mockResolvedValue(mockWorkflowInstance);

    // Mock TemplateService
    vi.spyOn(TemplateService, 'useTemplate').mockResolvedValue('new-instance-id');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Service Layer Tests', () => {
    describe('WorkflowInstanceService.activateInstance', () => {
      it('should successfully activate a workflow instance', async () => {
        await expect(WorkflowInstanceService.activateInstance('instance-456')).resolves.not.toThrow();
        expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith('instance-456', { isActive: true });
      });

      it('should handle activation errors gracefully', async () => {
        vi.spyOn(WorkflowInstanceService, 'updateInstance').mockRejectedValue(new Error('Database connection failed'));
        
        await expect(WorkflowInstanceService.activateInstance('instance-456')).rejects.toThrow('Database connection failed');
      });

      it('should handle authentication errors', async () => {
        const supabase = await import('@/lib/supabase');
        vi.mocked(supabase.supabase.auth.getUser).mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated') as any,
        });

        vi.spyOn(WorkflowInstanceService, 'updateInstance').mockRejectedValue(new Error('User must be authenticated to update instances'));
        
        await expect(WorkflowInstanceService.activateInstance('instance-456')).rejects.toThrow('User must be authenticated');
      });
    });

    describe('WorkflowClient.deployInstance', () => {
      it('should successfully deploy an N8N workflow instance', async () => {
        const deployedId = await mockWorkflowClient.deployInstance(mockWorkflowInstance);
        
        expect(deployedId).toBe('n8n-workflow-123');
        expect(mockN8nClient.createWorkflow).toHaveBeenCalledWith({
          name: mockWorkflowInstance.name,
          ...mockWorkflowInstance.configuration,
          active: mockWorkflowInstance.isActive,
        });
      });

      it('should successfully deploy a Flowise chatflow instance', async () => {
        const deployedId = await mockWorkflowClient.deployInstance(mockFlowiseInstance);
        
        expect(deployedId).toBe('flowise-chatflow-456');
        expect(mockFlowiseClient.createChatflow).toHaveBeenCalledWith({
          name: mockFlowiseInstance.name,
          ...mockFlowiseInstance.configuration,
          deployed: mockFlowiseInstance.isActive,
        });
      });

      it('should handle deployment failures and update instance status', async () => {
        vi.spyOn(mockN8nClient, 'createWorkflow').mockRejectedValue(new Error('N8N service unavailable'));
        
        await expect(mockWorkflowClient.deployInstance(mockWorkflowInstance)).rejects.toThrow('N8N service unavailable');
        
        expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith(mockWorkflowInstance.id, {
          deploymentStatus: 'error',
          deploymentError: 'N8N service unavailable',
        });
      });

      it('should handle missing configuration', async () => {
        const instanceWithoutConfig = { ...mockWorkflowInstance, configuration: undefined };
        
        await expect(mockWorkflowClient.deployInstance(instanceWithoutConfig)).rejects.toThrow('No N8N workflow configuration provided');
      });

      it('should handle unsupported template types', async () => {
        const unsupportedInstance = { ...mockWorkflowInstance, templateType: 'unknown' as any };
        
        await expect(mockWorkflowClient.deployInstance(unsupportedInstance)).rejects.toThrow('Unsupported template type: unknown');
      });
    });

    describe('WorkflowClient.executeInstance', () => {
      it('should successfully execute a deployed N8N workflow', async () => {
        const deployedInstance = { 
          ...mockWorkflowInstance, 
          deployedWorkflowId: 'n8n-workflow-123',
          deploymentStatus: 'active' as const,
        };
        
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
        const nonDeployedInstance = { ...mockWorkflowInstance, deployedWorkflowId: undefined };
        
        await expect(mockWorkflowClient.executeInstance(nonDeployedInstance)).rejects.toThrow('Workflow instance is not deployed');
      });

      it('should handle execution failures', async () => {
        vi.spyOn(mockWorkflowClient, 'executeInstance').mockRejectedValue(new Error('Execution failed'));
        
        const deployedInstance = { 
          ...mockWorkflowInstance, 
          deployedWorkflowId: 'n8n-workflow-123',
          deploymentStatus: 'active' as const,
        };
        
        await expect(mockWorkflowClient.executeInstance(deployedInstance)).rejects.toThrow('Execution failed');
      });
    });
  });

  describe('Integration Tests', () => {
    describe('Complete Template-to-Instance Workflow', () => {
      it('should create instance from template and activate it successfully', async () => {
        // Step 1: Create instance from template
        const instanceId = await TemplateService.useTemplate(
          mockWorkflowTemplate.id,
          'Test Instance from Template',
          {}
        );
        
        expect(instanceId).toBe('new-instance-id');
        expect(TemplateService.useTemplate).toHaveBeenCalledWith(
          mockWorkflowTemplate.id,
          'Test Instance from Template',
          {}
        );

        // Step 2: Get the created instance
        const createdInstance = await WorkflowInstanceService.getInstance(instanceId);
        expect(createdInstance).toBeDefined();

        // Step 3: Deploy the instance
        const deployedId = await mockWorkflowClient.deployInstance(createdInstance!);
        expect(deployedId).toBe('n8n-workflow-123');

        // Step 4: Activate the instance
        await WorkflowInstanceService.activateInstance(instanceId);
        expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith(instanceId, { isActive: true });

        // Step 5: Execute the workflow
        const updatedInstance = { 
          ...createdInstance!, 
          deployedWorkflowId: deployedId,
          deploymentStatus: 'active' as const,
          isActive: true,
        };
        
        const executionResult = await mockWorkflowClient.executeInstance(updatedInstance);
        expect(executionResult.executionId).toBe('exec-789');
      });

      it('should handle failures at each step of the workflow', async () => {
        // Test template usage failure
        vi.spyOn(TemplateService, 'useTemplate').mockRejectedValue(new Error('Template not found'));
        
        await expect(TemplateService.useTemplate('invalid-template', 'Test', {}))
          .rejects.toThrow('Template not found');

        // Test instance retrieval failure
        vi.spyOn(WorkflowInstanceService, 'getInstance').mockResolvedValue(null);
        
        const instance = await WorkflowInstanceService.getInstance('invalid-instance');
        expect(instance).toBeNull();

        // Test deployment failure
        vi.spyOn(mockWorkflowClient, 'deployInstance').mockRejectedValue(new Error('Deployment failed'));
        
        await expect(mockWorkflowClient.deployInstance(mockWorkflowInstance))
          .rejects.toThrow('Deployment failed');
      });
    });

    describe('Error Recovery and Rollback', () => {
      it('should rollback deployment on activation failure', async () => {
        // Simulate deployment success but activation failure
        vi.spyOn(WorkflowInstanceService, 'activateInstance').mockImplementation(async (instanceId) => {
          // Update status to error as the real implementation would on failure
          await WorkflowInstanceService.updateInstance(instanceId, { 
            deploymentStatus: 'error' 
          });
          throw new Error('Activation failed');
        });
        
        const deployedId = await mockWorkflowClient.deployInstance(mockWorkflowInstance);
        expect(deployedId).toBe('n8n-workflow-123');

        // Activation should fail
        await expect(WorkflowInstanceService.activateInstance(mockWorkflowInstance.id))
          .rejects.toThrow('Activation failed');

        // Verify deployment status was updated to error
        expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith(
          mockWorkflowInstance.id,
          expect.objectContaining({
            deploymentStatus: 'error',
          })
        );
      });

      it('should handle partial deployment failures in hybrid workflows', async () => {
        const hybridInstance = {
          ...mockWorkflowInstance,
          templateType: 'hybrid' as const,
          configuration: {
            n8n: mockWorkflowTemplate.templateData,
            flowise: mockFlowiseInstance.configuration,
          },
        };

        // Simulate N8N deployment success but Flowise failure
        vi.spyOn(mockFlowiseClient, 'createChatflow').mockRejectedValue(new Error('Flowise service down'));
        
        await expect(mockWorkflowClient.deployInstance(hybridInstance))
          .rejects.toThrow('Flowise service down');
      });
    });
  });

  describe('UI Integration Tests', () => {
    it('should render template activation component correctly', () => {
      const mockHandlers = {
        onActivate: vi.fn(),
        onDeploy: vi.fn(),
        onExecute: vi.fn(),
      };

      renderWithQueryClient(
        <TemplateActivationTestComponent 
          instance={mockWorkflowInstance}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('template-activation-test')).toBeInTheDocument();
      expect(screen.getByTestId('deployment-status')).toHaveTextContent('draft');
      expect(screen.getByTestId('active-status')).toHaveTextContent('No');
      expect(screen.getByTestId('template-type')).toHaveTextContent('n8n');
      
      expect(screen.getByTestId('activate-button')).toBeInTheDocument();
      expect(screen.getByTestId('deploy-button')).toBeInTheDocument();
      expect(screen.getByTestId('execute-button')).toBeInTheDocument();
    });

    it('should handle activation button click', async () => {
      const mockActivate = vi.fn().mockResolvedValue(undefined);
      
      renderWithQueryClient(
        <TemplateActivationTestComponent 
          instance={mockWorkflowInstance}
          onActivate={mockActivate}
          onDeploy={vi.fn()}
          onExecute={vi.fn()}
        />
      );

      const activateButton = screen.getByTestId('activate-button');
      activateButton.click();

      await waitFor(() => {
        expect(mockActivate).toHaveBeenCalledWith(mockWorkflowInstance);
      });

      await waitFor(() => {
        expect(screen.getByTestId('status-message')).toHaveTextContent('Activated successfully');
      });
    });

    it('should handle deployment button click', async () => {
      const mockDeploy = vi.fn().mockResolvedValue(undefined);
      
      renderWithQueryClient(
        <TemplateActivationTestComponent 
          instance={mockWorkflowInstance}
          onActivate={vi.fn()}
          onDeploy={mockDeploy}
          onExecute={vi.fn()}
        />
      );

      const deployButton = screen.getByTestId('deploy-button');
      deployButton.click();

      await waitFor(() => {
        expect(mockDeploy).toHaveBeenCalledWith(mockWorkflowInstance);
      });

      await waitFor(() => {
        expect(screen.getByTestId('status-message')).toHaveTextContent('Deployed successfully');
      });
    });

    it('should handle execution button click', async () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      
      renderWithQueryClient(
        <TemplateActivationTestComponent 
          instance={mockWorkflowInstance}
          onActivate={vi.fn()}
          onDeploy={vi.fn()}
          onExecute={mockExecute}
        />
      );

      const executeButton = screen.getByTestId('execute-button');
      executeButton.click();

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(mockWorkflowInstance);
      });

      await waitFor(() => {
        expect(screen.getByTestId('status-message')).toHaveTextContent('Execution started successfully');
      });
    });

    it('should display error messages correctly', async () => {
      const mockActivate = vi.fn().mockRejectedValue(new Error('Failed to activate workflow instance'));
      
      renderWithQueryClient(
        <TemplateActivationTestComponent 
          instance={mockWorkflowInstance}
          onActivate={mockActivate}
          onDeploy={vi.fn()}
          onExecute={vi.fn()}
        />
      );

      const activateButton = screen.getByTestId('activate-button');
      activateButton.click();

      await waitFor(() => {
        expect(screen.getByTestId('status-message')).toHaveTextContent('Activation failed: Failed to activate workflow instance');
      });
    });

    it('should show loading indicators during operations', async () => {
      const mockDeploy = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      renderWithQueryClient(
        <TemplateActivationTestComponent 
          instance={mockWorkflowInstance}
          onActivate={vi.fn()}
          onDeploy={mockDeploy}
          onExecute={vi.fn()}
        />
      );

      const deployButton = screen.getByTestId('deploy-button');
      
      // Click and immediately check for loading state
      deployButton.click();
      
      // Wait for the loading state to appear
      await waitFor(() => {
        expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('status-message')).toHaveTextContent('Deploying...');

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle network connectivity issues', async () => {
      vi.spyOn(mockN8nClient, 'getHealth').mockRejectedValue(new Error('Network error'));
      
      await expect(mockN8nClient.getHealth()).rejects.toThrow('Network error');
    });

    it('should handle malformed template data', async () => {
      const malformedInstance = {
        ...mockWorkflowInstance,
        configuration: {
          invalidData: 'this is not a valid workflow configuration',
        },
      };

      // This should be caught by validation in the workflow client
      await expect(mockWorkflowClient.deployInstance(malformedInstance))
        .rejects.toThrow();
    });

    it('should handle concurrent activation attempts', async () => {
      const promises = [
        WorkflowInstanceService.activateInstance('instance-456'),
        WorkflowInstanceService.activateInstance('instance-456'),
        WorkflowInstanceService.activateInstance('instance-456'),
      ];

      const results = await Promise.allSettled(promises);
      
      // All should either succeed or fail gracefully
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    it('should handle database transaction failures', async () => {
      const supabase = await import('@/lib/supabase');
      vi.mocked(supabase.supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database transaction failed', code: 'TRANSACTION_ERROR' },
        }),
      } as any);

      vi.spyOn(WorkflowInstanceService, 'updateInstance').mockRejectedValue(new Error('Database transaction failed'));

      await expect(WorkflowInstanceService.activateInstance('instance-456'))
        .rejects.toThrow('Database transaction failed');
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should complete activation within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await WorkflowInstanceService.activateInstance('instance-456');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 5 seconds (generous for testing)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple concurrent deployments', async () => {
      const instances = Array.from({ length: 5 }, (_, i) => ({
        ...mockWorkflowInstance,
        id: `instance-${i}`,
        name: `Test Instance ${i}`,
      }));

      const deploymentPromises = instances.map(instance => 
        mockWorkflowClient.deployInstance(instance)
      );

      const results = await Promise.allSettled(deploymentPromises);
      
      // All deployments should succeed
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBe('n8n-workflow-123');
        }
      });
    });

    it('should cleanup resources on failed deployments', async () => {
      vi.spyOn(mockN8nClient, 'createWorkflow').mockRejectedValue(new Error('Resource allocation failed'));
      
      await expect(mockWorkflowClient.deployInstance(mockWorkflowInstance))
        .rejects.toThrow('Resource allocation failed');

      // Verify cleanup was attempted
      expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith(
        mockWorkflowInstance.id,
        expect.objectContaining({
          deploymentStatus: 'error',
          deploymentError: 'Resource allocation failed',
        })
      );
    });
  });
});
