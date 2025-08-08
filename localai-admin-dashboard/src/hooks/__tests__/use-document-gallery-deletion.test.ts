import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocumentActions } from '../use-document-gallery';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn()
    }
  }
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('Document Deletion with Storage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('deleteDocument with complete file removal', () => {
    it('should delete both storage file and database record successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        file_path: 'user-123/document.pdf',
        name: 'test-document.pdf',
        file_size: 1024000 // 1MB
      };

      // Mock successful document fetch
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ 
        data: mockDocument, 
        error: null 
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        single: singleMock,
        delete: vi.fn().mockReturnThis()
      } as any);

      selectMock.mockReturnThis();
      eqMock.mockReturnThis();

      // Mock successful storage deletion
      const storageMock = vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null })
      });
      vi.mocked(supabase.storage.from).mockImplementation(storageMock);

      // Mock successful database deletion
      const deleteMock = vi.fn().mockReturnThis();
      const dbEqMock = vi.fn().mockResolvedValue({ error: null });
      
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'documents') {
          return {
            select: selectMock,
            eq: eqMock,
            single: singleMock,
            delete: deleteMock
          } as any;
        }
        return {} as any;
      });

      deleteMock.mockReturnValue({ eq: dbEqMock });

      const { result } = renderHook(() => useDocumentActions(), { wrapper });

      // Execute deletion
      result.current.deleteDocument('doc-123');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

      // Verify the correct order of operations
      expect(supabase.from).toHaveBeenCalledWith('documents');
      expect(selectMock).toHaveBeenCalledWith('file_path, name, file_size');
      expect(eqMock).toHaveBeenCalledWith('id', 'doc-123');
      expect(singleMock).toHaveBeenCalled();

      // Verify storage deletion was called
      expect(supabase.storage.from).toHaveBeenCalledWith('documents');
      expect(storageMock).toHaveBeenCalledWith('documents');

      // Verify database deletion was called
      expect(deleteMock).toHaveBeenCalled();

      // Verify success toast with file size info
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('test-document.pdf')
      );
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('1000 KB freed')
      );
    });

    it('should handle storage deletion failure and not delete database record', async () => {
      const mockDocument = {
        id: 'doc-123',
        file_path: 'user-123/document.pdf',
        name: 'test-document.pdf',
        file_size: 1024000
      };

      // Mock successful document fetch
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: mockDocument, 
          error: null 
        })
      } as any);

      // Mock failed storage deletion
      const storageMock = vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ 
          error: { message: 'Storage service unavailable' } 
        })
      });
      vi.mocked(supabase.storage.from).mockImplementation(storageMock);

      const { result } = renderHook(() => useDocumentActions(), { wrapper });

      // Execute deletion
      result.current.deleteDocument('doc-123');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

      // Verify error toast
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to delete document file. Please try again.'
      );

      // Verify database deletion was NOT called
      expect(supabase.from).not.toHaveBeenCalledWith('documents');
    });

    it('should handle document not found gracefully', async () => {
      // Mock document not found
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Document not found' } 
        })
      } as any);

      const { result } = renderHook(() => useDocumentActions(), { wrapper });

      // Execute deletion
      result.current.deleteDocument('non-existent-doc');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

      // Verify appropriate error message
      expect(toast.error).toHaveBeenCalledWith(
        'Document not found or already deleted'
      );
    });

    it('should handle orphaned file scenario when DB deletion fails', async () => {
      const mockDocument = {
        id: 'doc-123',
        file_path: 'user-123/document.pdf',
        name: 'test-document.pdf',
        file_size: 1024000
      };

      // Setup mocks for successful fetch and storage deletion
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ 
        data: mockDocument, 
        error: null 
      });

      // Mock successful storage deletion
      vi.mocked(supabase.storage.from).mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null })
      } as any);

      // Mock failed database deletion
      const deleteMock = vi.fn().mockReturnThis();
      const dbEqMock = vi.fn().mockResolvedValue({ 
        error: { message: 'Database constraint violation' } 
      });

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: selectMock,
        eq: eqMock,
        single: singleMock,
        delete: deleteMock
      } as any));

      deleteMock.mockReturnValue({ eq: dbEqMock });

      const { result } = renderHook(() => useDocumentActions(), { wrapper });

      // Execute deletion
      result.current.deleteDocument('doc-123');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

      // Verify critical error message
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('database cleanup failed')
      );
    });
  });
});