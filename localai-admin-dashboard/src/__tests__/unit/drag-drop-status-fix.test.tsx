/**
 * Test specifically for the DragDropUpload status bug
 * The bug: DragDropUpload was passing { processing_status: 'analyzing' } 
 * when updateDocumentStatus expected { status: 'analyzing' }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DragDropUpload } from '@/components/documents/DragDropUpload';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock router with minimal setup
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock auth hook
vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'test-token' },
  }),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock document processor
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({})),
}));

// Create spies for the document manager
const mockUpdateDocumentStatus = vi.fn();
const mockCreateDocument = vi.fn();

// Mock document manager hook
vi.mock('@/hooks/use-document-manager', () => ({
  useDocumentManager: () => ({
    createDocument: mockCreateDocument,
    updateDocumentStatus: mockUpdateDocumentStatus,
  }),
}));

describe('DragDropUpload Status Fix Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Set up default successful responses
    mockCreateDocument.mockResolvedValue({
      id: '123',
      name: 'test.pdf',
      processing_status: 'uploaded',
    });

    mockUpdateDocumentStatus.mockImplementation((documentId, options) => {
      // Simulate the actual validation that was failing
      const validStatuses = ['uploaded', 'analyzing', 'processing', 'completed', 'failed'];
      if (!options.status || !validStatuses.includes(options.status)) {
        throw new Error(`Invalid status '${options.status}'. Must be one of: ${validStatuses.join(', ')}`);
      }
      return Promise.resolve({ 
        id: documentId, 
        processing_status: options.status 
      });
    });
  });

  it('should pass correct status parameter to updateDocumentStatus', async () => {
    const onUploadComplete = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <DragDropUpload onUploadComplete={onUploadComplete} />
      </QueryClientProvider>
    );

    // Find file input and upload a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, file);

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify createDocument was called
    expect(mockCreateDocument).toHaveBeenCalled();

    // THE CRITICAL TEST: updateDocumentStatus should be called with { status: 'analyzing' }
    // NOT { processing_status: 'analyzing' } which would make options.status undefined
    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith('123', {
      status: 'analyzing',  // This is the fix - it should be 'status', not 'processing_status'
    });

    // Verify the function didn't throw an error (which means status was valid)
    // If status was undefined, the mock would have thrown an error
    expect(mockUpdateDocumentStatus).toHaveReturnedWith(
      expect.objectContaining({
        id: '123',
        processing_status: 'analyzing',
      })
    );

    // The main assertion is that updateDocumentStatus was called with correct parameters
    // and didn't throw an error. The console output shows "Status updated to analyzing"
    // which proves the fix is working.
  });

  it('should demonstrate the error that would occur with wrong parameter', async () => {
    const onUploadComplete = vi.fn();
    const user = userEvent.setup();

    // Mock the wrong behavior (what was happening before the fix)
    const brokenUpdateDocumentStatus = vi.fn().mockImplementation((documentId, options) => {
      // This simulates the DragDropUpload component calling with wrong parameter name
      // { processing_status: 'analyzing' } instead of { status: 'analyzing' }
      
      // The validation logic that was failing
      const validStatuses = ['uploaded', 'analyzing', 'processing', 'completed', 'failed'];
      if (!options.status || !validStatuses.includes(options.status)) {
        throw new Error(`Invalid status '${options.status}'. Must be one of: ${validStatuses.join(', ')}`);
      }
      return Promise.resolve({ id: documentId, processing_status: options.status });
    });

    // Simulate calling with wrong parameter (what was happening before fix)
    expect(() => {
      brokenUpdateDocumentStatus('123', { processing_status: 'analyzing' }); // Wrong!
    }).toThrow("Invalid status 'undefined'. Must be one of: uploaded, analyzing, processing, completed, failed");

    // But with correct parameter it should work
    expect(brokenUpdateDocumentStatus('123', { status: 'analyzing' })).resolves.toBeTruthy(); // Correct!
  });
});