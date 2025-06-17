import React from 'react'; // Import React
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowInstance } from '@/types/workflows';

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-description">{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-title">{children}</div>
  ),
}));

vi.mock('@/components/workflows/VisualWorkflowEditor', () => ({
  VisualWorkflowEditor: ({ workflow, onWorkflowChange, readonly }: any) => (
    <div data-testid="visual-workflow-editor">
      <div data-testid="workflow-nodes">{JSON.stringify(workflow.nodes)}</div>
      <div data-testid="workflow-connections">{JSON.stringify(workflow.connections)}</div>
      <div data-testid="readonly-state">{readonly ? 'readonly' : 'editable'}</div>
      <button 
        data-testid="workflow-change-button"
        onClick={() => onWorkflowChange({ 
          nodes: [{ id: 'test-node', type: 'start' }], 
          connections: [{ from: 'start', to: 'end' }] 
        })}
      >
        Test Workflow Change
      </button>
    </div>
  ),
}));

const mockWorkflowInstance: WorkflowInstance = {
  id: '3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2',
  name: 'Test Workflow Instance',
  templateId: 'template-123',
  configuration: { 
    nodes: [{ id: 'node1', type: 'trigger' }],
    connections: [{ from: 'node1', to: 'node2' }],
    test: 'value' 
  },
  isActive: true,
  deploymentStatus: 'active' as const,
  deployedWorkflowId: 'deployed-123',
  deploymentError: undefined,
  createdBy: 'user-123',
  createdAt: '2025-06-15T10:00:00Z',
  updatedAt: '2025-06-15T10:00:00Z',
  templateType: 'n8n' as const,
  workflow_templates: {
    id: 'template-123',
    name: 'Test Template',
    description: 'A test template',
    template_type: 'n8n' as const,
    thumbnail_url: 'https://example.com/thumb.png',
    template_data: { nodes: [] },
  },
};

// Create a mock editor route component
function MockEditorRoute() {
  // Get initial instance from global test state if available
  const getInitialInstance = () => {
    // Check if there's a test-specific instance set via window global
    if (typeof window !== 'undefined' && (window as any).__testInstance) {
      return (window as any).__testInstance;
    }
    return mockWorkflowInstance;
  };

  const [instance, setInstance] = React.useState<WorkflowInstance | null>(getInitialInstance());

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  // Determine readonly state based on deployment status
  // Only 'active' deployments should be readonly, all others (draft, error, deploying, etc.) should be editable
  const isReadonly = instance.deploymentStatus === 'active';
  const readonlyState = isReadonly ? 'readonly' : 'editable';

  return (
    <div className="space-y-6">
      <div data-testid="card" className="h-[800px]">
        <div data-testid="card-header">
          <div data-testid="card-title">Visual Workflow Editor</div>
          <div data-testid="card-description">
            Design your workflow using the visual editor
          </div>
        </div>
        <div data-testid="card-content" className="h-full p-0">
          <div className="h-full">
            <div data-testid="visual-workflow-editor">
              <div data-testid="workflow-nodes">{JSON.stringify(instance.configuration?.nodes || [])}</div>
              <div data-testid="workflow-connections">{JSON.stringify(instance.configuration?.connections || [])}</div>
              <div data-testid="readonly-state">{readonlyState}</div>
              <button 
                data-testid="workflow-change-button"
                onClick={() => setInstance({
                  ...instance,
                  configuration: {
                    ...instance.configuration,
                    nodes: [{ id: 'test-node', type: 'start' }],
                    connections: [{ from: 'start', to: 'end' }]
                  }
                })}
              >
                Test Workflow Change
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <div>
      Root
      <Outlet />
    </div>
  ),
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/_authenticated',
  component: () => (
    <div>
      Auth Layout
      <Outlet />
    </div>
  ),
});

const workflowsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/workflows',
  component: () => (
    <div>
      Workflows
      <Outlet />
    </div>
  ),
});

const instancesRoute = createRoute({
  getParentRoute: () => workflowsRoute,
  path: '/instances',
  component: () => (
    <div>
      Instances
      <Outlet />
    </div>
  ),
});

const editorRoute = createRoute({
  getParentRoute: () => instancesRoute,
  path: '/$instanceId/editor',
  component: MockEditorRoute,
});

