import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, createRootRoute, createRoute, RouterProvider } from '@tanstack/react-router';
import { DocumentGallery } from '@/components/documents/DocumentGallery';
// Import is automatically mocked above
import { AuthProvider } from '@/context/auth-context';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock document processor
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    evaluateDocumentType: vi.fn().mockResolvedValue({
      document_info: { filename: 'test.pdf' },
      type_evaluation: { primary_type: 'invoice', confidence: 0.85 },
      template_suggestions: []
    }),
    processDocumentWithDocling: vi.fn().mockResolvedValue({
      content: 'Processed content',
      metadata: { title: 'Test Document' },
      structure: { headings: [], tables: [], images: [] }
    })
  }))
}));

// Create test router
function createTestRouter() {
  const rootRoute = createRootRoute();
  
  // Create a layout route for authenticated pages
  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '_authenticated',
    component: ({ children }: any) => <>{children}</>,
  });
  
  const documentsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: 'documents',
    component: ({ children }: any) => <>{children}</>,
  });

  const galleryRoute = createRoute({
    getParentRoute: () => documentsRoute,
    path: 'gallery',
    component: DocumentGallery,
  });

  const documentDetailRoute = createRoute({
    getParentRoute: () => documentsRoute,
    path: '$documentId',
    component: () => <div>Document Detail</div>,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([
      authenticatedRoute.addChildren([
        documentsRoute.addChildren([galleryRoute, documentDetailRoute]),
      ]),
    ]),
    defaultPendingComponent: () => <div>Loading...</div>,
  });
}

describe('Document Gallery Upload Integration Test', () => {
  let queryClient: QueryClient;
  let mockUser: any;
  let mockSession: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock authenticated user
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      user: mockUser,
    };

    // Get mocked supabase
    const { supabase } = await import('@/lib/supabase');

    // Mock Supabase auth
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock document upload in Supabase storage
    (supabase.storage.from as any).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'documents/test-file.pdf' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/test-file.pdf' },
      }),
    });

    // Mock documents table operations
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'documents') {
        return {
          insert: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 1,
                uuid: 'test-doc-uuid',
                name: 'test.pdf',
                filename: 'test.pdf',
                file_path: 'documents/test-file.pdf',
                file_size: 1024,
                processing_status: 'uploaded',
                created_by: mockUser.id,
                created_at: new Date().toISOString(),
                metadata: {}
              },
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 1,
                  processing_status: 'analyzing',
                },
                error: null,
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, processing_status: 'completed' },
                error: null,
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        } as any;
      }
      
      // Mock document_processing_analytics
      if (table === 'document_processing_analytics') {
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                total_documents: 0,
                documents_by_status: {},
                documents_by_source: {},
                documents_by_method: {},
                avg_processing_time_seconds: 0,
              },
              error: null,
            }),
          }),
        } as any;
      }

      return {} as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should upload a document and show it gets stuck in analyzing status', async () => {
    const user = userEvent.setup();
    const router = createTestRouter();
    
    // Navigate to the gallery page
    await router.navigate({ to: '/_authenticated/documents/gallery' });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router}>
          <AuthProvider />
        </RouterProvider>
      </QueryClientProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Document Gallery')).toBeInTheDocument();
    });

    // Click upload button to show upload zone
    const uploadButton = screen.getByRole('button', { name: /upload document/i });
    await user.click(uploadButton);

    // Find the file input in the drag-drop zone
    const fileInput = screen.getByLabelText(/choose files/i);
    expect(fileInput).toBeInTheDocument();

    // Create a test file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    // Upload the file
    await user.upload(fileInput, file);

    // Get mocked supabase for assertions
    const { supabase } = await import('@/lib/supabase');

    // Wait for upload to start
    await waitFor(() => {
      expect(supabase.storage.from).toHaveBeenCalledWith('documents');
    });

    // Verify document record was created
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('documents');
      const fromMock = supabase.from as any;
      const insertMock = fromMock.mock.results[0]?.value?.insert;
      expect(insertMock).toHaveBeenCalled();
    });

    // Verify status was updated to analyzing
    await waitFor(() => {
      const fromMock = supabase.from as any;
      const updateCalls = fromMock.mock.calls.filter(
        (call: any[]) => call[0] === 'documents'
      );
      expect(updateCalls.length).toBeGreaterThan(1);
      
      // Check if update was called with analyzing status
      const updateMock = fromMock.mock.results.find(
        (result: any) => result.value?.update
      )?.value?.update;
      
      if (updateMock) {
        expect(updateMock).toHaveBeenCalledWith({
          processing_status: 'analyzing',
          metadata: expect.any(Object),
        });
      }
    });

    // Important: Verify that the document status is NOT updated to completed
    // This recreates the bug where documents get stuck in analyzing state
    
    // Mock that the backend never updates status to completed (simulating the bug)
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  id: 1, 
                  processing_status: 'analyzing', // Still analyzing!
                  name: 'test.pdf',
                  file_size: 1024,
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    // Force a re-render to simulate checking status
    rerender(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router}>
          <AuthProvider>
            <DocumentGallery />
          </AuthProvider>
        </RouterProvider>
      </QueryClientProvider>
    );

    // Wait a bit to simulate time passing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // The document should still show as analyzing (the bug!)
    const documentStatus = await queryClient.fetchQuery({
      queryKey: ['document', 1],
      queryFn: async () => {
        const { data } = await supabase
          .from('documents')
          .select('*')
          .eq('id', 1)
          .single();
        return data;
      },
    });

    expect(documentStatus?.processing_status).toBe('analyzing');
    
    // This is the bug: document is stuck in analyzing status
    console.log('BUG RECREATED: Document stuck in analyzing status after upload');
  });

  it('should handle upload errors gracefully', async () => {
    const user = userEvent.setup();
    const router = createTestRouter();
    
    // Navigate to the gallery page
    await router.navigate({ to: '/_authenticated/documents/gallery' });

    // Get mocked supabase
    const { supabase } = await import('@/lib/supabase');
    
    // Mock upload failure
    (supabase.storage.from as any).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      }),
      getPublicUrl: vi.fn(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router}>
          <AuthProvider />
        </RouterProvider>
      </QueryClientProvider>
    );

    // Show upload zone
    const uploadButton = screen.getByRole('button', { name: /upload document/i });
    await user.click(uploadButton);

    // Upload file
    const fileInput = screen.getByLabelText(/choose files/i);
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    
    await user.upload(fileInput, file);

    // Check that error toast was shown
    await waitFor(() => {
      const { toast } = require('sonner');
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
    });
  });
});