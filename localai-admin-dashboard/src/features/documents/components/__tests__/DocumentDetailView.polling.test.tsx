import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import React from 'react';

// Mock the UnifiedDocumentService
vi.mock('@/services/unified-document-service', () => ({
  UnifiedDocumentService: {
    getDocumentById: vi.fn()
  }
}));

import { UnifiedDocumentService } from '@/services/unified-document-service';

// Types
interface ProcessedDocument {
  id: string;
  processing_status?: string;
  status?: string;
  metadata?: any;
}

// Test the refetchInterval logic that's used in DocumentDetailView
const useDocumentPolling = (documentId: string) => {
  return useQuery({
    queryKey: ['processedDocument', documentId],
    queryFn: () => UnifiedDocumentService.getDocumentById(documentId),
    refetchInterval: (data: ProcessedDocument | null | undefined) => {
      // This is the FIXED logic from DocumentDetailView
      if (data === undefined || data === null) {
        console.log('⏳ Document not loaded yet, continuing to poll...');
        return 2000;
      }

      const currentStatus = data.processing_status || data.status;
      const isProcessing = currentStatus === 'analyzing' ||
                          currentStatus === 'processing' ||
                          currentStatus === 'uploading' ||
                          currentStatus === 'pending';

      if (isProcessing) {
        console.log('🔄 Continue polling - document status:', currentStatus);
        return 2000;
      }

      console.log('✅ Stop polling - document completed:', currentStatus || 'unknown');
      return false;
    },
    enabled: !!documentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

describe('DocumentDetailView Polling Behavior', () => {
  let queryClient: QueryClient;
  let consoleLogSpy: any;
  let consoleLogs: string[] = [];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchInterval: false // Disable default refetch for testing
        },
      },
    });

    consoleLogs = [];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((message) => {
      consoleLogs.push(message);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Critical Fix: Undefined Document Handling', () => {
    it('should continue polling when document data is undefined', async () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      // First call returns undefined (document not found yet)
      mockGetDocument.mockResolvedValueOnce(undefined as any);
      // Second call returns processing document
      mockGetDocument.mockResolvedValueOnce({
        id: 'test-123',
        processing_status: 'analyzing'
      } as any);
      // Third call returns completed document
      mockGetDocument.mockResolvedValueOnce({
        id: 'test-123',
        processing_status: 'completed'
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-123'), { wrapper });

      // Wait for initial fetch (undefined)
      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalledTimes(1);
      });

      // Verify polling continues with undefined data
      expect(consoleLogs).toContain('⏳ Document not loaded yet, continuing to poll...');

      // Wait for second fetch (analyzing)
      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Verify polling continues with processing status
      expect(consoleLogs.some(log => log.includes('Continue polling - document status: analyzing'))).toBe(true);

      // Wait for third fetch (completed)
      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalledTimes(3);
      }, { timeout: 3000 });

      // Verify polling stops with completed status
      expect(consoleLogs.some(log => log.includes('Stop polling - document completed: completed'))).toBe(true);
    });

    it('should continue polling when document data is null', async () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      // Return null initially
      mockGetDocument.mockResolvedValueOnce(null as any);
      mockGetDocument.mockResolvedValueOnce({
        id: 'test-null',
        processing_status: 'completed'
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-null'), { wrapper });

      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalled();
      });

      // Should continue polling with null data
      expect(consoleLogs).toContain('⏳ Document not loaded yet, continuing to poll...');
    });
  });

  describe('Processing Status Polling', () => {
    it.each([
      ['analyzing'],
      ['processing'],
      ['uploading'],
      ['pending']
    ])('should continue polling when status is %s', async (status) => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      mockGetDocument.mockResolvedValue({
        id: 'test-status',
        processing_status: status
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-status'), { wrapper });

      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalled();
      });

      // Should continue polling
      expect(consoleLogs.some(log => log.includes(`Continue polling - document status: ${status}`))).toBe(true);
    });

    it.each([
      ['completed'],
      ['failed'],
      ['error']
    ])('should stop polling when status is %s', async (status) => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      mockGetDocument.mockResolvedValue({
        id: 'test-stop',
        processing_status: status
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-stop'), { wrapper });

      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalled();
      });

      // Should stop polling
      expect(consoleLogs.some(log => log.includes(`Stop polling - document completed: ${status}`))).toBe(true);
    });
  });

  describe('Fallback Status Field', () => {
    it('should use status field when processing_status is undefined', async () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      mockGetDocument.mockResolvedValue({
        id: 'test-fallback',
        status: 'analyzing', // Only status field, no processing_status
        processing_status: undefined
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-fallback'), { wrapper });

      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalled();
      });

      // Should use status field as fallback
      expect(consoleLogs.some(log => log.includes('Continue polling - document status: analyzing'))).toBe(true);
    });

    it('should prefer processing_status over status when both exist', async () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      mockGetDocument.mockResolvedValue({
        id: 'test-both',
        processing_status: 'processing',
        status: 'completed' // Different value in status field
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-both'), { wrapper });

      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalled();
      });

      // Should use processing_status (processing) not status (completed)
      expect(consoleLogs.some(log => log.includes('Continue polling - document status: processing'))).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      // Fail twice, then succeed
      mockGetDocument
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          id: 'test-retry',
          processing_status: 'completed'
        } as any);

      // Create query client with retry enabled
      const retryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={retryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-retry'), { wrapper });

      // Wait for retries to complete
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      }, { timeout: 5000 });

      // Should have called 3 times (2 failures + 1 success)
      expect(mockGetDocument).toHaveBeenCalledTimes(3);
      expect(result.current.data?.id).toBe('test-retry');
    });
  });

  describe('Edge Cases', () => {
    it('should handle document with no status fields gracefully', async () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      mockGetDocument.mockResolvedValue({
        id: 'test-no-status',
        // No processing_status or status fields
      } as any);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling('test-no-status'), { wrapper });

      await waitFor(() => {
        expect(mockGetDocument).toHaveBeenCalled();
      });

      // Should stop polling when no status
      expect(consoleLogs.some(log => log.includes('Stop polling - document completed: unknown'))).toBe(true);
    });

    it('should not poll when documentId is empty', () => {
      const mockGetDocument = vi.mocked(UnifiedDocumentService.getDocumentById);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDocumentPolling(''), { wrapper });

      // Should not call API when documentId is empty
      expect(mockGetDocument).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });
});