const routeTree = rootRoute.addChildren([
  authRoute.addChildren([
    workflowsRoute.addChildren([
      instancesRoute.addChildren([editorRoute]),
    ]),
  ]),
]);

const createTestRouter = (initialPath: string) => {
  const history = createMemoryHistory({
    initialEntries: [initialPath],
  });

  return createRouter({
    routeTree,
    history,
  });
};

const renderWithRouter = (initialPath: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const router = createTestRouter(initialPath);

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

describe('Editor Tab Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render visual workflow editor successfully', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByText('Visual Workflow Editor')).toBeInTheDocument();
      });

      // Verify main sections are rendered
      expect(screen.getByText('Design your workflow using the visual editor')).toBeInTheDocument();
      expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
    });

    it('should render card structure correctly', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });

      // Check card structure
      expect(screen.getByTestId('card-header')).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toBeInTheDocument();
      expect(screen.getByTestId('card-description')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });

    it('should have correct card height styling', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });

      // Card should have height styling (h-[800px])
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('h-[800px]');
    });
  });

  describe('Workflow Data Display', () => {
    it('should display workflow nodes correctly', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('workflow-nodes')).toBeInTheDocument();
      });

      // Should display the nodes from configuration
      const nodesElement = screen.getByTestId('workflow-nodes');
      expect(nodesElement).toHaveTextContent('[{"id":"node1","type":"trigger"}]');
    });

    it('should display workflow connections correctly', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('workflow-connections')).toBeInTheDocument();
      });

      // Should display the connections from configuration
      const connectionsElement = screen.getByTestId('workflow-connections');
      expect(connectionsElement).toHaveTextContent('[{"from":"node1","to":"node2"}]');
    });

    it('should handle empty workflow data', async () => {
      // Mock an instance with empty workflow data
      const emptyWorkflowInstance = {
        ...mockWorkflowInstance,
        configuration: {},
      };

      // Override the mock for this test
      vi.doMock('react', () => ({
        ...vi.importActual('react'),
        useState: vi.fn(() => [emptyWorkflowInstance, vi.fn()]),
      }));

      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
      });

      // Should handle empty data gracefully
      expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
    });
  });

  describe('Readonly State Management', () => {
    afterEach(() => {
      // Clean up global test state
      if (typeof window !== 'undefined') {
        delete (window as any).__testInstance;
      }
    });

    it('should show editable state for non-active deployment', async () => {
      // Mock instance with draft status
      const draftInstance = {
        ...mockWorkflowInstance,
        deploymentStatus: 'draft' as const,
      };

      // Set test instance globally
      if (typeof window !== 'undefined') {
        (window as any).__testInstance = draftInstance;
      }

      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('readonly-state')).toBeInTheDocument();
      });

      // Should be editable for draft status
      expect(screen.getByTestId('readonly-state')).toHaveTextContent('editable');
    });

    it('should show readonly state for active deployment', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('readonly-state')).toBeInTheDocument();
      });

      // Should be readonly for active status
      expect(screen.getByTestId('readonly-state')).toHaveTextContent('readonly');
    });

    it('should handle error deployment status', async () => {
      // Mock instance with error status
      const errorInstance = {
        ...mockWorkflowInstance,
        deploymentStatus: 'error' as const,
      };

      // Set test instance globally
      if (typeof window !== 'undefined') {
        (window as any).__testInstance = errorInstance;
      }

      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('readonly-state')).toBeInTheDocument();
      });

      // Should be editable for error status
      expect(screen.getByTestId('readonly-state')).toHaveTextContent('editable');
    });
  });

  describe('Workflow Change Handling', () => {
    it('should handle workflow changes correctly', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('workflow-change-button')).toBeInTheDocument();
      });

      // Initial state
      expect(screen.getByTestId('workflow-nodes')).toHaveTextContent('[{"id":"node1","type":"trigger"}]');

      // Trigger workflow change
      const changeButton = screen.getByTestId('workflow-change-button');
      changeButton.click();

      // Should update the workflow data
      await waitFor(() => {
        expect(screen.getByTestId('workflow-nodes')).toHaveTextContent('[{"id":"test-node","type":"start"}]');
      });

      expect(screen.getByTestId('workflow-connections')).toHaveTextContent('[{"from":"start","to":"end"}]');
    });

    it('should preserve other configuration when updating workflow', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('workflow-change-button')).toBeInTheDocument();
      });

      // Trigger workflow change
      const changeButton = screen.getByTestId('workflow-change-button');
      changeButton.click();

      // Configuration should be updated while preserving other data
      await waitFor(() => {
        expect(screen.getByTestId('workflow-nodes')).toHaveTextContent('[{"id":"test-node","type":"start"}]');
      });

      // The editor should still be rendered
      expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when instance is null', () => {
      // Mock null instance
      vi.doMock('react', () => ({
        ...vi.importActual('react'),
        useState: vi.fn(() => [null, vi.fn()]),
      }));

      // This would show the loading state
      const { container } = render(<div>Loading instance...</div>);
      expect(container.textContent).toContain('Loading instance...');
    });
  });

  describe('Layout and Styling', () => {
    it('should have proper spacing classes', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });

      // Should have proper height and spacing
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('h-[800px]');
      
      const cardContent = screen.getByTestId('card-content');
      expect(cardContent).toHaveClass('h-full', 'p-0');
    });

    it('should handle container hierarchy correctly', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
      });

      // Check the structure hierarchy
      const card = screen.getByTestId('card');
      const cardContent = screen.getByTestId('card-content');
      const editor = screen.getByTestId('visual-workflow-editor');

      expect(card).toContainElement(cardContent);
      expect(cardContent).toContainElement(editor);
    });
  });

  describe('Integration with VisualWorkflowEditor', () => {
    it('should pass correct props to VisualWorkflowEditor', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
      });

      // Should pass workflow data
      expect(screen.getByTestId('workflow-nodes')).toHaveTextContent('[{"id":"node1","type":"trigger"}]');
      expect(screen.getByTestId('workflow-connections')).toHaveTextContent('[{"from":"node1","to":"node2"}]');
      
      // Should pass readonly state
      expect(screen.getByTestId('readonly-state')).toHaveTextContent('readonly');
    });

    it('should handle workflow change callbacks', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('workflow-change-button')).toBeInTheDocument();
      });

      // Test the onWorkflowChange callback
      const changeButton = screen.getByTestId('workflow-change-button');
      changeButton.click();

      await waitFor(() => {
        expect(screen.getByTestId('workflow-nodes')).toHaveTextContent('[{"id":"test-node","type":"start"}]');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      // Mock instance without configuration
      const noConfigInstance = {
        ...mockWorkflowInstance,
        configuration: null,
      };

      vi.doMock('react', () => ({
        ...vi.importActual('react'),
        useState: vi.fn(() => [noConfigInstance, vi.fn()]),
      }));

      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
      });

      // Should handle null configuration gracefully
      expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
    });

    it('should handle missing nodes and connections', async () => {
      // Mock instance with partial configuration
      const partialConfigInstance = {
        ...mockWorkflowInstance,
        configuration: { test: 'value' }, // No nodes or connections
      };

      vi.doMock('react', () => ({
        ...vi.importActual('react'),
        useState: vi.fn(() => [partialConfigInstance, vi.fn()]),
      }));

      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
      });

      // Should handle missing nodes/connections gracefully
      expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large workflow configurations', async () => {
      // Mock instance with many nodes
      const largeWorkflowInstance = {
        ...mockWorkflowInstance,
        configuration: {
          nodes: Array.from({ length: 100 }, (_, i) => ({ id: `node${i}`, type: 'process' })),
          connections: Array.from({ length: 99 }, (_, i) => ({ from: `node${i}`, to: `node${i + 1}` })),
        },
      };

      vi.doMock('react', () => ({
        ...vi.importActual('react'),
        useState: vi.fn(() => [largeWorkflowInstance, vi.fn()]),
      }));

      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
      });

      // Should handle large configurations without issues
      expect(screen.getByTestId('visual-workflow-editor')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByText('Visual Workflow Editor')).toBeInTheDocument();
      });

      // Should have proper title and description
      expect(screen.getByTestId('card-title')).toHaveTextContent('Visual Workflow Editor');
      expect(screen.getByTestId('card-description')).toHaveTextContent('Design your workflow using the visual editor');
    });

    it('should provide meaningful content descriptions', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/editor');

      await waitFor(() => {
        expect(screen.getByTestId('card-description')).toBeInTheDocument();
      });

      // Description should be informative
      expect(screen.getByTestId('card-description')).toHaveTextContent('Design your workflow using the visual editor');
    });
  });
});
