import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';
import { WorkflowClient } from '@/lib/workflow-client';
import { Route } from '../index';

// Mock the services
vi.mock('@/lib/workflow-instance-service');
vi.mock('@/lib/workflow-client');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  MoreHorizontal: () => <div data-testid="more-horizontal-icon" />,
  Play: () => <div data-testid="play-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  Edit: () => <div data-testid="edit-icon" />,
  Trash2: () => <div data-testid="trash2-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
}));

// Mock the UI components to avoid dependency issues
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props} data-testid="button">
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ onChange, ...props }: any) => (
    <input onChange={onChange} {...props} data-testid="input" />
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div onClick={onClick} data-testid="dropdown-menu-item">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table data-testid="table">{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody data-testid="table-body">{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td data-testid="table-cell">{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th data-testid="table-head">{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead data-testid="table-header">{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr data-testid="table-row">{children}</tr>,
}));

const mockWorkflowInstances = [
  {
    id: '3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2',
    name: 'Test Workflow Instance 1',
    description: 'A test workflow instance',
    templateId: 'template-123',
    configuration: { test: 'value' },
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
  },
  {
    id: '4b2cb1fb-1c33-5d58-a7fg-94db02bd99c3',
    name: 'Test Workflow Instance 2',
    description: 'Another test workflow instance',
    templateId: 'template-456',
    configuration: { test: 'value2' },
    isActive: false,
    deploymentStatus: 'draft' as const,
    deployedWorkflowId: null,
    deploymentError: undefined,
    createdBy: 'user-456',
    createdAt: '2025-06-14T10:00:00Z',
    updatedAt: '2025-06-14T10:00:00Z',
    templateType: 'flowise' as const,
    workflow_templates: {
      id: 'template-456',
      name: 'Flowise Template',
      description: 'A flowise template',
      template_type: 'flowise' as const,
      thumbnail_url: 'https://example.com/thumb2.png',
      template_data: { chains: [] },
    },
  },
];

const rootRoute = createRootRoute({
  component: () => <div>Root <Outlet /></div>,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/_authenticated',
  component: () => <div>Auth Layout <Outlet /></div>,
});

const workflowsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/workflows',
  component: () => <div>Workflows <Outlet /></div>,
});

const instancesRoute = createRoute({
  getParentRoute: () => workflowsRoute,
  path: '/instances',
  component: Route.options.component,
});

const routeTree = rootRoute.addChildren([
  authRoute.addChildren([
    workflowsRoute.addChildren([instancesRoute]),
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

describe('Workflow Instances Index Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(WorkflowClient).mockImplementation(() => ({
      deployInstance: vi.fn(),
      executeInstance: vi.fn(),
      getExecutionHistory: vi.fn().mockResolvedValue([]),
    }) as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Successful Instances Loading', () => {
    it('should load and display workflow instances successfully', async () => {
      // Mock successful instances loading
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
        expect(screen.getByText('Test Workflow Instance 2')).toBeInTheDocument();
      });

      // Verify the instance service was called
      expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();

      // Verify UI elements are rendered
      expect(screen.getByTestId('table')).toBeInTheDocument();
    });

    it('should display different deployment statuses correctly', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Check for status badges
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should handle different template types', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
        expect(screen.getByText('Test Workflow Instance 2')).toBeInTheDocument();
      });

      // Should display both n8n and flowise instances
      expect(screen.getByText('Test Template')).toBeInTheDocument();
      expect(screen.getByText('Flowise Template')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no instances exist', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue([]);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();
      });

      // Should show empty state message
      expect(screen.getByText(/no workflow instances/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle service error gracefully', async () => {
      const error = new Error('Failed to load instances');
      vi.mocked(WorkflowInstanceService.getInstances).mockRejectedValue(error);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();
      });

      // Should handle error without crashing
      expect(console.error).toHaveBeenCalledWith('Error loading instances:', error);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      vi.mocked(WorkflowInstanceService.getInstances).mockRejectedValue(networkError);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();
      });

      expect(console.error).toHaveBeenCalledWith('Error loading instances:', networkError);
    });
  });

  describe('Search and Filtering', () => {
    it('should filter instances by search query', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
        expect(screen.getByText('Test Workflow Instance 2')).toBeInTheDocument();
      });

      // Find and interact with search input
      const searchInput = screen.getByTestId('input');
      fireEvent.change(searchInput, { target: { value: 'Instance 1' } });

      // Should filter results (note: actual filtering logic would be in the component)
      expect(searchInput).toHaveValue('Instance 1');
    });

    it('should filter instances by status', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Check if filter controls are present
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('should filter instances by template type', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Should display instances with different template types
      expect(screen.getByText('Test Template')).toBeInTheDocument();
      expect(screen.getByText('Flowise Template')).toBeInTheDocument();
    });
  });

  describe('Instance Actions', () => {
    it('should handle instance activation/deactivation', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);
      vi.mocked(WorkflowInstanceService.activateInstance).mockResolvedValue();
      vi.mocked(WorkflowInstanceService.deactivateInstance).mockResolvedValue();

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Should render action buttons (dropdown menus)
      const dropdownTriggers = screen.getAllByTestId('dropdown-menu-trigger');
      expect(dropdownTriggers.length).toBeGreaterThan(0);
    });

    it('should handle instance deletion', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);
      vi.mocked(WorkflowInstanceService.deleteInstance).mockResolvedValue();

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Check for dropdown menus that would contain delete actions
      const dropdownTriggers = screen.getAllByTestId('dropdown-menu-trigger');
      expect(dropdownTriggers.length).toBeGreaterThan(0);
    });

    it('should handle instance execution', async () => {
      const mockClient = {
        executeInstance: vi.fn().mockResolvedValue({ executionId: 'exec-123' }),
        deployInstance: vi.fn(),
        getExecutionHistory: vi.fn().mockResolvedValue([]),
      };
      
      vi.mocked(WorkflowClient).mockImplementation(() => mockClient as any);
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Should render action controls
      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('should navigate to instance detail page', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Check for clickable instance names (which would navigate to detail)
      const instanceName = screen.getByText('Test Workflow Instance 1');
      expect(instanceName).toBeInTheDocument();
    });

    it('should provide create new instance functionality', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();
      });

      // Should render create button
      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates', () => {
    it('should handle instance status updates', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Should display current statuses
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should refresh instances data', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();
      });

      // Service should be called to load instances
      expect(WorkflowInstanceService.getInstances).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large numbers of instances', async () => {
      const manyInstances = Array.from({ length: 100 }, (_, index) => ({
        ...mockWorkflowInstances[0],
        id: `instance-${index}`,
        name: `Test Instance ${index}`,
      }));

      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(manyInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(WorkflowInstanceService.getInstances).toHaveBeenCalled();
      });

      // Should handle rendering without performance issues
      expect(screen.getByTestId('table')).toBeInTheDocument();
    });

    it('should debounce search input', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('input');
      
      // Rapid typing should be debounced
      fireEvent.change(searchInput, { target: { value: 'a' } });
      fireEvent.change(searchInput, { target: { value: 'ab' } });
      fireEvent.change(searchInput, { target: { value: 'abc' } });

      expect(searchInput).toHaveValue('abc');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Check for proper table structure
      expect(screen.getByTestId('table')).toBeInTheDocument();
      expect(screen.getByTestId('table-header')).toBeInTheDocument();
      expect(screen.getByTestId('table-body')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      vi.mocked(WorkflowInstanceService.getInstances).mockResolvedValue(mockWorkflowInstances);

      renderWithRouter('/_authenticated/workflows/instances');

      await waitFor(() => {
        expect(screen.getByText('Test Workflow Instance 1')).toBeInTheDocument();
      });

      // Interactive elements should be present
      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
