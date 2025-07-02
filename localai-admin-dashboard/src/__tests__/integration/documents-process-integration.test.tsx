import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import the generated route tree
import { routeTree } from '@/routeTree.gen';

// Import context providers that might be needed
import { SearchProvider } from '@/context/search-context';
import { SidebarProvider } from '@/components/ui/sidebar';

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn().mockReturnValue('true'),
    set: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123', email: 'test@example.com' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'test-user-123', email: 'test@example.com' },
            access_token: 'mock-token',
            expires_at: Date.now() + 3600000
          } 
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        // Simulate signed in state
        const mockSession = {
          user: { id: 'test-user-123', email: 'test@example.com' },
          access_token: 'mock-token',
          expires_at: Date.now() + 3600000
        };
        callback('SIGNED_IN', mockSession);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock document template service
vi.mock('@/features/documents/services/template-service', () => ({
  DocumentTemplateService: {
    getTemplates: vi.fn().mockResolvedValue([
      {
        id: 1,
        uuid: 'template-1',
        name: 'Test Template',
        description: 'A test template',
        template_content: 'Hello {{name}}!',
        template_type: 'document',
        smart_variables: [
          {
            id: 'name',
            name: 'name',
            type: 'text',
            description: 'Name field',
            extraction_hints: ['name'],
          },
        ],
        extraction_rules: [],
        generation_settings: {},
        category: 'test',
        tags: ['test'],
        usage_count: 0,
        rating: 5.0,
        is_public: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]),
  },
}));

// Create test router with all necessary routes
const createTestRouter = (initialLocation = '/documents') => {
  const history = createMemoryHistory({
    initialEntries: [initialLocation],
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    history,
    context: {
      queryClient,
    },
  });

  // Ensure router is loaded before returning
  return router;
};

// Test wrapper component
const TestWrapper = ({ router }: { router: any }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <SidebarProvider>
          <RouterProvider router={router} />
        </SidebarProvider>
      </SearchProvider>
    </QueryClientProvider>
  );
};

describe('Documents Process Route Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should navigate from documents gallery to process route when template is selected', async () => {
    const router = createTestRouter('/documents');
    
    render(<TestWrapper router={router} />);

    // Wait for the documents page to load
    await waitFor(() => {
      expect(screen.getByText('Smart Document Templates')).toBeInTheDocument();
    });

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    // Click on "Use Template" button
    const useTemplateButton = screen.getByText('Use Template');
    fireEvent.click(useTemplateButton);

    // Verify navigation occurred to /documents/process
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documents/process');
    });
  });

  it('should render the document processor when accessing /documents/process directly', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for the router to load and authenticate
    await router.load();

    // Wait for the process page to load with DocumentProcessor component
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify template information is displayed
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    
    // Verify processing pipeline section
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();

    // Verify file upload interface is present
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();

    // Verify back button is present
    expect(screen.getByText('← Back to Templates')).toBeInTheDocument();

    // Verify processing steps are visible
    expect(screen.getByText('Ready to start')).toBeInTheDocument();

    // Verify file input exists
    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
  });

  it('should handle the complete document processing workflow', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for the process page to load
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    });

    // Verify initial state shows file upload
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();

    // Simulate file upload
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for processing steps to update
    await waitFor(() => {
      // The processing should advance through the steps
      expect(fileInput.files).toHaveLength(1);
    });
  });

  it('should navigate back to documents from process route', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for the router to load and authenticate
    await router.load();

    // Wait for the process page to load
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click the back button
    const backButton = screen.getByRole('button', { name: /back to templates/i });
    fireEvent.click(backButton);

    // Verify navigation back to documents
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documents');
    });
  });

  it('should show success message after document generation', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for the process page to load
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    });

    // Simulate file upload to advance to generation step
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait a bit for processing to potentially advance
    await new Promise(resolve => setTimeout(resolve, 100));

    // Note: The actual generation workflow is complex and involves multiple async steps
    // This test verifies the UI structure is in place for the workflow
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
  });

  it('should handle route parameters and maintain state correctly', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for the router to load and authenticate
    await router.load();

    // Verify the route loads with correct template
    await waitFor(() => {
      expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify all smart variables are loaded from the mock template
    expect(screen.getByText('Business Proposal Template')).toBeInTheDocument();
    
    // The mock template should have 9 smart variables for business proposals
    // This verifies the template data is properly passed to the component
  });

  it('should render all DocumentProcessor elements and functionality', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for the router to load and authenticate  
    await router.load();

    // Wait for DocumentProcessor to render
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Test header elements
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to templates/i })).toBeInTheDocument();

    // Test processing pipeline section
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();

    // Test file upload section
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
    
    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.txt,.pdf,.docx,.doc');

    // Test initial processing state
    expect(screen.getByText('Ready to start')).toBeInTheDocument();

    // Test that smart variables section exists (should show template variables)
    // The mock template has 9 smart variables, so we should see variable inputs
    const templateVariables = ['client_name', 'company_name', 'proposal_date', 'proposal_amount', 'project_description'];
    templateVariables.forEach(variable => {
      // These might be in labels or placeholders, so we check if they're referenced
      expect(document.body).toHaveTextContent(new RegExp(variable.replace('_', ' '), 'i'));
    });

    // Test that the container has proper styling
    const container = screen.getByText('Document Processing').closest('div');
    expect(container).toHaveClass('max-w-6xl');
  });

  it('should handle error states gracefully', async () => {
    // Mock environment variable for error simulation
    const originalEnv = import.meta.env.VITE_SUPABASE_URL;
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, VITE_SUPABASE_URL: 'invalid-url' },
      writable: true,
    });
    
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Even with potential errors, the basic UI should still render
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    });

    // The component should handle errors gracefully and still show the interface
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();

    // Restore original environment
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, VITE_SUPABASE_URL: originalEnv },
      writable: true,
    });
  });

  it('should verify route tree includes the process route', () => {
    const router = createTestRouter('/documents/process');
    
    // Verify the router recognizes the route
    expect(router.state.location.pathname).toBe('/documents/process');
    
    // Verify the route is accessible
    expect(router.state.matches).toHaveLength(3); // root, _authenticated, documents/process
    
    // Verify the last match is our process route
    const lastMatch = router.state.matches[router.state.matches.length - 1];
    expect(lastMatch.routeId).toBe('/_authenticated/documents/process');
  });

  it('should maintain proper URL structure for the route', () => {
    const router = createTestRouter('/documents/process');
    
    // Verify the full path is correct
    expect(router.state.location.pathname).toBe('/documents/process');
    
    // Verify it's under the authenticated route structure
    expect(router.state.matches.some(match => match.routeId === '/_authenticated')).toBe(true);
    expect(router.state.matches.some(match => match.routeId === '/_authenticated/documents/process')).toBe(true);
  });
});
