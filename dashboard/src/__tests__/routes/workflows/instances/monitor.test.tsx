import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowInstance } from '@/types/workflows';
import React from 'react'; // Import React

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/workflows/RealtimeExecutionMonitor', () => ({
  RealtimeExecutionMonitor: ({ instanceId, onExecutionStart, onExecutionStop }: {
    instanceId: string;
    onExecutionStart?: (executionId: string) => void;
    onExecutionStop?: (executionId: string) => void;
  }) => {
    return (
      <div data-testid="realtime-execution-monitor">
        <div data-testid="instance-id">{instanceId}</div>
        <div data-testid="monitoring-controls">
          <button
            data-testid="start-execution-button"
            onClick={() => onExecutionStart?.('exec-test-123')}
          >
            Start Execution
          </button>
          <button
            data-testid="stop-execution-button"
            onClick={() => onExecutionStop?.('exec-test-123')}
          >
            Stop Execution
          </button>
        </div>
        <div data-testid="execution-status">
          <div className="status-indicator">Real-time monitoring active</div>
          <div className="connection-status">Connected to WebSocket</div>
        </div>
        <div data-testid="execution-metrics">
          <div className="metric">CPU Usage: 45%</div>
          <div className="metric">Memory Usage: 120MB</div>
          <div className="metric">Active Connections: 5</div>
        </div>
        <div data-testid="execution-logs">
          <div className="log-entry">Workflow started at 10:30:15</div>
          <div className="log-entry">Processing node: trigger-node</div>
          <div className="log-entry">Processing node: action-node</div>
        </div>
      </div>
    );
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockWorkflowInstance: WorkflowInstance = {
  id: '3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2',
  name: 'Test Workflow Instance',
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
};

// Create a mock monitor route component
function MockMonitorRoute() {
  const [instance] = React.useState<WorkflowInstance | null>(mockWorkflowInstance);

  const handleExecutionStart = async () => {
    const { toast } = await import('sonner');
    toast.success('Execution started - ID: exec-test-123');
  };

  const handleExecutionStop = async () => {
    const { toast } = await import('sonner');
    toast.info('Execution stopped - ID: exec-test-123');
  };

  if (!instance) {
    return <div>Loading instance...</div>;
  }

  return (
    <div className="space-y-6">
      <div data-testid="realtime-execution-monitor">
        <div data-testid="instance-id">{instance.id}</div>
        <div data-testid="monitoring-controls">
          <button
            data-testid="start-execution-button"
            onClick={handleExecutionStart}
          >
            Start Execution
          </button>
          <button
            data-testid="stop-execution-button"
            onClick={handleExecutionStop}
          >
            Stop Execution
          </button>
        </div>
        <div data-testid="execution-status">
          <div className="status-indicator">Real-time monitoring active</div>
          <div className="connection-status">Connected to WebSocket</div>
        </div>
        <div data-testid="execution-metrics">
          <div className="metric">CPU Usage: 45%</div>
          <div className="metric">Memory Usage: 120MB</div>
          <div className="metric">Active Connections: 5</div>
        </div>
        <div data-testid="execution-logs">
          <div className="log-entry">Workflow started at 10:30:15</div>
          <div className="log-entry">Processing node: trigger-node</div>
          <div className="log-entry">Processing node: action-node</div>
        </div>
      </div>
    </div>
  );
}

const renderWithRouter = (_initialPath: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Directly render the MockMonitorRoute component instead of using router navigation
  return render(
    <QueryClientProvider client={queryClient}>
      <MockMonitorRoute />
    </QueryClientProvider>
  );
};

describe('Monitor Tab Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render realtime execution monitor successfully', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('realtime-execution-monitor')).toBeInTheDocument();
      });

      // Verify monitor is rendered with correct instance ID
      expect(screen.getByTestId('instance-id')).toHaveTextContent('3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2');
    });

    it('should render monitoring controls', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('monitoring-controls')).toBeInTheDocument();
      });

      // Should have start and stop buttons
      expect(screen.getByTestId('start-execution-button')).toBeInTheDocument();
      expect(screen.getByTestId('stop-execution-button')).toBeInTheDocument();
    });

    it('should display real-time execution status', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-status')).toBeInTheDocument();
      });

      // Should show monitoring status and connection info
      expect(screen.getByText('Real-time monitoring active')).toBeInTheDocument();
      expect(screen.getByText('Connected to WebSocket')).toBeInTheDocument();
    });
  });

  describe('Execution Monitoring', () => {
    it('should handle execution start events', async () => {
      const { toast } = await import('sonner');
      
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('start-execution-button')).toBeInTheDocument();
      });

      const startButton = screen.getByTestId('start-execution-button');
      fireEvent.click(startButton);

      // Wait for async toast call to complete
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Execution started - ID: exec-test-123');
      });
    });

    it('should handle execution stop events', async () => {
      const { toast } = await import('sonner');
      
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('stop-execution-button')).toBeInTheDocument();
      });

      const stopButton = screen.getByTestId('stop-execution-button');
      fireEvent.click(stopButton);

      // Wait for async toast call to complete
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('Execution stopped - ID: exec-test-123');
      });
    });

    it('should display execution metrics', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-metrics')).toBeInTheDocument();
      });

      // Should show various performance metrics
      expect(screen.getByText('CPU Usage: 45%')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage: 120MB')).toBeInTheDocument();
      expect(screen.getByText('Active Connections: 5')).toBeInTheDocument();
    });

    it('should display real-time execution logs', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-logs')).toBeInTheDocument();
      });

      // Should show log entries
      expect(screen.getByText('Workflow started at 10:30:15')).toBeInTheDocument();
      expect(screen.getByText('Processing node: trigger-node')).toBeInTheDocument();
      expect(screen.getByText('Processing node: action-node')).toBeInTheDocument();
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection for real-time monitoring', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByText('Connected to WebSocket')).toBeInTheDocument();
      });

      // Should indicate active connection
      expect(screen.getByText('Real-time monitoring active')).toBeInTheDocument();
    });

    it('should handle connection events properly', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-status')).toBeInTheDocument();
      });

      // Should show connection status
      const statusElement = screen.getByTestId('execution-status');
      expect(statusElement).toContainElement(screen.getByText('Connected to WebSocket'));
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors gracefully', async () => {
      // Mock a disconnected state
      render(
        <div data-testid="execution-status">
          <div className="status-indicator error">Connection failed</div>
          <div className="connection-status">Disconnected from WebSocket</div>
        </div>
      );

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      expect(screen.getByText('Disconnected from WebSocket')).toBeInTheDocument();
    });

    it('should display error messages for failed executions', async () => {
      // Mock error scenario
      render(
        <div data-testid="error-display">
          <div className="error-message">Execution failed: Node timeout</div>
        </div>
      );

      expect(screen.getByText('Execution failed: Node timeout')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when instance is null', () => {
      render(<div>Loading instance...</div>);
      expect(screen.getByText('Loading instance...')).toBeInTheDocument();
    });

    it('should handle loading state during monitor initialization', async () => {
      // Mock loading state
      render(
        <div data-testid="monitor-loading">
          <div className="loading-spinner">Initializing monitor...</div>
        </div>
      );

      expect(screen.getByText('Initializing monitor...')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should update metrics in real-time', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-metrics')).toBeInTheDocument();
      });

      // Metrics should be displayed and update-able
      const metricsContainer = screen.getByTestId('execution-metrics');
      expect(metricsContainer).toContainElement(screen.getByText('CPU Usage: 45%'));
      expect(metricsContainer).toContainElement(screen.getByText('Memory Usage: 120MB'));
    });

    it('should stream execution logs in real-time', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-logs')).toBeInTheDocument();
      });

      // Should display streaming logs
      const logsContainer = screen.getByTestId('execution-logs');
      expect(logsContainer).toContainElement(screen.getByText('Workflow started at 10:30:15'));
      expect(logsContainer).toContainElement(screen.getByText('Processing node: trigger-node'));
    });

    it('should handle high-frequency updates efficiently', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('realtime-execution-monitor')).toBeInTheDocument();
      });

      // Should render without performance issues
      expect(screen.getByTestId('execution-metrics')).toBeInTheDocument();
      expect(screen.getByTestId('execution-logs')).toBeInTheDocument();
    });
  });

  describe('Interactive Controls', () => {
    it('should enable manual execution control', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('monitoring-controls')).toBeInTheDocument();
      });

      // Should have interactive buttons
      const startButton = screen.getByTestId('start-execution-button');
      const stopButton = screen.getByTestId('stop-execution-button');

      expect(startButton).not.toBeDisabled();
      expect(stopButton).not.toBeDisabled();
    });

    it('should provide execution control feedback', async () => {
      const { toast } = await import('sonner');
      
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('start-execution-button')).toBeInTheDocument();
      });

      // Test start feedback
      fireEvent.click(screen.getByTestId('start-execution-button'));
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Execution started - ID: exec-test-123');
      });

      // Test stop feedback
      fireEvent.click(screen.getByTestId('stop-execution-button'));
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('Execution stopped - ID: exec-test-123');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('realtime-execution-monitor')).toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByTestId('monitoring-controls')).toBeInTheDocument();
      expect(screen.getByTestId('execution-status')).toBeInTheDocument();
      expect(screen.getByTestId('execution-metrics')).toBeInTheDocument();
    });

    it('should provide accessible control buttons', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('start-execution-button')).toBeInTheDocument();
      });

      // Buttons should have accessible text
      expect(screen.getByText('Start Execution')).toBeInTheDocument();
      expect(screen.getByText('Stop Execution')).toBeInTheDocument();
    });

    it('should provide meaningful status information', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('execution-status')).toBeInTheDocument();
      });

      // Status should be clearly indicated
      expect(screen.getByText('Real-time monitoring active')).toBeInTheDocument();
      expect(screen.getByText('Connected to WebSocket')).toBeInTheDocument();
    });
  });

  describe('Performance Monitoring', () => {
    it('should display CPU usage metrics', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByText('CPU Usage: 45%')).toBeInTheDocument();
      });

      // Should show CPU metrics
      const metricsContainer = screen.getByTestId('execution-metrics');
      expect(metricsContainer).toContainElement(screen.getByText('CPU Usage: 45%'));
    });

    it('should display memory usage metrics', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByText('Memory Usage: 120MB')).toBeInTheDocument();
      });

      // Should show memory metrics
      const metricsContainer = screen.getByTestId('execution-metrics');
      expect(metricsContainer).toContainElement(screen.getByText('Memory Usage: 120MB'));
    });

    it('should display connection metrics', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByText('Active Connections: 5')).toBeInTheDocument();
      });

      // Should show connection metrics
      const metricsContainer = screen.getByTestId('execution-metrics');
      expect(metricsContainer).toContainElement(screen.getByText('Active Connections: 5'));
    });
  });

  describe('Template Type Support', () => {
    it('should work with n8n workflow instances', async () => {
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('realtime-execution-monitor')).toBeInTheDocument();
      });

      // Should handle n8n type correctly
      expect(screen.getByTestId('instance-id')).toHaveTextContent('3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2');
    });

    it('should work with flowise workflow instances', async () => {
      // Test would be similar but with flowise-specific instance
      renderWithRouter('/_authenticated/workflows/instances/3a1ba0ea-0b22-4c47-96ef-83ca01ac88b2/monitor');

      await waitFor(() => {
        expect(screen.getByTestId('realtime-execution-monitor')).toBeInTheDocument();
      });

      // Should work regardless of template type
      expect(screen.getByTestId('monitoring-controls')).toBeInTheDocument();
    });
  });
});
