/**
 * Focused Integration Test for Documents Process Route Rendering
 * 
 * This test specifically validates that the /documents/process route renders
 * the correct elements and is distinct from the /documents route.
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

// Mock all external dependencies
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn().mockReturnValue('true'),
    set: vi.fn(),
  },
}));

// Mock TanStack Router hooks that are used in components
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      history: {
        location: { href: '/documents/process' },
        go: vi.fn(),
        push: vi.fn(),
      },
      navigate: vi.fn(),
    })),
    useRouterState: vi.fn(() => ({
      status: 'idle',
      location: { pathname: '/documents/process' },
    })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

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

// Mock document template service
vi.mock('@/features/documents/services/template-service', () => ({
  DocumentTemplateService: {
    getTemplates: vi.fn().mockResolvedValue([]),
  },
}));

// Simple test wrapper that provides all necessary context
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
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
          {children}
        </SidebarProvider>
      </SearchProvider>
    </QueryClientProvider>
  );
};

describe('Documents Process Route Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render /documents/process route with DocumentProcessor elements', async () => {
    // Create router for the process route
    const history = createMemoryHistory({
      initialEntries: ['/documents/process'],
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

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    // Load the router and wait for the route to render
    await router.load();

    // Wait for the main DocumentProcessor heading
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify this is the process route, not the documents gallery
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.queryByText('Smart Document Templates')).not.toBeInTheDocument();
  });

  it('should render /documents route with DocumentsPage elements', async () => {
    // Create router for the documents route (gallery)
    const history = createMemoryHistory({
      initialEntries: ['/documents'],
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

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    // Load the router and wait for the route to render
    await router.load();

    // Wait for the main documents page heading
    await waitFor(() => {
      expect(screen.getByText('Smart Document Templates')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify this is the documents gallery, not the process route
    expect(screen.getByText('Smart Document Templates')).toBeInTheDocument();
    expect(screen.queryByText('Document Processing')).not.toBeInTheDocument();
  });

  it('should show distinct UI elements for /documents/process', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/documents/process'],
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

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify DocumentProcessor-specific elements
    expect(screen.getByText(/Using template:/)).toBeInTheDocument();
    expect(screen.getByText(/Business Proposal Template/)).toBeInTheDocument();
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
    expect(screen.getByText('← Back to Templates')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();

    // Verify file input
    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.txt,.pdf,.doc,.docx,.md');
  });

  it('should verify the route path is correctly set', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/documents/process'],
    });

    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      history,
      context: { queryClient },
    });

    // Verify the location is correct
    expect(router.state.location.pathname).toBe('/documents/process');

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    await router.load();

    // After loading, verify the route is still correct
    expect(router.state.location.pathname).toBe('/documents/process');
  });

  it('should handle navigation between routes', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/documents/process'],
    });

    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      history,
      context: { queryClient },
    });

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    await router.load();

    // Wait for the process page to load
    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Click the back button to navigate to documents
    const backButton = screen.getByRole('button', { name: /back to templates/i });
    fireEvent.click(backButton);

    // Verify navigation occurred
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documents');
    });
  });

  it('should render template information correctly', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/documents/process'],
    });

    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      history,
      context: { queryClient },
    });

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify the mock template information is displayed
    expect(screen.getByText(/Business Proposal Template/)).toBeInTheDocument();
    expect(screen.getByText(/Using template:/)).toBeInTheDocument();

    // Check that the processing pipeline is shown
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
  });

  it('should show success message area when document is generated', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/documents/process'],
    });

    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      history,
      context: { queryClient },
    });

    render(
      <TestWrapper>
        <RouterProvider router={router} />
      </TestWrapper>
    );

    await router.load();

    await waitFor(() => {
      expect(screen.getByText('Document Processing')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Initially, success message should not be visible
    expect(screen.queryByText('Document Generated Successfully!')).not.toBeInTheDocument();
    
    // The success message container should not be present initially
    const successContainer = document.querySelector('.bg-green-50');
    expect(successContainer).not.toBeInTheDocument();
  });
});
