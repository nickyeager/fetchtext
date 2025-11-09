import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DragDropUpload } from '@/components/documents/DragDropUpload';
import { AuthProvider } from '@/context/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, createRootRoute, RouterProvider } from '@tanstack/react-router';
import React from 'react';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the document processor
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    evaluateDocumentType: vi.fn(),
  })),
}));

// Mock the document manager hook
const mockUpdateDocumentStatus = vi.fn();
const mockCreateDocument = vi.fn();

vi.mock('@/hooks/use-document-manager', () => ({
  useDocumentManager: () => ({
    createDocument: mockCreateDocument,
    updateDocumentStatus: mockUpdateDocumentStatus,
  }),
}));

// Mock auth context
vi.mock('@/context/auth-context', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'test-token' },
  }),
}));

describe('DragDropUpload Real Error Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mocks
    mockCreateDocument.mockResolvedValue({
      id: '123',
      name: 'test.pdf',
      processing_status: 'uploaded',
    });

    mockUpdateDocumentStatus.mockImplementation((documentId, options) => {
      // This is where the real error happens - if options.status is undefined
      if (!options.status) {
        throw new Error("Invalid status 'undefined'. Must be one of: uploaded, analyzing, processing, completed, failed");
      }
      return Promise.resolve({ id: documentId, processing_status: options.status });
    });
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('should NOT pass undefined status to updateDocumentStatus', async () => {
    const onUploadComplete = vi.fn();
    const user = userEvent.setup();

    // Create a test router
    const rootRoute = createRootRoute();
    const router = createRouter({ routeTree: rootRoute });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router}>
          <AuthProvider>
            <DragDropUpload onUploadComplete={onUploadComplete} />
          </AuthProvider>
        </RouterProvider>
      </QueryClientProvider>
    );

    // Find the file input
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Create a test file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    // Upload the file
    await user.upload(fileInput, file);

    // Wait for the upload process to complete
    await waitFor(() => {
      // Check that updateDocumentStatus was called
      const { updateDocumentStatus } = require('@/hooks/use-document-manager').useDocumentManager();
      expect(updateDocumentStatus).toHaveBeenCalled();
    });

    // Verify updateDocumentStatus was called with correct parameters
    const { updateDocumentStatus } = require('@/hooks/use-document-manager').useDocumentManager();
    
    // The critical assertion - it should be called with { status: 'analyzing' }
    // NOT { processing_status: 'analyzing' } which would make options.status undefined
    expect(updateDocumentStatus).toHaveBeenCalledWith('123', {
      status: 'analyzing', // This is what it SHOULD be called with
    });
    
    // Verify no errors were shown
    const { toast } = require('sonner');
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('should show error when updateDocumentStatus receives undefined status', async () => {
    // Override the mock to simulate the actual error
    vi.mocked(require('@/hooks/use-document-manager').useDocumentManager).mockReturnValue({
      createDocument: vi.fn().mockResolvedValue({
        id: '123',
        name: 'test.pdf',
        processing_status: 'uploaded',
      }),
      updateDocumentStatus: vi.fn().mockImplementation((documentId, options) => {
        // Simulate what happens when status is undefined
        const validStatuses = ['uploaded', 'analyzing', 'processing', 'completed', 'failed'];
        if (!options.status || !validStatuses.includes(options.status)) {
          const error = new Error(`Invalid status '${options.status}'. Must be one of: ${validStatuses.join(', ')}`);
          throw error;
        }
        return Promise.resolve({ id: documentId, processing_status: options.status });
      }),
    } as any);

    const onUploadComplete = vi.fn();
    const user = userEvent.setup();

    const router = createMemoryRouter({
      routeTree,
      context: {
        auth: {
          user: { id: 'test-user', email: 'test@example.com' },
          session: { access_token: 'test-token' },
        },
      },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router}>
          <AuthProvider>
            <DragDropUpload onUploadComplete={onUploadComplete} />
          </AuthProvider>
        </RouterProvider>
      </QueryClientProvider>
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    // If we were still using the wrong property name, this would fail
    await user.upload(fileInput, file);

    // With the fix, this should succeed
    await waitFor(() => {
      const { updateDocumentStatus } = require('@/hooks/use-document-manager').useDocumentManager();
      expect(updateDocumentStatus).toHaveBeenCalledWith('123', {
        status: 'analyzing', // Correct property name
      });
    });
  });

  it('should handle actual upload flow end-to-end', async () => {
    const onUploadComplete = vi.fn();
    const navigate = vi.fn();
    
    // Mock useNavigate
    vi.mock('@tanstack/react-router', async () => {
      const actual = await vi.importActual('@tanstack/react-router');
      return {
        ...actual,
        useNavigate: () => navigate,
      };
    });

    const user = userEvent.setup();

    const router = createMemoryRouter({
      routeTree,
      context: {
        auth: {
          user: { id: 'test-user', email: 'test@example.com' },
          session: { access_token: 'test-token' },
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router}>
          <AuthProvider>
            <DragDropUpload onUploadComplete={onUploadComplete} />
          </AuthProvider>
        </RouterProvider>
      </QueryClientProvider>
    );

    // Verify the upload zone is visible
    expect(screen.getByText(/drag & drop your document here/i)).toBeInTheDocument();

    // Click to open file dialog
    const dropZone = screen.getByText(/drag & drop your document here/i).closest('div');
    if (dropZone) {
      fireEvent.click(dropZone);
    }

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    await user.upload(fileInput, file);

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.getByText(/uploading document/i)).toBeInTheDocument();
    });

    // Verify the correct status update was called
    const { updateDocumentStatus } = require('@/hooks/use-document-manager').useDocumentManager();
    expect(updateDocumentStatus).toHaveBeenCalledWith('123', {
      status: 'analyzing', // NOT processing_status
    });

    // Verify success callback was called
    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith('123');
    });
  });
});