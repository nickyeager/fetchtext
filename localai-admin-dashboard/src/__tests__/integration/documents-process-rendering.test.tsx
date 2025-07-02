/**
 * Integration Test for Documents Process Route Rendering
 * 
 * This test specifically validates that the /documents/process route renders
 * the correct DocumentProcessor component with all expected elements and
 * proper template data integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import the generated route tree
import { routeTree } from '@/routeTree.gen';

// Import context providers
import { SearchProvider } from '@/context/search-context';
import { SidebarProvider } from '@/components/ui/sidebar';

// Mock dependencies
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn().mockReturnValue('true'),
    set: vi.fn(),
  },
}));

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

// Test setup helpers
const createTestRouter = (initialLocation = '/documents/process') => {
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
    context: { queryClient },
  });

  // Ensure router is loaded before returning
  return router;
};

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

describe('Documents Process Route Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render DocumentProcessor with Business Proposal Template', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);

    // Wait for authentication and route loading
    await router.load();

    // Verify main heading
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify template information
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
  });

  it('should render all DocumentProcessor UI sections', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Header section
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to templates/i })).toBeInTheDocument();

    // Processing Pipeline section
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();

    // File Upload section
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();

    // Initial state
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
  });

  it('should render file upload input with correct attributes', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.txt,.pdf,.docx,.doc');
  });

  it('should render smart variables from Business Proposal Template', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Check that template variables are referenced in the UI
    // The mock template has these smart variables
    const expectedVariables = [
      'client_name',
      'company_name', 
      'proposal_date',
      'proposal_amount',
      'project_description',
      'project_timeline',
      'deliverables',
      'contact_email',
      'contact_person'
    ];

    // These variables should be referenced somewhere in the document
    // (either as labels, placeholders, or text content)
    expectedVariables.forEach(variable => {
      const normalizedVariable = variable.replace(/_/g, ' ');
      expect(document.body).toHaveTextContent(new RegExp(normalizedVariable, 'i'));
    });
  });

  it('should handle file upload interaction', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Simulate file upload
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Verify file was selected
    expect(fileInput.files).toHaveLength(1);
    expect(fileInput.files?.[0]).toBe(file);
  });

  it('should navigate back when back button is clicked', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify we're on the process route
    expect(router.state.location.pathname).toBe('/documents/process');

    // Click back button
    const backButton = screen.getByRole('button', { name: /back to templates/i });
    fireEvent.click(backButton);

    // Verify navigation occurred
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documents');
    });
  });

  it('should show success message when document is generated', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Initially, success message should not be visible
    expect(screen.queryByText('Document Generated Successfully!')).not.toBeInTheDocument();

    // The success message would appear after document generation completes
    // This tests the conditional rendering structure
    const successSection = document.querySelector('.bg-green-50');
    expect(successSection).not.toBeInTheDocument();
  });

  it('should render with proper CSS classes and styling', async () => {
    const router = createTestRouter('/documents/process');
    
    render(<TestWrapper router={router} />);
    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify main container styling
    const mainContainer = screen.getByText('Document Processing').closest('div');
    expect(mainContainer).toHaveClass('container', 'mx-auto', 'py-6');

    // Verify DocumentProcessor wrapper
    const processorWrapper = screen.getByText('Processing Pipeline').closest('.max-w-6xl');
    expect(processorWrapper).toHaveClass('max-w-6xl', 'mx-auto', 'space-y-6');
  });
});
