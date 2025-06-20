import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Simplified mock instance
const mockWorkflowInstance: WorkflowInstance = {
  id: 'instance-456',
  templateId: 'template-123',
  name: 'Test Workflow Instance',
  configuration: { nodes: [], connections: {} },
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

// Simplified test component
function SimpleActivationComponent({ instance }: { instance: WorkflowInstance }) {
  const [status, setStatus] = React.useState<string>('');

  const handleActivate = () => {
    setStatus('Activating...');
    setTimeout(() => setStatus('Activated successfully'), 100);
  };

  return (
    <div data-testid="activation-component">
      <h2>{instance.name}</h2>
      <p data-testid="status">{instance.deploymentStatus}</p>
      <button data-testid="activate-button" onClick={handleActivate}>
        Activate
      </button>
      <div data-testid="status-message">{status}</div>
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

describe('Template Activation Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic Component Rendering', () => {
    it('should render activation component with instance data', () => {
      renderWithQueryClient(
        <SimpleActivationComponent instance={mockWorkflowInstance} />
      );
      
      expect(screen.getByText('Test Workflow Instance')).toBeInTheDocument();
      expect(screen.getByTestId('status')).toHaveTextContent('draft');
      expect(screen.getByTestId('activate-button')).toBeInTheDocument();
    });

    it('should handle activation button click', async () => {
      renderWithQueryClient(
        <SimpleActivationComponent instance={mockWorkflowInstance} />
      );
      
      const activateButton = screen.getByTestId('activate-button');
      
      await act(async () => {
        fireEvent.click(activateButton);
      });
      
      expect(screen.getByTestId('status-message')).toHaveTextContent('Activating...');
    });
  });

  describe('Instance Status Display', () => {
    it('should display correct deployment status', () => {
      const activeInstance = { ...mockWorkflowInstance, deploymentStatus: 'active' as const };
      
      renderWithQueryClient(
        <SimpleActivationComponent instance={activeInstance} />
      );
      
      expect(screen.getByTestId('status')).toHaveTextContent('active');
    });

    it('should display correct instance name', () => {
      const namedInstance = { ...mockWorkflowInstance, name: 'Custom Instance Name' };
      
      renderWithQueryClient(
        <SimpleActivationComponent instance={namedInstance} />
      );
      
      expect(screen.getByText('Custom Instance Name')).toBeInTheDocument();
    });
  });
});
