import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocumentsPage from '@/features/documents';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';
import { VisualWorkflowEditor } from '@/components/workflows/VisualWorkflowEditor';

// Mock the template service to avoid API calls
vi.mock('@/features/documents/services/template-service', () => ({
  DocumentTemplateService: {
    getTemplates: vi.fn().mockResolvedValue([]),
  },
}));

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

// Mock the auth context
vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    isAuthenticated: true,
    loading: false,
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  },
}));

describe('Documents Routes Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('should render DocumentsPage component', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Document Automation')).toBeInTheDocument();
    });

    expect(screen.getByText('Create intelligent documents using AI-powered templates')).toBeInTheDocument();
    expect(screen.getByText('Template Gallery')).toBeInTheDocument();
    expect(screen.getByText('Generated Documents')).toBeInTheDocument();
  });

  it('should render DocumentProcessor component', async () => {
    const mockTemplate = {
      id: 1,
      uuid: 'test-uuid',
      name: 'Test Template',
      description: 'Test description',
      template_content: 'Test content',
      template_type: 'document',
      smart_variables: [],
      extraction_rules: [],
      generation_settings: {},
      category: 'test',
      tags: [],
      usage_count: 0,
      rating: 5,
      is_public: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentProcessor 
          selectedTemplate={mockTemplate}
          onGenerationComplete={vi.fn()}
          onBack={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Should render the DocumentProcessor component
      expect(screen.getByText('Document Processing Workflow')).toBeInTheDocument();
    });
  });

  it('should render VisualWorkflowEditor component', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VisualWorkflowEditor />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Should render the VisualWorkflowEditor component
      expect(screen.getByText('Visual Workflow Editor')).toBeInTheDocument();
    });
  });
});
